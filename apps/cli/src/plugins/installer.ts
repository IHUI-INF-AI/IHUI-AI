// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins Marketplace 安装器 — 实现本地/Git 插件的安装、卸载、注册表持久化。
 *
 * 灵感来源:参考行业 Agent 框架的 plugin marketplace 安装流程。
 * 设计:
 *   - installPlugin(source):自动识别本地路径 vs Git URL,分流安装
 *   - installMarketplacePlugin(name, marketplaceRoot):从 marketplace 索引查找后安装
 *   - uninstallPlugin(name):删除安装目录 + 可选保留 plugin-data
 *   - Registry 持久化到 ~/.ihui/installed-plugins/registry.json,支持去重短路
 *   - 路径安全:拒 `..` 越界、符号链接逃逸;**realpath 判不了不再等于放行**(G-705)——
 *     可跳过的 errno 是封闭集 `{ENOENT, ENOTDIR, EISDIR}`(唯一实现在 `./path-safety.ts`),
 *     EPERM/EACCES/ELOOP 及任何未知形态一律判 unsafe ⇒ 拒装并给出点名到链接/阶段/错误码的诊断。
 *   - **安装落盘有提交点**:新副本先完整复制进 staging,才进入提交序列
 *     (旧副本原子改名挪开 → 新副本落位 → **本次事务号随权威记录 registry.json 落盘**
 *     → 事务号核对后才处置旧副本)。次序是判据不是风格(G-756,上游
 *     `atomic-directory.ts:303-305`「权威先于删归档」):权威写失败即抛,归档一律不处置。
 *     复制失败 / 取消 / 落盘失败 ⇒ 旧副本一律仍在位。
 *
 * 修复缘由(实测缺陷,2026-09-28):旧实现在覆盖安装里先 `rmSync(dest)` 再 `copyDirRecursive`,
 * 于是"复制/移动失败或被取消"时**最后可用副本已被删掉**,用户侧表现是"插件突然没了"。
 * 现在 dest 只在提交点之后、且新副本已在 staging 完整备好时才被换掉。
 *
 * 安装目录布局:
 *   ~/.ihui/installed-plugins/
 *     <plugin-name>/          ← 插件文件(从源复制)
 *       plugin.json
 *     <plugin-name>.staging-<pid>-<n>/    ← 在途新副本(提交点之前唯一可动)
 *     <plugin-name>.superseded-<pid>/     ← 旧副本归档(权威状态落盘 + 事务号核对后才删)
 *     registry.json           ← 全局安装记录(经 util/atomic-write 原子落盘)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getPluginInstallPath,
  getPluginDataDir,
  getRegistryPath,
} from './paths.js';
import {
  getOrCloneGitCache,
  takeOwnershipOfTarget,
  landStagedSwap,
  finalizeStagedSwap,
  discardStagingDirectory,
  isUsableDirectoryCopy,
  prepareStagingDirectory,
  PluginSwapCancelledError,
  type StagedSwap,
} from './cache.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';
import {
  checkSymlinkContainment,
  classifyRealpathFailure,
  type ContainmentStage,
} from './path-safety.js';
import {
  scanMarketplace,
  findPluginInIndex,
  isLocalSource,
  isGitSource,
  type MarketplacePluginEntry,
  type MarketplaceSource,
} from './marketplace.js';

// ==================== 类型定义 ====================

/** 安装结果 */
export interface InstallOutcome {
  name: string;
  version?: string;
  /** 安装目标绝对路径 ~/.ihui/installed-plugins/<name>/ */
  installedPath: string;
  /** 'local' 或 'git:url' */
  source: string;
  /** 之前是否已装(短路径返回 true,不重复复制) */
  wasInstalled: boolean;
  /**
   * 本次落位的事务号(G-756),它同时写进了权威记录(`registry.json` 对应那条)。
   * `wasInstalled: true` 的短路路径没有交换 ⇒ 该字段为 undefined。
   * 调用方(与恢复侧的对账)据此能问出"这笔是不是权威认的那一笔",不必再猜。
   */
  transactionId?: string;
}

/** 卸载结果 */
export interface UninstallOutcome {
  name: string;
  /** 已删除的安装目录路径(未找到时为空字符串) */
  removedPath: string;
  /** 是否存在 plugin-data 目录 */
  hadData: boolean;
}

