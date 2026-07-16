/**
 * Agent 执行模块 — 非交互式执行,支持工具调用循环。
 *
 * 灵感来源:cli 的 `cli-shell` crate(agent runtime + leader/stdio/headless)。
 * 简化策略(做减法):
 *   - 用 prompt engineering 让 LLM 输出结构化 tool_call 块(不依赖后端 function calling)
 *   - 工具循环:发 tools schema → 解析 tool_calls → 本地执行 → 回传 tool_result → 循环
 *   - 循环终止条件:LLM 不再输出 tool_call(end_turn)或达到 maxIterations
 *
 * Headless 模式(--json 或非 TTY):输出 NDJSON 事件流。
 * Exit code:0=成功 / 1=失败 / 2=部分完成(max_iterations) / 130=中断
 *
 * 公共函数(供 REPL/ACP 复用):
 *   - setupAgentTools:注册工具 + 构建 system prompt(含 AGENTS.md 注入)
 *   - runToolLoop:执行多轮工具循环,支持回调(onDelta/onToolCall/onToolResult)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { streamChat, setBaseUrl, setTokenProvider } from '@ihui/api-client';
import {
  registerTools,
  listTools,
  buildSystemPrompt,
  parseToolCalls,
  executeToolCall,
  formatToolResult,
  clearTools,
  type Tool,
  type ToolContext,
} from '../tools/index.js';
import { BUILTIN_TOOLS } from '../tools/builtins.js';
import { createFileEditTools } from '../tools/file-edit.js';
import { GIT_TOOLS } from '../tools/git.js';
import { FETCH_TOOLS } from '../tools/fetch-url.js';
import { TEST_TOOLS } from '../tools/run-tests.js';
import { DIAGNOSTIC_TOOLS } from '../tools/diagnostics.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import { compressContext } from '../context.js';
import { loadMcpTools } from '../tools/mcp-runtime.js';
import { auditLog } from '../audit.js';
import { loadSettings } from './settings.js';
import type { Session } from './session.js';
import { saveSession } from './session.js';

export type { ToolContext } from '../tools/index.js';

type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };

export interface AgentOptions {
  prompt: string;
  modelId: string;
  workspacePath: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations: number;
  jsonMode?: boolean;
  checkpoints?: CheckpointManager;
  enableMcp?: boolean;
  /** 允许 dangerous 工具自动执行(无确认)。headless 模式推荐显式开启。 */
  allowDangerous?: boolean;
  /** 关联会话(用于中断时持久化 messages 供 --resume 恢复) */
  session?: Session;
  /** 中断信号,abort 后 runToolLoop 会停止并返回 stopReason='cancelled' */
  signal?: AbortSignal;
  /** 强制 LLM 先输出 plan 块再执行工具 */
  planFirst?: boolean;
}

export type AgentStopReason = 'end_turn' | 'cancelled' | 'max_iterations' | 'error';

export interface AgentResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
}

type HeadlessEvent =
  | { type: 'start'; prompt: string; model: string; workspace: string }
  | { type: 'message_delta'; text: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; output: string }
  | { type: 'iteration'; count: number; max: number }
  | { type: 'error'; message: string }
  | { type: 'complete'; stopReason: AgentStopReason; iterations: number };

// ==================== 公共函数 ====================

/** 读取工作区 AGENTS.md(如果存在),用于注入 system prompt */
export function readAgentsMd(workspacePath: string): string | undefined {
  const p = path.join(workspacePath, 'AGENTS.md');
  try {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  } catch {
    // 读取失败忽略
  }
  return undefined;
}

export interface SetupAgentToolsOptions {
  workspacePath: string;
  checkpoints?: CheckpointManager;
  enableMcp?: boolean;
  silent?: boolean;
  /** 危险操作确认回调。REPL 用 inquirer,Agent 用 --allow-dangerous,ACP 默认拒绝。 */
  confirmDangerous?: (tool: Tool, args: Record<string, unknown>) => Promise<boolean>;
  /** 强制 LLM 先输出 plan 块再执行工具 */
  planFirst?: boolean;
}

export interface SetupAgentToolsResult {
  systemPrompt: string;
  ctx: ToolContext;
}

