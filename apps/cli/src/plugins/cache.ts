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
 *   - **崩溃后的恢复(G-730/G-731)**:`recoverStaleSwapArtifacts()` 是唯一处置入口,挂在
 *     `getOrCloneGitCache` 的读判据之前。两件事缺一不可 —— 问写者证据(marker 记 ownerPid+ownerId;
 *     旧 marker 没记 ⇒ "无凭据",只有零破坏的回位、永不获得删除权),并问**权威记录**是否已写上
 *     这笔事务号(`SwapAuthority`;只按目录形状猜会跨代读,或把权威仍指向的旧快照当垃圾删)。
 *     并发读者绝不把仍活跃写者的归档 rename 走(G-731:那等于抽掉写者唯一的回滚快照)。
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
 *       └─ .ihui-swap-transaction.json    ← 事务标记:transactionId + target + stagedAt
 *                                          + **ownerPid/ownerId(G-731 写者证据)**
 *                                          + **authorityPath/authorityKey(G-730 权威面)**
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
// G-815:git 派生的唯一封顶出口(timeout / maxBuffer / 净化 env 三件套都在它内部默认给全)。
// 本文件不再直接 import node:child_process —— 绕过它就没有封顶,而守门 80 的 HOT 清单已含本文件。
import { GIT_BIN_ENV, GIT_NETWORK_TIMEOUT_MS, execGitCapped, execGitCloneWithRetry } from './git-runner.js';
import { getInstalledPluginsDir, getMarketplaceCacheDir, getRegistryPath } from './paths.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';
// G-786:git 入参形状白名单的唯一判据(marketplace.ts 用同一份,不得在此重抄正则)
import { assertGitCloneInputs, GitCloneInputRejectedError } from './url-shape.js';
// G-747:符号链接可达性判定的**唯一**实现(G-705 落地)。本文件只消费它的四态结论 ——
// 不得在此再抄一份可降级错误码名单,也不得自己包一层真实路径解析(两处实现必漂移,AGENTS §4/守门 131)。
import { checkSymlinkContainment, type ContainmentStage } from './path-safety.js';
// 只取**类型**(编译期擦除):installer.js 在运行期 import 本文件,值边会成环,类型边不会。
import type { PluginPathUnsafeReason } from './installer.js';

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

/** 测试用:自定义 git 二进制路径(默认解析见 git-runner.ts::resolveGitBinary) */
// G-815:键名与解析逻辑一起搬进唯一出口 `./git-runner.js`(两处各写一份 ⇒ 换机/CI 下只有一处生效)。

/**
 * 计算 URL 对应的缓存路径 — sha1(url) 哈希作为目录名,避免特殊字符。
 * 返回绝对路径,不保证目录存在。
 */
export function getCachePath(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(getMarketplaceCacheDir(), hash);
}

/**
 * 缓存复制面独有的符号链接异常(字段形态与 installer.ts 的 `PluginPathUnsafeError` 同形)。
 *
 * 为什么不直接复用那个类:installer.js 在运行期 import cache.js(cache.js 是它的下游),
 * 反向再引一条值边就是循环依赖 —— 循环里的 class 声明在"谁先被求值"时会拿到未初始化的绑定,
 * 而这条边守的是复制路径,不该把"抛得出来"寄托在模块求值顺序上(AGENTS §3「跨包循环依赖」同族)。
 * 所以**共享的是判据(path-safety)与 reason 值域(类型引用)**,复制的只有外壳字段;
 * errno 名单在本文件零出现 —— 那才是本票要钉的东西。
 */
export class PluginCacheCopyUnsafeError extends Error {
  readonly code = 'plugin_cache_copy_unsafe';
  readonly reason: PluginPathUnsafeReason;
  readonly linkPath: string | null;
  readonly targetPath: string | null;
  readonly rootPath: string | null;
  readonly errno: string | null;
  readonly stage: ContainmentStage | null;
  constructor(msg: string, detail: { reason: PluginPathUnsafeReason; linkPath: string; targetPath: string; rootPath: string; errno?: string | null; stage?: ContainmentStage | null }) {
    super(msg);
    this.name = 'PluginCacheCopyUnsafeError';
    this.reason = detail.reason;
    this.linkPath = detail.linkPath;
    this.targetPath = detail.targetPath;
    this.rootPath = detail.rootPath;
    this.errno = detail.errno ?? null;
    this.stage = detail.stage ?? null;
  }
}