/** 单条安装记录 */
export interface InstallRecord {
  name: string;
  version?: string;
  sourceType: 'local' | 'git';
  /** Git 源 URL(仅 git 类型) */
  sourceUrl?: string;
  /** 本地源绝对路径(仅 local 类型) */
  sourcePath?: string;
  /** 多插件 repo 子目录(git 类型,可选) */
  pluginSubdir?: string;
  /** 安装时间 ISO 时间戳 */
  installedAt: string;
  /** Git pin SHA(可选) */
  sha?: string;
  /**
   * 落这笔记录的那次目录交换的事务号(G-756 接线)。
   *
   * **可选,且接线前写的存量记录一律没有这个键** —— 权威读侧(`cache.ts` 的
   * `authorityTransactionVerdict`)对"字段缺席"给的是 `unknown`(无从问出),
   * **不是** `not-committed`:把"没写过"读成"权威否认这笔",会让每一次正常覆盖安装
   * 都不肯清归档(那正是读侧注释里点名要避免的恒挡门)。判序与 G-730 的
   * `unverifiable` 同一条规矩 —— 缺证据不算证据:既不据此判已提交,也不据此判被否认。
   * 所以存量 registry 不需要迁移,恢复/收尾对它们的行为与接线前逐字一致。
   */
  transactionId?: string;
}

/** 安装注册表 */
export interface InstallRegistry {
  records: InstallRecord[];
}

// ==================== 异常类型 ====================

/** 插件清单缺失异常 */
export class PluginManifestMissingError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PluginManifestMissingError';
  }
}

/**
 * 判红的三种来源(调用方据此分流,不靠读文案猜):
 *   - `outside-base-dir`       解析后路径越出基准目录(原行为)
 *   - `symlink-escape`         符号链接真实目标越界(原行为)
 *   - `symlink-unverifiable`   **新增**:可达性判不了(EPERM/EACCES/ELOOP/未知码)——
 *     旧实现在这一格 `catch {}` / `continue` 直接放行,即 fail-open;现在按不安全处置
 *   - `unspecified`            未附详情的历史构造形态(保持向后兼容)
 */
export type PluginPathUnsafeReason =
  | 'unspecified'
  | 'outside-base-dir'
  | 'symlink-escape'
  | 'symlink-unverifiable';

/** 附在异常上的结构化诊断(全部可为空,便于旧构造调用一字不改地继续工作)。 */
export interface PluginPathUnsafeDetail {
  reason?: PluginPathUnsafeReason;
  /** 出问题的符号链接自身 */
  linkPath?: string | null;
  /** 链接目标 / 解析后的路径 */
  targetPath?: string | null;
  /** 允许范围的根 */
  rootPath?: string | null;
  /** 判不了时拿到的 errno(null = 连码都取不到,同样判 unsafe) */
  errno?: string | null;
  /** 判不了发生在哪一步(仅 symlink-unverifiable 有值) */
  stage?: ContainmentStage | null;
}

/**
 * 插件路径不安全异常(包含 `..` 越界、符号链接逃逸、符号链接可达性判不了)。
 *
 * 为什么带字段而不是只带一句文案:第三方插件被拒时,调用方(命令层/日志/未来的装载审计)
 * 需要能回答"是哪条链接、哪个码、哪一步"。文案里嵌这些信息,读的人就得再解析一次文案。
 */
export class PluginPathUnsafeError extends Error {
  readonly code = 'plugin_path_unsafe';
  readonly reason: PluginPathUnsafeReason;
  readonly linkPath: string | null;
  readonly targetPath: string | null;
  readonly rootPath: string | null;
  readonly errno: string | null;
  readonly stage: ContainmentStage | null;
  constructor(msg: string, detail?: PluginPathUnsafeDetail) {
    super(msg);
    this.name = 'PluginPathUnsafeError';
    this.reason = detail?.reason ?? 'unspecified';
    this.linkPath = detail?.linkPath ?? null;
    this.targetPath = detail?.targetPath ?? null;
    this.rootPath = detail?.rootPath ?? null;
    this.errno = detail?.errno ?? null;
    this.stage = detail?.stage ?? null;
  }
}

// ==================== Registry 持久化 ====================

/**
 * 加载安装注册表。文件不存在/损坏时返回空注册表,不抛异常。
 */
export function loadInstallRegistry(): InstallRegistry {
  const p = getRegistryPath();
  if (!fs.existsSync(p)) return { records: [] };
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { records: [] };
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.records)) return { records: [] };
    return parsed as InstallRegistry;
  } catch {
    return { records: [] };
  }
}

/**
 * 保存安装注册表 —— 一律走全仓唯一的原子写出口 `util/atomic-write.ts`
 * (同目录 tmp + rename + 读后写基线校验)。
 *
 * 旧形态是 `writeFileSync(tmp)` + `renameSync(tmp, p)` 的手搓第二份:没有读后写校验,
 * 并行会话交错时双方都报成功而其中一份被静默抹掉;而且它在插件里另写了一遍 rename 重试面
 * (AGENTS §4「两处算同一件事必漂移」)。出口已带 Windows EPERM 退避重试,这里不得再抄。
 */
