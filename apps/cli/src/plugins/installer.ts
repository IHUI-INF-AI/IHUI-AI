/**
 * Plugins Marketplace 安装器 — 实现本地/Git 插件的安装、卸载、注册表持久化。
 *
 * 灵感来源:grok-build xai-grok-plugin-marketplace 的安装流程。
 * 设计:
 *   - installPlugin(source):自动识别本地路径 vs Git URL,分流安装
 *   - installMarketplacePlugin(name, marketplaceRoot):从 marketplace 索引查找后安装
 *   - uninstallPlugin(name):删除安装目录 + 可选保留 plugin-data
 *   - Registry 持久化到 ~/.ihui/installed-plugins/registry.json,支持去重短路
 *   - 路径安全:拒 `..` 越界、符号链接逃逸
 *
 * 安装目录布局:
 *   ~/.ihui/installed-plugins/
 *     <plugin-name>/          ← 插件文件(从源复制)
 *       plugin.json
 *     registry.json           ← 全局安装记录
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getPluginInstallPath,
  getPluginDataDir,
  getRegistryPath,
} from './paths.js';
import { getOrCloneGitCache } from './cache.js';
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

/** 插件路径不安全异常(包含 `..` 越界或符号链接逃逸) */
export class PluginPathUnsafeError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PluginPathUnsafeError';
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
 * 保存安装注册表(原子写:先写临时文件再 rename)。
 */
export function saveInstallRegistry(reg: InstallRegistry): void {
  const p = getRegistryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

// ==================== 路径安全检查 ====================

/**
 * 校验本地路径安全:拒 `..` 越界 / 拒符号链接逃逸。
 *
 * 规则:
 *   - 解析后路径必须位于 baseDir 内(relative 不以 `..` 开头)
 *   - 若解析后路径本身是符号链接,其目标也必须位于 baseDir 内
 *
 * @param localPath 待校验路径(相对或绝对)
 * @param baseDir 基准目录(相对路径以此为根)
 */
function isPathUnsafe(localPath: string, baseDir: string): boolean {
  const resolved = path.resolve(baseDir, localPath);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return true;
  // 符号链接逃逸检查:若 resolved 是 symlink,验证其目标也在 baseDir 内
  try {
    if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) {
      const real = fs.realpathSync(resolved);
      const realBase = fs.realpathSync(baseDir);
      const realRel = path.relative(realBase, real);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) return true;
    }
  } catch {
    // 路径不存在或 realpath 失败,跳过 symlink 检查
  }
  return false;
}

// ==================== 递归复制 ====================

/**
 * 递归复制目录,遇到符号链接时校验目标在源树内(防逃逸)。
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
      // 校验目标在源树内
      try {
        const realRoot = fs.realpathSync(root);
        const realTarget = fs.realpathSync(resolvedTarget);
        const rel = path.relative(realRoot, realTarget);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          throw new PluginPathUnsafeError(`符号链接逃逸: ${s} -> ${resolvedTarget}`);
        }
      } catch (e) {
        if (e instanceof PluginPathUnsafeError) throw e;
        // realpath 失败,跳过此 symlink
        continue;
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
 */
export async function installPlugin(
  source: string,
  opts?: { trust?: boolean; ref?: string; sha?: string },
): Promise<InstallOutcome> {
  if (isLocalSourceString(source)) {
    return installLocal(source, process.cwd());
  }
  return installGit(source, opts);
}

/**
 * 本地路径安装(内部)。
 *
 * @param localPath 本地路径(相对或绝对)
 * @param baseDir 基准目录(路径安全校验的根)
 */
