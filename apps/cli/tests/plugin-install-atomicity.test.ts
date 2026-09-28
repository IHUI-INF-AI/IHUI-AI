// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getPluginInstallPath, getRegistryPath } from '../src/plugins/paths.js';
import { isUsableDirectoryCopy, supersededPathFor, swapScratchMarkers, DirectorySwapError, PluginSwapCancelledError } from '../src/plugins/cache.js';
import {
  PluginPathUnsafeError,
  installMarketplacePlugin,
  installPlugin,
  loadInstallRegistry,
  type InstallRegistry,
} from '../src/plugins/installer.js';

/**
 * 插件安装的「提交点」对账:覆盖安装/复制失败/取消都不得先删掉最后可用副本。
 *
 * 钉的实测缺陷(2026-09-28):`installLocal` 与 `installGit` 都是
 * `if (existsSync(dest)) rmSync(dest)` 之后才 `copyDirRecursive(...)` ——
 * 复制失败或被取消时,旧副本已经没了,用户侧表现是"插件突然没了"。
 *
 * 测试口径:走生产入口(`installPlugin` / `installMarketplacePlugin`),
 * "可用副本"只用生产导出的 `isUsableDirectoryCopy()`,失败注入自带阳性对照。
 */

const HOME_ENV = 'IHUI_HOME';
const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';

let tmpHome: string;
let tmpCwd: string;
let tmpRepo: string;
let originalCwd: string;
let savedHome: string | undefined;
let savedMock: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('plugin-install-home-');
  tmpCwd = mkScratch('plugin-install-cwd-');
  tmpRepo = mkScratch('plugin-install-repo-');
  originalCwd = process.cwd();
  savedHome = process.env[HOME_ENV];
  savedMock = process.env[MOCK_CLONE_SRC_ENV];
  process.env[HOME_ENV] = tmpHome;
  delete process.env[MOCK_CLONE_SRC_ENV];
});

afterEach(() => {
  process.chdir(originalCwd);
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  if (savedMock !== undefined) process.env[MOCK_CLONE_SRC_ENV] = savedMock;
  else delete process.env[MOCK_CLONE_SRC_ENV];
  rmScratch(tmpRepo);
  rmScratch(tmpCwd);
  rmScratch(tmpHome);
});

// ==================== 夹具助手 ====================

/** 在 cwd 下写一个可安装的本地插件源 */
function writeLocalPlugin(relDir: string, manifest: { name: string; version: string }, extra?: Record<string, string>): string {
  const dir = path.join(tmpCwd, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest), 'utf-8');
  for (const [name, content] of Object.entries(extra ?? {})) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
  }
  return dir;
}

/** 交换残留:暂存/归档目录在成功路径上一律不应存在 */
function leftoverSwapScratch(): string[] {
  if (!fs.existsSync(getInstalledPluginsDir())) return [];
  const markers = swapScratchMarkers();
  return fs.readdirSync(getInstalledPluginsDir()).filter(
    (n) => n.includes(markers.staging) || n.includes(markers.superseded),
  );
}

/** 原子写出口留下的 tmp 文件(成功落盘后不应存在) */
function leftoverRegistryTmp(): string[] {
  const dir = path.dirname(getRegistryPath());
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
}

function readRegistry(): InstallRegistry {
  return loadInstallRegistry();
}

