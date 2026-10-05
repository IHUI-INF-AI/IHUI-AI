// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { getInstalledPluginsDir, getMarketplaceCacheDir, getRegistryPath } from '../src/plugins/paths.js';
import { loadInstallRegistry, rollbackInstallAuthority, saveInstallRegistry, upsertInstallRecord, type InstallRecord } from '../src/plugins/installer.js';
import {
  DirectorySwapError,
  PluginSwapCancelledError,
  authorityForTarget,
  commitStagedSwap,
  currentSwapProcessOwnerId,
  finalizeStagedSwap,
  getCachePath,
  getOrCloneGitCache,
  isUsableDirectoryCopy,
  landStagedSwap,
  prepareStagingDirectory,
  recoverStaleSwapArtifacts,
  supersededPathFor,
  swapMarkerName,
  swapScratchMarkers,
  takeOwnershipOfTarget,
  type SwapAuthority,
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
  // G-807:个别用例把"判新鲜用的时钟"改成受控输入(只假 Date),这里统一复位,
  // 绝不让假时钟漏进下一条用例或别的套件(漏出去就是一条新的随机红)。
  vi.useRealTimers();
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

// ==================== 崩溃后的恢复(G-730 权威面 × G-731 写者证据) ====================

describe('遗留归档的恢复 — 写者证据 × 权威结论', () => {
  /**
   * 造一份"上一次进程崩在提交序列中间"的现场。
   *
   * 刻意用生产原语造(takeOwnershipOfTarget / landStagedSwap),只把**写者身份**改写成外进程
   * —— 判活与权威对账吃的必须是真实形态的 marker,不是测试自己拼的假结构。
   * `markerFields: null` ⇒ 连标记都没有(那是"别人家的遗留目录",一条都不许动)。
   */
  function seedCrashScene(opts: {
    name: string;
    landNewCopy?: boolean;
    markerFields?: Record<string, unknown> | null;
  }): { target: string; archive: string; transactionId: string; authorityFile: string; authority: SwapAuthority } {
    const target = path.join(tmpHome, 'recover', opts.name);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'old.txt'), 'old', 'utf-8');
    const authorityFile = path.join(tmpHome, 'recover', `${opts.name}.authority.json`);
    const authority: SwapAuthority = { path: authorityFile, recordKey: 'p1' };

    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
    const swap = takeOwnershipOfTarget(target, staging, { authority });
    if (opts.landNewCopy) landStagedSwap(swap);

    const archive = swap.superseded as string;
    const markerPath = path.join(archive, swapMarkerName());
    if (opts.markerFields === null) {
      fs.rmSync(markerPath, { force: true });
    } else {
      fs.writeFileSync(
        markerPath,
        JSON.stringify({
          transactionId: swap.transactionId,
          target,
          stagedAt: new Date().toISOString(),
          ownerPid: 424242,
          ownerId: 'another-process',
          authorityPath: authority.path,
          authorityKey: authority.recordKey,
          ...(opts.markerFields ?? {}),
        }),
        'utf-8',
      );
    }
    return { target, archive, transactionId: swap.transactionId, authorityFile, authority };
  }

  /** 写权威记录:安装的那条插件记录里 transactionId 是哪个号 */
  function writeAuthority(file: string, transactionId: string | null): void {
    const record: Record<string, unknown> = { name: 'p1', sourceType: 'git', installedAt: '2026-09-29T00:00:00.000Z' };
    if (transactionId !== null) record.transactionId = transactionId;
    fs.writeFileSync(file, JSON.stringify({ records: [record] }, null, 2), 'utf-8');
  }

  const deadWriter = async (): Promise<boolean> => false;
  const liveWriter = async (): Promise<boolean> => true;

  it('① 权威已含该事务号 ⇒ 只清归档,目标(新一代)一字未动', async () => {
    const scene = seedCrashScene({ name: 'committed', landNewCopy: true });
    writeAuthority(scene.authorityFile, scene.transactionId);

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: deadWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['archive-deleted']);
    expect(fs.existsSync(scene.archive)).toBe(false);
    // 目标仍是新副本 —— 恢复没有把它换回旧代,也没有把旧代内容混进来
    expect(fs.readFileSync(path.join(scene.target, 'new.txt'), 'utf-8')).toBe('new');
    expect(fs.existsSync(path.join(scene.target, 'old.txt'))).toBe(false);
  });

  it('② 权威不含该事务号 + 目标为空槽 ⇒ 归档 rename 回位(旧代回到权威槽位)', async () => {
    const scene = seedCrashScene({ name: 'not-committed-empty' });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: deadWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['restored']);
    expect(fs.existsSync(scene.archive)).toBe(false);
    expect(fs.readFileSync(path.join(scene.target, 'old.txt'), 'utf-8')).toBe('old');
    // 回位后标记必须被摘掉:它是"在途事务"的凭据,留在权威副本里会骗下一轮恢复
    expect(fs.existsSync(path.join(scene.target, swapMarkerName()))).toBe(false);
  });

  it('③ marker 指向活进程 ⇒ 恢复一条都不动(写者的回滚快照没被抢走,G-731)', async () => {
    const scene = seedCrashScene({ name: 'live-writer' });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');
    const parent = path.dirname(scene.target);
    const shapeBefore = fs.readdirSync(parent).sort();
    const bytesBefore = fs.readFileSync(path.join(scene.archive, 'old.txt'), 'utf-8');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: liveWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['skipped-live-writer']);
    expect(outcomes[0].reason).toContain('G-731');
    // 备份字节逐字不变
    expect(fs.readFileSync(path.join(scene.archive, 'old.txt'), 'utf-8')).toBe(bytesBefore);
    // 目录形状逐字不变(既没回位也没删除)
    expect(fs.readdirSync(parent).sort()).toEqual(shapeBefore);
    expect(fs.existsSync(scene.target)).toBe(false);
  });

  it('④ marker 指向已死进程 ⇒ 正常回位', async () => {
    const scene = seedCrashScene({ name: 'dead-writer' });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: deadWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['restored']);
    expect(isUsableDirectoryCopy(scene.target)).toBe(true);
    expect(fs.readFileSync(path.join(scene.target, 'old.txt'), 'utf-8')).toBe('old');
  });

  it('④b 判活复用 mcp-oauth 那份实现:不注入探针也能把已退出写者判成 dead', async () => {
    // 999999 与 apps/cli/tests/mcp-oauth.test.ts:330 用的是同一枚"无效 PID"夹具口径。
    // 这一条不注入 ⇒ 走的是 cache.ts 里的 defaultPidAliveProbe;若那条通道接错或 import 失败,
    // 结论会落 unverifiable,而本用例要的 archive-deleted 只在**正面判死**时才发生。
    const scene = seedCrashScene({ name: 'dead-real-probe', landNewCopy: true, markerFields: { ownerPid: 999999 } });
    writeAuthority(scene.authorityFile, scene.transactionId);

    const outcomes = await recoverStaleSwapArtifacts(scene.target);

    expect(outcomes.map((o) => o.action)).toEqual(['archive-deleted']);
    expect(outcomes[0].reason).toContain('归档已清除');
  });

  it('④c 同 pid 而 ownerId 不符 ⇒ pid 已被复用,不得判成"写者还活着"', async () => {
    const scene = seedCrashScene({
      name: 'pid-reused',
      markerFields: { ownerPid: process.pid, ownerId: 'not-this-process' },
    });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: liveWriter });

    // 判活通道即使一律回 true,这条也不得走 live 分支 —— 短路在 ownerId 对账上
    expect(outcomes.map((o) => o.action)).toEqual(['restored']);
    expect(outcomes[0].reason).toContain('pid 已被复用');
  });

  it('④d 本进程在途的交换(ownerPid+ownerId 都是自己)⇒ 恢复绝不插手', async () => {
    const scene = seedCrashScene({
      name: 'own-in-flight',
      markerFields: { ownerPid: process.pid, ownerId: currentSwapProcessOwnerId() },
    });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: liveWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['skipped-in-process']);
    expect(fs.existsSync(scene.archive)).toBe(true);
  });

  // ---------- 存量 marker 兼容口径(约束 2:无 ownerPid/ownerId ⇒ 无凭据) ----------

  it('⑤ 存量 marker 无 ownerPid/ownerId + 空槽 ⇒ 只做零破坏的回位(不判活也不判死)', async () => {
    const scene = seedCrashScene({
      name: 'legacy-no-owner-empty',
      markerFields: { ownerPid: undefined, ownerId: undefined },
    });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: liveWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['restored']);
    expect(fs.readFileSync(path.join(scene.target, 'old.txt'), 'utf-8')).toBe('old');
    // 判活通道一律回 true 也照样回位 ⇒ 走的是"无凭据"这一档,不是"判成已死"
    expect(outcomes[0].reason).toContain('无从证明写者已退出');
  });

  it('⑤-negative 存量 marker 无 ownerPid/ownerId + 新一代在位 ⇒ 不抢占,归档保留不删', async () => {
    const scene = seedCrashScene({
      name: 'legacy-no-owner-occupied',
      landNewCopy: true,
      markerFields: { ownerPid: undefined, ownerId: undefined },
    });
    writeAuthority(scene.authorityFile, scene.transactionId); // 权威已经认了这笔

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: liveWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['left-as-is']);
    expect(outcomes[0].reason).toContain('不抢占');
    expect(fs.existsSync(path.join(scene.archive, 'old.txt'))).toBe(true);
  });

  it('归档里没有事务标记 ⇒ 不是本机制的现场,一条都不动', async () => {
    const scene = seedCrashScene({ name: 'no-marker', markerFields: null });
    const bytesBefore = fs.readFileSync(path.join(scene.archive, 'old.txt'), 'utf-8');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: deadWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['left-as-is']);
    expect(fs.readFileSync(path.join(scene.archive, 'old.txt'), 'utf-8')).toBe(bytesBefore);
  });

  it('权威带的是另一笔事务号而新一代已在位 ⇒ 两份并存,一条不动并报名(不得把旧快照当垃圾删)', async () => {
    const scene = seedCrashScene({ name: 'cross-generation', landNewCopy: true });
    writeAuthority(scene.authorityFile, 'an-older-generation-txn');

    const outcomes = await recoverStaleSwapArtifacts(scene.target, { isPidAlive: deadWriter });

    expect(outcomes.map((o) => o.action)).toEqual(['left-as-is']);
    expect(outcomes[0].reason).toContain('两份都保留');
    expect(fs.readFileSync(path.join(scene.target, 'new.txt'), 'utf-8')).toBe('new');
    expect(fs.readFileSync(path.join(scene.archive, 'old.txt'), 'utf-8')).toBe('old');
  });

  it('finalize 也必须问权威面:权威带的是另一笔号 ⇒ 归档拒删;号对上 ⇒ 才删', () => {
    // 这一条刻意走**真实提交序列**的句柄(takeOwnershipOfTarget + landStagedSwap),而不是手工铺的
    // 归档夹具 —— 它判的就是 finalize 自己那一步,句柄必须是生产盖出来的那一份。
    const target = path.join(tmpHome, 'finalize-gate');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'old.txt'), 'old', 'utf-8');
    const authorityFile = path.join(tmpHome, 'finalize-gate.registry.json');
    const staging = prepareStagingDirectory(target);
    fs.writeFileSync(path.join(staging, 'new.txt'), 'new', 'utf-8');
    const swap = takeOwnershipOfTarget(target, staging, {
      authority: { path: authorityFile, recordKey: 'p1' },
    });
    landStagedSwap(swap);
    const archive = swap.superseded as string;

    // 权威记录里写的是别的号 ⇒ 只比"marker ⊕ 本句柄事务号"会误删权威仍指向的旧快照
    writeAuthority(authorityFile, 'an-older-generation-txn');
    const refused = finalizeStagedSwap(swap);
    expect(refused.deleted).toBe(false);
    expect(refused.reason).toContain('未获权威确认');
    expect(fs.existsSync(path.join(archive, 'old.txt'))).toBe(true);

    // 权威把这笔事务号写上了 ⇒ 同一句柄、同一片盘,这次可以删
    writeAuthority(authorityFile, swap.transactionId);
    const ok = finalizeStagedSwap(swap);
    expect(ok.deleted).toBe(true);
    expect(fs.existsSync(archive)).toBe(false);
    expect(fs.readFileSync(path.join(target, 'new.txt'), 'utf-8')).toBe('new');
  });

  it('权威面按路径推导:installed-plugins 的直接子目录 ⇒ registry 那条记录;缓存目录 ⇒ null', () => {
    const installDir = path.join(getInstalledPluginsDir(), 'demo-plugin');
    const derived = authorityForTarget(installDir);
    expect(derived).not.toBeNull();
    expect(derived?.path).toBe(getRegistryPath());
    expect(derived?.recordKey).toBe('demo-plugin');
    // 安装根本身、以及不在它下面的路径,都没有权威记录可问
    expect(authorityForTarget(getInstalledPluginsDir())).toBeNull();
    expect(authorityForTarget(getCachePath('https://example.test/derivation.git'))).toBeNull();
    expect(authorityForTarget(path.join(getInstalledPluginsDir(), 'a', 'b'))).toBeNull();
  });

  it('恢复挂在读入口上:getOrCloneGitCache 先把崩溃遗留的旧副本回位,再照常刷新', async () => {
    // 没有这一手,过期刷新会走 hadCache=false 去重新 clone,把最后一份可用旧副本永久留在归档里,
    // 而本次调用照样报成功 —— 账面看不出盘上还躺着一代内容(与"造好没装车"同一型)。
    const url = 'https://example.test/crash-recovered.git';
    const cachePath = getCachePath(url);
    const archive = `${cachePath}${swapScratchMarkers().superseded}424242`;
    fs.mkdirSync(archive, { recursive: true });
    fs.writeFileSync(path.join(archive, 'legacy.txt'), 'legacy', 'utf-8');
    fs.writeFileSync(
      path.join(archive, swapMarkerName()),
      JSON.stringify({
        transactionId: 'a-crashed-txn',
        target: cachePath,
        stagedAt: '2026-09-28T00:00:00.000Z',
      }),
      'utf-8',
    );
    // 回位过来的目录"该按过期算"这件事不能靠 mtime 断言:rename 之后还要摘标记,目录 mtime 会被
    // 重新盖章,而本机实测它可能比 Date.now() 还新亚毫秒 ⇒ ttlMs:0 照样被"缓存命中"短路(第一轮
    // 就红在这里)。TTL 取负让"必须刷新"成为确定性前提,不改一行生产判据。
    writeMockCloneSrc({ 'fresh.txt': 'fresh' });
    // G-807(本用例此前**随机红**的根因与修法,原文记下防被"顺手改回 TTL 符号"):
    // "必须刷新"此前用 `ttlMs:-1` 硬造,于是断言压在 cache.ts:1003 的
    // `ageMs = Date.now() - stat.mtimeMs; ageMs < ttl ⇒ 命中` 上。而回位是「rename 归档 → 目标」
    // +「摘掉目标里的事务标记」两步 —— 摘标记会让 NTFS 给目录**重盖** mtime,实测本机(200 次复刻
    // 同样的两步)该 mtime 可比 `Date.now()` 超前最多 1.549ms,其中 38 次 >=1ms;一旦落后于这次
    // 盖章,`ageMs < -1` 就成立 ⇒ 判成"缓存新鲜" ⇒ fromCache:true ⇒ `expected true to be false`。
    // 红的是时序而不是行为,所以正解不是把 TTL 再拧一格,而是**把判新鲜用的时钟变成显式受控输入**:
    // 只假 Date(toFake:['Date'],不动任何异步定时器,不改生产一行),把 now 拨到归档实际落地之后 10 分钟,
    // TTL 取 1 分钟 ⇒ ageMs ≈ 600000ms,与那个 1.55ms 竞态窗口差 5 个数量级 ⇒ "必须刷新"从此确定。
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 10 * 60 * 1000);
    let result: Awaited<ReturnType<typeof getOrCloneGitCache>>;
    try {
      result = await getOrCloneGitCache(url, { ttlMs: 60 * 1000 });
    } finally {
      vi.useRealTimers();
    }

    expect(result.fromCache).toBe(false);
    expect(fs.readFileSync(path.join(cachePath, 'fresh.txt'), 'utf-8')).toBe('fresh');
    // 遗留归档不再躺在盘上:先回位、再被本次提交序列正常处置
    expect(fs.existsSync(archive)).toBe(false);
    expect(leftoverSuperseded(getMarketplaceCacheDir())).toEqual([]);
    // 回位过来的旧内容不该混进新副本
    expect(fs.existsSync(path.join(cachePath, 'legacy.txt'))).toBe(false);
  });

  it('G-807 反向锁①:同一夹具把时钟拨到实际时刻**之前** ⇒ 判成缓存命中不刷新,而归档照样被回位清空', async () => {
    // 这一条把「恢复动作发生了」与「刷新发生了」拆成两件事:上面那条的 `fromCache:false` 若被
    // 当成恢复的证据,那它其实只证明 TTL 判过了。这里让 TTL 确定性判成命中(时钟拨回 60s 之前,
    // 年龄 -60000ms ≪ 默认 TTL 5min),刷新那条腿根本不进 —— 若恢复没挂在读入口上,
    // `cachePath/legacy.txt` 就不可能在那儿 ⇒ 本用例必红,而不是永远绿。
    const url = 'https://example.test/crash-recovered-hit.git';
    const cachePath = getCachePath(url);
    const archive = `${cachePath}${swapScratchMarkers().superseded}424243`;
    fs.mkdirSync(archive, { recursive: true });
    fs.writeFileSync(path.join(archive, 'legacy.txt'), 'legacy', 'utf-8');
    fs.writeFileSync(
      path.join(archive, swapMarkerName()),
      JSON.stringify({
        transactionId: 'a-crashed-txn-hit',
        target: cachePath,
        stagedAt: '2026-09-28T00:00:00.000Z',
      }),
      'utf-8',
    );
    // 刻意**不**写 mock clone 源:这一条要求刷新那条腿一步都不许走。
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() - 60 * 1000);
    let hit: Awaited<ReturnType<typeof getOrCloneGitCache>>;
    try {
      hit = await getOrCloneGitCache(url);
    } finally {
      vi.useRealTimers();
    }

    expect(hit.fromCache).toBe(true);
    // 是"缓存命中"而不是"离线降级复用":降级路径同样回 fromCache:true,但必带 staleReason(cache.ts:1031)。
    expect(hit.staleReason).toBeUndefined();
    expect(fs.existsSync(path.join(cachePath, 'fresh.txt'))).toBe(false);
    // 恢复动作本身:归档被回位到权威槽位,旧代内容在位,在途标记已摘。
    expect(fs.existsSync(archive)).toBe(false);
    expect(fs.readFileSync(path.join(cachePath, 'legacy.txt'), 'utf-8')).toBe('legacy');
    expect(fs.existsSync(path.join(cachePath, swapMarkerName()))).toBe(false);
  });

  it('G-807 反向锁②:归档没有事务标记 ⇒ 恢复不插手 ⇒ 读入口也不得把它清掉(否则上面"归档消失"无从归因)', async () => {
    // 对照组钉的是"归档消失"这件事的**唯一生产者**是恢复动作:同一形状的遗留目录,只把标记摘掉
    // (即"不是本机制的现场"),跑完必须原样躺在盘上。若哪次改动让读入口顺手扫掉遗留归档,
    // 这一条先红,而上面两条的 `existsSync(archive) === false` 就再也不是恢复的证据了。
    const url = 'https://example.test/not-a-recovery-scene.git';
    const cachePath = getCachePath(url);
    const archive = `${cachePath}${swapScratchMarkers().superseded}424244`;
    fs.mkdirSync(archive, { recursive: true });
    fs.writeFileSync(path.join(archive, 'legacy.txt'), 'legacy', 'utf-8');
    writeMockCloneSrc({ 'fresh.txt': 'fresh' });

    const result = await getOrCloneGitCache(url, { ttlMs: 60 * 1000 });

    expect(result.fromCache).toBe(false);
    expect(fs.readFileSync(path.join(cachePath, 'fresh.txt'), 'utf-8')).toBe('fresh');
    // 无人处置 ⇒ 归档必须还在,且没有被"回位"成新副本的一部分
    expect(fs.existsSync(archive)).toBe(true);
    expect(leftoverSuperseded(getMarketplaceCacheDir())).toContain(path.basename(archive));
    expect(fs.existsSync(path.join(cachePath, 'legacy.txt'))).toBe(false);
  });
});