export function saveInstallRegistry(reg: InstallRegistry): void {
  const p = getRegistryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  commitAtomicWrite(captureWriteBaseline(p), JSON.stringify(reg, null, 2));
}

// ==================== 路径安全检查 ====================

/** 一次本地路径安全校验的结论(把"为什么不安全"带出去,而不是只回一个布尔)。 */
type LocalPathSafety =
  | { readonly safe: true }
  | {
      readonly safe: false;
      readonly message: string;
      readonly detail: PluginPathUnsafeDetail;
    };

/**
 * 校验本地路径安全:拒 `..` 越界 / 拒符号链接逃逸 / **符号链接判不了按不安全处置**。
 *
 * 规则:
 *   - 解析后路径必须位于 baseDir 内(relative 不以 `..` 开头)
 *   - 若解析后路径本身是符号链接,其目标也必须位于 baseDir 内
 *
 * G-705 修的是这里:旧实现把整段包在 `try { … } catch { /* realpath 失败,跳过 *\/ }` 里,
 * 于是 EPERM / EACCES / ELOOP(以及 lstat 的同类失败)一律被读成"没有链接"= 放行。
 * 现在只有 `path-safety.ts` 封闭集里的**明确缺失**才降级(行为与改动前逐字一致),
 * 其它错误一律 `safe: false`。判据不在本文件重写一遍,只消费结论。
 *
 * @param localPath 待校验路径(相对或绝对)
 * @param baseDir 基准目录(相对路径以此为根)
 */
function inspectLocalPathSafety(localPath: string, baseDir: string): LocalPathSafety {
  const resolved = path.resolve(baseDir, localPath);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {
      safe: false,
      message: `不安全的本地路径: ${localPath}`,
      detail: { reason: 'outside-base-dir', targetPath: resolved, rootPath: baseDir },
    };
  }

  // 符号链接逃逸检查:仅当 resolved 自身是符号链接时才需要解析可达性
  let isLink: boolean;
  try {
    isLink = fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink();
  } catch (err) {
    const verdict = classifyRealpathFailure(err);
    if (verdict.kind === 'missing') {
      // 明确缺失:与改动前一致(后续 existsSync/statSync 会给出"本地源不是目录"的常规错误)
      return { safe: true };
    }
    return {
      safe: false,
      message:
        `不安全的本地路径: ${localPath}(符号链接可达性判不了,按拒装处置 —— ` +
        `这不是"路径不存在",是"这台机读不到它的真实目标",请核查权限/文件系统后重试):: ${verdict.summary}`,
      detail: {
        reason: 'symlink-unverifiable',
        linkPath: resolved,
        targetPath: resolved,
        rootPath: baseDir,
        errno: verdict.errno,
      },
    };
  }
  if (!isLink) return { safe: true };

  const verdict = checkSymlinkContainment({
    linkPath: resolved,
    targetPath: resolved,
    rootPath: baseDir,
  });
  if (verdict.status === 'contained') return { safe: true };
  if (verdict.status === 'degraded-missing') {
    // 链接目标明确不存在(封闭集内,如悬空链接 ENOENT):按改动前口径跳过
    return { safe: true };
  }
  const escape = verdict.status === 'escape';
  return {
    safe: false,
    message: escape
      ? `不安全的本地路径: ${localPath}(${verdict.message})`
      : `不安全的本地路径: ${localPath}(符号链接可达性判不了,按拒装处置:${verdict.message})`,
    detail: {
      reason: escape ? 'symlink-escape' : 'symlink-unverifiable',
      linkPath: resolved,
      targetPath: resolved,
      rootPath: baseDir,
      errno: verdict.status === 'unsafe' ? verdict.errno : null,
      stage: verdict.status === 'unsafe' ? verdict.stage : null,
    },
  };
}

// ==================== 递归复制 ====================

/**
 * 递归复制目录,遇到符号链接时校验目标在源树内(防逃逸)。
 *
 * G-705 修的第二处:旧实现在 `catch (e) { if (e instanceof PluginPathUnsafeError) throw e; continue; }`
 * 里把 **realpath 失败**一律 `continue` —— 于是一条指向范围外的链接,只要解析它时出了
 * 任何错(EPERM/EACCES/ELOOP),就被当成"这条链接不用管"。现在:
 *   - `degraded-missing`(封闭集 {ENOENT,ENOTDIR,EISDIR} 内的明确缺失)⇒ 与改动前一致,跳过;
 *   - `unsafe`(判不了)⇒ 抛 `PluginPathUnsafeError`,**一条内容都不复制**。
 *     抛出点在 staging 阶段,`installFromDirectory` 会清掉 staging 并上抛 ⇒ 旧副本仍在位。
 *   - `escape` / `contained` ⇒ 行为不变(拒 / 跟随复制)。
 * 判据住在 `./path-safety.ts`,这里只消费结论(不得再抄一份 errno 列表)。
 */
