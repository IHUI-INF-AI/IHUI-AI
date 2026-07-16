/**
 * Pre/Post Tool Hooks — 用户自定义工具调用钩子。
 *
 * 灵感来源:cli 的 hooks 系统(pre/post tool call 可阻断 + sessionStart/sessionEnd 生命周期)。
 * 简化策略(做减法):
 *   - 多源加载 hooks.json:<cwd>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}(高→低,深合并)
 *   - 每个 hook 二选一:command(本地 shell)或 webhook(HTTP POST 通知外部服务)
 *   - preToolCall:钩子失败时阻断工具调用(blockOnError 默认 true)
 *   - postToolCall:钩子失败时返回 blockResult(blockOnError 默认 false,仅通知)
 *   - sessionStart:会话启动时执行,失败阻断会话启动(blockOnError 默认 true)
 *   - sessionEnd:会话结束时执行,失败不阻塞退出(始终 swallow)
 *   - 钩子通过环境变量接收上下文(IHUI_TOOL / IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT / IHUI_WORKSPACE / IHUI_SESSION_ID)
 *   - matchTool 支持正则匹配工具名,省略则匹配所有工具
 *
 * 配置示例 (~/.ihui/hooks.json):
 * {
 *   "preToolCall": [
 *     { "name": "block-rm-rf", "command": "echo 'blocked' && exit 1", "matchTool": "bash", "blockOnError": true }
 *   ],
 *   "postToolCall": [
 *     { "name": "notify-feishu", "webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
 *       "body": "{\"event\":\"{{event}}\",\"tool\":\"{{toolName}}\"}", "blockOnError": false }
 *   ],
 *   "sessionStart": [
 *     { "name": "load-ctx", "command": "cat ~/.ihui/context.md" }
 *   ],
 *   "sessionEnd": [
 *     { "name": "notify", "command": "echo 'session ended' >> ~/.ihui/sessions.log" }
 *   ]
 * }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';

export interface HookEntry {
  name: string;
  /** 本地 shell 命令(与 webhook 二选一) */
  command?: string;
  /** HTTP webhook URL(与 command 二选一,POST 通知外部服务) */
  webhook?: string;
  /** webhook 请求方法(默认 POST) */
  method?: 'POST' | 'PUT' | 'GET';
  /** webhook 请求头 */
  headers?: Record<string, string>;
  /** webhook 请求 body 模板(支持 {{event}} {{workspacePath}} {{sessionId}} {{toolName}} {{toolArgs}}) */
  body?: string;
  matchTool?: string;
  blockOnError?: boolean;
  /** 超时毫秒(command 与 webhook 共用,默认 10000) */
  timeout?: number;
}

export interface HooksConfig {
  preToolCall?: HookEntry[];
  postToolCall?: HookEntry[];
  sessionStart?: HookEntry[];
  sessionEnd?: HookEntry[];
}

export interface HookResult {
  proceed: boolean;
  reason?: string;
}

export interface SessionHookContext {
  workspacePath: string;
  sessionId?: string;
}

/**
 * webhook body 模板变量替换:将 {{var}} 替换为 vars[var]。
 * 未定义变量替换为空字符串。无变量时原样返回。
 */
export function buildWebhookBody(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : '';
  });
}

/**
 * 深合并两个 HooksConfig:b 的标量/数组与 a 合并。
 * 数组字段(preToolCall 等)拼接为 [...a, ...b](a 在前);仅一边存在则保留该边。
 */
export function deepMergeHooks(a: HooksConfig, b: HooksConfig): HooksConfig {
  const result: HooksConfig = {};
  const keys: Array<keyof HooksConfig> = ['preToolCall', 'postToolCall', 'sessionStart', 'sessionEnd'];
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av && bv) {
      result[k] = [...av, ...bv];
    } else if (av) {
      result[k] = [...av];
    } else if (bv) {
      result[k] = [...bv];
    }
  }
  return result;
}

/** 多源扫描目录(高→低):workspace 三级 → home 三级 */
const CONFIG_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

function listHooksConfigPaths(cwd: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(cwd, d, 'hooks.json'));
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(home, d, 'hooks.json'));
  return paths;
}

export function getHooksPath(): string {
  if (process.env.IHUI_HOOKS_CONFIG) return process.env.IHUI_HOOKS_CONFIG;
  return path.join(os.homedir(), '.ihui', 'hooks.json');
}

/**
 * 多源加载 hooks.json,按优先级深合并(高优先级覆盖低优先级)。
 * IHUI_HOOKS_CONFIG 环境变量设置时退化为单源(向后兼容)。
 */