/**
 * 递归复制目录(内部工具,供 mock clone 与降级使用)。
 *
 * G-747 补的正是此前完全缺失的一维:旧实现遇到符号链接只做
 * `fs.statSync(resolved).isDirectory() ? copyDirRecursive(resolved, d) : copyFileSync(resolved, d)`
 * —— **没有任何可达性校验**,一条指向缓存根之外的链接会把外面那整棵树复制进 staging。
 * 同一判据我方已有唯一实现(`./path-safety.ts`,G-705 落地 676ee237),G-705 交付报告点名的
 * 就是这一格。现只消费它的四态结论(与 installer.ts 的 copyDirRecursive 同源同形):
 *   - `contained`        ⇒ 目标在根内,跟随复制(行为不变)。
 *   - `escape`           ⇒ 抛 `PluginCacheCopyUnsafeError`,一条内容都不再复制。
 *   - `unsafe`           ⇒ 同样抛。**为什么这里绝不"跳过"**:G-705 的判序是
 *     "取不到码 = 未知 = unsafe",未知不并进 missing;把"我没看见"记成"检查通过"就是
 *     fail-open,而这条链路吃的是**远端 manifest 指定的第三方仓库**。
 *   - `degraded-missing` ⇒ **允许跳过**:它是 `path-safety.ts` 里那份可降级错误码**封闭集合**内的
 *     **明确缺失**(悬空链接本机实测就是"路径不存在"那一码),不存在的东西不可能被复制进来;
 *     这与改动前"等价可过"。
 *     顺带改掉旧行为里另一处不体面:悬空链接原先在 `statSync` 上抛穿整条复制链(错误不带
 *     reasonCode),现在走同一份判定 ⇒ 干净跳过,其余内容照拷。
 * 抛出点仍在 staging 阶段:`getOrCloneGitCache` 的 catch 会 `discardStagingDirectory(staging)`,
 * 所以要么整棵可用,要么本次暂存被清掉且旧副本仍在位 —— 不留半份目录。
 */