function copyDirRecursive(src: string, dest: string, rootSrc?: string): void {
  const root = rootSrc ?? src;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      // 解析符号链接目标
      const target = fs.readlinkSync(s);
      const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(s), target);
      // 校验目标在源树内(判不了 = 拒,不再是"跳过这条链接")
      const verdict = checkSymlinkContainment({ linkPath: s, targetPath: resolvedTarget, rootPath: root });
      if (verdict.status === 'degraded-missing') {
        continue;
      }
      if (verdict.status !== 'contained') {
        const escape = verdict.status === 'escape';
        throw new PluginPathUnsafeError(
          escape
            ? `符号链接逃逸,拒绝复制:${verdict.message}`
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
      // 目标在树内,跟随复制
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

// ==================== 清单读取 ====================

/** 候选清单文件名(优先级排序) */
const MANIFEST_FILES = ['plugin.json', 'plugin.config.json'];

/**
 * 读取插件目录下的清单文件,返回 name + version。
 * 不存在或损坏时抛 PluginManifestMissingError。
 */
function readPluginManifest(pluginDir: string): { name: string; version?: string } {
  for (const name of MANIFEST_FILES) {
    const p = path.join(pluginDir, name);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.name === 'string' && obj.name.length > 0) {
          return {
            name: obj.name,
            version: typeof obj.version === 'string' ? obj.version : undefined,
          };
        }
      }
    } catch {
      // 损坏 JSON 继续尝试下一个候选
    }
  }
  throw new PluginManifestMissingError(`插件清单缺失或无效: ${pluginDir}`);
}

// ==================== 本地路径识别 ====================

/**
 * 判断 source 是否为本地路径(以 `./`、`/` 开头,或 Windows 盘符开头)。
 * 否则视为 Git URL。
 */
function isLocalSourceString(source: string): boolean {
  if (source.startsWith('./')) return true;
  if (source.startsWith('/') || source.startsWith('\\')) return true;
  // Windows 盘符路径,如 C:\ 或 C:/
  if (/^[A-Za-z]:[\\/]/.test(source)) return true;
  return false;
}

// ==================== installPlugin ====================

/**
 * 安装插件 — 自动识别本地路径或 Git URL。
 *
 * @param source 本地路径(相对/绝对)或 Git URL
 * @param opts.trust 信任源(预留,暂未使用)
 * @param opts.ref Git 分支/tag(浅克隆)
 * @param opts.sha Git commit SHA(pin)
 * @param opts.signal 取消通道:只在提交点之前生效(越过提交点后不回退已生效的插件)
 */
export async function installPlugin(
  source: string,
  opts?: { trust?: boolean; ref?: string; sha?: string; signal?: AbortSignal },
): Promise<InstallOutcome> {
  if (isLocalSourceString(source)) {
    return installLocal(source, process.cwd(), opts?.signal);
  }
  return installGit(source, opts);
}

/**
 * 把 sourceDir 落成 destDir —— 唯一的"复制到 staging → 落位 → **权威落盘** → 处置旧副本"实现。
 *
 * 提交序列在此显式编排,不再走 `commitStagedSwap`:那条序列的 land 与 finalize 之间
 * 没有"权威落盘"这一格,而 G-730 给 finalize 加的前置③问的正是权威面
 * —— 权威没写上,finalize 只能拿到 `unknown`(写侧接线前恒如此),归档永远收不掉。
 * 次序照上游 `atomic-directory.ts:303-305`(权威落盘排在归档删除之前)与
 * `marketplace.ts:1800-1821`(记录携 txnId 入权威文件):
 *
 *   takeOwnershipOfTarget(旧副本原子改名挪开) → landStagedSwap(新副本落位)
 *     → persistInstallAuthority(registry 那条记录带上本次 transactionId)
 *     → finalizeStagedSwap(此刻权威认这笔,才允许处置归档)
 *
 * 四条失败形态一律不产生"两代都没了":复制失败 / 取消 ⇒ 目标一步没动;
 * 落盘失败 ⇒ 旧副本回位或原样保留在归档(cache 层负责);
 * **权威写失败 ⇒ 当场抛出且不进入 finalize**,归档与其中的旧副本逐字仍在(可回位)。
 * local 与 git:url 两条腿共用它,不得各写一遍(两处实现必漂移)。
 *
 * @param reg 调用方已加载的注册表(去重短路用的同一份;写回沿用同一份基准,不另取一份)
 * @param recordFields 本条记录除 installedAt / transactionId 之外的字段
 * @returns 落进权威记录的那条(带本次事务号)
 */
