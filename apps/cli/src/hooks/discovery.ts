// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HooksDiscovery — 目录自动发现 hooks。
 * 扫描 <workspace>/.ihui-agent/hooks/(source=cli)+ ~/.ihui-agent/hooks/(source=user),
 * 解析 frontmatter(name/enabled/priority/type),状态持久化到
 * <workspace>/.ihui-agent/hooks/.state.json(.state.json 优先于 frontmatter.enabled)。
 * discover()/enable(name)/disable(name) 三方法;free functions 薄封装默认实例。
 *
 * 平台独占:仅 cli(W3-4 Hooks 自动发现,对标 OpenClaw hooks 自动发现)。
 * 与 commands/hooks-auto.ts(沙箱执行 + 热重载)互补:本模块只做发现 + 启停状态管理。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { tryParseJson, isRecord } from '../util/json.js';

export type DiscoveredHookType =
  | 'pre_tool'
  | 'post_tool'
  | 'pre_session'
  | 'post_session'
  | 'on_error'
  | 'unknown';

export interface DiscoveredHook {
  /** 唯一 id:<source>:<stem> */
  id: string;
  /** hook 名称(frontmatter.name 或文件名 stem) */
  name: string;
  type: DiscoveredHookType;
  /** 是否启用(.state.json 优先,frontmatter.enabled 次之,默认 true) */
  enabled: boolean;
  /** 来源:cli(workspace)/ user(home) */
  source: 'cli' | 'user';
  /** 0-100,高优先级先执行,默认 50 */
  priority: number;
  /** 文件绝对路径 */
  filePath: string;
}

export interface HooksDirs {
  cli: string;
  user: string;
}

/**
 * 发现诊断判别码(封闭集,与 plugins/types.ts 的 PLUGIN_DIAGNOSTIC_CODES 同一形态)。
 * 三处都是 scanDir/parseFrontmatter 里原本 `catch { 静默跳过 }` 的吞错点 —— 现在编码成数据。
 */
export const HOOK_DISCOVERY_DIAGNOSTIC_CODES = [
  /** 整个 hooks 目录读不出(readdirSync 失败,ENOENT 除外=正常缺席):该目录下 hooks 全部缺席 */
  'hooks-dir-unreadable',
  /** 扩展名命中的 hook 文件 stat 失败:该文件缺席(计入 totalDiscovered,不计入 hooks) */
  'hook-file-stat-failed',
  /** hook 文件本体读不出:仍按"无 frontmatter 默认值"装载,但 frontmatter 内容被忽略 */
  'hook-frontmatter-unreadable',
] as const;

export type HookDiscoveryDiagnosticCode = (typeof HOOK_DISCOVERY_DIAGNOSTIC_CODES)[number];

/** 诊断严重级:`error` = 发现了却没装载;`warning` = 装载了但有内容被忽略 */
export type HookDiscoveryDiagnosticSeverity = 'error' | 'warning';

/**
 * 判别码 → 严重级的唯一映射(与 plugins/loader.ts 的 DIAGNOSTIC_SEVERITY 同一纪律:
 * `Record<Code, Severity>` 键穷尽,新增码忘定档编译期就红)。
 */
const HOOK_DIAGNOSTIC_SEVERITY: Record<HookDiscoveryDiagnosticCode, HookDiscoveryDiagnosticSeverity> = {
  'hooks-dir-unreadable': 'error',
  'hook-file-stat-failed': 'error',
  'hook-frontmatter-unreadable': 'warning',
};

/** 一条发现诊断 — "哪些 hook 该在而没在/为什么被降级"的可机读记录。 */
export interface HookDiscoveryDiagnostic {
  /** 稳定判别码(封闭集,见 HOOK_DISCOVERY_DIAGNOSTIC_CODES) */
  code: HookDiscoveryDiagnosticCode;
  /** 严重级(由 code 唯一决定,产出点不各写一遍) */
  severity: HookDiscoveryDiagnosticSeverity;
  /** 触发该诊断的目录/文件绝对路径 */
  file: string;
  /** 人类可读说明(ASCII:诊断要能进日志,不得被控制台码页吃掉) */
  message: string;
}

/** 发现结果信封:成功条目 + 发现总数 + 诊断(无异常时缺席) */
export interface HookDiscoveryResult {
  /** 成功发现的 hooks(与 discover() 旧契约同一集合) */
  hooks: DiscoveredHook[];
  /** 发现总数:扩展名命中的条目总数,含被 diagnostics 记下的那部分(stat 失败的文件) */
  totalDiscovered: number;
  /** 诊断:无异常时缺席(不是空数组) */
  diagnostics?: HookDiscoveryDiagnostic[];
}