function copyDirRecursive(src: string, dest: string, rootSrc?: string): void {
  const root = rootSrc ?? src;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(s), target);
      const verdict = checkSymlinkContainment({ linkPath: s, targetPath: resolvedTarget, rootPath: root });
      if (verdict.status === 'degraded-missing') continue;
      if (verdict.status !== 'contained') {
        const escape = verdict.status === 'escape';
        throw new PluginCacheCopyUnsafeError(
          escape
            ? `符号链接逃逸,拒绝复制缓存内容:${verdict.message}`
            : `符号链接可达性判不了,拒绝复制任何内容(旧副本仍在位):${verdict.message}`,
          {
            reason: escape ? 'symlink-escape' : 'symlink-unverifiable',
            linkPath: s,
            targetPath: resolvedTarget,
            rootPath: root,
            errno: verdict.status === 'unsafe' ? verdict.errno : null,
            stage: verdict.status === 'unsafe' ? verdict.stage : null,
          },
        );
      }
      if (fs.statSync(resolvedTarget).isDirectory()) {
        copyDirRecursive(resolvedTarget, d, root);
      } else {
        fs.copyFileSync(resolvedTarget, d);
      }
    } else if (entry.isDirectory()) {
      copyDirRecursive(s, d, root);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * 执行 git clone(或测试 mock)到 target 目录。
 *
 * G-786(形状白名单 + `--` 分隔,判据唯一实现在 `./url-shape.ts`):
 *   远端 manifest 的 `url` / `ref` / `sha` 是**外部字符串**,旧实现把它们原样塞进 argv 的位置参数位、
 *   且没有任何分隔符 —— git 的选项解析在位置参数之后仍然生效,于是 `"url":"--upload-pack=…"` 被当**选项**、
 *   `"url":"ext::sh -c …"` 在启用该 transport 的构建下等于执行。现在:
 *     1. **先审后动**,且审在测试钩子之前(否则 IHUI_MOCK_GIT_CLONE_SRC 会让用例绕开判据,
 *        而"拒绝路径根本不派生 git"就成了断言不出来的话);
 *     2. 位置参数前插 `--`(clone 的 url/target、fetch 的 sha);fetch 那一趟的 `origin` 是本函数的
 *        常量、不是外部串,所以分隔符放在它之后;
 *     3. `checkout` **不加** `--` —— 本机实测 `git checkout -- <sha>` 把 `<sha>` 当 pathspec 而 rc=1
 *        (`error: pathspec '504f…' did not match any file(s) known to git`),这一维改由
 *        `evaluateGitSha` 的十六进制值域闭合兜住,加分隔符等于把 SHA pin 的功能弄坏。
 *   派生方式(G-815/G-816):三趟全部收进唯一出口 `./git-runner.js` ——
 *     · `clone` 走 `execGitCloneWithRetry`:有限次数 + **只对派生层结构化码**(ETIMEDOUT 等白名单)退避,
 *       重试前复位目标目录(git 拒绝 clone 进非空目录,不复位等于第二轮必撞第一轮的残骸);
 *       安全拒绝类(G-786 的形状白名单)与取消**原样上抛、绝不退避** —— 那是 G-809 点名的面。
 *     · `fetch` / `checkout` 走 `execGitCapped`(封顶但**不重试**):fetch 的"复位"会删掉已 clone 的仓库,
 *       语义与 clone 不同;checkout 是本地操作,失败重跑必然复现。
 *     旧写法 `{ stdio:'pipe', windowsHide:true }` 三件套全缺(无 timeout / 无 maxBuffer / 完整继承父进程
 *     `GIT_DIR`·`GIT_INDEX_FILE`·`GIT_CONFIG_GLOBAL`·`GIT_SSH_COMMAND`)⇒ 挂起无上限、大输出 ENOBUFS 后
 *     "clone 失败但东西在"、从别处上下文派生时 clone 落到错误的对象库。windowsHide 仍由出口内部给(AGENTS §5b/守门 52)。
 */
async function performClone(
  url: string,
  target: string,
  ref?: string,
  sha?: string,
  signal?: AbortSignal,
): Promise<void> {
  // 咽喉点:任何 git 派生之前必须过形状白名单(结构化 reasonCode,不靠错误文案判断)
  //
  // G-797:回环 http 只在**测试钩子在位**时放行。判据取的是这一族**已有**的两个钩子
  // (`IHUI_MOCK_GIT_CLONE_SRC` / `IHUI_GIT_BIN`),不新造第三个开关名 —— 新开关等于第二套
  // "我在测试里"的真相,而生产路径上没人会设它,于是那一档永远只在测试里被跑到过。
  // 键名各自只有一个主人:前者是本文件 :67,后者是 git-runner.ts::GIT_BIN_ENV(G-815 收口)。
  const loopbackTestHook = Boolean(process.env[MOCK_CLONE_SRC_ENV] || process.env[GIT_BIN_ENV]);
  assertGitCloneInputs({ url, ref, sha }, { loopbackTestHook });
  const mockSrc = process.env[MOCK_CLONE_SRC_ENV];
  if (mockSrc) {
    // 测试钩子:复制指定目录作为 clone 结果
    copyDirRecursive(mockSrc, target);
    return;
  }
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push('--', url, target);
  await execGitCloneWithRetry(args, target, { timeoutMs: GIT_NETWORK_TIMEOUT_MS, signal });
  if (sha) {
    // 拉取指定 commit 并 checkout(SHA pin)
    execGitCapped(['-C', target, 'fetch', '--depth=1', 'origin', '--', sha], {
      timeoutMs: GIT_NETWORK_TIMEOUT_MS,
    });
    execGitCapped(['-C', target, 'checkout', sha]);
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

/**
 * 本进程这一次"交换主体身份"的凭据(G-731 机制出处的 `atomicProcessOwnerId` 同形)。
 * ownerPid 单独不够:pid 会被系统复用,而"复用后的新进程"恰恰最容易被误判成"写者还活着/已死"。
 * 所以 marker 同时记 ownerPid + ownerId,回读时两元都对得上才认定是**本进程**在途的交换。
 */
const processSwapOwnerId = crypto.randomUUID();

/** 供诊断与测试引用"本进程盖进 marker 的那份 ownerId"(不得在别处再算一份) */
export function currentSwapProcessOwnerId(): string {
  return processSwapOwnerId;
}

/**
 * 权威记录面(G-730)。机制出处:上游 `atomic-directory.ts:99-147` 的恢复分支先问
 * `authorityContainsTransactionSync(authorityPath, transactionId)` —— **"盘上目录形状"不是
 * 提交与否的证据,权威记录里有没有这笔事务号才是**。
 *
 * 本仓的权威记录 = `~/.ihui/installed-plugins/registry.json`(`getRegistryPath()`)。
 * 它由 `installer.ts` 的 `saveInstallRegistry()` 写(G-730/G-731 的禁改面),所以:
 *   - 读侧现在就生效 —— 交换落在 installed-plugins 之下时,恢复/处置都必须问它;
 *   - 写侧(registry 记录里落 `transactionId` 字段)属 installer.ts 持有者的下一笔。
 *     在它落地前 `authorityContainsTransaction()` 对安装目录恒为 false ⇒ 恢复只会做
 *     "零破坏的回位",绝不删任何一份现场(见 `recoverStaleSwapArtifacts` 的判据表)。
 */
export interface SwapAuthority {
  /** 权威记录文件绝对路径 */
  readonly path: string;
  /**
   * 该 target 在权威记录里对应的那条记录的主键值(本仓 = 插件名)。
   * 给了它就只在**那一条记录内部**找事务号 —— 不给则整份文档搜。
   * 刻意不是"整份文档一律搜":另一插件留下的同号会让本 target 被误判成"权威已认这笔"。
   */
  readonly recordKey?: string | null;
}

/**
 * 由 target 路径推导权威面;推导不出(不是安装目录 / 名字对不上任何记录主键)⇒ null = standalone。
 * 唯一实现,`takeOwnershipOfTarget` 与恢复流程都走它,不得各算各的。
 */
export function authorityForTarget(target: string): SwapAuthority | null {
  const installRoot = path.resolve(getInstalledPluginsDir());
  const abs = path.resolve(target);
  if (abs === installRoot) return null; // 安装根本身不是"某插件的一代目录"
  const rel = path.relative(installRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // 只认 installed-plugins 的**直接子目录**(= getPluginInstallPath(name) 的形态)
  const name = rel.split(path.sep)[0];
  if (!name || rel.split(path.sep).length !== 1) return null;
  return { path: getRegistryPath(), recordKey: name };
}

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
  /** 本笔交换所属的权威记录面;null = standalone(没有任何记录可以说"这笔已认") */
  readonly authority: SwapAuthority | null;
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

function writeSwapMarker(swap: {
  transactionId: string;
  target: string;
  authority: SwapAuthority | null;
}): void {
  const supersededDir = supersededPathFor(swap.target);
  const payload = JSON.stringify({
    transactionId: swap.transactionId,
    target: swap.target,
    stagedAt: new Date().toISOString(),
    // G-731:写者身份。marker 只代表"事务已开始",要判断写者是否已退出必须有这两元。
    ownerPid: process.pid,
    ownerId: processSwapOwnerId,
    // G-730:这笔事务的权威面在哪、对应哪条记录 —— 恢复时问的就是它。
    authorityPath: swap.authority?.path ?? null,
    authorityKey: swap.authority?.recordKey ?? null,
  });
  // 落盘一律走全仓唯一的原子写出口(不得在这里再抄一份 tmp+rename 重试)
  const markerPath = path.join(supersededDir, SWAP_MARKER_NAME);
  commitAtomicWrite(captureWriteBaseline(markerPath), payload);
}

/**
 * 归档事务标记的完整形态。
 * `ownerPid`/`ownerId`/`authorityPath`/`authorityKey` 都是 **G-730/731 新增**,
 * 存量 marker(2026-09-29 之前落的)只有 transactionId/target/stagedAt ⇒ 这几项为 null,
 * 下游一律按"无凭据"处置(见 `classifySwapOwnerEvidence`),**不得**据缺字段推断写者已死。
 */
export interface SwapMarkerRecord {
  readonly transactionId: string;
  readonly target: string | null;
  readonly ownerPid: number | null;
  readonly ownerId: string | null;
  readonly authorityPath: string | null;
  readonly authorityKey: string | null;
}

/** 读回归档标记的全部字段;读不到 / JSON 坏 / 没有字符串事务号 ⇒ null(= 无从证明它是谁家的现场) */
function readSwapMarkerRecord(supersededDir: string): SwapMarkerRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(supersededDir, SWAP_MARKER_NAME), 'utf-8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.transactionId !== 'string') return null;
    return {
      transactionId: obj.transactionId,
      target: typeof obj.target === 'string' ? obj.target : null,
      ownerPid: typeof obj.ownerPid === 'number' && Number.isSafeInteger(obj.ownerPid) ? obj.ownerPid : null,
      ownerId: typeof obj.ownerId === 'string' ? obj.ownerId : null,
      authorityPath: typeof obj.authorityPath === 'string' ? obj.authorityPath : null,
      authorityKey: typeof obj.authorityKey === 'string' ? obj.authorityKey : null,
    };
  } catch {
    return null;
  }
}

/** 读回归档里的事务号;读不到/形状不对一律返回 null(= 无从证明它是本次交换的产物) */
function readSwapMarker(supersededDir: string): string | null {
  return readSwapMarkerRecord(supersededDir)?.transactionId ?? null;
}

/**
 * 权威记录对这笔事务的三种结论(G-730 的"问权威面",上游 `authorityContainsTransactionSync`
 * 的对应物 —— 但比它多一档,原因见 `unknown`)。
 *   - `committed`     ⇒ 权威记录里就写着这个事务号 ⇒ 这次交换已被权威确认,归档可以处置;
 *   - `not-committed` ⇒ 权威记录带事务号字段、而写的是**别的**号 ⇒ 权威认的是另一代,
 *                       这一代没被认 ⇒ 绝不能把权威仍指向的那份旧快照当垃圾删;
 *   - `unknown`       ⇒ 无从问出(文件不存在 / JSON 坏 / 没有对应记录 / **记录还没带 transactionId 字段**)。
 *
 * 为什么要单列 `unknown` 而不是折成 `not-committed`:权威记录写侧的 `transactionId` 字段属
 * `installer.ts` 的 `saveInstallRegistry()`/`InstallRecord`(G-730/G-731 的禁改面),此刻 registry
 * 记录里根本没有这个键。把"字段缺席"读成"权威否认这笔",会让每一次正常覆盖安装都不肯清归档
 * —— 那是拿别人的未接线造一台恒挡的门。`unknown` 在处置侧一律走"零破坏"路径,
 * 而 installer 一旦开始写这个字段,本判据**当场自动变严**(无需再改代码)。
 */
export type AuthorityTransactionVerdict = 'committed' | 'not-committed' | 'unknown';

/** 在给定子树里收集所有键名为 transactionId 的字符串值(唯一一份遍历实现,两侧共用) */
function collectTransactionIds(node: unknown, keyHits: string[], anyKeyPresent: { v: boolean }): void {
  if (typeof node !== 'object' || node === null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTransactionIds(item, keyHits, anyKeyPresent);
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'transactionId') {
      anyKeyPresent.v = true;
      if (typeof v === 'string') keyHits.push(v);
    }
    collectTransactionIds(v, keyHits, anyKeyPresent);
  }
}

/** 权威面里与该 target 对应的那条记录(没给 recordKey ⇒ 整份文档);取不到 ⇒ null */
function authorityScope(authority: SwapAuthority): { readonly present: boolean; readonly node: unknown } {
  let raw: string;
  try {
    raw = fs.readFileSync(authority.path, 'utf-8');
  } catch {
    return { present: false, node: null };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return { present: false, node: null };
  }
  if (typeof authority.recordKey !== 'string' || authority.recordKey.length === 0) {
    return { present: true, node: value };
  }
  // 给了 recordKey 就只在那一条记录内部问 —— 避免别的插件留下的同号把本 target 洗成"已提交"
  const records = (value as { records?: unknown } | null)?.records;
  const hit = Array.isArray(records)
    ? records.find(
        (r) => !!r && typeof r === 'object' && (r as { name?: unknown }).name === authority.recordKey,
      )
    : undefined;
  if (hit === undefined) return { present: false, node: null };
  return { present: true, node: hit };
}

export function authorityTransactionVerdict(
  authority: SwapAuthority,
  transactionId: string,
): AuthorityTransactionVerdict {
  const scope = authorityScope(authority);
  if (!scope.present) return 'unknown';
  const keyHits: string[] = [];
  collectTransactionIds(scope.node, keyHits, { v: false });
  if (keyHits.length === 0) return 'unknown'; // 字段缺席 ≠ 字段否认(见上面 doc 的"为什么")
  return keyHits.includes(transactionId) ? 'committed' : 'not-committed';
}

/** 布尔投影(唯一实现 = 上面那条判据);上游同名判据在本仓的对应写法 */
export function authorityContainsTransaction(authority: SwapAuthority, transactionId: string): boolean {
  return authorityTransactionVerdict(authority, transactionId) === 'committed';
}

/**
 * 归档 marker 的写者是否**已被排除**为"还在写"。三态,绝不折成布尔:
 *   - `in-process`  ⇒ ownerPid/ownerId 与本进程逐字相同 ⇒ 这是**本进程**在途的交换 ⇒ 谁都不许动;
 *   - `live`        ⇒ 那个 pid 上确有一个进程、且身份无从否证 ⇒ 写者可能正在提交 ⇒ 一条都不动(G-731);
 *   - `dead`        ⇒ 判活给出"该 pid 上没有进程" ⇒ 写者已退出 ⇒ 允许按权威面回位;
 *   - `unverifiable`⇒ 旧 marker 没有 ownerPid/ownerId(存量形态)或判活本身问不到 ⇒ **无凭据**:
 *                     既不得据此抢占(绝不删任何现场),也不得判"一定是活跃写者"而拒绝零破坏的回位。
 *
 * 判活实现**复用仓里已有的那一份**:`apps/cli/src/tools/mcp-oauth.ts:834` 的 `isProcessAlive`。
 * 两个候选方向的取舍(约束 1):
 *   ① `scripts/lib/git-native-locks.mjs:91-110`(`classifyLock(lock,{isPidAlive})`)—— 它是**注入式**的,
 *      自己不含判活,而且住在 `scripts/**`:`apps/cli/tsconfig.json` 写死 `rootDir:"src"` ⇒ src import
 *      它直接 TS6059,发布清单 `files:["dist","src"]` 也根本不含 scripts/(本文件 116-118 行已记过一次)。
 *   ② mcp-oauth 的 `isProcessAlive` —— 同包、已导出、且带实测口径
 *      (`apps/cli/tests/mcp-oauth.test.ts:306-331`:EPERM 视为存活;Windows 下 PID 1 行为不确定,
 *       所以测试不得拿 PID 1 当"死进程"夹具)。⇒ **选 ②**。
 * 刻意**不在这里手写 `process.kill(pid,0)`**(约束 1:不得新造第三份实现);也因此用 dynamic import
 * 只在"确实有遗留归档要判"时才把那一路模块拉进来,交换主路径与无遗留时的恢复都不付这个代价。
 */
export type SwapOwnerEvidence = 'in-process' | 'live' | 'dead' | 'unverifiable';

/** 判活通道(测试注入点;缺省 = 复用 mcp-oauth 那份实现) */
export type PidAliveProbe = (pid: number) => Promise<boolean>;

async function defaultPidAliveProbe(pid: number): Promise<boolean> {
  const mod = await import('../tools/mcp-oauth.js');
  return mod.isProcessAlive(pid);
}

async function classifySwapOwner(
  marker: SwapMarkerRecord,
  isPidAlive: PidAliveProbe,
): Promise<{ evidence: SwapOwnerEvidence; why: string }> {
  if (marker.ownerPid === null || marker.ownerId === null) {
    return { evidence: 'unverifiable', why: '存量 marker 未记 ownerPid/ownerId ⇒ 无从证明写者已退出' };
  }
  if (marker.ownerPid <= 0) return { evidence: 'unverifiable', why: `非法 ownerPid=${marker.ownerPid}` };
  if (marker.ownerPid === process.pid) {
    // 同 pid + 同 ownerId ⇒ 就是本进程在途的交换;同 pid 而 ownerId 不同 ⇒ 该 pid 已被系统复用给本进程,
    // 原写者必已退出(照上游 `isAtomicTransactionOwnerAlive` 的同一判序,不得反过来判"活着")。
    if (marker.ownerId === processSwapOwnerId) return { evidence: 'in-process', why: '本进程在途的交换' };
    return { evidence: 'dead', why: 'ownerPid 与本进程相同但 ownerId 不符 ⇒ pid 已被复用,原写者已退出' };
  }
  try {
    const alive = await isPidAlive(marker.ownerPid);
    return alive
      ? { evidence: 'live', why: `ownerPid=${marker.ownerPid} 仍在世 ⇒ 写者可能正在提交(G-731)` }
      : { evidence: 'dead', why: `ownerPid=${marker.ownerPid} 上已无进程 ⇒ 写者已退出` };
  } catch (e) {
    return { evidence: 'unverifiable', why: `判活问不到:${e instanceof Error ? e.message : String(e)}` };
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
export function takeOwnershipOfTarget(
  target: string,
  staging: string,
  opts?: { authority?: SwapAuthority | null },
): StagedSwap {
  const transactionId = crypto.randomUUID();
  // 未显式给(undefined / 没这个键)⇒ 由路径推导(安装目录 ⇒ registry 那条记录;其余 ⇒ standalone);
  // 显式给 null ⇒ 调用方点名"这笔没有权威面",不再推导。唯一实现见 authorityForTarget。
  const authority = opts?.authority !== undefined ? opts.authority : authorityForTarget(target);
  const swapBase: Omit<StagedSwap, 'superseded' | 'hadPrevious'> = { target, staging, transactionId, authority };
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
    writeSwapMarker(swap);
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
 * 前置缺一不可,否则只保留不删:
 *   ① 目标确实是落好的新副本,且 staging 已被改名带走;
 *   ② 归档里的事务标记等于本句柄的 transactionId(证明它就是本次交换挪出来的那一份);
 *   ③ **G-730 新增**:权威面没有否认这笔事务。
 *      只比"归档 marker ⊕ 本句柄事务号"等于自己在给自己发合格证 —— 进程在 rename 与
 *      "权威记录写盘"之间崩溃时,盘上会同时留着两代目录,而这条对账照样绿,于是恢复/收尾会
 *      把权威仍指向的那份旧快照当垃圾删。现在权威记录带 transactionId 字段并写着别的号 ⇒ 拒删。
 *      字段尚未接线时是 `unknown`(见 `authorityTransactionVerdict` 的"为什么"),行为与改动前逐字一致。
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
  if (swap.authority) {
    const verdict = authorityTransactionVerdict(swap.authority, swap.transactionId);
    if (verdict === 'not-committed') {
      return {
        deleted: false,
        reason:
          `权威记录(${swap.authority.path})带的是另一笔事务号,本次交换未获权威确认,` +
          `归档保留不删:${swap.superseded}`,
      };
    }
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
  opts?: { signal?: AbortSignal; authority?: SwapAuthority | null },
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
    swap = takeOwnershipOfTarget(target, staging, { authority: opts?.authority });
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

// ==================== 崩溃后的恢复(G-730 / G-731) ====================
//
// 形态取自上游 `atomic-directory.ts:89-97,129-159`,那两句原文注释是要防的东西本身:
//   「marker 只表示事务已经开始，不能证明 writer 已退出。普通 overview/discovery
//     读取若恢复仍活跃的事务，会抢走 rollback backup，甚至删除 writer 的 staging。」
// 所以恢复必须同时问两件事:① **写者还在不在**(G-731:并发读者把写者刚挪出的旧副本 rename 走,
//    写者失败时就没有快照可回滚);② **权威认不认这笔**(G-730:只按目录形状猜会跨代读 ——
//    manifest 是新一代而记录是新一代没写过的旧记录,或者把权威仍指向的旧快照当垃圾删)。
//
// 处置表(action 面唯一实现;每一行都有一条用例钉住,见 tests/plugin-cache-rollback.test.ts):
//   写者证据        权威结论            目标槽位    动作
//   live            —                   —           一条都不动(G-731)
//   in-process      —                   —           本进程在途,不动
//   dead            committed           在位        只清归档,目标不动(=正常提交的收尾)
//   无凭据/未判定   committed           在位        **不动**(缺证据不算"写者已退出",不抢占)
//   dead/无凭据     committed           空          归档回位(权威认它,槽位却空 = 异常磁盘态)
//   dead/无凭据     not-committed       空          归档回位(权威认的还是旧代 ⇒ 旧代回位)
//   dead/无凭据     not-committed       在位        **两份并存,一条不动并报名**(跨代并存要人裁决)
//   dead/无凭据     unknown             空          归档回位(零破坏,不做任何删除)
//   dead/无凭据     unknown             在位        不动并报名
//   无标记          —                   —           不是本机制的现场 ⇒ 绝不动别人的东西
// `unverifiable`(存量 marker 没有 ownerPid/ownerId)刻意**不等于** "写者已死":
// 它只拿到"零破坏的回位",永不获得删除权 —— 抢占需要正面证据,缺证据不算证据。

/** 恢复对单个遗留归档的结论 */
export interface SwapRecoveryEntry {
  readonly archive: string;
  readonly action:
    | 'restored'
    | 'archive-deleted'
    | 'left-as-is'
    | 'skipped-live-writer'
    | 'skipped-in-process';
  readonly reason: string;
}

async function restoreArchiveToTarget(archive: string, target: string): Promise<SwapRecoveryEntry> {
  try {
    fs.renameSync(archive, target);
  } catch (e) {
    return {
      archive,
      action: 'left-as-is',
      reason: `回位失败,现场保留(未删除任何内容):${archive} → ${target} :: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  activeSwapScratch.delete(archive);
  // 标记是"归档属于哪笔事务"的凭据,回位后它已经不再描述任何在途事务;
  // 留在恢复出来的权威副本里只会被下一轮恢复当成现场证据读到,故就地摘掉(只删这一个文件)。
  try {
    fs.rmSync(path.join(target, SWAP_MARKER_NAME), { force: true });
  } catch {
    // 摘不掉不改判据结论:内容已回位,下一轮恢复会再问一次
  }
  return { archive, action: 'restored', reason: `旧副本已回位到权威槽位:${target}` };
}

async function deleteCommittedArchive(archive: string): Promise<SwapRecoveryEntry> {
  try {
    fs.rmSync(archive, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  } catch (e) {
    return {
      archive,
      action: 'left-as-is',
      reason: `归档已可删除但删不动(占用),现场保留:${archive} :: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  activeSwapScratch.delete(archive);
  return { archive, action: 'archive-deleted', reason: '权威已确认这笔事务且新副本在位,归档已清除' };
}

/**
 * 恢复某个 target 遗留的 `.superseded-*` 归档(崩溃窗口的唯一处置出口)。
 *
 * 零成本早退:父目录不存在或没有任何 `.superseded-` 条目时**同步返回空数组**,
 * 不派生、不 import 判活通道 —— 它挂在每次 `getOrCloneGitCache` 的入口,不能变成一条常驻开销。
 *
 * `opts.authority` = 覆盖权威面(测试与调用方点名用);缺省按 marker 里记的那份问,
 * marker 没记(存量形态)再退回 `authorityForTarget(target)` 推导。
 */
export async function recoverStaleSwapArtifacts(
  target: string,
  opts?: { isPidAlive?: PidAliveProbe; authority?: SwapAuthority | null },
): Promise<SwapRecoveryEntry[]> {
  const parent = path.dirname(target);
  const base = path.basename(target);
  const prefix = `${base}${SUPERSEDED_SUFFIX}`;
  let entries: string[];
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return []; // 缓存根还没有 ⇒ 不可能有遗留现场
  }
  const archives = entries.filter((name) => name.startsWith(prefix) && name !== base);
  if (archives.length === 0) return [];

  const probe = opts?.isPidAlive ?? defaultPidAliveProbe;
  const outcomes: SwapRecoveryEntry[] = [];
  for (const name of archives) {
    const archive = path.join(parent, name);
    // "本进程在途"这一档只有一份判据:marker 的 ownerPid + ownerId 与本进程逐字相同
    // (见 classifySwapOwner 的 in-process 分支)。刻意**不再**用 activeSwapScratch 做第二道预筛 ——
    // 那是同一件事的第二份实现(必漂移),而且那份集合还兼顾着 staging 与 clearMarketplaceCache,
    // 挪用到恢复这里只会让判据多一条没人审的旁路。
    if (!isDirectoryPath(archive)) {
      outcomes.push({ archive, action: 'left-as-is', reason: '同名条目不是目录,不是本机制的现场' });
      continue;
    }
    const marker = readSwapMarkerRecord(archive);
    if (!marker) {
      // 没有标记 ⇒ 无从证明这是哪笔交换挪出来的旧副本 ⇒ 一条都不动(§7 删除安全)
      outcomes.push({ archive, action: 'left-as-is', reason: `归档里没有 ${SWAP_MARKER_NAME},不属本机制的现场` });
      continue;
    }
    const { evidence, why } = await classifySwapOwner(marker, probe);
    if (evidence === 'live') {
      outcomes.push({ archive, action: 'skipped-live-writer', reason: `${why} ⇒ 恢复一条都不动(G-731)` });
      continue;
    }
    if (evidence === 'in-process') {
      outcomes.push({ archive, action: 'skipped-in-process', reason: why });
      continue;
    }
    const authority =
      opts && opts.authority !== undefined
        ? opts.authority
        : marker.authorityPath
          ? { path: marker.authorityPath, recordKey: marker.authorityKey }
          : authorityForTarget(marker.target ?? target);
    const verdict = authority ? authorityTransactionVerdict(authority, marker.transactionId) : 'unknown';
    const slotFree = !fs.existsSync(target);
    const ask = authority
      ? `权威面 ${authority.path}${authority.recordKey ? `(记录 ${authority.recordKey})` : ''} 结论=${verdict}`
      : '该 target 无权威记录可问(standalone)';

    if (verdict === 'committed') {
      if (slotFree) {
        // 权威认这笔、槽位却空着(异常磁盘态)⇒ 回位一个完整版本,零破坏
        const entry = await restoreArchiveToTarget(archive, target);
        outcomes.push({ ...entry, reason: `${entry.reason}(${why};权威已认这笔)` });
        continue;
      }
      if (evidence !== 'dead') {
        // 无凭据不得抢占(约束 2):写者可能只是还没跑完它那一步清理,此刻删归档
        // 抽掉的就是它唯一的回滚快照 —— 与 G-731 是同一型事故,只是发生在"删"这一侧。
        outcomes.push({
          archive,
          action: 'left-as-is',
          reason: `${why} ⇒ 权威虽已认这笔,但写者证据不足,不抢占:归档保留 ${archive}`,
        });
        continue;
      }
      outcomes.push(await deleteCommittedArchive(archive));
      continue;
    }
    // not-committed / unknown:只有"槽位为空"的回位是零破坏动作;两代并存一律交人工
    if (slotFree) {
      const entry = await restoreArchiveToTarget(archive, target);
      outcomes.push({ ...entry, reason: `${entry.reason}(${why};${ask})` });
      continue;
    }
    outcomes.push({
      archive,
      action: 'left-as-is',
      reason: `${why};${ask} ⇒ 盘上两代目录并存且不等于"权威已认这笔",两份都保留、一条不动,需人工裁决`,
    });
  }
  return outcomes;
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

  // G-730:上一次进程在 rename 与权威落盘之间崩溃 ⇒ 这里可能躺着一份无人处置的归档。
  // 在读判据之前先恢复(判活不过的现场一律不动 ⇒ 并发写者的快照不会被抢走,G-731),
  // 否则本函数会走 hadCache=false 去重新 clone,把最后一份可用旧副本永久留在归档里。
  await recoverStaleSwapArtifacts(localPath);

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
    await performClone(url, staging, opts?.ref, opts?.sha, opts?.signal);
  } catch (e) {
    // G-786:形状白名单的拒绝**不是**"网络失败"—— 输入根本没进 git,把它包成缓存失败、或据此降级
    // 复用过期副本,都会让调用方丢掉结构化 reasonCode 并把"被拒"读成"离线可用"。staging 照清,错误原样上抛。
    if (e instanceof GitCloneInputRejectedError) {
      discardStagingDirectory(staging);
      throw e;
    }
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
