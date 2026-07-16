/**
 * Pre/Post Tool Hooks — 用户自定义工具调用钩子。
 *
 * 灵感来源:cli 的 hooks 系统(pre/post tool call 可阻断)。
 * 简化策略(做减法):
 *   - 从 ~/.ihui/hooks.json 加载配置
 *   - preToolCall:钩子 exit != 0 时阻断工具调用(blockOnError 默认 true)
 *   - postToolCall:仅通知,不阻断
 *   - 钩子通过环境变量接收上下文(IHUI_TOOL / IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT)
 *   - matchTool 支持正则匹配工具名,省略则匹配所有工具
 *
 * 配置示例 (~/.ihui/hooks.json):
 * {
 *   "preToolCall": [
 *     { "name": "block-rm-rf", "command": "echo 'blocked' && exit 1", "matchTool": "bash", "blockOnError": true }
 *   ],
 *   "postToolCall": [
 *     { "name": "log-tool", "command": "echo $(date) $IHUI_TOOL >> /tmp/ihui-tools.log" }
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
}

export interface HooksConfig {
  preToolCall?: HookEntry[];
  postToolCall?: HookEntry[];
}

export interface HookResult {
  proceed: boolean;
  reason?: string;
}

export function getHooksPath(): string {
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
    timeout: 10_000,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
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

export function runPostToolCall(toolName: string, output: unknown): void {
  const config = loadHooks();
  const hooks = config.postToolCall ?? [];
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    runHook(entry, {
      IHUI_HOOK_TYPE: 'postToolCall',
      IHUI_TOOL: toolName,
      IHUI_TOOL_OUTPUT: JSON.stringify(output ?? {}),
    });
  }
}
