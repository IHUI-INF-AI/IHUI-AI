// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getMarketplaceCacheDir } from '../src/plugins/paths.js';
import {
  DirectorySwapError,
  PluginSwapCancelledError,
  commitStagedSwap,
  finalizeStagedSwap,
  getCachePath,
  getOrCloneGitCache,
  isUsableDirectoryCopy,
  landStagedSwap,
  prepareStagingDirectory,
  supersededPathFor,
  swapMarkerName,
  swapScratchMarkers,
  takeOwnershipOfTarget,
} from '../src/plugins/cache.js';

/**
 * 插件缓存的「提交点」与回滚对账。
 *
 * 钉的是实测缺陷(2026-09-28):旧实现在 `rmSync(localPath)` 与 `renameSync(tmp, localPath)`
 * 之间留着一个真实的目标缺失窗口,而 `catch` 在这种情况下直接回 `fromCache:true`
 * ("离线降级:复用过期缓存")—— 复用的正是刚被自己删掉的那个目录。
 *
 * 测试口径:
 *   - 一律走生产导出的入口(`getOrCloneGitCache` / `commitStagedSwap` 及其分步原语);
 *   - "是否可用副本"只用生产的 `isUsableDirectoryCopy()`,测试里不内联第二份判定;
 *   - 每一处失败注入都自带阳性对照(先证明这个形态在这台机上真会失败),
 *     否则注入就是一张空支票。
 */

const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';
const GIT_BIN_ENV = 'IHUI_GIT_BIN';
const HOME_ENV = 'IHUI_HOME';

let tmpHome: string;
let tmpMockSrc: string;
let savedHome: string | undefined;
let savedMock: string | undefined;
let savedGitBin: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('plugin-cache-home-');
  tmpMockSrc = mkScratch('plugin-cache-mock-');
  savedHome = process.env[HOME_ENV];
  savedMock = process.env[MOCK_CLONE_SRC_ENV];
  savedGitBin = process.env[GIT_BIN_ENV];
  process.env[HOME_ENV] = tmpHome;
  delete process.env[MOCK_CLONE_SRC_ENV];
  delete process.env[GIT_BIN_ENV];
});

afterEach(() => {
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  if (savedMock !== undefined) process.env[MOCK_CLONE_SRC_ENV] = savedMock;
  else delete process.env[MOCK_CLONE_SRC_ENV];
  if (savedGitBin !== undefined) process.env[GIT_BIN_ENV] = savedGitBin;
  else delete process.env[GIT_BIN_ENV];
  rmScratch(tmpMockSrc);
  rmScratch(tmpHome);
});

// ==================== 夹具助手 ====================

/** 造一份"已经过期"的缓存目录(内容 + 旧 mtime) */
function seedExpiredCache(url: string, files: Record<string, string>, ageMs = 60 * 60 * 1000): string {
  const p = getCachePath(url);
  fs.mkdirSync(p, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(p, name), content, 'utf-8');
  }
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(p, t, t);
  return p;
}

/** 把 mock clone 源写成指定内容(测试钩子IHUI_MOCK_GIT_CLONE_SRC 会把它当 clone 结果) */
function writeMockCloneSrc(files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpMockSrc, name), content, 'utf-8');
  }
  process.env[MOCK_CLONE_SRC_ENV] = tmpMockSrc;
}

/** 缓存根里遗留的在途暂存目录(交换成功后必须为空) */
function leftoverStaging(parent: string): string[] {
  if (!fs.existsSync(parent)) return [];
  const markers = swapScratchMarkers();
  return fs.readdirSync(parent).filter((n) => n.includes(markers.staging));
}

/** 缓存根里遗留的旧副本归档(成功提交后 finalize 应把它清掉) */
function leftoverSuperseded(parent: string): string[] {
  if (!fs.existsSync(parent)) return [];
  const markers = swapScratchMarkers();
  return fs.readdirSync(parent).filter((n) => n.includes(markers.superseded));
}

/**
 * 阳性对照:证明"把一个目录改名到一个已存在的目录"在这台机上真的失败。
 * 没有这一步,失败注入可能什么都没注入,而两条断言照样绿(本仓记过"注入未命中
 * 而两臂都报 0"那一型)。
 */
