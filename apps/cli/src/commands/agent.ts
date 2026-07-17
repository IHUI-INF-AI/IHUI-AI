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
  parsePlanBlock,
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
import { CODEGRAPH_TOOLS } from '../tools/codegraph.js';
import { createSubagentTool } from '../tools/subagent.js';
import { resolveSandboxOptions } from '../sandbox/index.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import { compressContextIfNeeded, estimateTokens, estimateMessagesTokens } from '../context.js';
import { generateReminders } from '../reminders.js';
import { loadMcpTools } from '../tools/mcp-runtime.js';
import { loadSkills, formatSkillsForPrompt, type Skill } from '../skills/index.js';
import { loadMemory, formatMemoryForPrompt, type MemoryEntry } from '../memory/index.js';
import { auditLog } from '../audit.js';
import { loadHooks, runSessionStartHooks, runSessionEndHooks } from '../hooks/index.js';
import { loadSettings, type SamplerSettings } from './settings.js';
import type { Session } from './session.js';
import { saveSession } from './session.js';

// 模块增强:为 StreamChatOptions 添加 sampler 字段(透传给后端 LiteLLM)。
// 不修改 packages/api-client 源码,在此处以声明合并方式扩展类型。
declare module '@ihui/api-client' {
  interface StreamChatOptions {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    stop?: string[];
  }
}

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
  /** P1-5 输出格式:覆盖 jsonMode(若设置)。--output-format 显式传入,默认 undefined 走 jsonMode 路径 */
  outputFormat?: OutputFormat;
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
  /** LLM 采样参数(透传到 streamChat) */
  sampler?: SamplerSettings;
}

export type AgentStopReason = 'end_turn' | 'cancelled' | 'max_iterations' | 'budget_limited' | 'error';

export interface AgentResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
  usage: TokenUsage;
}

// ==================== P1-5 Headless 多格式输出(实现在 src/headless-format.ts,此处仅 re-export)====================
// 灵感来源:cli 的 LeaderOutput/HeadlessFormat(Rust enum,支持 text/json/markdown/yaml)。
// 简化策略(做减法):不引入外部 yaml 库,自实现 30 行极简序列化器(只覆盖常见类型),流式输出不缓冲。
export type { OutputFormat, HeadlessEvent } from '../headless-format.js'
export { parseOutputFormat, formatHeadlessEvent } from '../headless-format.js'
import { formatHeadlessEvent } from '../headless-format.js'
import type { OutputFormat, HeadlessEvent } from '../headless-format.js'

// ==================== 公共函数 ====================

/** 读取工作区 AGENTS.md(如果存在),用于注入 system prompt */
function readAgentsMd(workspacePath: string): string | undefined {
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
  /** 子 agent 父配置(提供则注册 dispatch_subagent 工具) */
  subagentParent?: {
    modelId: string;
    apiUrl: string;
    apiKey?: string;
    allowDangerous?: boolean;
  };
}

export interface SetupAgentToolsResult {
  systemPrompt: string;
  ctx: ToolContext;
  /** 加载到的 skills(供 REPL /skill 命令使用) */
  skills: Skill[];
  /** 加载到的 memory 条目(供 REPL /memory 命令使用) */
  memory: MemoryEntry[];
}