function installFromDirectory(
  sourceDir: string,
  destDir: string,
  reg: InstallRegistry,
  recordFields: Omit<InstallRecord, 'installedAt' | 'transactionId'>,
  signal?: AbortSignal,
): InstallRecord {
  // 提交点之前:取消 = 什么都不动,直接上抛
  if (signal?.aborted) throw new PluginSwapCancelledError(destDir);
  const staging = prepareStagingDirectory(destDir);
  try {
    copyDirRecursive(sourceDir, staging);
  } catch (e) {
    // 复制失败(符号链接逃逸,或符号链接可达性判不了):目标目录一步没动
    discardStagingDirectory(staging);
    throw e;
  }
  let swap: StagedSwap;
  try {
    // 没拿到槽位所有权 ⇒ 目标一步没动,临时物自己清掉(与 commitStagedSwap 同形)
    swap = takeOwnershipOfTarget(destDir, staging);
  } catch (e) {
    discardStagingDirectory(staging);
    throw e;
  }
  // 落盘失败由 landStagedSwap 负责回位/保留归档并抛 DirectorySwapError
  landStagedSwap(swap);
  // ——— 提交点已越过:此后绝不回退,也不响应取消(回退抹掉的就是已生效的插件) ———
  const record: InstallRecord = {
    ...recordFields,
    installedAt: new Date().toISOString(),
    transactionId: swap.transactionId,
  };
  // 权威落盘排在 finalize 之前:写不上就抛,绝不处置归档
  persistInstallAuthority(reg, record, swap);
  finalizeStagedSwap(swap);
  return record;
}

/**
 * 本地路径安装(内部)。
 *
 * @param localPath 本地路径(相对或绝对)
 * @param baseDir 基准目录(路径安全校验的根)
 * @param signal 取消通道(提交点之前)
 */
async function installLocal(
  localPath: string,
  baseDir: string,
  signal?: AbortSignal,
): Promise<InstallOutcome> {
  // 安全校验(结论结构化:被拒时点名是哪条链接、哪个 errno、发生在哪一步)
  const safety = inspectLocalPathSafety(localPath, baseDir);
  if (!safety.safe) {
    throw new PluginPathUnsafeError(safety.message, safety.detail);
  }
  const resolvedSrc = path.resolve(baseDir, localPath);
  if (!fs.existsSync(resolvedSrc) || !fs.statSync(resolvedSrc).isDirectory()) {
    throw new Error(`本地源不是目录: ${resolvedSrc}`);
  }

  // 读清单
  const manifest = readPluginManifest(resolvedSrc);
  const dest = getPluginInstallPath(manifest.name);

  // 已装短路:按 name + sourcePath 去重。"已装"必须过可用性判据 ——
  // 只问 existsSync 会把"空目录/半成品"报成装好了(与缓存降级同一型)。
  const reg = loadInstallRegistry();
  const existing = reg.records.find(
    (r) => r.name === manifest.name && r.sourceType === 'local' && r.sourcePath === resolvedSrc,
  );
  if (existing && isUsableDirectoryCopy(dest)) {
    return {
      name: manifest.name,
      version: manifest.version,
      installedPath: dest,
      source: 'local',
      wasInstalled: true,
    };
  }

  // 复制到 staging → 落位 → 权威落盘(带本次事务号)→ 处置旧副本
  // 失败一律在"权威写下"之前停下 ⇒ registry 不出现"记录说装了 2.0.0 而盘上是 v1"
  const record = installFromDirectory(
    resolvedSrc,
    dest,
    reg,
    {
      name: manifest.name,
      version: manifest.version,
      sourceType: 'local',
      sourcePath: resolvedSrc,
    },
    signal,
  );

  return {
    name: manifest.name,
    version: manifest.version,
    installedPath: dest,
    source: 'local',
    wasInstalled: false,
    transactionId: record.transactionId,
  };
}

