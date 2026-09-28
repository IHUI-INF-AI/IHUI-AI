// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins Marketplace Git URL 缓存 — 避免重复 git clone 远程仓库。
 *
 * 设计:
 *   - 每个 URL 对应 ~/.ihui/marketplace-cache/<sha1(url)>/ 目录
 *   - 缓存 TTL 默认 5 分钟,过期后尝试刷新
 *   - **目录级提交点**:新副本先在 staging 里完整备好,才进入提交序列
 *     (旧副本原子改名挪开 → 新副本落位 → 核对事务号后才处置旧副本)。
 *     进入提交点之前任何失败 ⇒ 旧副本仍在位、staging 自清、错误如实上抛。
 *   - 无网络容错:clone/网络失败时**先校验旧副本确实在位且可用**才降级复用,
 *     并在返回值里带上可诊断的过期说明;校验不过 ⇒ 抛错,绝不把"没拿到"写成"拿到了"。
 *   - 测试钩子:IHUI_MOCK_GIT_CLONE_SRC(模拟 clone 成功)/ IHUI_GIT_BIN(自定义 git 二进制路径)
 *
 * 修复缘由(实测缺陷,2026-09-28):旧实现在 `rmSync(localPath)` 与 `renameSync(tmpPath, localPath)`
 * 之间留着一个**真实的目标缺失窗口**,而它的 `catch` 在这种情况下直接
 * `return { localPath, fromCache: true }`(注释写着"离线降级:复用过期缓存")——
 * 复用的正是刚被自己删掉的那个目录,于是"先删最后可用副本、再把失败报成成功"。
 * 现在:降级分支必须先过 `isUsableDirectoryCopy()`;提交失败一律上抛,不降级。
 *
 * 缓存目录布局:
 *   ~/.ihui/marketplace-cache/
 *     <sha1(url-A)>/    ← 完整 git 仓库(浅克隆)
 *     <sha1(url-B)>/
 *     <sha1(url-B)>.staging-<pid>-<n>/    ← 在途新副本(提交点之前唯一可动)
 *     <sha1(url-B)>.superseded-<pid>/     ← 旧副本归档(权威状态落盘 + 事务号核对后才删)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getMarketplaceCacheDir } from './paths.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';

/** 缓存条目元信息(供调试与诊断) */
export interface CacheEntry {
  url: string;
  localPath: string;
  cachedAt: number;
  ttlMs: number;
}

/** 默认 TTL:5 分钟 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** 测试用:模拟 clone 来源目录(设置后跳过真实 git 调用,直接复制该目录) */
const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';

/** 测试用:自定义 git 二进制路径(默认 'git'),指向不存在路径可模拟无网络 */
const GIT_BIN_ENV = 'IHUI_GIT_BIN';

/**
 * 计算 URL 对应的缓存路径 — sha1(url) 哈希作为目录名,避免特殊字符。
 * 返回绝对路径,不保证目录存在。
 */
export function getCachePath(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(getMarketplaceCacheDir(), hash);
}

/** 递归复制目录(内部工具,供 mock clone 与降级使用) */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(s), target);
      if (fs.statSync(resolved).isDirectory()) {
        copyDirRecursive(resolved, d);
      } else {
        fs.copyFileSync(resolved, d);
      }
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/** 执行 git clone(或测试 mock)到 target 目录 */
function performClone(url: string, target: string, ref?: string, sha?: string): void {
  const mockSrc = process.env[MOCK_CLONE_SRC_ENV];
  if (mockSrc) {
    // 测试钩子:复制指定目录作为 clone 结果
    copyDirRecursive(mockSrc, target);
    return;
  }
  const gitBin = process.env[GIT_BIN_ENV] || 'git';
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(url, target);
  execFileSync(gitBin, args, { stdio: 'pipe', windowsHide: true });
  if (sha) {
    // 拉取指定 commit 并 checkout(SHA pin)
    execFileSync(gitBin, ['-C', target, 'fetch', '--depth=1', 'origin', sha], {
      stdio: 'pipe',
      windowsHide: true,
    });
    execFileSync(gitBin, ['-C', target, 'checkout', sha], { stdio: 'pipe', windowsHide: true });
  }
}

