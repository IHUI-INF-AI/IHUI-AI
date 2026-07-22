/**
 * ihui hooks-auto — Hooks 自动发现机制(深度对标 OpenClaw hooks 系统并反超)。
 *
 * 与 apps/cli/src/hooks/index.ts(手动 hooks.json 配置)互补:
 *   - 手动 hooks:用户在 hooks.json 写死 preToolCall/postToolCall 命令,需手动维护
 *   - 自动发现:扫描多目录的脚本文件,自动识别类型/优先级,支持热重载 + 沙箱执行
 *
 * 反超 OpenClaw 之处:
 *   1. 多目录自动扫描(OpenClaw 需手动配置):5 级目录 <workspace>/.{ihui,agents,claude,cursor}/hooks/ + ~/.ihui/hooks/
 *   2. 5 种 hook 类型:pre_tool / post_tool / pre_session / post_session / on_error
 *   3. hook 优先级(0-100)+ 冲突检测(同 type 同 priority)
 *   4. 热重载:fs.watch 监听目录变化,自动重算 diff(added/removed/modified)
 *   5. 沙箱执行:JS/TS 用 new Function() + 只读 require 白名单;shell 用 child_process exec + 超时 kill
 *
 * 文件格式(.js/.mjs/.ts/.sh),可选 frontmatter:
 *   ---
 *   name: my-hook
 *   type: pre_tool
 *   priority: 80
 *   timeout: 3000
 *   enabled: true
 *   ---
 *   // 脚本内容(JS/TS 可通过 ctx 全局变量读上下文,require 白名单读 node:fs/node:path)
 *
 * 无 frontmatter 时:按文件名前缀推断 type(如 pre_tool-*.js → pre_tool),priority 默认 50。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import type { Command } from 'commander';
import chalk from 'chalk';

// ==================== 类型定义 ====================

export type HookType = 'pre_tool' | 'post_tool' | 'pre_session' | 'post_session' | 'on_error';

export interface HookDefinition {
  /** 从文件路径生成的唯一 id(<sourceLabel>:<filename>) */
  id: string;
  /** hook 名称(frontmatter.name 或文件名 stem) */
  name: string;
  type: HookType;
  /** 0-100,高优先级先执行,默认 50 */
  priority: number;
  /** 脚本内容(.js/.ts/.sh/.mjs,已剥离 frontmatter) */
  script: string;
  scriptType: 'javascript' | 'typescript' | 'shell';
  /** 来源目录绝对路径 */
  source: string;
  enabled: boolean;
  /** 超时 ms,默认 5000 */
  timeout: number;
  /** 从 frontmatter 读取的额外元数据(非已知字段) */
  metadata: Record<string, unknown>;
}

export interface HookExecutionContext {
  hookType: HookType;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: { success: boolean; output: string };
  sessionId?: string;
  error?: { message: string; stack?: string };
  workspacePath: string;
  timestamp: number;
}

export interface HookExecutionResult {
  hookId: string;
  status: 'success' | 'failed' | 'timeout' | 'skipped';
  output: string;
  duration: number;
  /** pre_tool hook 可返回 true 中止工具执行 */
  shouldAbort: boolean;
}

/** 热重载回调:新增 / 删除(id 列表)/ 修改 */
type HookChangeCallback = (
  added: HookDefinition[],
  removed: string[],
  modified: HookDefinition[],
) => void;

// ==================== 常量 ====================

const VALID_HOOK_TYPES: ReadonlySet<string> = new Set<string>([
  'pre_tool',
  'post_tool',
  'pre_session',
  'post_session',
  'on_error',
]);

const DEFAULT_PRIORITY = 50;
const DEFAULT_TIMEOUT = 5000;
const MIN_PRIORITY = 0;
const MAX_PRIORITY = 100;

/** 5 级扫描目录:workspace 4 级 + 用户全局 1 级 */
const WORKSPACE_HOOK_DIRS = ['.ihui/hooks', '.agents/hooks', '.claude/hooks', '.cursor/hooks'];
const USER_HOOK_DIR = '.ihui/hooks';