/**
 * 安装记录的**主键** = 裸 `name`,不含 sourceType/sourceUrl/pluginSubdir/sourcePath。
 *
 * 依据(现读三处,不是猜):
 *  - 安装目录按 name 派生:`getPluginInstallPath(manifest.name)`(本文件 local 腿与 git 腿各一次),
 *    而 `paths.ts:55-57` 就是 `installed-plugins/<name>` ⇒ **同名两条记录必然指向同一个目录**,
 *    "一名多行"在物理层没有承载物,它不是"多实例",只是同一件事被登记了两遍。
 *  - 权威面问事务号用的也是裸 name:`cache.ts:266-276` 由 target 反推出 `recordKey = name`,
 *    `cache.ts:520-524` 再 `records.find(r => r.name === recordKey)` 取记录。
 *  - 卸载按 name 删的就是那一个目录(`uninstallPlugin`),所以"还剩一行别的同名记录"必然谎报已装。
 *
 * 刻意不把来源列并进主键:那三列描述的是"这一代从哪来",每次覆盖安装都可能合法变化
 * (换仓库 URL / 增删 pluginSubdir / local→git 换源)。把它们并进主键 = 允许同名多行,而多行的
 * 后果正是 G-808 的病灶:写侧旧实现 `reg.records.push(record)` 无条件追加,读侧按 name 取**首行**
 * ⇒ 从第二次覆盖安装起 `authorityTransactionVerdict` 恒落 `not-committed` ⇒ 归档永远收不走
 * (方向安全,但账目烂掉)。
 *
 * 上游的 `name@marketplace` 需要 `marketplace` 列,本仓 `InstallRecord` 没有 ⇒ 补列属 schema 决策
 * (两个市场同名插件会撞成一行),**另计一票**;本票只按既有主键收口。
 */
function installRecordKey(record: Pick<InstallRecord, 'name'>): string {
  return record.name;
}

/**
 * 按主键 upsert:命中同主键则**就地替换那一行**(保持数组位置),否则追加。
 *
 * 三条设计点:
 *  1. **原位替换**而不是"删掉再 push":读侧 `cache.ts:520-524` 取的是**首行**同名记录,
 *     留在原位 ⇒ 它问到的必然是刚落的这一代。存量里已存在的同名多行(旧写侧留下的)一律**不动**
 *     —— 本票不做数据迁移,那些副本由读侧的"取最新一行"兜底(见报告:那一行改动住在 cache.ts,
 *     在本票文件清单外)。
 *  2. **整体替换**而不是逐字段合并(即刻意**不**保留上一代的 `installedAt`):
 *     ① 上一代的 `transactionId` 必须消失 —— 留着它,finalize 会去问一笔已被取代的事务;
 *     ② `installedAt` 一并刷新,是为了让"按出生时刻排序取最新"这条读侧兜底不会把刚写的记录读成旧的。
 *     上游 `marketplace.ts:1174-1185` 能保留出生时刻,是因为它另有独立的 createdAt;
 *     本仓 `InstallRecord` 只有这一个时刻列,保留它就等于同时保留一个过期排序键。
 *     用户可见后果:覆盖安装后"安装时间"变成本次时间(与 `registry-client.ts:195` 那条既有
 *     upsert 先例同形 —— 它写的也是 `{ ...record, installedAt: now }`)。
 *  3. 返回落进去的那条,便于调用方直接带回(不另取一份副本,避免"改的是副本而权威没动")。
 */
export function upsertInstallRecord(reg: InstallRegistry, record: InstallRecord): InstallRecord {
  const key = installRecordKey(record);
  const idx = reg.records.findIndex((r) => installRecordKey(r) === key);
  if (idx >= 0) {
    reg.records[idx] = record;
  } else {
    reg.records.push(record);
  }
  return record;
}

/**
 * 权威落盘:把本次交换的事务号随这条安装记录写进 registry。
 *
 * 与改动前的区别只在**次序与后果**:旧实现是整条提交序列(含删归档)跑完之后才补记录,
 * 写失败也只留一句"重跑一次安装即可补上记录" —— 于是权威面对这笔事务永远说不出
 * "已提交",G-730 的 finalize/恢复只能按 `unknown` 走"零破坏回位、永不删"。
 * 现在它排在 finalize 之前:写不上就抛,**绝不处置归档**。
 * 仍然不回退已落位的新副本(那会抹掉刚生效的插件),但绝不静默。
 *
 * G-808:落盘走 `upsertInstallRecord` 而不是 `records.push` —— 无条件追加正是同名多行的来源,
 * 而整份 registry 的原子写仍然只在 `saveInstallRegistry` 那一处(AGENTS §守门 122 的唯一出口),
 * upsert 只改内存里的那份数组,不新增第二次落盘、也不裸写文件。
 */