/** 错误文本(unknown 收窄,零 any) */
function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 造一条诊断:severity 由码唯一决定,产出点不得自行挑档 */
function hookDiagnostic(
  code: HookDiscoveryDiagnosticCode,
  file: string,
  message: string,
): HookDiscoveryDiagnostic {
  return { code, severity: HOOK_DIAGNOSTIC_SEVERITY[code], file, message };
}

interface ParsedFrontmatter {
  name?: string;
  enabled?: boolean;
  priority?: number;
  type?: string;
}

interface HookStateEntry {
  enabled?: boolean;
  priority?: number;
}

type HookState = Record<string, HookStateEntry>;

const HOOK_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.js', '.mjs', '.sh']);
const DEFAULT_PRIORITY = 50;

const VALID_TYPES: ReadonlySet<DiscoveredHookType> = new Set<DiscoveredHookType>([
  'pre_tool',
  'post_tool',
  'pre_session',
  'post_session',
  'on_error',
]);

const FILENAME_TYPE_PREFIX: ReadonlyArray<{ prefix: string; type: DiscoveredHookType }> = [
  { prefix: 'pre_tool', type: 'pre_tool' },
  { prefix: 'post_tool', type: 'post_tool' },
  { prefix: 'pre_session', type: 'pre_session' },
  { prefix: 'post_session', type: 'post_session' },
  { prefix: 'on_error', type: 'on_error' },
];

export function getHooksDirs(workspacePath = process.cwd()): HooksDirs {
  return {
    cli: path.join(workspacePath, '.ihui-agent', 'hooks'),
    user: path.join(os.homedir(), '.ihui-agent', 'hooks'),
  };
}

export class HooksDiscovery {
  private readonly workspacePath: string;
  private readonly stateFile: string;

  constructor(workspacePath = process.cwd()) {
    this.workspacePath = workspacePath;
    this.stateFile = path.join(getHooksDirs(workspacePath).cli, '.state.json');
  }

  getDirs(): HooksDirs {
    return getHooksDirs(this.workspacePath);
  }

  /** 扫描两目录,返回全部发现的 hooks(按 priority 降序 + name 升序)。 */
  discover(): DiscoveredHook[] {
    return this.discoverWithDiagnostics().hooks;
  }

  /**
   * discover 的信封版:同时返回成功条目、诊断(封闭 code + severity)与发现总数。
   * L11495(G-998082):发现类接口要有"部分失败"信封 —— 诊断记录被静默跳过的
   * 目录/文件,无异常时 diagnostics 缺席;totalDiscovered 是量出来的条目总数,
   * 含被 diagnostics 记下的那部分。discover() 保留旧契约,既有调用方零改动。
   */
  discoverWithDiagnostics(): HookDiscoveryResult {
    const dirs = this.getDirs();
    const state = this.loadState();
    const acc = { hooks: [] as DiscoveredHook[], diagnostics: [] as HookDiscoveryDiagnostic[], discovered: 0 };
    this.scanDir(dirs.cli, 'cli', state, acc);
    this.scanDir(dirs.user, 'user', state, acc);
    acc.hooks.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    const result: HookDiscoveryResult = { hooks: acc.hooks, totalDiscovered: acc.discovered };
    if (acc.diagnostics.length > 0) result.diagnostics = acc.diagnostics;
    return result;
  }

  /** discover 别名(语义化)。 */
  list(): DiscoveredHook[] {
    return this.discover();
  }

  /** 启用 hook(按 name 或 id 匹配),持久化状态。返回是否找到。 */
  enable(name: string): boolean {
    return this.setState(name, true);
  }

  /** 禁用 hook(按 name 或 id 匹配),持久化状态。返回是否找到。 */
  disable(name: string): boolean {
    return this.setState(name, false);
  }

  private setState(name: string, enabled: boolean): boolean {
    const found = this.discover().find((h) => h.name === name || h.id === name);
    if (!found) return false;
    const state = this.loadState();
    const existing = state[found.id] ?? {};
    state[found.id] = { ...existing, enabled };
    this.saveState(state);
    return true;
  }