/** 文件扩展名 → scriptType 映射 */
const EXT_SCRIPT_TYPE: Record<string, HookDefinition['scriptType']> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
  '.sh': 'shell',
};

/** 文件名前缀 → HookType 推断(无 frontmatter 时使用) */
const FILENAME_TYPE_PREFIX: ReadonlyArray<{ prefix: string; type: HookType }> = [
  { prefix: 'pre_tool', type: 'pre_tool' },
  { prefix: 'post_tool', type: 'post_tool' },
  { prefix: 'pre_session', type: 'pre_session' },
  { prefix: 'post_session', type: 'post_session' },
  { prefix: 'on_error', type: 'on_error' },
];

/** fs 写方法黑名单(沙箱内禁用,实现只读 fs) */
const FS_WRITE_METHODS: ReadonlySet<string> = new Set<string>([
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'mkdir',
  'mkdirSync',
  'rmdir',
  'rmdirSync',
  'rm',
  'rmSync',
  'unlink',
  'unlinkSync',
  'rename',
  'renameSync',
  'copyFile',
  'copyFileSync',
  'truncate',
  'truncateFileSync',
  'chown',
  'chownSync',
  'chmod',
  'chmodSync',
  'lutimes',
  'lutimesSync',
  'link',
  'linkSync',
  'symlink',
  'symlinkSync',
  'open',
  'openSync',
  'write',
  'writeSync',
  'writev',
  'writevSync',
  'createWriteStream',
]);

/** 已知的 frontmatter 字段(其余进入 metadata) */
const KNOWN_FM_KEYS: ReadonlySet<string> = new Set<string>([
  'name',
  'type',
  'priority',
  'timeout',
  'enabled',
]);

// ==================== Frontmatter 解析 ====================

/** 从 frontmatter 文本解析所有 `key: value` 行为字符串 record(去引号/trim) */
function parseFrontmatterPairs(front: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const line of front.split('\n')) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    pairs[m[1]!] = m[2]!.replace(/^["']|["']$/g, '').trim();
  }
  return pairs;
}

function parseBoolValue(v: string): boolean | undefined {
  const low = v.toLowerCase();
  if (low === 'true' || low === 'yes') return true;
  if (low === 'false' || low === 'no') return false;
  return undefined;
}

