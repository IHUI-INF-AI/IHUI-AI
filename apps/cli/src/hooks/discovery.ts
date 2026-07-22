/**
 * HooksDiscovery — 目录自动发现 hooks。
 * 扫描 <workspace>/.trae-cn/hooks/(source=cli)+ ~/.trae-cn/hooks/(source=user),
 * 解析 frontmatter(name/enabled/priority/type),状态持久化到
 * <workspace>/.trae-cn/hooks/.state.json(.state.json 优先于 frontmatter.enabled)。
 * discover()/enable(name)/disable(name) 三方法;free functions 薄封装默认实例。
 *
 * 平台独占:仅 cli(W3-4 Hooks 自动发现,对标 OpenClaw hooks 自动发现)。
 * 与 commands/hooks-auto.ts(沙箱执行 + 热重载)互补:本模块只做发现 + 启停状态管理。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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
    cli: path.join(workspacePath, '.trae-cn', 'hooks'),
    user: path.join(os.homedir(), '.trae-cn', 'hooks'),
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
    const dirs = this.getDirs();
    const state = this.loadState();
    const hooks: DiscoveredHook[] = [];
    this.scanDir(dirs.cli, 'cli', state, hooks);
    this.scanDir(dirs.user, 'user', state, hooks);
    hooks.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    return hooks;
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
    out: DiscoveredHook[],
  ): void {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const file of files) {
      if (file.startsWith('.')) continue; // 跳过 .state.json 等隐藏文件
      const ext = path.extname(file).toLowerCase();
      if (!HOOK_EXTENSIONS.has(ext)) continue;
      const filePath = path.join(dir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      const fm = this.parseFrontmatter(filePath);
      const stem = path.basename(file, ext);
      const id = `${source}:${stem}`;
      const fmEnabled = fm.enabled ?? true;
      const fmPriority = fm.priority ?? DEFAULT_PRIORITY;
      const stateEntry = state[id];
      const enabled = stateEntry?.enabled ?? fmEnabled;
      const priority = stateEntry?.priority ?? fmPriority;
      const name = fm.name ?? stem;
      const type = this.resolveType(fm.type, stem);
      out.push({ id, name, type, enabled, source, priority, filePath });
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

  private parseFrontmatter(filePath: string): ParsedFrontmatter {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return {};
    }
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) return {};
    const block = fmMatch[1];
    if (!block) return {};
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
    return result;
  }

  private loadState(): HookState {
    if (!fs.existsSync(this.stateFile)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8')) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as HookState;
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

export function listDiscoveredHooks(): DiscoveredHook[] {
  return getDefault().list();
}

export function enableHook(name: string): boolean {
  return getDefault().enable(name);
}

export function disableHook(name: string): boolean {
  return getDefault().disable(name);
}