function assertRenameOntoExistingDirFailsHere(blockerDir: string): void {
  const probe = path.join(path.dirname(blockerDir), `.probe-src-${process.pid}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(probe, { recursive: true });
  fs.writeFileSync(path.join(probe, 'probe.txt'), 'probe', 'utf-8');
  try {
    expect(() => fs.renameSync(probe, blockerDir)).toThrow();
    // 失败注入成立 ⇒ 源目录必须还在(注入本身也不得破坏现状)
    expect(fs.existsSync(path.join(probe, 'probe.txt'))).toBe(true);
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}

// ==================== 入口级:getOrCloneGitCache ====================

describe('getOrCloneGitCache — 提交点与降级判据', () => {
  it('② 一切正常:新副本落位、fromCache=false、旧副本被承接后不留暂存/归档', async () => {
    const url = 'https://example.test/ok-refresh.git';
    const cachePath = seedExpiredCache(url, { 'old-marker.txt': 'old' });
    writeMockCloneSrc({ 'new-marker.txt': 'new' });

    const result = await getOrCloneGitCache(url, { ttlMs: 1000 });

    expect(result.fromCache).toBe(false);
    expect(result.localPath).toBe(cachePath);
    expect(isUsableDirectoryCopy(cachePath)).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'new-marker.txt'))).toBe(true);
    // 旧内容被替换掉(不是被留在原地当"可用副本")
    expect(fs.existsSync(path.join(cachePath, 'old-marker.txt'))).toBe(false);
    // 提交点之后不留任何在途物
    const root = getMarketplaceCacheDir();
    expect(leftoverStaging(root)).toEqual([]);
    expect(leftoverSuperseded(root)).toEqual([]);
  });

  it('① 注入 rename 失败(连所有权都没拿到):旧副本仍在位,且绝不返回 fromCache:true', async () => {
    const url = 'https://example.test/rename-fail.git';
    const cachePath = seedExpiredCache(url, { 'old-marker.txt': 'old' });
    writeMockCloneSrc({ 'new-marker.txt': 'new' });

    // 注入:旧副本归档槽位被一份非空目录占住 ⇒ 提交点第一步的 rename 必失败
    const blocker = supersededPathFor(cachePath);
    fs.mkdirSync(path.join(blocker, 'occupied'), { recursive: true });
    fs.writeFileSync(path.join(blocker, 'occupied', 'keep.txt'), 'not-mine', 'utf-8');
    assertRenameOntoExistingDirFailsHere(blocker);

    let resolved: unknown = null;
    let thrown: unknown = null;
    try {
      resolved = await getOrCloneGitCache(url, { ttlMs: 1000 });
    } catch (e) {
      thrown = e;
    }

    // 失败路径不得伪报成功(旧实现在这里回的就是 fromCache:true)
    expect(resolved).toBeNull();
    expect(thrown).toBeInstanceOf(DirectorySwapError);
    if (thrown instanceof DirectorySwapError) {
      expect(!!(thrown as { message: string }).message.includes('未处置的上一笔归档')).toBe(true);
    }
    // 最后可用副本仍在位,内容一字未变
    expect(isUsableDirectoryCopy(cachePath)).toBe(true);
    expect(fs.readFileSync(path.join(cachePath, 'old-marker.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(path.join(cachePath, 'new-marker.txt'))).toBe(false);
    // 临时物自己清掉;别人的那份归档一根手指都没碰
    expect(leftoverStaging(getMarketplaceCacheDir())).toEqual([]);
    expect(fs.readFileSync(path.join(blocker, 'occupied', 'keep.txt'), 'utf-8')).toBe('not-mine');
  });

  it('⑤ clone 失败 + 确有可用的过期副本:允许降级,但必须带可诊断的过期说明', async () => {
    const url = 'https://example.test/offline-stale.git';
    const cachePath = seedExpiredCache(url, { 'cached.txt': 'data' });
    process.env[GIT_BIN_ENV] = path.join(tmpHome, 'nonexistent-git-binary');

    const result = await getOrCloneGitCache(url, { ttlMs: 1000 });

    expect(result.fromCache).toBe(true);
    expect(typeof result.staleReason).toBe('string');
    expect(result.staleReason).toContain('刷新失败已复用过期缓存');
    expect(result.staleReason).toContain(cachePath);
    expect(isUsableDirectoryCopy(cachePath)).toBe(true);
    expect(fs.readFileSync(path.join(cachePath, 'cached.txt'), 'utf-8')).toBe('data');
    expect(leftoverStaging(getMarketplaceCacheDir())).toEqual([]);
  });

  it('⑤-negative 缓存目录根本不存在 + clone 失败:如实失败,不把"没拿到"写成"拿到了"', async () => {
    const url = 'https://example.test/no-copy-at-all.git';
    process.env[GIT_BIN_ENV] = path.join(tmpHome, 'nonexistent-git-binary');

    await expect(getOrCloneGitCache(url, { ttlMs: 1000 })).rejects.toThrow(/无可用的过期副本/);
    // 权威路径上什么都没留下(旧实现会先 clone 到权威路径,失败即留半成品)
    expect(fs.existsSync(getCachePath(url))).toBe(false);
  });

  it('⑤-negative 缓存目录存在但已被掏空:不可用副本 ⇒ 不得 fromCache:true', async () => {
    const url = 'https://example.test/emptied-cache.git';
    const cachePath = seedExpiredCache(url, { 'gone.txt': 'x' });
    // 模拟"被删空/半截"的目录:存在、是目录、无内容 ⇒ 按生产判据不算可用副本
    fs.rmSync(path.join(cachePath, 'gone.txt'), { force: true });
    expect(isUsableDirectoryCopy(cachePath)).toBe(false);
    process.env[GIT_BIN_ENV] = path.join(tmpHome, 'nonexistent-git-binary');

    let resolved: unknown = null;
    let thrown: unknown = null;
    try {
      resolved = await getOrCloneGitCache(url, { ttlMs: 1000 });
    } catch (e) {
      thrown = e;
    }
    expect(resolved).toBeNull();
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('无可用的过期副本');
  });

  it('③ 取消在提交点之前:抛 PluginSwapCancelledError,现状不变、不留临时物', async () => {
    const url = 'https://example.test/cancel-before-commit.git';
    const cachePath = seedExpiredCache(url, { 'old-marker.txt': 'old' });
    writeMockCloneSrc({ 'new-marker.txt': 'new' });
    const controller = new AbortController();
    controller.abort();

    await expect(getOrCloneGitCache(url, { ttlMs: 1000, signal: controller.signal })).rejects.toBeInstanceOf(
      PluginSwapCancelledError,
    );

    expect(isUsableDirectoryCopy(cachePath)).toBe(true);
    expect(fs.readFileSync(path.join(cachePath, 'old-marker.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(path.join(cachePath, 'new-marker.txt'))).toBe(false);
    expect(leftoverStaging(getMarketplaceCacheDir())).toEqual([]);
    expect(leftoverSuperseded(getMarketplaceCacheDir())).toEqual([]);
  });

  it('④ 取消在提交点之后:已生效的新副本不回退', async () => {
    const url = 'https://example.test/cancel-after-commit.git';
    seedExpiredCache(url, { 'old-marker.txt': 'old' });
    writeMockCloneSrc({ 'new-marker.txt': 'new' });
    const controller = new AbortController();

    const result = await getOrCloneGitCache(url, { ttlMs: 1000, signal: controller.signal });
    expect(result.fromCache).toBe(false);

    // 提交点已过 —— 此刻到达的取消不得把已生效的副本抹掉或换回旧版
    controller.abort();
    const cachePath = getCachePath(url);
    expect(isUsableDirectoryCopy(cachePath)).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'new-marker.txt'))).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'old-marker.txt'))).toBe(false);
    expect(leftoverSuperseded(getMarketplaceCacheDir())).toEqual([]);
  });

  it('无缓存 + clone 成功:走同一条提交序列,权威路径不出现半成品', async () => {
    const url = 'https://example.test/first-clone.git';
    writeMockCloneSrc({ 'first.txt': 'v1' });

    const result = await getOrCloneGitCache(url);

    expect(result.fromCache).toBe(false);
    expect(isUsableDirectoryCopy(result.localPath)).toBe(true);
    expect(leftoverStaging(getMarketplaceCacheDir())).toEqual([]);
  });
});

// ==================== 原语级:提交点分步语义 ====================

describe('目录级提交点原语 — 所有权 / 落盘 / 事务号', () => {
  function makeTarget(name: string, files: Record<string, string>): string {
    const target = path.join(tmpHome, 'swap-root', name);
    fs.mkdirSync(target, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(target, file), content, 'utf-8');
    }
    return target;
  }

  it('落盘失败(staging 不在位)⇒ 旧副本被放回原位,归档不残留', () => {
    const target = makeTarget('restore', { 'old.txt': 'old' });
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');

    const swap = takeOwnershipOfTarget(target, staging);
    expect(swap.hadPrevious).toBe(true);
    expect(swap.superseded).toBe(supersededPathFor(target));
    expect(fs.existsSync(target)).toBe(false); // 槽位已让出,内容在归档里
    expect(fs.readFileSync(path.join(swap.superseded as string, 'old.txt'), 'utf-8')).toBe('old');

    // 注入:权威落盘那一步之前 staging 消失 ⇒ rename 必失败(ENOENT,两平台都成立)
    fs.rmSync(staging, { recursive: true, force: true });
    expect(() => landStagedSwap(swap)).toThrow(DirectorySwapError);

    // 旧副本回到原位,归档被放回而不是留在旁边
    expect(isUsableDirectoryCopy(target)).toBe(true);
    expect(fs.readFileSync(path.join(target, 'old.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(swap.superseded as string)).toBe(false);
  });

  it('权威状态还没落盘 ⇒ finalize 绝不删旧副本归档', () => {
    const target = makeTarget('not-landed', { 'old.txt': 'old' });
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');

    const swap = takeOwnershipOfTarget(target, staging);
    const outcome = finalizeStagedSwap(swap); // 故意不 landStagedSwap

    expect(outcome.deleted).toBe(false);
    expect(outcome.reason).toContain('权威状态未确认落盘');
    expect(isUsableDirectoryCopy(swap.superseded as string)).toBe(true);
    expect(fs.readFileSync(path.join(swap.superseded as string, 'old.txt'), 'utf-8')).toBe('old');
  });

  it('归档带同一 transactionId 落盘之后才删;事务号不符 ⇒ 保留并点名', () => {
    const target = makeTarget('txid', { 'old.txt': 'old' });
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');

    const swap = takeOwnershipOfTarget(target, staging);
    landStagedSwap(swap);
    const marker = path.join(swap.superseded as string, swapMarkerName());

    // 篡改事务号:这份归档不再能证明是本次交换挪出来的 ⇒ 不许删
    fs.writeFileSync(marker, JSON.stringify({ transactionId: 'someone-else', target }), 'utf-8');
    const refused = finalizeStagedSwap(swap);
    expect(refused.deleted).toBe(false);
    expect(refused.reason).toContain('事务号与本次交换不符');
    expect(fs.existsSync(path.join(swap.superseded as string, 'old.txt'))).toBe(true);

    // 号对了才删
    fs.writeFileSync(marker, JSON.stringify({ transactionId: swap.transactionId, target }), 'utf-8');
    const ok = finalizeStagedSwap(swap);
    expect(ok.deleted).toBe(true);
    expect(fs.existsSync(swap.superseded as string)).toBe(false);
    expect(fs.readFileSync(path.join(target, 'new.txt'), 'utf-8')).toBe('new');
  });

  it('事务标记写不下去(标记名被目录占住)⇒ 不进入落盘,旧副本放回原位', () => {
    // 目标里预置一个与事务标记同名的目录:改名后它跟着进了归档,
    // 于是"写标记"这一步必然失败(原子写出口拒绝把文件写进一个已存在的目录)。
    const target = makeTarget('marker-blocked', { 'old.txt': 'old' });
    fs.mkdirSync(path.join(target, swapMarkerName()), { recursive: true });
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');

    let thrown: unknown = null;
    try {
      takeOwnershipOfTarget(target, staging);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(DirectorySwapError);
    expect((thrown as DirectorySwapError).supersededPreserved).toBeNull();
    // 旧副本回到原位,新副本没有偷偷落盘
    expect(isUsableDirectoryCopy(target)).toBe(true);
    expect(fs.readFileSync(path.join(target, 'old.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(path.join(target, 'new.txt'))).toBe(false);
    expect(fs.existsSync(supersededPathFor(target))).toBe(false);
  });

  it('目标本就不存在(首次落位):commitStagedSwap 不做任何改名,直接落权威状态', () => {
    const target = path.join(tmpHome, 'swap-root', 'first-time');
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'only.txt'), 'v1', 'utf-8');

    const { swap, finalized } = commitStagedSwap(target, staging);

    expect(swap.hadPrevious).toBe(false);
    expect(swap.superseded).toBeNull();
    expect(finalized.deleted).toBe(false);
    expect(finalized.reason).toContain('没有旧副本需要处置');
    expect(isUsableDirectoryCopy(target)).toBe(true);
    expect(fs.readFileSync(path.join(target, 'only.txt'), 'utf-8')).toBe('v1');
  });

  it('提交点之前取消 ⇒ commitStagedSwap 抛错并自清 staging,目标一步没动', () => {
    const target = makeTarget('cancel-midway', { 'old.txt': 'old' });
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
    const controller = new AbortController();
    controller.abort();

    expect(() => commitStagedSwap(target, staging, { signal: controller.signal })).toThrow(
      PluginSwapCancelledError,
    );

    expect(fs.existsSync(staging)).toBe(false);
    expect(isUsableDirectoryCopy(target)).toBe(true);
    expect(fs.readFileSync(path.join(target, 'old.txt'), 'utf-8')).toBe('old');
    expect(fs.existsSync(path.join(target, 'new.txt'))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