export function loadHooksConfig(cwd: string = process.cwd()): HooksConfig {
  if (process.env.IHUI_HOOKS_CONFIG) {
    const p = process.env.IHUI_HOOKS_CONFIG;
    if (!fs.existsSync(p)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as HooksConfig;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  const paths = listHooksConfigPaths(cwd);
  let acc: HooksConfig = {};
  for (const p of [...paths].reverse()) {
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as HooksConfig;
      if (parsed && typeof parsed === 'object') {
        acc = deepMergeHooks(acc, parsed);
      }
    } catch {
      // 损坏文件忽略,继续下一源
    }
  }
  return acc;
}

export function loadHooks(): HooksConfig {
  return loadHooksConfig();
}

function matchesTool(entry: HookEntry, toolName: string): boolean {
  if (!entry.matchTool) return true;
  try {
    return new RegExp(entry.matchTool).test(toolName);
  } catch {
    return entry.matchTool === toolName;
  }
}

type WebhookResult =
  | { kind: 'response'; status: number; body: string }
  | { kind: 'error'; error: 'timeout' | 'network'; message: string };

/** 子进程脚本:用原生 fetch 发起 webhook,AbortController 控制超时,结果以 JSON 写到 stdout。
 *  通过 IHUI_WEBHOOK_CFG 环境变量传入配置,避免命令行转义。 */
const WEBHOOK_SCRIPT = `
const cfg = JSON.parse(process.env.IHUI_WEBHOOK_CFG || '{}');
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), cfg.timeout);
fetch(cfg.url, {
  method: cfg.method,
  headers: cfg.headers,
  body: cfg.body,
  signal: ctrl.signal,
}).then(async (r) => {
  const t = await r.text().catch(() => '');
  process.stdout.write(JSON.stringify({ kind: 'response', status: r.status, body: String(t).slice(0, 500) }));
}).catch((e) => {
  const name = (e && e.name) || '';
  const code = (e && e.code) || '';
  const isTimeout = name === 'TimeoutError' || name === 'AbortError' || code === 'ABORT_ERR';
  process.stdout.write(JSON.stringify({ kind: 'error', error: isTimeout ? 'timeout' : 'network', message: String((e && e.message) || e) }));
}).finally(() => clearTimeout(timer));
`;

function extractWebhookVars(env: Record<string, string>): Record<string, string> {
  return {
    event: env.IHUI_HOOK_TYPE ?? '',
    workspacePath: env.IHUI_WORKSPACE ?? '',
    sessionId: env.IHUI_SESSION_ID ?? '',
    toolName: env.IHUI_TOOL ?? '',
    toolArgs: env.IHUI_TOOL_INPUT ?? env.IHUI_TOOL_OUTPUT ?? '',
  };
}

function runWebhookSync(
  entry: HookEntry,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  const timeout = entry.timeout ?? 10_000;
  const cfg = {
    url: entry.webhook,
    method: entry.method ?? 'POST',
    headers: entry.headers ?? {},
    body: entry.body ? buildWebhookBody(entry.body, extractWebhookVars(env)) : undefined,
    timeout,
  };
  const result = spawnSync(process.execPath, ['-e', WEBHOOK_SCRIPT], {
    env: { ...process.env, ...env, IHUI_WEBHOOK_CFG: JSON.stringify(cfg) },
    encoding: 'utf-8',
    timeout: timeout + 3000,
    windowsHide: true,
  });
  if (result.error) {
    return { exitCode: 1, stdout: '', stderr: `webhook 执行失败: ${result.error.message}` };
  }
  if (result.status === null) {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时' };
  }
  const out = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  let res: WebhookResult;
  try {
    res = JSON.parse(out) as WebhookResult;
  } catch {
    return { exitCode: 1, stdout: '', stderr: 'webhook 响应解析失败' };
  }
  if (res.kind === 'response') {
    if (res.status >= 200 && res.status < 300) {
      return { exitCode: 0, stdout: `webhook ${res.status}`, stderr: '' };
    }
    return { exitCode: 1, stdout: '', stderr: `webhook 返回 ${res.status}` };
  }
  if (res.error === 'timeout') {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时' };
  }
  return { exitCode: 1, stdout: '', stderr: res.message || 'webhook 网络错误' };
}

function runHook(
  entry: HookEntry,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  if (entry.webhook) {
    return runWebhookSync(entry, env);
  }
  if (!entry.command) {
    return { exitCode: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync(entry.command, {
    shell: true,
    encoding: 'utf-8',
    timeout: entry.timeout ?? 10_000,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const timedOut = result.signal === 'SIGTERM' && result.status === null;
  return {
    exitCode: timedOut ? 124 : (result.status ?? 1),
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

export function runPreToolCall(toolName: string, input: unknown): HookResult {
  const config = loadHooks();
  const hooks = config.preToolCall ?? [];
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const r = runHook(entry, {
      IHUI_HOOK_TYPE: 'preToolCall',
      IHUI_TOOL: toolName,
      IHUI_TOOL_INPUT: JSON.stringify(input ?? {}),
    });
    const blockOnError = entry.blockOnError ?? true;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runPostToolCall(toolName: string, output: unknown): HookResult {
  const config = loadHooks();
  const hooks = config.postToolCall ?? [];
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const r = runHook(entry, {
      IHUI_HOOK_TYPE: 'postToolCall',
      IHUI_TOOL: toolName,
      IHUI_TOOL_OUTPUT: JSON.stringify(output ?? {}),
    });
    const blockOnError = entry.blockOnError ?? false;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `postToolCall 钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runSessionStartHooks(config: HooksConfig | null, ctx: SessionHookContext): HookResult {
  if (!config?.sessionStart) return { proceed: true };
  for (const entry of config.sessionStart) {
    const r = runHook(entry, {
      IHUI_HOOK_TYPE: 'sessionStart',
      IHUI_WORKSPACE: ctx.workspacePath,
      IHUI_SESSION_ID: ctx.sessionId ?? '',
    });
    const blockOnError = entry.blockOnError ?? true;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `sessionStart 钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runSessionEndHooks(config: HooksConfig | null, ctx: SessionHookContext): void {
  if (!config?.sessionEnd) return;
  for (const entry of config.sessionEnd) {
    try {
      runHook(entry, {
        IHUI_HOOK_TYPE: 'sessionEnd',
        IHUI_WORKSPACE: ctx.workspacePath,
        IHUI_SESSION_ID: ctx.sessionId ?? '',
      });
    } catch {
      // sessionEnd 失败不阻塞退出
    }
  }
}
