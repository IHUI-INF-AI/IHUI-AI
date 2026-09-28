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
 *     (旧副本原子改名挪开 → 新副本落位 → 事务号核对后才处置旧副本)。
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
  commitStagedSwap,
  discardStagingDirectory,
  isUsableDirectoryCopy,
  prepareStagingDirectory,
  PluginSwapCancelledError,
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
 * 把 sourceDir 落成 destDir —— 唯一的"复制到 staging → 提交"实现。
 *
 * 三条失败形态(复制失败 / 取消 / 落盘失败)一律只动 staging,旧副本仍在位;
 * local 与 git:url 两条腿共用它,不得各写一遍(两处实现必漂移)。
 */
function installFromDirectory(sourceDir: string, destDir: string, signal?: AbortSignal): void {
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
  // 越过提交点:此后不回退(取消也不回退)
  commitStagedSwap(destDir, staging, { signal });
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

  // 复制到 staging → 提交点替换(复制失败/取消 ⇒ 旧副本仍在位)
  installFromDirectory(resolvedSrc, dest, signal);

  // 写 registry
  reg.records.push({
    name: manifest.name,
    version: manifest.version,
    sourceType: 'local',
    sourcePath: resolvedSrc,
    installedAt: new Date().toISOString(),
  });
  saveInstallRegistryChecked(reg, dest);

  return {
    name: manifest.name,
    version: manifest.version,
    installedPath: dest,
    source: 'local',
    wasInstalled: false,
  };
}

/**
 * 写安装记录,并把"文件已就位而记录没写上"这一格说清 ——
 * 插件文件此刻已是权威状态,不回退(那会抹掉刚生效的插件),但也不许静默。
 */
function saveInstallRegistryChecked(reg: InstallRegistry, dest: string): void {
  try {
    saveInstallRegistry(reg);
  } catch (e) {
    throw new Error(
      `插件文件已就位(${dest}),但安装记录未写入:重跑一次安装即可补上记录。原始错误:${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
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

  // 复制到 staging → 提交点替换(复制失败/取消 ⇒ 旧副本仍在位)
  installFromDirectory(pluginDir, dest, opts?.signal);

  // 写 registry
  reg.records.push({
    name: manifest.name,
    version: manifest.version,
    sourceType: 'git',
    sourceUrl: url,
    pluginSubdir,
    installedAt: new Date().toISOString(),
    sha: opts?.sha,
  });
  saveInstallRegistryChecked(reg, dest);

  return {
    name: manifest.name,
    version: manifest.version,
    installedPath: dest,
    source: 'git:url',
    wasInstalled: false,
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

  // 移除注册表记录
  if (hadRecord) {
    reg.records.splice(idx, 1);
    saveInstallRegistry(reg);
  }

  return {
    name,
    removedPath,
    hadData,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