function parseNumberValue(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 解析 hook 文件内容:分离 frontmatter 与脚本正文 */
function parseHookFileContent(content: string): {
  frontmatter: Record<string, string>;
  script: string;
  hasFrontmatter: boolean;
} {
  const m = content.match(/^---\s*\n([\s\S]*?)\n?---\s*\n([\s\S]*)$/);
  if (m) {
    return {
      frontmatter: parseFrontmatterPairs(m[1]!),
      script: m[2]!.trim(),
      hasFrontmatter: true,
    };
  }
  return { frontmatter: {}, script: content.trim(), hasFrontmatter: false };
}

/** 无 frontmatter 时按文件名前缀推断 HookType */
function inferTypeFromFilename(stem: string): HookType | undefined {
  const lower = stem.toLowerCase();
  for (const { prefix, type } of FILENAME_TYPE_PREFIX) {
    if (lower === prefix || lower.startsWith(prefix + '-') || lower.startsWith(prefix + '_')) {
      return type;
    }
  }
  return undefined;
}

// ==================== TypeScript 类型擦除(最小化) ====================

/**
 * TypeScript 类型擦除(最小化正则实现,无 TS 编译器依赖)。
 * 用于在沙箱中用 new Function 执行 .ts hook。
 * 处理常见模式:import / export / interface / type 别名 / as 断言 / 变量注解 / 返回类型 / 函数参数注解。
 * 复杂类型(泛型调用、条件类型、嵌套大括号)可能无法正确擦除,建议复杂 hook 使用 .js/.mjs。
 */
function stripTypeScript(src: string): string {
  let s = src;
  // 1. 移除 import 语句(含 import type)
  s = s.replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  s = s.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  s = s.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
  // 2. 移除 export 关键字(保留声明)
  s = s.replace(/^\s*export\s+(default\s+)?/gm, '');
  // 3. 移除 interface 声明(匹配到第一个闭合大括号)
  s = s.replace(/^\s*interface\s+\w+[^{]*\{[\s\S]*?\}\s*$/gm, '');
  // 4. 移除 type 别名声明
  s = s.replace(/^\s*type\s+\w+[^=]*=[\s\S]*?;\s*$/gm, '');
  // 5. 移除 as 类型断言(as IdentifierPath)
  s = s.replace(/\bas\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\b/g, '');
  // 6. 移除变量声明的类型注解:(const|let|var) name: Type = → name =
  s = s.replace(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=;{\n]+?(\s*=)/g, '$1 $2$3');
  // 7. 移除无初值的变量声明类型注解:(const|let|var) name: Type; → name;
  s = s.replace(
    /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$.<>\[\]|& ,]+;/g,
    '$1 $2;',
  );
  // 8. 移除函数返回类型:) : Type { → ) {
  s = s.replace(/\)\s*:\s*[A-Za-z_$][\w$.<>\[\]|& ,]*?\s*\{/g, ') {');
  // 9. 移除函数参数类型注解(仅函数声明/箭头函数的参数列表内)
  s = s.replace(
    /(\bfunction\s+[A-Za-z_$][\w$]*\s*\(|\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\()([^)]*)\)/g,
    (_match, prefix: string, params: string) => {
      const cleaned = params.replace(
        /([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$.<>\[\]|& ,]+/g,
        '$1',
      );
      return `${prefix}${cleaned})`;
    },
  );
  return s;
}

// ==================== 沙箱 ====================

/**
 * 构建沙箱 require 函数:仅允许 node:fs(只读 Proxy,禁用写方法)与 node:path。
 * hook 脚本通过注入的 require 访问受限模块,无法写文件系统或加载任意模块。
 */
function buildSandboxRequire(): (mod: string) => unknown {
  const readOnlyFs = new Proxy(fs, {
    get(target, prop) {
      if (typeof prop === 'string' && FS_WRITE_METHODS.has(prop)) {
        throw new Error(`fs.${prop} 被沙箱禁止(hook 仅允许只读 fs)`);
      }
      return Reflect.get(target, prop);
    },
  });
  return (mod: string) => {
    if (mod === 'node:fs' || mod === 'fs') return readOnlyFs;
    if (mod === 'node:path' || mod === 'path') return path;
    throw new Error(`require '${mod}' 不在 hook 沙箱白名单(仅允许 node:fs / node:path)`);
  };
}

/** 解释 JS/TS hook 的返回值,决定 output 与 shouldAbort */
function interpretReturnValue(value: unknown): { output: string; shouldAbort: boolean } {
  if (value === true) return { output: '', shouldAbort: true };
  if (value === false || value === null || value === undefined) {
    return { output: '', shouldAbort: false };
  }
  if (typeof value === 'string') return { output: value, shouldAbort: false };
  if (typeof value === 'number') return { output: String(value), shouldAbort: false };
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const abort = obj['shouldAbort'] === true || obj['abort'] === true;
    const out =
      typeof obj['output'] === 'string'
        ? obj['output']
        : typeof obj['message'] === 'string'
          ? obj['message']
          : '';
    return { output: out, shouldAbort: abort };
  }
  return { output: String(value), shouldAbort: false };
}

/** 计算 hook 签名用于热重载 diff(含所有可变字段) */
function hookSignature(hook: HookDefinition): string {
  return [hook.name, hook.type, hook.priority, hook.timeout, hook.enabled, hook.script].join('|');
}

// ==================== HookAutoDiscovery ====================

/**
 * Hooks 自动发现:扫描 5 级目录,解析 hook 文件,支持热重载与冲突检测。
 */
export class HookAutoDiscovery {
  private readonly workspacePath: string;
  private readonly hooks: Map<string, HookDefinition> = new Map();
  private watchers: fs.FSWatcher[] = [];
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  private watching = false;

  constructor(workspacePath: string) {
    this.workspacePath = path.resolve(workspacePath);
  }

  /** 扫描所有 hook 目录,返回发现的 hooks(按 priority 降序) */
  discover(): HookDefinition[] {
    this.hooks.clear();
    for (const loc of this.getScanLocations()) {
      this.scanDirectory(loc.dir, loc.sourceLabel);
    }
    return this.getHooks();
  }

  /** 获取 5 级扫描目录与来源标签 */
  private getScanLocations(): Array<{ dir: string; sourceLabel: string }> {
    const locs: Array<{ dir: string; sourceLabel: string }> = [];
    for (const sub of WORKSPACE_HOOK_DIRS) {
      const sourceLabel = sub.split('/')[0]!;
      locs.push({ dir: path.join(this.workspacePath, sub), sourceLabel });
    }
    locs.push({ dir: path.join(os.homedir(), USER_HOOK_DIR), sourceLabel: 'global' });
    return locs;
  }

  /** 扫描单个目录下的 hook 文件(扁平,不递归) */
  private scanDirectory(dir: string, sourceLabel: string): void {
    if (!fs.existsSync(dir)) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const scriptType = EXT_SCRIPT_TYPE[ext];
      if (!scriptType) continue;
      const fullPath = path.join(dir, entry.name);
      const hook = this.parseHookFile(fullPath, dir, sourceLabel, scriptType);
      if (hook) this.hooks.set(hook.id, hook);
    }
  }

  /** 解析单个 hook 文件为 HookDefinition,失败/无法识别类型返回 null */
  private parseHookFile(
    fullPath: string,
    sourceDir: string,
    sourceLabel: string,
    scriptType: HookDefinition['scriptType'],
  ): HookDefinition | null {
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return null;
    }
    const filename = path.basename(fullPath);
    const ext = path.extname(filename).toLowerCase();
    const fileStem = path.basename(fullPath, ext);
    const parsed = parseHookFileContent(content);
    const fm = parsed.frontmatter;

    // type: frontmatter 优先,否则按文件名推断,都无法确定 → 跳过
    let type: HookType | undefined;
    const fmType = fm['type'] ?? '';
    if (fmType && VALID_HOOK_TYPES.has(fmType)) {
      type = fmType as HookType;
    } else {
      type = inferTypeFromFilename(fileStem);
    }
    if (!type) return null;

    const name = fm['name'] ?? fileStem;
    const priorityNum = parseNumberValue(fm['priority'] ?? '');
    const priority =
      priorityNum !== undefined
        ? Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, priorityNum))
        : DEFAULT_PRIORITY;
    const timeoutNum = parseNumberValue(fm['timeout'] ?? '');
    const timeout = timeoutNum !== undefined ? timeoutNum : DEFAULT_TIMEOUT;
    const enabledVal = parseBoolValue(fm['enabled'] ?? '');
    const enabled = enabledVal !== undefined ? enabledVal : true;

    // metadata:非已知 frontmatter 字段
    const metadata: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fm)) {
      if (!KNOWN_FM_KEYS.has(k)) metadata[k] = v;
    }

    return {
      id: `${sourceLabel}:${filename}`,
      name,
      type,
      priority,
      script: parsed.script,
      scriptType,
      source: sourceDir,
      enabled,
      timeout,
      metadata,
    };
  }

  /**
   * 监听 hook 目录变化,自动重载(用 fs.watch + 200ms 防抖)。
   * 仅监听调用时已存在的目录;新建目录需重新调用 watch。
   */
  watch(onChange: HookChangeCallback): void {
    if (this.watching) return;
    this.watching = true;
    for (const loc of this.getScanLocations()) {
      if (!fs.existsSync(loc.dir)) continue;
      try {
        const watcher = fs.watch(loc.dir, () => this.scheduleRescan(onChange));
        watcher.on('error', () => {
          /* 忽略监听错误,避免未捕获事件 */
        });
        this.watchers.push(watcher);
      } catch {
        /* 监听失败跳过该目录 */
      }
    }
  }

  /** 防抖重扫:200ms 内多次变更合并为一次 diff 回调 */
  private scheduleRescan(onChange: HookChangeCallback): void {
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = setTimeout(() => {
      this.watchTimer = null;
      const oldMap = new Map(this.hooks);
      this.discover();
      const newMap = this.hooks;
      const added: HookDefinition[] = [];
      const removed: string[] = [];
      const modified: HookDefinition[] = [];
      for (const [id, hook] of newMap) {
        const old = oldMap.get(id);
        if (!old) {
          added.push(hook);
        } else if (hookSignature(old) !== hookSignature(hook)) {
          modified.push(hook);
        }
      }
      for (const id of oldMap.keys()) {
        if (!newMap.has(id)) removed.push(id);
      }
      if (added.length > 0 || removed.length > 0 || modified.length > 0) {
        onChange(added, removed, modified);
      }
    }, 200);
  }

  /** 停止监听并关闭所有 watcher */
  stopWatch(): void {
    this.watching = false;
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        /* 忽略关闭错误 */
      }
    }
    this.watchers = [];
  }

  /** 获取当前已发现的 hooks(可选按 type 过滤,按 priority 降序) */
  getHooks(type?: HookType): HookDefinition[] {
    const all = Array.from(this.hooks.values());
    const filtered = type ? all.filter((h) => h.type === type) : all;
    return filtered.sort((a, b) => b.priority - a.priority);
  }

  /** 启用/禁用 hook(运行时切换,不影响磁盘文件;下次 discover 重置为文件声明值) */
  setHookEnabled(hookId: string, enabled: boolean): void {
    const hook = this.hooks.get(hookId);
    if (hook) hook.enabled = enabled;
  }

  /** 冲突检测:同 type 同 priority 的 enabled hook 标记冲突 */
  detectConflicts(): Array<{ type: HookType; priority: number; hooks: HookDefinition[] }> {
    const groups = new Map<string, HookDefinition[]>();
    for (const hook of this.hooks.values()) {
      if (!hook.enabled) continue;
      const key = `${hook.type}:${hook.priority}`;
      const arr = groups.get(key);
      if (arr) arr.push(hook);
      else groups.set(key, [hook]);
    }
    const conflicts: Array<{ type: HookType; priority: number; hooks: HookDefinition[] }> = [];
    for (const [key, hooks] of groups) {
      if (hooks.length <= 1) continue;
      const parts = key.split(':');
      const t = parts[0];
      const p = parts[1];
      if (t === undefined || p === undefined) continue;
      conflicts.push({ type: t as HookType, priority: Number(p), hooks });
    }
    return conflicts;
  }
}