/** 注册工具 + 构建 system prompt(含 AGENTS.md + skills + memory 注入) */
export async function setupAgentTools(opts: SetupAgentToolsOptions): Promise<SetupAgentToolsResult> {
  clearTools();
  registerTools(BUILTIN_TOOLS);
  registerTools(GIT_TOOLS);
  registerTools(FETCH_TOOLS);
  registerTools(TEST_TOOLS);
  registerTools(DIAGNOSTIC_TOOLS);
  registerTools(CODEGRAPH_TOOLS);
  registerTools(createFileEditTools({ workspacePath: opts.workspacePath, checkpoints: opts.checkpoints }));
  if (opts.subagentParent) {
    registerTools([createSubagentTool({
      modelId: opts.subagentParent.modelId,
      apiUrl: opts.subagentParent.apiUrl,
      apiKey: opts.subagentParent.apiKey,
      workspacePath: opts.workspacePath,
      allowDangerous: opts.subagentParent.allowDangerous,
    })]);
  }
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
  const skills = loadSkills({ cwd: opts.workspacePath });
  if (skills.length > 0 && !opts.silent) {
    console.info(chalk.dim(`  📚 已加载 ${skills.length} 个 skill(/skills 查看,/skill <name> 调用)`));
  }
  const memory = loadMemory(opts.workspacePath);
  if (memory.length > 0 && !opts.silent) {
    console.info(chalk.dim(`  🧠 已加载 ${memory.length} 条 memory(/memory 查看)`));
  }
  const skillsText = formatSkillsForPrompt(skills);
  const memoryText = formatMemoryForPrompt(memory);
  const extraContext = [agentsMd, skillsText, memoryText].filter(Boolean).join('\n\n');
  const systemPrompt = buildSystemPrompt(tools, extraContext, opts.planFirst);
  const settings = loadSettings();
  const resolvedSandbox = resolveSandboxOptions(
    settings.sandbox?.profile,
    settings.sandbox ?? {},
  );
  const ctx: ToolContext = {
    workspacePath: opts.workspacePath,
    confirmDangerous: opts.confirmDangerous,
    sandbox: settings.sandbox ? {
      commandAllowlist: resolvedSandbox.commandAllowlist,
      blockedEnvVars: resolvedSandbox.blockedEnvVars,
      allowedPaths: resolvedSandbox.allowedPaths,
    } : undefined,
    folderTrust: settings.folderTrust,
  };

  return { systemPrompt, ctx, skills, memory };
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
  /** 模型上下文窗口大小(tokens)。达 85% 自动压缩到 60%,默认 8000。 */
  contextLimit?: number;
  /** 是否启用 plan 强制阻断(配合 planApproved 控制) */
  planFirst?: boolean;
  /** plan 是否已被批准;true 时跳过阻断,允许工具执行。阻断逻辑会在 plan 块出现后自动置 true */
  planApproved?: boolean;
  /** LLM 采样参数(透传到 streamChat) */
  sampler?: SamplerSettings;
  /** 累计成本上限(美元)。超过后 stopReason='budget_limited'。与 AGENTS.md 第 9 节 goal 模式 budget 语义对齐 */
  maxCostUsd?: number;
  /**
   * P0-2 Interject:drain pending interjection buffer。
   * 灵感来源:cli 的 `x.ai/interject` 扩展方法。
   * 语义:在 agent 运行中,用户可向 buffer 追加新指令;runToolLoop 在每轮迭代开始 + end_turn 时 drain,
   * 把累积的 interjection 作为新 user 消息追加(不取消当前回合,而是让 LLM 下一轮处理)。
   * 回调实现应返回并清空 buffer(每次调用返回当前累积内容,然后清空)。
   */
  drainInterjections?: () => string[];
}

export interface RunToolLoopResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
  usage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'stepfun/step-3.7-flash': { input: 0, output: 0 },
  'stepfun/step-3.5-flash': { input: 0, output: 0 },
  'stepfun/step-router-v1': { input: 0, output: 0 },
  'gpt-4o': { input: 2.5e-6, output: 10e-6 },
  'gpt-4o-mini': { input: 0.15e-6, output: 0.6e-6 },
  'gpt-4-turbo': { input: 10e-6, output: 30e-6 },
  'gpt-3.5-turbo': { input: 0.5e-6, output: 1.5e-6 },
  'claude-3-5-sonnet': { input: 3e-6, output: 15e-6 },
  'claude-3-haiku': { input: 0.25e-6, output: 1.25e-6 },
};

function estimateIterationCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[modelId] ?? MODEL_PRICING['gpt-4o-mini']!;
  return promptTokens * pricing.input + completionTokens * pricing.output;
}