  private scanDir(
    dir: string,
    source: 'cli' | 'user',
    state: HookState,
    acc: { hooks: DiscoveredHook[]; diagnostics: HookDiscoveryDiagnostic[]; discovered: number },
  ): void {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      // ENOENT = 目录不存在,是常态(多数用户没有 user hooks 目录),不算异常
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      acc.diagnostics.push(
        hookDiagnostic('hooks-dir-unreadable', dir, `Hooks directory unreadable: ${errorText(e)}`),
      );
      return;
    }
    for (const file of files) {
      if (file.startsWith('.')) continue; // 跳过 .state.json 等隐藏文件
      const ext = path.extname(file).toLowerCase();
      if (!HOOK_EXTENSIONS.has(ext)) continue;
      const filePath = path.join(dir, file);
      // 扩展名命中即计入发现总数;该条目若被下面的诊断跳过,仍留在 totalDiscovered 里
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        acc.discovered += 1;
        acc.diagnostics.push(
          hookDiagnostic('hook-file-stat-failed', filePath, `Hook file stat failed: ${errorText(e)}`),
        );
        continue;
      }
      if (!stat.isFile()) continue;
      const fmResult = this.parseFrontmatter(filePath);
      if (fmResult.readFailed) {
        acc.diagnostics.push(
          hookDiagnostic(
            'hook-frontmatter-unreadable',
            filePath,
            'Hook file unreadable; loaded with default frontmatter',
          ),
        );
      }
      const fm = fmResult.fm;
      const stem = path.basename(file, ext);
      const id = `${source}:${stem}`;
      const fmEnabled = fm.enabled ?? true;
      const fmPriority = fm.priority ?? DEFAULT_PRIORITY;
      const stateEntry = state[id];
      const enabled = stateEntry?.enabled ?? fmEnabled;
      const priority = stateEntry?.priority ?? fmPriority;
      const name = fm.name ?? stem;
      const type = this.resolveType(fm.type, stem);
      acc.hooks.push({ id, name, type, enabled, source, priority, filePath });
      acc.discovered += 1;
    }
  }

  private resolveType(fmType: string | undefined, stem: string): DiscoveredHookType {
    if (fmType && VALID_TYPES.has(fmType as DiscoveredHookType)) {
      return fmType as DiscoveredHookType;
    }
    const lower = stem.toLowerCase();
    for (const { prefix, type } of FILENAME_TYPE_PREFIX) {
      if (lower.startsWith(prefix)) return type;
    }
    return 'unknown';
  }

  /** 读 frontmatter;文件本体读不出时 readFailed=true(调用方记一条 warning 诊断) */
  private parseFrontmatter(filePath: string): { fm: ParsedFrontmatter; readFailed: boolean } {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return { fm: {}, readFailed: true };
    }
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) return { fm: {}, readFailed: false };
    const block = fmMatch[1];
    if (!block) return { fm: {}, readFailed: false };
    const result: ParsedFrontmatter = {};
    for (const line of block.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const rawValue = line.slice(idx + 1).trim();
      if (key === 'name') {
        result.name = rawValue.replace(/^["']|["']$/g, '');
      } else if (key === 'enabled') {
        result.enabled = rawValue === 'true';
      } else if (key === 'priority') {
        const n = Number(rawValue);
        if (Number.isFinite(n)) result.priority = n;
      } else if (key === 'type') {
        result.type = rawValue.replace(/^["']|["']$/g, '');
      }
    }
    return { fm: result, readFailed: false };
  }

  private loadState(): HookState {
    if (!fs.existsSync(this.stateFile)) return {};
    try {
      const parsed = tryParseJson(fs.readFileSync(this.stateFile, 'utf-8'));
      if (isRecord(parsed)) {
        return parsed as unknown as HookState;
      }
      return {};
    } catch {
      return {};
    }
  }

  private saveState(state: HookState): void {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }
}

// === free functions:薄封装默认实例(基于 process.cwd())===
// 供 commands/hooks.ts 的 list/enable/disable 直接调用。

let defaultInstance: HooksDiscovery | null = null;
function getDefault(): HooksDiscovery {
  if (!defaultInstance) defaultInstance = new HooksDiscovery();
  return defaultInstance;
}

export function discoverHooks(): DiscoveredHook[] {
  return getDefault().discover();
}

/** discoverHooks 的信封版:同 discoverWithDiagnostics(诊断 + totalDiscovered)。 */
export function discoverHooksWithDiagnostics(): HookDiscoveryResult {
  return getDefault().discoverWithDiagnostics();
}

export function listDiscoveredHooks(): DiscoveredHook[] {
  return getDefault().list();
}

export function enableHook(name: string): boolean {
  return getDefault().enable(name);
}

export function disableHook(name: string): boolean {
  return getDefault().disable(name);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
