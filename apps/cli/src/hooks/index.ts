/**
 * Pre/Post Tool Hooks — 用户自定义工具调用钩子。
 *
 * 灵感来源:grok-build 的 hooks 系统(pre/post tool call 可阻断 + sessionStart/sessionEnd 生命周期)。
 * 简化策略(做减法):
 *   - 从 ~/.ihui/hooks.json 加载配置
 *   - preToolCall:钩子 exit != 0 时阻断工具调用(blockOnError 默认 true)
 *   - postToolCall:钩子 exit != 0 时返回 blockResult(blockOnError 默认 false,仅通知)
 *   - sessionStart:会话启动时执行,exit != 0 阻断会话启动(blockOnError 默认 true)
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
 *     { "name": "verify-build", "command": "npm test", "matchTool": "bash", "blockOnError": true }
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
  command: string;
  matchTool?: string;
  blockOnError?: boolean;
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

export function getHooksPath(): string {
  if (process.env.IHUI_HOOKS_CONFIG) return process.env.IHUI_HOOKS_CONFIG;
  return path.join(os.homedir(), '.ihui', 'hooks.json');
}

export function loadHooks(): HooksConfig {
  const p = getHooksPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as HooksConfig;
  } catch {
    return {};
  }
}

function matchesTool(entry: HookEntry, toolName: string): boolean {
  if (!entry.matchTool) return true;
  try {
    return new RegExp(entry.matchTool).test(toolName);
  } catch {
    return entry.matchTool === toolName;
  }
}

function runHook(
  entry: HookEntry,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
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
