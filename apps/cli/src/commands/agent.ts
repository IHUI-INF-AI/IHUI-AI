/**
 * Agent 执行模块 — 非交互式执行,支持工具调用循环。
 *
 * 灵感来源:grok-build 的 `xai-grok-shell` crate(agent runtime + leader/stdio/headless)。
 * 简化策略(做减法):
 *   - 用 prompt engineering 让 LLM 输出结构化 tool_call 块(不依赖后端 function calling)
 *   - 工具循环:发 tools schema → 解析 tool_calls → 本地执行 → 回传 tool_result → 循环
 *   - 循环终止条件:LLM 不再输出 tool_call(end_turn)或达到 maxIterations
 *
 * Headless 模式(--json 或非 TTY):输出 NDJSON 事件流。
 * Exit code:0=成功 / 1=失败 / 2=部分完成(max_iterations) / 130=中断
 */

import chalk from 'chalk';
import { streamChat, setBaseUrl, setTokenProvider } from '@ihui/api-client';
import {
  registerTools,
  listTools,
  buildSystemPrompt,
  parseToolCalls,
  executeToolCall,
  formatToolResult,
  clearTools,
  type ToolContext,
} from '../tools/index.js';
import { BUILTIN_TOOLS } from '../tools/builtins.js';
import { createFileEditTools } from '../tools/file-edit.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import { compressContext } from '../context.js';
import { loadMcpTools } from '../tools/mcp-runtime.js';

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

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  clearTools();
  registerTools(BUILTIN_TOOLS);
  if (opts.checkpoints) {
    registerTools(createFileEditTools({ workspacePath: opts.workspacePath, checkpoints: opts.checkpoints }));
  }
  if (opts.enableMcp) {
    try {
      const mcpTools = await loadMcpTools({ workspacePath: opts.workspacePath });
      if (mcpTools.length > 0) {
        registerTools(mcpTools);
        if (opts.jsonMode !== true) console.info(chalk.dim(`  🔌 已加载 ${mcpTools.length} 个 MCP 工具`));
      }
    } catch {
      // MCP 加载失败不阻塞
    }
  }

  const tools = listTools();
  const systemPrompt = buildSystemPrompt(tools);
  const ctx: ToolContext = { workspacePath: opts.workspacePath };

  const jsonMode = opts.jsonMode === true;
  const emit = (event: HeadlessEvent): void => {
    if (jsonMode) process.stdout.write(JSON.stringify(event) + '\n');
  };

  if (jsonMode) {
    emit({ type: 'start', prompt: opts.prompt, model: opts.modelId, workspace: opts.workspacePath });
  } else {
    console.info(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}`));
    console.info(chalk.dim(`任务: ${opts.prompt}\n`));
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: opts.prompt },
  ];

  let assistantText = '';
  let hadError = false;
  let iterations = 0;

  try {
    for (let i = 0; i < opts.maxIterations; i++) {
      iterations = i + 1;
      emit({ type: 'iteration', count: iterations, max: opts.maxIterations });

      const compression = compressContext(messages);
      if (compression.compressed && !jsonMode) {
        console.info(chalk.dim(`  📦 上下文压缩: ${compression.originalTokens} → ${compression.compressedTokens} tokens (移除 ${compression.removedCount} 条)`));
      }
      const effectiveMessages = compression.messages;

      let iterationText = '';
      let iterError = false;

      await streamChat({
        model: opts.modelId,
        messages: effectiveMessages,
        onDelta: (delta) => {
          iterationText += delta;
          if (jsonMode) emit({ type: 'message_delta', text: delta });
          else process.stdout.write(delta);
        },
        onError: (err) => {
          iterError = true;
          hadError = true;
          if (jsonMode) emit({ type: 'error', message: err });
          else console.error(chalk.red(`\n❌ ${err}`));
        },
        onDone: () => {
          if (!jsonMode) console.info('');
        },
      });

      if (iterError) break;

      messages.push({ role: 'assistant', content: iterationText });
      assistantText += iterationText;

      const toolCalls = parseToolCalls(iterationText);

      if (toolCalls.length === 0) {
        break;
      }

      if (!jsonMode) console.info(chalk.dim(`\n  📦 检测到 ${toolCalls.length} 个工具调用`));

      const resultParts: string[] = [];
      for (const call of toolCalls) {
        emit({ type: 'tool_call', name: call.name, arguments: call.arguments });
        if (!jsonMode) console.info(chalk.cyan(`  🔧 ${call.name} ${JSON.stringify(call.arguments)}`));

        const result = await executeToolCall(call, ctx);

        emit({ type: 'tool_result', name: call.name, success: result.success, output: result.output });
        if (!jsonMode) {
          const icon = result.success ? '✓' : '✗';
          console.info(chalk.dim(`  ${icon} ${result.output.slice(0, 200)}`));
        }

        resultParts.push(formatToolResult(call, result));
      }

      messages.push({ role: 'user', content: resultParts.join('\n\n') });

      if (i === opts.maxIterations - 1) {
        if (!jsonMode) console.info(chalk.yellow(`\n  ⚠ 达到最大迭代次数 (${opts.maxIterations})`));
      }
    }
  } catch (err) {
    hadError = true;
    const msg = err instanceof Error ? err.message : String(err);
    if (jsonMode) emit({ type: 'error', message: msg });
    else console.error(chalk.red(`\n❌ ${msg}`));
  }

  let stopReason: AgentStopReason;
  if (hadError) {
    stopReason = 'error';
  } else if (iterations >= opts.maxIterations) {
    stopReason = 'max_iterations';
  } else {
    stopReason = 'end_turn';
  }

  if (!jsonMode) {
    console.info(chalk.green(`\n✨ 完成 (${iterations} 轮迭代, ${stopReason})\n`));
  }
  emit({ type: 'complete', stopReason, iterations });

  return { stopReason, assistantText, iterations };
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