// ==================== 目录级「提交点」原语(唯一实现) ====================
//
// 形态取自 `scripts/lib/stale-lock-claim.mjs`(本仓唯一的"原子改名取得所有权 → 回读核对 →
// 才处置"骨架):① 先 rename 拿所有权,**任何失败都绝不回退去 rmSync 原路径**;
// ② 处置(删除)之前必须按**同一事务号**回读核对,核对不过就保留现场并点名。
// 这里实现的是"目录交换",不是"锁抢占"(两个关注点不同),所以没有复制那份算法,
// 只沿用它的骨架顺序与"绝不静默删"的判据方向。
// ⚠ 为何不直接 import 那一层:`apps/cli/tsconfig.json` 写死 `rootDir: "src"`,src 里 import
//   `scripts/**` 直接 TS6059;且发布清单 `files:["dist","src"]` 根本不含 `scripts/`。
//   归属见交付报告:统一两者需要一个可被 CLI 运行时 import 的共享模块(属 apps/cli/src/util/ 持有者)。

/** 在途新副本的后缀(同进程多次交换用序号隔开,绝不互相覆盖 staging) */
const STAGING_SUFFIX = '.staging-';
/** 旧副本归档的后缀(**按 pid 定名** ⇒ 提交点之前可核验"是否已有未处置归档",且可被测试注入) */
const SUPERSEDED_SUFFIX = '.superseded-';
/** 归档目录里的事务标记:删除之前必须逐字读回并等于本次 transactionId */
const SWAP_MARKER_NAME = '.ihui-swap-transaction.json';

/** 同进程 staging 序号 */
let stagingSeq = 0;
/** 本进程在途交换留下的暂存路径(clearMarketplaceCache 据此跳过,绝不删别人的在途半成品) */
const activeSwapScratch = new Set<string>();

/** 提交点之前被调用方取消(现状一律未改动) */
export class PluginSwapCancelledError extends Error {
  readonly code = 'plugin_swap_cancelled';
  readonly target: string;
  constructor(target: string) {
    super(`插件交换已取消:${target}(取消发生在提交点之前,旧副本与目录结构均未改动)`);
    this.name = 'PluginSwapCancelledError';
    this.target = target;
  }
}

/** 目录级提交失败 —— 一定说清"旧副本现在在哪里",绝不静默丢内容 */
export class DirectorySwapError extends Error {
  readonly code = 'directory_swap_failed';
  readonly target: string;
  /** 旧副本被保留在哪个路径;null = 已放回原位或本来就没有旧副本 */
  readonly supersededPreserved: string | null;
  constructor(target: string, message: string, supersededPreserved: string | null) {
    super(message);
    this.name = 'DirectorySwapError';
    this.target = target;
    this.supersededPreserved = supersededPreserved;
  }
}

/** 一次目录交换的句柄:事务号跟着句柄走,落盘与处置用的是同一个凭据。 */
export interface StagedSwap {
  readonly target: string;
  readonly staging: string;
  /** 旧副本被改名后的落点(hadPrevious=false 时为 null) */
  readonly superseded: string | null;
  readonly hadPrevious: boolean;
  readonly transactionId: string;
}

/** finalize 的结论 —— 只报"删了什么/为什么没删",不改写交换本身的成功与否 */
export interface SwapFinalizeOutcome {
  readonly deleted: boolean;
  readonly reason: string;
}