describe('G-732 — 权威回滚本身要 CAS(并发更新不得被无条件盖写)', () => {
  // 票面验收(逐字):句柄 A 先写 registry → 句柄 B 交换失败触发回滚 ⇒
  // 断言 A 内容逐字仍在 ∧ 错误点名 concurrent update。
  it('句柄 A 先写 → 句柄 B(过期基准)回滚 ⇒ 报 concurrent update 且 A 内容逐字仍在', () => {
    // 句柄 A:正常写入一条带事务号的记录(它的"上一代"是 tx-prev)
    const regA = loadInstallRegistry();
    const recordA: InstallRecord = {
      name: 'plg',
      sourceType: 'local',
      installedAt: '2026-10-03T00:00:00Z',
      transactionId: 'txA',
    };
    upsertInstallRecord(regA, recordA);
    saveInstallRegistry(regA);

    // 句柄 B:基于 A 写入**之前**的过期内存基准,交换失败后触发回滚,
    // 声称要回滚的是"自己的" txB —— CAS 必须拒,且错误点名 concurrent update。
    expect(() =>
      rollbackInstallAuthority({ name: 'plg', expectTransactionId: 'txB' }),
    ).toThrow(/Cannot roll back marketplace authority after concurrent update/);

    // A 的内容逐字仍在(无条件盖写会把这条抹掉 —— 那正是本票要防的形态)
    const onDisk = JSON.parse(fs.readFileSync(getRegistryPath(), 'utf-8')) as { records: InstallRecord[] };
    expect(onDisk.records).toHaveLength(1);
    expect(onDisk.records[0]).toEqual(recordA);
  });

  it('反向对照:CAS 凭据相符 ⇒ 回滚成功,上一代记录逐字还原', () => {
    const previous: InstallRecord = {
      name: 'plg2',
      sourceType: 'local',
      installedAt: '2026-10-02T00:00:00Z',
      transactionId: 'tx-prev',
    };
    const reg = loadInstallRegistry();
    upsertInstallRecord(reg, previous);
    saveInstallRegistry(reg);
    // 同一笔事务(凭据相符)触发回滚,还原到上一代
    const current: InstallRecord = { ...previous, installedAt: '2026-10-03T01:00:00Z', transactionId: 'tx-new' };
    const reg2 = loadInstallRegistry();
    upsertInstallRecord(reg2, current);
    saveInstallRegistry(reg2);

    const result = rollbackInstallAuthority({ name: 'plg2', expectTransactionId: 'tx-new', restoreRecord: previous });
    expect(result).toEqual({ rolledBack: true, recordExisted: true });
    const onDisk = JSON.parse(fs.readFileSync(getRegistryPath(), 'utf-8')) as { records: InstallRecord[] };
    expect(onDisk.records).toHaveLength(1);
    expect(onDisk.records[0]).toEqual(previous);
  });

  it('记录缺席 ⇒ 幂等返回不报错(回滚目标态已达)', () => {
    expect(rollbackInstallAuthority({ name: 'absent-plg', expectTransactionId: 'tx-x' })).toEqual({
      rolledBack: false,
      recordExisted: false,
    });
  });
});

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