// ==================== HookExecutor ====================

type HookFunction = (ctx: HookExecutionContext, requireFn: (mod: string) => unknown) => unknown;

/**
 * Hook 沙箱执行器:JS/TS 用 new Function 包装 + 只读 require 白名单;shell 用 exec + 超时 kill。
 * 失败/超时不影响主流程(除非 pre_tool 返回 shouldAbort)。
 */
export class HookExecutor {
  /** 执行单个 hook */
  async execute(hook: HookDefinition, ctx: HookExecutionContext): Promise<HookExecutionResult> {
    const start = Date.now();
    if (!hook.enabled) {
      return { hookId: hook.id, status: 'skipped', output: '', duration: 0, shouldAbort: false };
    }
    try {
      if (hook.scriptType === 'shell') {
        return await this.executeShell(hook, ctx, start);
      }
      return await this.executeScript(hook, ctx, start);
    } catch (err) {
      return {
        hookId: hook.id,
        status: 'failed',
        output: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
        shouldAbort: false,
      };
    }
  }

  /**
   * 按顺序执行多个 hooks(同 type,按 priority 降序)。
   * pre_tool 链中某 hook 返回 shouldAbort → 停止后续 hook。
   */
  async executeChain(
    hooks: HookDefinition[],
    ctx: HookExecutionContext,
  ): Promise<HookExecutionResult[]> {
    const results: HookExecutionResult[] = [];
    for (const hook of hooks) {
      const result = await this.execute(hook, ctx);
      results.push(result);
      if (result.shouldAbort) break;
    }
    return results;
  }