/** 「这条路径当前是一个目录」—— 交换判据与可用性判据共用的那一份实现 */
function isDirectoryPath(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isEmptyDirectory(p: string): boolean {
  try {
    return fs.readdirSync(p).length === 0;
  } catch {
    return false;
  }
}

/**
 * 「这条路径是不是一个还能用的副本」—— 全仓唯一判据。
 *
 * 降级分支与测试都必须用它(测试不得内联第二份判定,否则两边会各自漂)。
 * 判据刻意只问"在位 + 是目录 + 非空":半截 clone 之所以危险,正是因为
 * "看着像缓存"而内容不完整;非空这一维挡不住全部残缺,但把"目录被删空 / 从未建成"
 * 这一型(实测就是旧代码降级复用的那种)明确排除在外。
 */
export function isUsableDirectoryCopy(p: string): boolean {
  return isDirectoryPath(p) && !isEmptyDirectory(p);
}

/** staging 落点(同一父目录 ⇒ rename 不跨卷;序号隔开 ⇒ 同进程并发交换不互踩) */
export function stagingPathFor(target: string): string {
  return `${target}${STAGING_SUFFIX}${process.pid}-${stagingSeq}`;
}

/** 旧副本归档落点(按 pid 定名,便于"未处置归档"可被核验) */
export function supersededPathFor(target: string): string {
  return `${target}${SUPERSEDED_SUFFIX}${process.pid}`;
}

/** 本次交换留下的暂存/归档路径前缀(供清理与断言复用,不在别处再抄一份后缀名) */
export function swapScratchMarkers(): { staging: string; superseded: string } {
  return { staging: STAGING_SUFFIX, superseded: SUPERSEDED_SUFFIX };
}

/** 归档目录里事务标记的文件名(它是交换契约的一部分,故对外可见) */
export function swapMarkerName(): string {
  return SWAP_MARKER_NAME;
}

/**
 * 备好一个空的 staging 目录(提交点之前)。
 * 失败一律只动 staging 自己,目标目录不碰。
 */
export function prepareStagingDirectory(target: string): string {
  stagingSeq += 1;
  const staging = stagingPathFor(target);
  try {
    fs.mkdirSync(path.dirname(staging), { recursive: true });
    fs.mkdirSync(staging);
  } catch (e) {
    activeSwapScratch.delete(staging);
    throw new DirectorySwapError(
      target,
      `无法建立暂存目录(目标目录未被改动):${staging} :: ${e instanceof Error ? e.message : String(e)}`,
      null,
    );
  }
  activeSwapScratch.add(staging);
  return staging;
}

/** 放弃 staging:只删本交换创建的暂存目录,并把它从在途清单里摘掉。 */
export function discardStagingDirectory(staging: string): void {
  activeSwapScratch.delete(staging);
  try {
    fs.rmSync(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  } catch {
    // 暂存清不掉不改判据结论:目标目录仍在位,错误已在上游抛出
  }
}

function writeSwapMarker(supersededDir: string, transactionId: string, target: string): void {
  const payload = JSON.stringify({ transactionId, target, stagedAt: new Date().toISOString() });
  // 落盘一律走全仓唯一的原子写出口(不得在这里再抄一份 tmp+rename 重试)
  const markerPath = path.join(supersededDir, SWAP_MARKER_NAME);
  commitAtomicWrite(captureWriteBaseline(markerPath), payload);
}

/** 读回归档里的事务号;读不到/形状不对一律返回 null(= 无从证明它是本次交换的产物) */
function readSwapMarker(supersededDir: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(supersededDir, SWAP_MARKER_NAME), 'utf-8')) as unknown;
    if (parsed && typeof parsed === 'object' && 'transactionId' in parsed) {
      const tx = (parsed as { transactionId: unknown }).transactionId;
      return typeof tx === 'string' ? tx : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 提交点第一步:把旧副本**原子改名**挪开,取得目标槽位的所有权。
 *
 * - 目标不存在 ⇒ hadPrevious=false,什么都不动;
 * - 目标存在而归档槽位已被占 ⇒ 判"有未处置的上一笔归档",直接抛错(此刻目标仍在位);
 *   唯一放过的是"空目录"(不可能是任何人的内容,且 Windows 上连改名到空目录都会 EPERM);
 * - 改名失败 ⇒ 抛错,旧副本仍在原位。
 */
export function takeOwnershipOfTarget(target: string, staging: string): StagedSwap {
  const transactionId = crypto.randomUUID();
  const swapBase: Omit<StagedSwap, 'superseded' | 'hadPrevious'> = { target, staging, transactionId };
  if (!fs.existsSync(target)) return { ...swapBase, superseded: null, hadPrevious: false };

  const superseded = supersededPathFor(target);
  activeSwapScratch.add(superseded);
  if (fs.existsSync(superseded)) {
    if (!isEmptyDirectory(superseded)) {
      activeSwapScratch.delete(superseded);
      throw new DirectorySwapError(
        target,
        `目标已有未处置的上一笔归档,拒绝继续(旧副本仍在位,未删除任何内容):${superseded}`,
        superseded,
      );
    }
    fs.rmSync(superseded, { recursive: true, force: true });
  }
  try {
    fs.renameSync(target, superseded);
  } catch (e) {
    activeSwapScratch.delete(superseded);
    throw new DirectorySwapError(
      target,
      `取得目标槽位失败(旧副本仍在位,未删除任何内容):${target} :: ${e instanceof Error ? e.message : String(e)}`,
      null,
    );
  }
  const swap: StagedSwap = { ...swapBase, superseded, hadPrevious: true };
  // 事务标记写不进去 ⇒ 这次交换没有凭据,绝不能继续往下走;先把旧副本放回原位
  try {
    writeSwapMarker(superseded, transactionId, target);
  } catch (e) {
    const preserved = restoreSuperseded(swap);
    throw new DirectorySwapError(
      target,
      `写入事务标记失败,未落盘新副本(旧副本${preserved ? `保留在 ${preserved} —— 未删除任何内容` : '已放回原位'}):` +
        `${e instanceof Error ? e.message : String(e)}`,
      preserved,
    );
  }
  return swap;
}

/**
 * 提交点第二步:把 staging 落成权威状态。
 * 落盘失败 ⇒ 尽力把旧副本放回原位;放回也失败 ⇒ **保留归档并在错误里点名**,绝不删它。
 */
export function landStagedSwap(swap: StagedSwap): void {
  if (!isDirectoryPath(swap.staging)) {
    const preserved = restoreSuperseded(swap);
    throw new DirectorySwapError(
      swap.target,
      `暂存副本不可用,未落盘:${swap.staging}(旧副本${preserved ? `仍在 ${preserved}` : '已在原位'})`,
      preserved,
    );
  }
  try {
    fs.renameSync(swap.staging, swap.target);
  } catch (e) {
    const preserved = restoreSuperseded(swap);
    discardStagingDirectory(swap.staging);
    throw new DirectorySwapError(
      swap.target,
      `权威状态落盘失败(旧副本${preserved ? `已保留在 ${preserved} —— 未删除任何内容,请人工处置后重试` : '已放回原位'}):` +
        `${swap.staging} → ${swap.target} :: ${e instanceof Error ? e.message : String(e)}`,
      preserved,
    );
  }
  activeSwapScratch.delete(swap.staging);
}

/** 把归档放回目标位置;成功返回 null(= 现状已复原),失败返回保留路径。 */
function restoreSuperseded(swap: StagedSwap): string | null {
  if (!swap.hadPrevious || !swap.superseded) return null;
  if (!fs.existsSync(swap.superseded)) return null;
  if (fs.existsSync(swap.target)) return swap.superseded; // 槽位又被占了 ⇒ 不许覆盖,现场保留
  try {
    fs.renameSync(swap.superseded, swap.target);
    activeSwapScratch.delete(swap.superseded);
    return null;
  } catch {
    return swap.superseded;
  }
}

/**
 * 权威状态落盘**之后**才处置旧副本(§7 删除安全:新副本逐字承接了同一功能,才算"有承接")。
 * 两条前置缺一不可,否则只保留不删:
 *   ① 目标确实是落好的新副本,且 staging 已被改名带走;
 *   ② 归档里的事务标记等于本句柄的 transactionId(证明它就是本次交换挪出来的那一份)。
 */
export function finalizeStagedSwap(swap: StagedSwap): SwapFinalizeOutcome {
  if (!swap.hadPrevious || !swap.superseded) return { deleted: false, reason: '没有旧副本需要处置' };
  if (!fs.existsSync(swap.target) || fs.existsSync(swap.staging)) {
    return { deleted: false, reason: `权威状态未确认落盘,保留旧副本归档不删:${swap.superseded}` };
  }
  const tx = readSwapMarker(swap.superseded);
  if (tx !== swap.transactionId) {
    return {
      deleted: false,
      reason: `归档事务号与本次交换不符(读回 ${tx ?? '无标记'}),按"不属本次交换"保留:${swap.superseded}`,
    };
  }
  try {
    fs.rmSync(swap.superseded, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  } catch (e) {
    return {
      deleted: false,
      reason: `旧副本已可删除但删不动(占用),现场保留:${swap.superseded} :: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  activeSwapScratch.delete(swap.superseded);
  return { deleted: true, reason: '旧副本已由同一事务的新副本承接,归档已清除' };
}

/**
 * 完整提交序列(唯一编排入口,cache 与 installer 共用)。
 *
 * 取消语义(逐字照此实现,不得改):`signal` 只在**进入提交点之前**被咨询;
 * 一旦开始取得槽位所有权,序列必须跑完 —— 越过落盘之后再回退,抹掉的就是已经生效的插件。
 */
export function commitStagedSwap(
  target: string,
  staging: string,
  opts?: { signal?: AbortSignal },
): { swap: StagedSwap; finalized: SwapFinalizeOutcome } {
  if (opts?.signal?.aborted) {
    discardStagingDirectory(staging);
    throw new PluginSwapCancelledError(target);
  }
  if (!isDirectoryPath(staging)) {
    throw new DirectorySwapError(
      target,
      `提交点之前暂存副本不在位,拒绝进入提交:${staging}(目标目录未被改动)`,
      null,
    );
  }
  let swap: StagedSwap;
  try {
    swap = takeOwnershipOfTarget(target, staging);
  } catch (e) {
    // 没拿到所有权 ⇒ 目标一步没动,临时物自己清掉
    discardStagingDirectory(staging);
    throw e;
  }
  try {
    landStagedSwap(swap);
    // ——— 提交点已越过:此后绝不回退,也绝不响应取消 ———
    return { swap, finalized: finalizeStagedSwap(swap) };
  } finally {
    activeSwapScratch.delete(staging);
  }
}

// ==================== 缓存读写 ====================

/** getOrCloneGitCache 的结果 */
export interface CacheFetchResult {
  localPath: string;
  fromCache: boolean;
  /**
   * 仅降级路径带:说清"复用的是哪一份过期副本、为什么没能刷新"。
   * 旧实现什么也不说就回 fromCache:true,读日志的人无从判断这是缓存还是新拉的。
   */
  staleReason?: string;
  /** 归档没清掉时点名落点(不影响本次成功与否) */
  archiveNote?: string;
}

/**
 * 获取或创建 Git URL 的本地缓存目录。
 *
 * 流程:
 *   1. 缓存命中(存在且未过期)→ 直接返回,fromCache=true
 *   2. 缓存过期 → clone 到 staging 备齐 → 提交序列替换旧副本;
 *      **clone/网络失败**才允许降级,且降级前必须校验旧副本确实在位可用(带 staleReason);
 *      **提交失败**一律上抛(那不是"离线",是出了故障),旧副本仍在位。
 *   3. 无缓存 → 必须 clone(同样先落 staging,不在权威路径留半成品);失败抛错
 *
 * @param url Git 仓库 URL
 * @param opts.ref 分支/tag 名(浅克隆)
 * @param opts.sha 指定 commit SHA(pin 到具体提交)
 * @param opts.ttlMs 缓存 TTL(默认 5 分钟)
 * @param opts.signal 取消通道(只在提交点之前生效)
 */
export async function getOrCloneGitCache(
  url: string,
  opts?: { ref?: string; sha?: string; ttlMs?: number; signal?: AbortSignal },
): Promise<CacheFetchResult> {
  const localPath = getCachePath(url);
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  if (opts?.signal?.aborted) throw new PluginSwapCancelledError(localPath);

  const hadCache = fs.existsSync(localPath);

  if (hadCache) {
    const stat = fs.statSync(localPath);
    const ageMs = Date.now() - stat.mtimeMs;
    // 命中除了"没过期"还必须"确实是可用副本":空目录/被删空的目录按 TTL 判会报成
    // "缓存命中",而调用方拿到的是一条指向空目录的路径(与降级同一型失效)。
    if (ageMs < ttl && isUsableDirectoryCopy(localPath)) {
      return { localPath, fromCache: true };
    }
  }

  // 缓存过期 / 无缓存:都先把新副本备到 staging,再进入提交点
  const staging = prepareStagingDirectory(localPath);
  try {
    performClone(url, staging, opts?.ref, opts?.sha);
  } catch (e) {
    // 只清 staging —— 目标目录到此为止一步没动过(旧实现的缺陷恰恰是"先删目标再改名")
    discardStagingDirectory(staging);
    const reason = e instanceof Error ? e.message : String(e);
    if (hadCache && isUsableDirectoryCopy(localPath)) {
      // 离线降级:必须"校验过仍在位且可用"才敢复用,并把过期说明带出去(不静默)
      const ageMs = Date.now() - fs.statSync(localPath).mtimeMs;
      return {
        localPath,
        fromCache: true,
        staleReason:
          `刷新失败已复用过期缓存:${reason}(缓存年龄 ${Math.round(ageMs / 1000)}s > TTL ${Math.round(ttl / 1000)}s)` +
          `,路径 ${localPath}`,
      };
    }
    // 没有可用副本:如实上抛。返回 fromCache:true 等于把"没拿到"写成"拿到了"
    throw new Error(
      `获取插件缓存失败且无可用的过期副本(未删除任何既有内容):${localPath} :: ${reason}`,
      { cause: e },
    );
  }

  // 提交点之后。失败 ⇒ 上抛(旧副本由 landStagedSwap 保证仍在位或已放回),绝不降级
  const { finalized } = commitStagedSwap(localPath, staging, { signal: opts?.signal });

  // 落盘后再打时间戳:失败只意味着下一轮会再刷一次,不回退已生效的副本
  try {
    const now = new Date();
    fs.utimesSync(localPath, now, now);
  } catch {
    // 不改判据结论:缓存内容已是权威状态
  }
  return {
    localPath,
    fromCache: false,
    ...(finalized.deleted ? {} : { archiveNote: finalized.reason }),
  };
}

/**
 * 清空整个 marketplace 缓存目录下的所有条目(不删除缓存根目录本身)。
 * 用于强制刷新或磁盘清理。
 *
 * 唯一不放行的路径:本进程**在途交换**留下的暂存/归档(删掉它们等于把一次正在进行的
 * 提交点半路过道拆掉 —— 那正是本票要防的"先删最后可用副本"形态)。
 */
export function clearMarketplaceCache(): void {
  const dir = getMarketplaceCacheDir();
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (activeSwapScratch.has(p)) continue;
    fs.rmSync(p, { recursive: true, force: true });
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