function persistInstallAuthority(
  reg: InstallRegistry,
  record: InstallRecord,
  swap: StagedSwap,
): void {
  try {
    upsertInstallRecord(reg, record);
    saveInstallRegistry(reg);
  } catch (e) {
    throw new Error(
      `新副本已落位(${swap.target}),但权威记录未写入(事务 ${swap.transactionId}):` +
        `旧副本归档未处置${swap.superseded ? `,逐字保留在 ${swap.superseded}(可回位)` : '(本次没有旧副本)'} —— ` +
        `此刻既没有删任何归档,也没有回退新副本。原始错误:${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
}
/**
 * 插件域文件权威面(registry.json)的**唯一**回滚出口 —— 回滚本身要 CAS
 * (G-732,2026-10-03;上游 marketplace.ts:1827-1848 的写法,报错文案逐字同义)。
 *
 * 防的形态:回滚无条件盖写。句柄 A 写完 registry 后,句柄 B(基于过期的内存基准)
 * 交换失败要回滚 —— 若 B 直接把"删记录/还原旧记录"盖上去,A 的更新就被抹掉了。
 * 所以回滚前必须**从盘上重读**并核对:该条记录的事务号仍等于本次要回滚的那笔;
 * 不等 ⇒ 抛 `Cannot roll back marketplace authority after concurrent update`
 * (并发写入者已接手这条记录,回滚方无权处置)。记录缺席 = 没有"这笔"可回滚,
 * 幂等返回、不报错(回滚的幂等语义:目标态已达)。
 *
 * 上游同款的后半(:421-444)—— "权威回滚失败时**故意**先 finalize 数据面,
 * 宁可权威指新代,也不让它指向已被删的旧代" —— 属于调用方的失败编排:
 * 本提交点的既有纪律(see installFromDirectory:「提交点已越过:此后绝不回退」)
 * 仍优先,未来任何要在权威面回退的流程(如恢复处置表新增动作)**必须**走本出口,
 * 不得再写第二份无条件盖写。
 */
export function rollbackInstallAuthority(opts: {
  /** 记录键(插件名) */
  name: string
  /** 本次要回滚掉的那笔写入的事务号 —— CAS 凭据:盘上该条仍带它才许动 */
  expectTransactionId: string
  /** 回滚到的上一代记录;缺省 = 整条移除(= 这条安装从未发生) */
  restoreRecord?: InstallRecord
  /** 测试注入缝(缺省真读盘;镜像测试不在这里造第二份判据) */
  load?: typeof loadInstallRegistry
  save?: typeof saveInstallRegistry
}): { rolledBack: boolean; recordExisted: boolean } {
  const load = opts.load ?? loadInstallRegistry
  const save = opts.save ?? saveInstallRegistry
  // CAS 的对面是"盘上现状"——每次都重读,绝不用调用方内存里那份基准
  const fresh = load()
  const idx = fresh.records.findIndex((r) => installRecordKey(r) === opts.name)
  if (idx < 0) return { rolledBack: false, recordExisted: false }
  const current = fresh.records[idx]!;
  if ((current.transactionId ?? '') !== opts.expectTransactionId) {
    throw new Error(
      `Cannot roll back marketplace authority after concurrent update:` +
        `盘上记录的事务号(${current.transactionId ?? '(缺席)'})≠ 本次要回滚的事务号(${opts.expectTransactionId})` +
        `—— 已有并发写入者接手这条记录,无条件盖写会把别人的更新抹掉`,
    )
  }
  if (opts.restoreRecord) {
    fresh.records[idx] = opts.restoreRecord
  } else {
    fresh.records.splice(idx, 1)
  }
  save(fresh)
  return { rolledBack: true, recordExisted: true }
}

/**
 * Git URL 安装(内部)。
 */
async function installGit(
  url: string,
  opts?: { ref?: string; sha?: string; signal?: AbortSignal },
): Promise<InstallOutcome> {
  // 获取缓存(或新 clone)
  const { localPath: cachePath } = await getOrCloneGitCache(url, {
    ref: opts?.ref,
    sha: opts?.sha,
    signal: opts?.signal,
  });

  // 在 cache 中查找 plugin.json(根目录或一级子目录,支持多插件 repo)
  const pluginSubdir = findPluginSubdir(cachePath);
  const pluginDir = pluginSubdir ? path.join(cachePath, pluginSubdir) : cachePath;
  const manifest = readPluginManifest(pluginDir);
  const dest = getPluginInstallPath(manifest.name);

  // 已装短路:按 name + sourceUrl + pluginSubdir 去重(同 local,须可用才算已装)
  const reg = loadInstallRegistry();
  const existing = reg.records.find(
    (r) =>
      r.name === manifest.name &&
      r.sourceType === 'git' &&
      r.sourceUrl === url &&
      r.pluginSubdir === pluginSubdir,
  );
  if (existing && isUsableDirectoryCopy(dest)) {
    return {
      name: manifest.name,
      version: manifest.version,
      installedPath: dest,
      source: 'git:url',
      wasInstalled: true,
    };
  }

  // 复制到 staging → 落位 → 权威落盘(带本次事务号)→ 处置旧副本(与 local 同一条实现)
  const record = installFromDirectory(
    pluginDir,
    dest,
    reg,
    {
      name: manifest.name,
      version: manifest.version,
      sourceType: 'git',
      sourceUrl: url,
      pluginSubdir,
      sha: opts?.sha,
    },
    opts?.signal,
  );

  return {
    name: manifest.name,
    version: manifest.version,
    installedPath: dest,
    source: 'git:url',
    wasInstalled: false,
    transactionId: record.transactionId,
  };
}

/**
 * 在 cache 目录中定位 plugin.json 所在子目录。
 * 优先根目录;否则扫描一级子目录(跳过 .git)。
 * 返回 undefined 表示根目录,字符串表示子目录名。
 */
function findPluginSubdir(cachePath: string): string | undefined {
  // 根目录有清单
  for (const name of MANIFEST_FILES) {
    if (fs.existsSync(path.join(cachePath, name))) return undefined;
  }
  // 扫描一级子目录
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(cachePath, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === '.git') continue;
    const sub = path.join(cachePath, e.name);
    for (const name of MANIFEST_FILES) {
      if (fs.existsSync(path.join(sub, name))) return e.name;
    }
  }
  return undefined;
}

// ==================== installMarketplacePlugin ====================

/**
 * 通过 marketplace 索引查找并安装插件。
 *
 * @param name 插件名
 * @param marketplaceRoot marketplace 仓库本地路径(含 .ihui-plugin/marketplace.json 等)
 * @param qualifier 别名限定(tags/keywords/domains/category)
 * @param opts.signal 取消通道(只在提交点之前生效)
 */
export async function installMarketplacePlugin(
  name: string,
  marketplaceRoot: string,
  qualifier?: string,
  opts?: { signal?: AbortSignal },
): Promise<InstallOutcome> {
  const scan = scanMarketplace(marketplaceRoot);
  if (!scan.found || !scan.index) {
    throw new Error(`marketplace 索引未找到: ${marketplaceRoot}`);
  }
  const entry = findPluginInIndex(scan.index, name, qualifier);
  if (!entry) {
    throw new Error(`插件 ${name}${qualifier ? ` (qualifier=${qualifier})` : ''} 未在 marketplace 中找到`);
  }
  return installFromMarketplaceEntry(entry, marketplaceRoot, opts?.signal);
}

/** 根据 marketplace 条目的 source 类型分流安装 */
async function installFromMarketplaceEntry(
  entry: MarketplacePluginEntry,
  marketplaceRoot: string,
  signal?: AbortSignal,
): Promise<InstallOutcome> {
  const src: MarketplaceSource = entry.source;
  if (isGitSource(src)) {
    return installPlugin(src.url, { ref: src.ref, sha: src.sha, signal });
  }
  if (isLocalSource(src)) {
    const localPath = typeof src === 'string' ? src : src.path;
    // 相对路径以 marketplaceRoot 为基准解析,然后按绝对路径安装(marketplaceRoot 为安全根)
    const resolved = path.resolve(marketplaceRoot, localPath);
    return installLocal(resolved, marketplaceRoot, signal);
  }
  throw new Error(`未知的 source 类型: ${JSON.stringify(src)}`);
}

// ==================== uninstallPlugin ====================

/**
 * 卸载插件 — 删除安装目录,可选保留 plugin-data。
 *
 * @param name 插件名
 * @param opts.confirm 预留确认参数(暂未使用)
 * @param opts.keepData true 时保留 plugin-data 目录
 */
export async function uninstallPlugin(
  name: string,
  opts?: { confirm?: boolean; keepData?: boolean },
): Promise<UninstallOutcome> {
  const reg = loadInstallRegistry();
  const idx = reg.records.findIndex((r) => r.name === name);
  const hadRecord = idx >= 0;

  // 删除安装目录
  const installPath = getPluginInstallPath(name);
  let removedPath = '';
  if (fs.existsSync(installPath)) {
    fs.rmSync(installPath, { recursive: true, force: true });
    removedPath = installPath;
  }

  // 处理 plugin-data
  const dataDir = getPluginDataDir(name);
  let hadData = false;
  if (fs.existsSync(dataDir)) {
    hadData = true;
    if (!opts?.keepData) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  // 移除注册表记录 —— 删该 name 的**全部**行,不是只删第一条。
  // 依据:安装目录是按 name 那一个(`getPluginInstallPath(name)`,上面已整目录删除),所以任何
  // 幸存的同名行都在谎报"还装着"。G-808 的账面烂掉形态正是 `splice(idx, 1)` 只第一条:
  // 旧写侧留下的第二行永远声称已装而目录不在,而它自己也永远不会再被写到。
  // 写侧改 upsert 后新数据一名一行,这里的全删只对**存量同名多行**生效(收敛它们,不制造新形态)。
  if (hadRecord) {
    reg.records = reg.records.filter((r) => installRecordKey(r) !== name);
    saveInstallRegistry(reg);
  }

  return {
    name,
    removedPath,
    hadData,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