/** 阳性对照:证明"目录改名到已存在目录"在这台机上真会失败(否则注入是空支票) */
function assertRenameOntoExistingDirFailsHere(blockerDir: string): void {
  const probe = path.join(path.dirname(blockerDir), `.probe-${process.pid}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(probe, { recursive: true });
  fs.writeFileSync(path.join(probe, 'probe.txt'), 'probe', 'utf-8');
  try {
    expect(() => fs.renameSync(probe, blockerDir)).toThrow();
    expect(fs.existsSync(path.join(probe, 'probe.txt'))).toBe(true);
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}

/** 建一份占住归档槽位的非空目录,返回其路径 */
function occupySupersededSlot(dest: string): string {
  const blocker = supersededPathFor(dest);
  fs.mkdirSync(path.join(blocker, 'occupied'), { recursive: true });
  fs.writeFileSync(path.join(blocker, 'occupied', 'keep.txt'), 'not-mine', 'utf-8');
  return blocker;
}

/** 当前环境能否创建目录符号链接(Windows 走 junction) */
const canSymlink = (() => {
  let probe: string | null = null;
  try {
    probe = mkScratch('plugin-install-symlink-cap-');
    const inner = path.join(probe, 'target');
    fs.mkdirSync(inner, { recursive: true });
    fs.symlinkSync(inner, path.join(probe, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    return fs.lstatSync(path.join(probe, 'link')).isSymbolicLink();
  } catch {
    return false;
  } finally {
    if (probe) rmScratch(probe);
  }
})();

// ==================== 本地路径安装 ====================

describe('installPlugin(local) — 提交点之前不得破坏现状', () => {
  it('② 正常安装:文件可用、registry 落盘、不留交换残留与原子写 tmp', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('plug', { name: 'p-ok', version: '1.0.0' }, { 'marker.txt': 'v1' });

    const outcome = await installPlugin('./plug');

    expect(outcome.wasInstalled).toBe(false);
    expect(outcome.installedPath).toBe(getPluginInstallPath('p-ok'));
    expect(isUsableDirectoryCopy(outcome.installedPath)).toBe(true);
    expect(fs.readFileSync(path.join(outcome.installedPath, 'marker.txt'), 'utf-8')).toBe('v1');
    expect(readRegistry().records.some((r) => r.name === 'p-ok')).toBe(true);
    expect(leftoverSwapScratch()).toEqual([]);
    expect(leftoverRegistryTmp()).toEqual([]);
  });

  it('① 注入 rename 失败(覆盖安装):旧副本仍在位,registry 不被追加,临时物自清', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('v1', { name: 'p-block', version: '1.0.0' }, { 'marker.txt': 'v1' });
    await installPlugin('./v1');
    const dest = getPluginInstallPath('p-block');

    // 换一个源目录(同插件名)以避开"已装短路",逼它真的走覆盖
    writeLocalPlugin('v2', { name: 'p-block', version: '2.0.0' }, { 'marker.txt': 'v2' });
    const blocker = occupySupersededSlot(dest);
    assertRenameOntoExistingDirFailsHere(blocker);

    let resolved: unknown = null;
    let thrown: unknown = null;
    try {
      resolved = await installPlugin('./v2');
    } catch (e) {
      thrown = e;
    }

    expect(resolved).toBeNull();
    expect(thrown).toBeInstanceOf(DirectorySwapError);
    // 最后可用副本仍在位,内容一字未变
    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');
    expect(fs.readFileSync(path.join(dest, 'plugin.json'), 'utf-8')).toContain('1.0.0');
    // 失败路径不写记录(不出现"记录说装了 2.0.0 而盘上还是 v1")
    const versions = readRegistry()
      .records.filter((r) => r.name === 'p-block')
      .map((r) => r.version);
    expect(versions).toEqual(['1.0.0']);
    // 临时物自清;那份占位归档一根手指都没碰
    expect(leftoverSwapScratch().filter((n) => !n.includes('.superseded-'))).toEqual([]);
    expect(fs.readFileSync(path.join(blocker, 'occupied', 'keep.txt'), 'utf-8')).toBe('not-mine');
  });

  it('③ 取消在提交点之前:抛 PluginSwapCancelledError,旧副本与 registry 一律不变', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('v1', { name: 'p-cancel', version: '1.0.0' }, { 'marker.txt': 'v1' });
    await installPlugin('./v1');
    const dest = getPluginInstallPath('p-cancel');

    writeLocalPlugin('v2', { name: 'p-cancel', version: '2.0.0' }, { 'marker.txt': 'v2' });
    const controller = new AbortController();
    controller.abort();

    await expect(installPlugin('./v2', { signal: controller.signal })).rejects.toBeInstanceOf(
      PluginSwapCancelledError,
    );

    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');
    const versions = readRegistry()
      .records.filter((r) => r.name === 'p-cancel')
      .map((r) => r.version);
    expect(versions).toEqual(['1.0.0']);
    expect(leftoverSwapScratch()).toEqual([]);
  });

  it('④ 取消在提交点之后:已生效的新副本不回退', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('v1', { name: 'p-late', version: '1.0.0' }, { 'marker.txt': 'v1' });
    await installPlugin('./v1');
    writeLocalPlugin('v2', { name: 'p-late', version: '2.0.0' }, { 'marker.txt': 'v2' });

    const controller = new AbortController();
    const outcome = await installPlugin('./v2', { signal: controller.signal });
    expect(outcome.wasInstalled).toBe(false);

    controller.abort();
    const dest = getPluginInstallPath('p-late');
    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v2');
    expect(readRegistry().records.filter((r) => r.name === 'p-late').map((r) => r.version)).toEqual([
      '1.0.0',
      '2.0.0',
    ]);
  });

  it('复制失败(符号链接逃逸):旧副本仍在位,不留交换残留', { skip: !canSymlink }, async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('v1', { name: 'p-copyfail', version: '1.0.0' }, { 'marker.txt': 'v1' });
    await installPlugin('./v1');
    const dest = getPluginInstallPath('p-copyfail');

    // v2 源里放一个指向源树之外的符号链接 ⇒ copyDirRecursive 抛 PluginPathUnsafeError
    writeLocalPlugin('v2', { name: 'p-copyfail', version: '2.0.0' });
    const outside = path.join(tmpRepo, 'outside-target');
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(tmpCwd, 'v2', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');

    await expect(installPlugin('./v2')).rejects.toBeInstanceOf(PluginPathUnsafeError);

    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');
    expect(readRegistry().records.filter((r) => r.name === 'p-copyfail').map((r) => r.version)).toEqual(['1.0.0']);
    expect(leftoverSwapScratch()).toEqual([]);
  });

  it('记录在而安装目录被掏空:不得把"空目录"报成已装(可用性判据只有一份)', async () => {
    process.chdir(tmpCwd);
    writeLocalPlugin('plug', { name: 'p-empty', version: '1.0.0' }, { 'marker.txt': 'v1' });
    const outcome = await installPlugin('./plug');
    const dest = outcome.installedPath;

    // 模拟"插件目录被清空但记录还在":按 existsSync 判会短路成 wasInstalled:true
    for (const entry of fs.readdirSync(dest)) fs.rmSync(path.join(dest, entry), { recursive: true, force: true });
    expect(isUsableDirectoryCopy(dest)).toBe(false);

    const again = await installPlugin('./plug');

    expect(again.wasInstalled).toBe(false);
    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('v1');
  });
});

// ==================== Git URL 安装(同一提交序列) ====================

describe('installPlugin(git:url) — 与 local 共用同一份提交实现', () => {
  it('② 正常安装:从缓存落到安装目录,不留交换残留', async () => {
    fs.writeFileSync(
      path.join(tmpRepo, 'plugin.json'),
      JSON.stringify({ name: 'g-ok', version: '1.0.0' }),
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpRepo, 'marker.txt'), 'g1', 'utf-8');
    process.env[MOCK_CLONE_SRC_ENV] = tmpRepo;

    const outcome = await installPlugin('https://example.test/g-ok.git');

    expect(outcome.source).toBe('git:url');
    expect(isUsableDirectoryCopy(outcome.installedPath)).toBe(true);
    expect(fs.readFileSync(path.join(outcome.installedPath, 'marker.txt'), 'utf-8')).toBe('g1');
    expect(leftoverSwapScratch()).toEqual([]);
  });

  it('① 注入 rename 失败(覆盖安装):旧副本仍在位,新副本不落安装目录', async () => {
    fs.writeFileSync(
      path.join(tmpRepo, 'plugin.json'),
      JSON.stringify({ name: 'g-block', version: '1.0.0' }),
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpRepo, 'marker.txt'), 'g1', 'utf-8');
    process.env[MOCK_CLONE_SRC_ENV] = tmpRepo;
    await installPlugin('https://example.test/g-block-v1.git');
    const dest = getPluginInstallPath('g-block');

    // 换一个 URL(同插件名)绕开"已装短路",并占住安装目录的归档槽位
    fs.writeFileSync(path.join(tmpRepo, 'plugin.json'), JSON.stringify({ name: 'g-block', version: '2.0.0' }), 'utf-8');
    fs.writeFileSync(path.join(tmpRepo, 'marker.txt'), 'g2', 'utf-8');
    const blocker = occupySupersededSlot(dest);
    assertRenameOntoExistingDirFailsHere(blocker);

    let resolved: unknown = null;
    let thrown: unknown = null;
    try {
      resolved = await installPlugin('https://example.test/g-block-v2.git');
    } catch (e) {
      thrown = e;
    }

    expect(resolved).toBeNull();
    expect(thrown).toBeInstanceOf(DirectorySwapError);
    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('g1');
    expect(leftoverSwapScratch().filter((n) => !n.includes('.superseded-'))).toEqual([]);
  });

  it('③ 取消在提交点之前:安装目录一步没动', async () => {
    fs.writeFileSync(
      path.join(tmpRepo, 'plugin.json'),
      JSON.stringify({ name: 'g-cancel', version: '1.0.0' }),
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpRepo, 'marker.txt'), 'g1', 'utf-8');
    process.env[MOCK_CLONE_SRC_ENV] = tmpRepo;
    await installPlugin('https://example.test/g-cancel-v1.git');
    const dest = getPluginInstallPath('g-cancel');

    fs.writeFileSync(path.join(tmpRepo, 'marker.txt'), 'g2', 'utf-8');
    const controller = new AbortController();
    controller.abort();

    await expect(installPlugin('https://example.test/g-cancel-v2.git', { signal: controller.signal })).rejects.toBeInstanceOf(
      PluginSwapCancelledError,
    );

    expect(isUsableDirectoryCopy(dest)).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'marker.txt'), 'utf-8')).toBe('g1');
    expect(leftoverSwapScratch()).toEqual([]);
  });
});

// ==================== marketplace 入口(取消通道贯穿) ====================

describe('installMarketplacePlugin — 取消通道贯穿到同一条提交序列', () => {
  function makeMarketplace(): string {
    const root = path.join(tmpCwd, 'mp');
    fs.mkdirSync(path.join(root, '.ihui-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.ihui-plugin', 'marketplace.json'),
      JSON.stringify({
        name: 'test-mp',
        owner: { name: 'tester' },
        plugins: [{ name: 'mp-p', version: '1.0.0', source: './plugins/mp-p' }],
      }),
    );
    const src = path.join(root, 'plugins', 'mp-p');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'plugin.json'), JSON.stringify({ name: 'mp-p', version: '1.0.0' }), 'utf-8');
    fs.writeFileSync(path.join(src, 'marker.txt'), 'mp1', 'utf-8');
    return root;
  }

  it('② 正常安装成功且不留残留', async () => {
    const root = makeMarketplace();
    const outcome = await installMarketplacePlugin('mp-p', root);
    expect(outcome.name).toBe('mp-p');
    expect(isUsableDirectoryCopy(outcome.installedPath)).toBe(true);
    expect(leftoverSwapScratch()).toEqual([]);
  });

  it('③ 取消在提交点之前:安装目录不存在且不留残留', async () => {
    const root = makeMarketplace();
    const controller = new AbortController();
    controller.abort();

    await expect(installMarketplacePlugin('mp-p', root, undefined, { signal: controller.signal })).rejects.toBeInstanceOf(
      PluginSwapCancelledError,
    );

    expect(fs.existsSync(getPluginInstallPath('mp-p'))).toBe(false);
    expect(leftoverSwapScratch()).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