/** 执行多轮工具循环,直到 end_turn 或 maxIterations。messages 数组会被原地修改(追加 assistant + tool_result 消息) */
export async function runToolLoop(opts: RunToolLoopOptions): Promise<RunToolLoopResult> {
  let assistantText = '';
  let hadError = false;
  let iterations = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let budgetLimited = false;
  const consecutiveFailures = new Map<string, number>();
  const FAILURE_REFLECTION_THRESHOLD = 2;
  // P1-2 Reminders:跨迭代持久化已注入的 reminder 类型(避免重复注入)
  const reminderInjected = new Set<string>();

  // P0-2 Interject:drain pending buffer 并作为新 user 消息追加。返回是否有 interjection 被 drain。
  function drainAndAppendInterjections(): boolean {
    if (!opts.drainInterjections) return false;
    const interjections = opts.drainInterjections();
    if (interjections.length === 0) return false;
    opts.messages.push({ role: 'user', content: interjections.join('\n\n') });
    return true;
  }

  try {
    for (let i = 0; i < opts.maxIterations; i++) {
      iterations = i + 1;
      await opts.onIteration?.(iterations, opts.maxIterations);

      // P0-2 Interject:本轮 LLM 调用前 drain,处理上一轮工具执行期间用户输入的 interjection
      // 让 LLM 本轮看到 tool_result + user interjection,自然响应
      drainAndAppendInterjections();

      const compression = compressContextIfNeeded(opts.messages, {
        contextLimit: opts.contextLimit ?? 8000,
      });
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
        ...(opts.sampler ?? {}),
      });

      if (iterError) break;

      // Token 累计:prompt 从压缩后 messages 估算,completion 从 iterationText 估算
      const iterPromptTokens = estimateMessagesTokens(effectiveMessages);
      const iterCompletionTokens = estimateTokens(iterationText);
      totalPromptTokens += iterPromptTokens;
      totalCompletionTokens += iterCompletionTokens;
      totalCostUsd += estimateIterationCost(opts.modelId, iterPromptTokens, iterCompletionTokens);

      // Cost guard:超阈值立即停止,语义对齐 AGENTS.md 第 9 节 budget_limited
      if (opts.maxCostUsd !== undefined && totalCostUsd >= opts.maxCostUsd) {
        budgetLimited = true;
        opts.messages.push({ role: 'assistant', content: iterationText });
        assistantText += iterationText;
        break;
      }

      opts.messages.push({ role: 'assistant', content: iterationText });
      assistantText += iterationText;

      const toolCalls = parseToolCalls(iterationText);

      if (toolCalls.length === 0) {
        // P0-2 Interject:end_turn 时再 drain 一次,处理 LLM 调用期间用户输入的 interjection
        // 如果有 interjection,不 break,continue 进入下一轮让 LLM 响应
        if (drainAndAppendInterjections()) {
          continue;
        }
        break;
      }

      // Plan Mode 强制阻断:planFirst 开启且未批准时,要求 LLM 先输出 plan 块再执行工具
      if (opts.planFirst && !opts.planApproved && toolCalls.length > 0) {
        const planBlock = parsePlanBlock(iterationText);
        if (planBlock) {
          // LLM 输出了 plan 块,自动批准,本迭代跳过工具执行
          opts.planApproved = true;
          opts.messages.push({
            role: 'user',
            content: 'Plan 已记录,请按计划逐步执行工具。每完成一步简要说明进度。',
          });
        } else {
          // LLM 没输出 plan 块就调用工具,拒绝执行
          opts.messages.push({
            role: 'user',
            content: '请先输出 ```plan 代码块列出任务步骤,再执行工具。',
          });
        }
        continue;
      }

      const resultParts: string[] = [];
      // P0-1 Tool parallelism:先按顺序触发 onToolCall,再用 Promise.all 并行执行,最后按顺序处理结果
      // 单工具时 Promise.all 退化为串行,无额外开销,UI 体验与原串行实现一致
      for (const call of toolCalls) {
        await opts.onToolCall?.(call.name, call.arguments);
      }
      const parallelResults = await Promise.all(
        toolCalls.map(async (call) => {
          const startTime = Date.now();
          const result = await executeToolCall(call, opts.ctx);
          return { call, result, durationMs: Date.now() - startTime };
        }),
      );
      for (const { call, result, durationMs } of parallelResults) {
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

      // P1-2 Reminders:工具结果后自动注入系统提醒(context budget / iteration progress)
      // 灵感来源:cli 的 reminders crate,让 LLM 被动接收关键状态信息
      const reminders = generateReminders({
        iterations,
        maxIterations: opts.maxIterations,
        totalPromptTokens,
        totalCompletionTokens,
        contextLimit: opts.contextLimit ?? 8000,
        injected: reminderInjected,
      });
      for (const r of reminders) {
        resultParts.push(r);
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
  } else if (budgetLimited) {
    stopReason = 'budget_limited';
  } else if (iterations >= opts.maxIterations) {
    stopReason = 'max_iterations';
  } else {
    stopReason = 'end_turn';
  }

  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const usage: TokenUsage = {
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    totalTokens,
    estimatedCostUsd: totalCostUsd,
  };

  return { stopReason, assistantText, iterations, usage };
}

// ==================== Agent 模式(非交互式) ====================

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  const hooksConfig = loadHooks();
  const sessionHookCtx = {
    workspacePath: opts.workspacePath,
    sessionId: opts.session?.id,
  };
  const startResult = runSessionStartHooks(hooksConfig, sessionHookCtx);
  if (!startResult.proceed) {
    const errMsg = startResult.reason ?? 'sessionStart hook blocked';
    if (opts.jsonMode === true) {
      process.stdout.write(JSON.stringify({ type: 'error', message: errMsg }) + '\n');
    } else {
      console.error(chalk.red(`\n❌ ${errMsg}`));
    }
    return {
      stopReason: 'error',
      assistantText: '',
      iterations: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    };
  }

  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  // P1-5 输出格式:outputFormat 优先(显式 --output-format),否则按 jsonMode 决定(text / json)
  const outputFormat: OutputFormat = opts.outputFormat ?? (opts.jsonMode === true ? 'json' : 'text');
  const isStructured = outputFormat === 'json' || outputFormat === 'markdown' || outputFormat === 'yaml';
  const silent = isStructured;  // 结构化输出时禁用 setupAgentTools 的非结构化日志

  const { systemPrompt, ctx } = await setupAgentTools({
    workspacePath: opts.workspacePath,
    checkpoints: opts.checkpoints,
    enableMcp: opts.enableMcp,
    silent,
    planFirst: opts.planFirst,
    subagentParent: {
      modelId: opts.modelId,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      allowDangerous: opts.allowDangerous,
    },
    confirmDangerous: async (tool, args) => {
      if (opts.allowDangerous) {
        if (!silent) console.info(chalk.yellow(`  ⚠ 自动允许危险操作: ${tool.name} ${JSON.stringify(args).slice(0, 100)}`));
        return true;
      }
      if (!silent) console.error(chalk.red(`  ✗ 危险操作被拒绝(需 --allow-dangerous): ${tool.name}`));
      return false;
    },
  });

  /** P1-5 统一 emit:按 outputFormat 切换序列化方式,流式输出到 stdout */
  const emit = (event: HeadlessEvent): void => {
    const line = formatHeadlessEvent(event, outputFormat);
    if (line) process.stdout.write(line);
  };

  const spinner = isStructured ? null : ora({ text: '准备中...', color: 'cyan' }).start();

  if (isStructured) {
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
      planFirst: opts.planFirst,
      sampler: opts.sampler,
      onDelta: (delta) => {
        if (isStructured) emit({ type: 'message_delta', text: delta });
        else {
          if (spinner?.isSpinning) spinner.stop();
          process.stdout.write(delta);
        }
      },
      onToolCall: (name, args) => {
        if (isStructured) emit({ type: 'tool_call', name, arguments: args });
        else {
          if (spinner?.isSpinning) spinner.stop();
          console.info(chalk.cyan(`\n  🔧 ${name} ${JSON.stringify(args)}`));
        }
      },
      onToolResult: (name, success, output) => {
        if (isStructured) emit({ type: 'tool_result', name, success, output });
        else {
          const icon = success ? '✓' : '✗';
          console.info(chalk.dim(`  ${icon} ${output.slice(0, 200)}`));
        }
      },
      onIteration: (count, max) => {
        if (isStructured) emit({ type: 'iteration', count, max });
        else if (spinner) {
          spinner.start(`🔧 执行中 (轮次 ${count}/${max})`);
        }
      },
      onError: (message) => {
        if (isStructured) emit({ type: 'error', message });
        else {
          if (spinner?.isSpinning) spinner.stop();
          console.error(chalk.red(`\n❌ ${message}`));
        }
      },
    });

    if (spinner?.isSpinning) spinner.stop();

    if (!isStructured) {
      console.info(chalk.green(`\n✨ 完成 (${result.iterations} 轮迭代, ${result.stopReason})`));
      const u = result.usage;
      const cost = u.estimatedCostUsd > 0 ? `$${u.estimatedCostUsd.toFixed(4)}` : 'plan 套餐';
      console.info(chalk.dim(`📊 tokens: ${u.totalTokens} (prompt ${u.promptTokens} + completion ${u.completionTokens}) — ${cost}\n`));
    }
    emit({ type: 'complete', stopReason: result.stopReason, iterations: result.iterations, usage: result.usage });

    return result;
  } finally {
    runSessionEndHooks(hooksConfig, sessionHookCtx);
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