/** 注册工具 + 构建 system prompt(含 AGENTS.md 注入) */
export async function setupAgentTools(opts: SetupAgentToolsOptions): Promise<SetupAgentToolsResult> {
  clearTools();
  registerTools(BUILTIN_TOOLS);
  registerTools(GIT_TOOLS);
  registerTools(FETCH_TOOLS);
  registerTools(TEST_TOOLS);
  registerTools(DIAGNOSTIC_TOOLS);
  registerTools(createFileEditTools({ workspacePath: opts.workspacePath, checkpoints: opts.checkpoints }));
  if (opts.enableMcp) {
    try {
      const mcpTools = await loadMcpTools({ workspacePath: opts.workspacePath });
      if (mcpTools.length > 0) {
        registerTools(mcpTools);
        if (!opts.silent) console.info(chalk.dim(`  🔌 已加载 ${mcpTools.length} 个 MCP 工具`));
      }
    } catch {
      // MCP 加载失败不阻塞
    }
  }

  const tools = listTools();
  const agentsMd = readAgentsMd(opts.workspacePath);
  const systemPrompt = buildSystemPrompt(tools, agentsMd, opts.planFirst);
  const settings = loadSettings();
  const ctx: ToolContext = {
    workspacePath: opts.workspacePath,
    confirmDangerous: opts.confirmDangerous,
    sandbox: settings.sandbox ? {
      commandAllowlist: settings.sandbox.commandAllowlist,
      blockedEnvVars: settings.sandbox.blockedEnvVars,
      allowedPaths: settings.sandbox.allowedPaths,
    } : undefined,
  };

  return { systemPrompt, ctx };
}

export interface RunToolLoopOptions {
  modelId: string;
  messages: ChatMessage[];
  ctx: ToolContext;
  maxIterations: number;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void | Promise<void>;
  onToolCall?: (name: string, args: Record<string, unknown>) => void | Promise<void>;
  onToolResult?: (name: string, success: boolean, output: string) => void | Promise<void>;
  onIteration?: (count: number, max: number) => void | Promise<void>;
  onError?: (message: string) => void | Promise<void>;
}

export interface RunToolLoopResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
}

/** 执行多轮工具循环,直到 end_turn 或 maxIterations。messages 数组会被原地修改(追加 assistant + tool_result 消息) */
export async function runToolLoop(opts: RunToolLoopOptions): Promise<RunToolLoopResult> {
  let assistantText = '';
  let hadError = false;
  let iterations = 0;
  const consecutiveFailures = new Map<string, number>();
  const FAILURE_REFLECTION_THRESHOLD = 2;

  try {
    for (let i = 0; i < opts.maxIterations; i++) {
      iterations = i + 1;
      await opts.onIteration?.(iterations, opts.maxIterations);

      const compression = compressContext(opts.messages);
      const effectiveMessages = compression.messages;

      let iterationText = '';
      let iterError = false;

      await streamChat({
        model: opts.modelId,
        messages: effectiveMessages,
        signal: opts.signal,
        onDelta: (delta) => {
          iterationText += delta;
          void opts.onDelta?.(delta);
        },
        onError: (err) => {
          iterError = true;
          hadError = true;
          void opts.onError?.(err);
        },
        onDone: () => {
          // 由调用方处理
        },
      });

      if (iterError) break;

      opts.messages.push({ role: 'assistant', content: iterationText });
      assistantText += iterationText;

      const toolCalls = parseToolCalls(iterationText);

      if (toolCalls.length === 0) {
        break;
      }

      const resultParts: string[] = [];
      for (const call of toolCalls) {
        await opts.onToolCall?.(call.name, call.arguments);

        const startTime = Date.now();
        const result = await executeToolCall(call, opts.ctx);
        const durationMs = Date.now() - startTime;

        auditLog({
          timestamp: new Date().toISOString(),
          tool: call.name,
          input: call.arguments,
          output: result.output,
          success: result.success,
          durationMs,
          error: result.error,
        });

        if (result.success) {
          consecutiveFailures.set(call.name, 0);
        } else {
          const prev = consecutiveFailures.get(call.name) ?? 0;
          const next = prev + 1;
          consecutiveFailures.set(call.name, next);
          if (next >= FAILURE_REFLECTION_THRESHOLD) {
            resultParts.push(`[系统提示] 工具 ${call.name} 已连续失败 ${next} 次。请反思:参数是否正确?是否应该换一种工具或方案?当前失败原因:${result.error ?? '未知'}`);
            consecutiveFailures.set(call.name, 0);
          }
        }

        await opts.onToolResult?.(call.name, result.success, result.output);
        resultParts.push(formatToolResult(call, result));
      }

      opts.messages.push({ role: 'user', content: resultParts.join('\n\n') });
    }
  } catch (err) {
    if (opts.signal?.aborted) {
      // abort 不是错误,由 stopReason 逻辑处理为 'cancelled'
    } else {
      hadError = true;
      const msg = err instanceof Error ? err.message : String(err);
      await opts.onError?.(msg);
    }
  }

  let stopReason: AgentStopReason;
  if (opts.signal?.aborted) {
    stopReason = 'cancelled';
  } else if (hadError) {
    stopReason = 'error';
  } else if (iterations >= opts.maxIterations) {
    stopReason = 'max_iterations';
  } else {
    stopReason = 'end_turn';
  }

  return { stopReason, assistantText, iterations };
}