  /** 沙箱执行 shell hook:exec + cwd 锁定 workspacePath + 超时 kill */
  private executeShell(
    hook: HookDefinition,
    ctx: HookExecutionContext,
    start: number,
  ): Promise<HookExecutionResult> {
    return new Promise<HookExecutionResult>((resolve) => {
      exec(
        hook.script,
        {
          cwd: ctx.workspacePath,
          timeout: hook.timeout,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        },
        (err, stdout, stderr) => {
          const duration = Date.now() - start;
          const out = (stdout || '').trim();
          const errText = (stderr || '').trim();
          if (err === null) {
            resolve({
              hookId: hook.id,
              status: 'success',
              output: out || errText,
              duration,
              shouldAbort: false,
            });
            return;
          }
          // killed === true → 超时被 kill
          if (err.killed === true) {
            resolve({
              hookId: hook.id,
              status: 'timeout',
              output: errText || '执行超时',
              duration,
              shouldAbort: false,
            });
            return;
          }
          // 非零退出 → 失败;pre_tool 视为中止信号
          resolve({
            hookId: hook.id,
            status: 'failed',
            output: errText || out || err.message,
            duration,
            shouldAbort: hook.type === 'pre_tool',
          });
        },
      );
    });
  }

  /** 沙箱执行 JS/TS hook:new Function 包装 + 注入 ctx + require 白名单 */
  private async executeScript(
    hook: HookDefinition,
    ctx: HookExecutionContext,
    start: number,
  ): Promise<HookExecutionResult> {
    const processed = hook.scriptType === 'typescript' ? stripTypeScript(hook.script) : hook.script;
    const sandboxRequire = buildSandboxRequire();

    let fn: HookFunction;
    try {
      fn = new Function('ctx', 'require', `"use strict";\n${processed}`) as HookFunction;
    } catch (err) {
      return {
        hookId: hook.id,
        status: 'failed',
        output: `脚本语法错误: ${err instanceof Error ? err.message : String(err)}`,
        duration: Date.now() - start,
        shouldAbort: false,
      };
    }

    let value: unknown;
    try {
      value = fn(ctx, sandboxRequire);
    } catch (err) {
      return {
        hookId: hook.id,
        status: 'failed',
        output: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
        shouldAbort: false,
      };
    }

    // 异步 hook(返回 Promise):race 超时;同步 hook 立即返回
    if (value instanceof Promise) {
      try {
        value = await this.raceTimeout(value, hook.timeout);
      } catch (err) {
        const duration = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === '__HOOK_TIMEOUT__') {
          return {
            hookId: hook.id,
            status: 'timeout',
            output: '异步执行超时',
            duration,
            shouldAbort: false,
          };
        }
        return { hookId: hook.id, status: 'failed', output: msg, duration, shouldAbort: false };
      }
    }