async function installLocal(localPath: string, baseDir: string): Promise<InstallOutcome> {
  // 安全校验
  if (isPathUnsafe(localPath, baseDir)) {
    throw new PluginPathUnsafeError(`不安全的本地路径: ${localPath}`);
  }
  const resolvedSrc = path.resolve(baseDir, localPath);
  if (!fs.existsSync(resolvedSrc) || !fs.statSync(resolvedSrc).isDirectory()) {
    throw new Error(`本地源不是目录: ${resolvedSrc}`);
  }

  // 读清单
  const manifest = readPluginManifest(resolvedSrc);
  const dest = getPluginInstallPath(manifest.name);

  // 已装短路:按 name + sourcePath 去重
  const reg = loadInstallRegistry();
  const existing = reg.records.find(
    (r) => r.name === manifest.name && r.sourceType === 'local' && r.sourcePath === resolvedSrc,
  );
  if (existing && fs.existsSync(dest)) {
    return {
      name: manifest.name,
      version: manifest.version,
      installedPath: dest,
      source: 'local',
      wasInstalled: true,
    };
  }

  // 复制
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  copyDirRecursive(resolvedSrc, dest);

  // 写 registry
  reg.records.push({
    name: manifest.name,
    version: manifest.version,
    sourceType: 'local',
    sourcePath: resolvedSrc,
    installedAt: new Date().toISOString(),
  });
  saveInstallRegistry(reg);

  return {
    name: manifest.name,
    version: manifest.version,
    installedPath: dest,
    source: 'local',
    wasInstalled: false,
  };
}

/**
 * Git URL 安装(内部)。
 */
async function installGit(url: string, opts?: { ref?: string; sha?: string }): Promise<InstallOutcome> {
  // 获取缓存(或新 clone)
  const { localPath: cachePath } = await getOrCloneGitCache(url, { ref: opts?.ref, sha: opts?.sha });

  // 在 cache 中查找 plugin.json(根目录或一级子目录,支持多插件 repo)
  const pluginSubdir = findPluginSubdir(cachePath);
  const pluginDir = pluginSubdir ? path.join(cachePath, pluginSubdir) : cachePath;
  const manifest = readPluginManifest(pluginDir);
  const dest = getPluginInstallPath(manifest.name);

  // 已装短路:按 name + sourceUrl + pluginSubdir 去重
  const reg = loadInstallRegistry();
  const existing = reg.records.find(
    (r) =>
      r.name === manifest.name &&
      r.sourceType === 'git' &&
      r.sourceUrl === url &&
      r.pluginSubdir === pluginSubdir,
  );
  if (existing && fs.existsSync(dest)) {
    return {
      name: manifest.name,
      version: manifest.version,
      installedPath: dest,
      source: 'git:url',
      wasInstalled: true,
    };
  }

  // 复制
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  copyDirRecursive(pluginDir, dest);

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
  saveInstallRegistry(reg);

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
 * @param marketplaceRoot marketplace 仓库本地路径(含 .grok-plugin/marketplace.json 等)
 * @param qualifier 别名限定(tags/keywords/domains/category)
 */
export async function installMarketplacePlugin(
  name: string,
  marketplaceRoot: string,
  qualifier?: string,
): Promise<InstallOutcome> {
  const scan = scanMarketplace(marketplaceRoot);
  if (!scan.found || !scan.index) {
    throw new Error(`marketplace 索引未找到: ${marketplaceRoot}`);
  }
  const entry = findPluginInIndex(scan.index, name, qualifier);
  if (!entry) {
    throw new Error(`插件 ${name}${qualifier ? ` (qualifier=${qualifier})` : ''} 未在 marketplace 中找到`);
  }
  return installFromMarketplaceEntry(entry, marketplaceRoot);
}

/** 根据 marketplace 条目的 source 类型分流安装 */
async function installFromMarketplaceEntry(
  entry: MarketplacePluginEntry,
  marketplaceRoot: string,
): Promise<InstallOutcome> {
  const src: MarketplaceSource = entry.source;
  if (isGitSource(src)) {
    return installPlugin(src.url, { ref: src.ref, sha: src.sha });
  }
  if (isLocalSource(src)) {
    const localPath = typeof src === 'string' ? src : src.path;
    // 相对路径以 marketplaceRoot 为基准解析,然后按绝对路径安装(marketplaceRoot 为安全根)
    const resolved = path.resolve(marketplaceRoot, localPath);
    return installLocal(resolved, marketplaceRoot);
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