// ==================== Agent 模式(非交互式) ====================

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  const { systemPrompt, ctx } = await setupAgentTools({
    workspacePath: opts.workspacePath,
    checkpoints: opts.checkpoints,
    enableMcp: opts.enableMcp,
    silent: opts.jsonMode === true,
    planFirst: opts.planFirst,
    confirmDangerous: async (tool, args) => {
      if (opts.allowDangerous) {
        if (!opts.jsonMode) console.info(chalk.yellow(`  ⚠ 自动允许危险操作: ${tool.name} ${JSON.stringify(args).slice(0, 100)}`));
        return true;
      }
      if (!opts.jsonMode) console.error(chalk.red(`  ✗ 危险操作被拒绝(需 --allow-dangerous): ${tool.name}`));
      return false;
    },
  });

  const jsonMode = opts.jsonMode === true;
  const emit = (event: HeadlessEvent): void => {
    if (jsonMode) process.stdout.write(JSON.stringify(event) + '\n');
  };

  const spinner = jsonMode ? null : ora({ text: '准备中...', color: 'cyan' }).start();

  if (jsonMode) {
    emit({ type: 'start', prompt: opts.prompt, model: opts.modelId, workspace: opts.workspacePath });
  } else {
    console.info(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}`));
    console.info(chalk.dim(`任务: ${opts.prompt}\n`));
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: opts.prompt },
  ];

  // 如果带历史会话(--resume/--continue),恢复非 system 历史
  if (opts.session?.history.length) {
    for (const m of opts.session.history) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role as ChatRole, content: m.content });
      }
    }
  }

  try {
    const result = await runToolLoop({
      modelId: opts.modelId,
      messages,
      ctx,
      maxIterations: opts.maxIterations,
      signal: opts.signal,
      onDelta: (delta) => {
        if (jsonMode) emit({ type: 'message_delta', text: delta });
        else {
          if (spinner?.isSpinning) spinner.stop();
          process.stdout.write(delta);
        }
      },
      onToolCall: (name, args) => {
        emit({ type: 'tool_call', name, arguments: args });
        if (!jsonMode) {
          if (spinner?.isSpinning) spinner.stop();
          console.info(chalk.cyan(`\n  🔧 ${name} ${JSON.stringify(args)}`));
        }
      },
      onToolResult: (name, success, output) => {
        emit({ type: 'tool_result', name, success, output });
        if (!jsonMode) {
          const icon = success ? '✓' : '✗';
          console.info(chalk.dim(`  ${icon} ${output.slice(0, 200)}`));
        }
      },
      onIteration: (count, max) => {
        emit({ type: 'iteration', count, max });
        if (!jsonMode && spinner) {
          spinner.start(`🔧 执行中 (轮次 ${count}/${max})`);
        }
      },
      onError: (message) => {
        emit({ type: 'error', message });
        if (!jsonMode) {
          if (spinner?.isSpinning) spinner.stop();
          console.error(chalk.red(`\n❌ ${message}`));
        }
      },
    });

    if (spinner?.isSpinning) spinner.stop();

    if (!jsonMode) {
      console.info(chalk.green(`\n✨ 完成 (${result.iterations} 轮迭代, ${result.stopReason})\n`));
    }
    emit({ type: 'complete', stopReason: result.stopReason, iterations: result.iterations });

    return result;
  } finally {
    // 任何路径(完成/错误/中断)都持久化 messages 到 session,供 --resume 恢复
    if (opts.session) {
      opts.session.history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
      saveSession(opts.session);
    }
  }
}

export function stopReasonToExitCode(reason: AgentStopReason): number {
  switch (reason) {
    case 'end_turn':
      return 0;
    case 'error':
      return 1;
    case 'max_iterations':
      return 2;
    case 'cancelled':
      return 130;
    default:
      return 1;
  }
}