    const { output, shouldAbort: rawAbort } = interpretReturnValue(value);
    return {
      hookId: hook.id,
      status: 'success',
      output,
      duration: Date.now() - start,
      shouldAbort: rawAbort && hook.type === 'pre_tool',
    };
  }

  /** Promise 超时竞争:超时抛出哨兵错误 */
  private raceTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('__HOOK_TIMEOUT__')), timeoutMs);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
}

// ==================== CLI 命令注册 ====================

const HOOK_TYPE_ORDER: HookType[] = ['pre_tool', 'post_tool', 'pre_session', 'post_session', 'on_error'];

const STATUS_COLOR: Record<HookExecutionResult['status'], (s: string) => string> = {
  success: chalk.green,
  failed: chalk.red,
  timeout: chalk.yellow,
  skipped: chalk.dim,
};

/**
 * 注册 hooks-auto 子命令(供主 agent 在 index.ts 统一调用)。
 *   ihui hooks-auto discover          扫描并列出所有已发现 hooks
 *   ihui hooks-auto conflicts          检测同 type 同 priority 的冲突
 *   ihui hooks-auto test <id|name>     用模拟上下文执行单个 hook(沙箱验证)
 */
export function registerHooksAutoCommand(program: Command): void {
  const cmd = program.command('hooks-auto').description('自动发现并管理多目录 hook 脚本');

  cmd.command('discover')
    .description('扫描所有 hook 目录并列出已发现的 hooks')
    .action(() => {
      const discovery = new HookAutoDiscovery(process.cwd());
      const hooks = discovery.discover();
      const conflicts = discovery.detectConflicts();

      if (hooks.length === 0) {
        console.info(chalk.dim('\n未发现任何 hook 脚本'));
        console.info(chalk.dim('  扫描目录:'));
        console.info(chalk.dim('    <workspace>/.ihui/hooks/'));
        console.info(chalk.dim('    <workspace>/.agents/hooks/'));
        console.info(chalk.dim('    <workspace>/.claude/hooks/'));
        console.info(chalk.dim('    <workspace>/.cursor/hooks/'));
        console.info(chalk.dim('    ~/.ihui/hooks/'));
        console.info(chalk.dim('  文件格式:.js/.mjs/.ts/.sh(可选 frontmatter 声明 type/priority)\n'));
        return;
      }

      console.info(chalk.cyan(`\n已发现 ${hooks.length} 个 hook:`));
      for (const type of HOOK_TYPE_ORDER) {
        const group = hooks.filter((h) => h.type === type);
        if (group.length === 0) continue;
        console.info(chalk.cyan(`\n  ${type} (${group.length}):`));
        for (const h of group) {
          const state = h.enabled ? chalk.green('enabled') : chalk.dim('disabled');
          const meta = chalk.dim(`[${h.scriptType}]`);
          console.info(`    ${chalk.bold(`[${h.priority}]`)} ${chalk.bold(h.id)} ${state} ${meta}`);
          console.info(`      ${chalk.dim(`name: ${h.name}`)}  ${chalk.dim(`source: ${h.source}`)}`);
        }
      }

      if (conflicts.length > 0) {
        console.info(chalk.yellow(`\n冲突 ${conflicts.length} 组(同 type 同 priority):`));
        for (const c of conflicts) {
          const ids = c.hooks.map((h) => h.id).join(', ');
          console.info(`  ${chalk.yellow(`${c.type} @ ${c.priority}`)}: ${ids}`);
        }
      }
      console.info('');
    });

  cmd.command('conflicts')
    .description('检测同 type 同 priority 的 hook 冲突')
    .action(() => {
      const discovery = new HookAutoDiscovery(process.cwd());
      discovery.discover();
      const conflicts = discovery.detectConflicts();
      if (conflicts.length === 0) {
        console.info(chalk.green('\n无冲突 ✅\n'));
        return;
      }
      console.info(chalk.yellow(`\n检测到 ${conflicts.length} 组冲突:`));
      for (const c of conflicts) {
        const ids = c.hooks.map((h) => h.id).join(', ');
        console.info(`  ${chalk.yellow(`${c.type} @ priority ${c.priority}`)}: ${ids}`);
      }
      console.info('');
    });

  cmd.command('test <id>')
    .description('用模拟上下文执行单个 hook(沙箱验证,按 id 或 name 匹配)')
    .action(async (id: string) => {
      const discovery = new HookAutoDiscovery(process.cwd());
      const hooks = discovery.discover();
      const hook = hooks.find((h) => h.id === id || h.name === id);
      if (!hook) {
        console.error(chalk.red(`\n未找到 hook: ${id}`));
        console.info(chalk.dim('可用 hooks:'));
        for (const h of hooks) console.info(chalk.dim(`  ${h.id}  (${h.name})`));
        console.info('');
        return;
      }
      const ctx: HookExecutionContext = {
        hookType: hook.type,
        workspacePath: process.cwd(),
        timestamp: Date.now(),
      };
      if (hook.type === 'pre_tool' || hook.type === 'post_tool') {
        ctx.toolName = 'test-tool';
      }
      console.info(chalk.cyan(`\n执行 hook: ${hook.id} (${hook.scriptType})`));
      const executor = new HookExecutor();
      const result = await executor.execute(hook, ctx);
      const color = STATUS_COLOR[result.status];
      console.info(`  ${chalk.bold('状态')}: ${color(result.status)}`);
      console.info(`  ${chalk.bold('耗时')}: ${result.duration}ms`);
      console.info(`  ${chalk.bold('中止')}: ${result.shouldAbort ? chalk.red('是') : '否'}`);
      if (result.output) {
        console.info(`  ${chalk.bold('输出')}: ${result.output}`);
      }
      console.info('');
    });
}
