/**
 * Agent 执行模块 — 非交互式执行,支持工具调用循环。
 *
 * 灵感来源:参考行业 Agent 框架的 agent runtime + leader/stdio/headless 设计。
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
import { streamChat, setBaseUrl, setTokenProvider, formatSSEError, type SSEErrorSeverity } from '@ihui/api-client';
import {
  registerTools,
  listTools,
  buildSystemPrompt,
  parseToolCalls,
  parsePlanBlock,
  executeToolCall,
  formatToolResult,
  clearTools,
  getTool,
  enableToolHub,
  setHubRemoteRegistry,
  type Tool,
  type ToolContext,
} from '../tools/index.js';
import { BUILTIN_TOOLS } from '../tools/builtins.js';
import { createFileEditTools } from '../tools/file-edit.js';
import { GIT_TOOLS } from '../tools/git.js';
import { FETCH_TOOLS } from '../tools/fetch-url.js';
import { WEB_SEARCH_TOOLS } from '../tools/web-search.js';
import { TEST_TOOLS } from '../tools/run-tests.js';
import { DIAGNOSTIC_TOOLS } from '../tools/diagnostics.js';
import { CODEGRAPH_TOOLS, enableCodegraphIncremental, persistCodegraphCache } from '../tools/codegraph.js';
import { createSubagentTool } from '../tools/subagent.js';
import { CLIPBOARD_TOOLS } from '../tools/clipboard.js';
import { checkPermission, type PermissionRules, type PermissionMode } from '../tools/permissions.js';
import { resolveSandboxOptions } from '../sandbox/index.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import type { HunkTracker } from '../checkpoints/hunk-tracker.js';
import { compressContextIfNeeded, estimateTokens, estimateMessagesTokens, type CompressionResult, UsageLedger } from '../context.js';
import { compressContextV2, type CompactionSampler, type CompactionObserver } from '../compaction-v2.js';
import { generateReminders } from '../reminders.js';
import { loadMcpTools, loadMcpConnections } from '../tools/mcp-runtime.js';
import { registerMcpToolsToHub } from '../tools/hub/mcp-adapter.js';
import { InMemoryRegistry } from '../tools/hub/registry.js';
import { loadSkills, formatSkillsForPrompt, type Skill } from '../skills/index.js';
import { loadMemory, formatMemoryForPrompt, type MemoryEntry } from '../memory/index.js';
import { auditLog } from '../audit.js';
import { loadHooks, runSessionStartHooks, runSessionEndHooks, runHook } from '../hooks/index.js';
import { loadSettings, type SamplerSettings, type Settings } from './settings.js';
import type { Session } from './session.js';
import { saveSession } from './session.js';
import { PluginRegistry, loadPlugins, type PluginHookContext } from '../plugins/index.js';
import type { PlanMachine } from '../plan/index.js';
import { DoomLoopDetector, type DoomLoopAlert } from '../doom-loop-detector.js';
import { FsEventSource, type FsEvent } from '../fs-watcher/index.js';
import {
  renderMermaid,
  extractMermaidBlocks,
  writeMermaidToWorkspace,
} from '../mermaid/index.js';
import {
  initTelemetry,
  track as trackTelemetry,
  shutdownTelemetry,
} from '../telemetry/index.js';

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

// 模块增强:为 ToolContext 添加 permissionMode 字段(不修改 tools/index.ts 源码)。
declare module '../tools/index.js' {
  interface ToolContext {
    permissionMode?: PermissionMode;
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
  /** P0-7 Permission rules:白名单/黑名单控制(--tools/--disallowed-tools CLI flag 注入) */
  permissions?: PermissionRules;
  /** 权限模式:default|acceptEdits|bypassPermissions|plan|manual */
  permissionMode?: PermissionMode;
}

export type AgentStopReason = 'end_turn' | 'cancelled' | 'max_iterations' | 'budget_limited' | 'doom_loop' | 'error';

export interface AgentResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
  usage: TokenUsage;
}

// ==================== P1-5 Headless 多格式输出(实现在 src/headless-format.ts,此处仅 re-export)====================
// 灵感来源:参考行业 Agent 框架的 LeaderOutput/HeadlessFormat 设计(支持 text/json/markdown/yaml)。
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
    /** 透传 HunkTracker 给 subagent(启用 hunk 级冲突检测 + 改动归属追踪) */
    hunkTracker?: HunkTracker;
  };
  /** P0-7 Permission rules:白名单/黑名单控制(--tools/--disallowed-tools CLI flag 注入) */
  permissions?: PermissionRules;
  /** 权限模式:default|acceptEdits|bypassPermissions|plan|manual */
  permissionMode?: PermissionMode;
  /** HunkTracker(可选,启用后 write_file/edit_file/delete_file 会记录改动 + 检测冲突) */
  hunkTracker?: HunkTracker;
  /** 当前 agent 标识(用于 hunkTracker 归属记录,默认 'main') */
  agentId?: string;
  /**
   * 外部注入的 PluginRegistry(可选,优先于 settings.plugins 自动加载)。
   * 提供时 setupAgentTools 不再自动 loadPlugins,直接使用此 registry。
   */
  pluginRegistry?: PluginRegistry;
}

export interface SetupAgentToolsResult {
  systemPrompt: string;
  ctx: ToolContext;
  /** 加载到的 skills(供 REPL /skill 命令使用) */
  skills: Skill[];
  /** 加载到的 memory 条目(供 REPL /memory 命令使用) */
  memory: MemoryEntry[];
  /** PluginRegistry(若 settings.plugins.enabled 或外部注入,供 runToolLoop 触发 preToolCall/postToolCall hook) */
  pluginRegistry?: PluginRegistry;
}

/** 注册工具 + 构建 system prompt(含 AGENTS.md + skills + memory 注入) */
export async function setupAgentTools(opts: SetupAgentToolsOptions): Promise<SetupAgentToolsResult> {
  clearTools();
  registerTools(BUILTIN_TOOLS);
  registerTools(GIT_TOOLS);
  registerTools(FETCH_TOOLS);
  registerTools(WEB_SEARCH_TOOLS);
  registerTools(TEST_TOOLS);
  registerTools(DIAGNOSTIC_TOOLS);
  registerTools(CODEGRAPH_TOOLS);
  // P2-3 剪贴板工具:feature flag 启用时注册(默认关闭,零回归)
  if (loadSettings().clipboard?.enabled === true) {
    registerTools(CLIPBOARD_TOOLS);
  }
  registerTools(createFileEditTools({
    workspacePath: opts.workspacePath,
    checkpoints: opts.checkpoints,
    hunkTracker: opts.hunkTracker,
    agentId: opts.agentId,
  }));
  const settings = loadSettings();
  if (opts.subagentParent) {
    registerTools([createSubagentTool({
      modelId: opts.subagentParent.modelId,
      apiUrl: opts.subagentParent.apiUrl,
      apiKey: opts.subagentParent.apiKey,
      workspacePath: opts.workspacePath,
      allowDangerous: opts.subagentParent.allowDangerous,
      worktreeFastPathEnabled: settings.worktreeFastPath?.enabled === true,
      hunkTracker: opts.subagentParent.hunkTracker,
      precedenceEnabled: settings.subagentPrecedence?.enabled === true,
    })]);
  }
  if (opts.enableMcp) {
    // P1-5 hub mcp-adapter:flag 启用时走 hub adapter 路径(MCP 工具注册到 hub remote registry);
    // 否则走原 mcp-runtime 路径(注册到 registry Map)。两条路径互斥,避免重复注册。
    const useHubAdapter = settings.toolHub?.mcpAdapter?.enabled === true;
    if (useHubAdapter) {
      try {
        const conns = await loadMcpConnections({ workspacePath: opts.workspacePath });
        if (conns.length > 0) {
          const remoteRegistry = new InMemoryRegistry();
          let total = 0;
          for (const conn of conns) {
            total += registerMcpToolsToHub({
              hub: remoteRegistry,
              mcpConnection: conn,
              serverName: conn.server.name,
              enableDangerous: settings.allowDangerous,
            });
          }
          setHubRemoteRegistry(remoteRegistry);
          if (total > 0 && !opts.silent) {
            console.info(chalk.dim(`  🔌 已加载 ${total} 个 MCP 工具 (via hub adapter)`));
          }
        }
      } catch {
        // MCP 加载失败不阻塞
      }
    } else {
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
  }

  // P1-5 Computer Hub 集成:flag 启用时把已注册工具同步到 hub(InMemoryRegistry + CompoundResolver)
  // local-shadows-remote 调度;flag 关闭时完全等同原有行为(零回归)
  if (settings.toolHub?.enabled === true) {
    enableToolHub();
  }

  // Plugins 集成:settings.plugins.enabled === true 或外部注入 registry 时,
  // loadPlugins + registerAll + runSetups(真实接入,消除死代码)。
  // flag 关闭且未注入时,pluginRegistry=undefined,runToolLoop 内 runPluginHooks 直接 return(零回归)
  let pluginRegistry: PluginRegistry | undefined = opts.pluginRegistry;
  if (!pluginRegistry && settings.plugins?.enabled === true) {
    try {
      const pluginsDir = settings.plugins.pluginsDir ?? path.join(opts.workspacePath, '.ihui', 'plugins');
      const defs = loadPlugins({ pluginsDir });
      if (defs.length > 0) {
        pluginRegistry = new PluginRegistry({ workingDir: opts.workspacePath });
        const registered = pluginRegistry.registerAll(defs);
        if (!opts.silent) {
          console.info(chalk.dim(`  🧩 已加载 ${registered}/${defs.length} 个插件`));
        }
        const failed = await pluginRegistry.runSetups();
        if (failed.length > 0 && !opts.silent) {
          console.warn(chalk.yellow(`  ⚠ ${failed.length} 个插件 setup 失败:${failed.join(', ')}`));
        }
      }
    } catch {
      // 插件加载失败不阻塞 agent 启动
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
    permissions: opts.permissions,
    permissionMode: opts.permissionMode,
  };

  return { systemPrompt, ctx, skills, memory, pluginRegistry };
}

export interface RunToolLoopOptions {
  modelId: string;
  messages: ChatMessage[];
  ctx: ToolContext;
  maxIterations: number;
  signal?: AbortSignal;
  /** 关联会话 ID(用于 hook 埋点传递) */
  sessionId?: string;
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
   * 灵感来源:参考行业 Agent 框架的 `x.ai/interject` 扩展方法。
   * 语义:在 agent 运行中,用户可向 buffer 追加新指令;runToolLoop 在每轮迭代开始 + end_turn 时 drain,
   * 把累积的 interjection 作为新 user 消息追加(不取消当前回合,而是让 LLM 下一轮处理)。
   * 回调实现应返回并清空 buffer(每次调用返回当前累积内容,然后清空)。
   *
   * P0-4 扩展:支持 image content block(多模态),drain 时图片块转为文本占位符
   * (当前 streamChat 仅支持 content: string,后续支持多模态时可改为原生传递)。
   */
  drainInterjections?: () => InterjectionBlock[];
  /** Plugins 注册表(可选)— 若传入,在工具调用前后触发 preToolCall/postToolCall 钩子点 */
  plugins?: PluginRegistry;
  /** Plan Machine 状态机(可选)— 若传入,gathering 状态阻断工具执行 */
  planMachine?: PlanMachine;
  /**
   * P2-1 fsnotify 文件监听源(可选)— 若传入,每轮迭代把最近 60s 文件变更注入 user 消息。
   * 让 LLM 感知工作区外部编辑(IDE/编辑器/ci 等触发的文件变更)。
   */
  fsEventSource?: FsEventSource;
  /**
   * P2-5 UsageLedger(可选)— 若传入,每轮迭代后记录 token 使用(prompt + completion + cost)。
   * 调用方可通过 ledger.history / getChatState / isOver*Budget 查询详细使用情况。
   * 不传入时使用内部临时实例(结果通过 usage 字段返回,无历史记录)。
   */
  usageLedger?: UsageLedger;
}

/**
 * P0-4 Interjection 内容块:支持文本 + 图片(参考行业 Agent 框架的 interject image content block)。
 * - 文本块:直接作为 user 消息内容
 * - 图片块:base64 编码 + mediaType,drain 时转为文本占位符(因 streamChat 暂不支持多模态)
 */
export type InterjectionBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; mediaType: string; data: string };
      altText?: string;
    };

/**
 * P0-4 把 interjection 块数组转为 LLM 可消费的文本(当前 streamChat 仅支持 content: string)。
 * - 文本块:直接拼接
 * - 图片块:转占位符 `[图片: <altText 或 mediaType>, <N> bytes base64]`
 * - 兼容旧 API(plain string):直接拼接(P0-2 旧测试使用)
 * 后续 streamChat 支持多模态时,可改为返回 ContentBlock[] 原生传递。
 */
export function formatInterjectionBlocks(blocks: ReadonlyArray<InterjectionBlock | string>): string {
  return blocks
    .map((b) => {
      if (typeof b === 'string') return b;
      if (b.type === 'text') return b.text;
      const label = b.altText ?? b.source.mediaType;
      const sizeKb = Math.round((b.source.data.length * 3) / 4 / 1024); // base64 → 原始字节数
      return `[图片: ${label}, ${sizeKb} KB]`;
    })
    .join('\n\n');
}

/**
 * Plugin hook 入口 — 真实调用 pluginRegistry.runHook。
 *
 * 做减法:PluginDefinition.onHook 是程序化回调(JSON 清单无法声明),JSON 加载的插件
 * 只声明 hooks 数组(无 callback),runHook 内部会通过 logger.info 记录事件(让 registry 真实被使用)。
 *
 * @param registry 插件注册表(可选,未传入直接 return — 零回归)
 * @param event 钩子事件名(preToolCall / postToolCall)
 * @param context 钩子上下文(工具名 + 参数 + 结果),透传给 plugin.onHook
 */
async function runPluginHooks(
  registry: PluginRegistry | undefined,
  event: 'preToolCall' | 'postToolCall',
  context: { toolName: string; args: Record<string, unknown>; result?: unknown },
): Promise<void> {
  if (!registry) return;
  const hookContext: PluginHookContext = {
    toolName: context.toolName,
    args: context.args,
    result: context.result,
  };
  await registry.runHook(event, hookContext);
}

/**
 * P2-1 把 fs-watcher 事件格式化为 system prompt 片段。
 * 事件为空时返回空字符串(避免污染 prompt)。
 * 事件过多时只保留最近 10 条(避免 context 膨胀)。
 */
function formatFsEventsForPrompt(events: FsEvent[]): string {
  if (events.length === 0) return '';
  const recent = events.slice(-10);
  const lines = recent.map((e) => `  - [${e.kind}] ${e.path}`);
  return `[系统提示] 工作区最近文件变更(60s 内,共 ${events.length} 条,显示最近 ${lines.length} 条):\n${lines.join('\n')}`;
}

/**
 * P2-1 附加 checkpoint 自动快照监听器:文件变更事件累计达到 threshold 时,
 * 对所有受影响路径创建一个 auto_fs_watcher 快照(防数据丢失)。
 */
function attachCheckpointAutoSnapshot(
  src: FsEventSource,
  checkpoints: CheckpointManager,
  threshold: number,
): void {
  const pendingFiles = new Set<string>();
  let eventCount = 0;
  src.on('event', (e: FsEvent) => {
    eventCount++;
    pendingFiles.add(e.path);
    if (eventCount >= threshold) {
      const files = Array.from(pendingFiles);
      pendingFiles.clear();
      eventCount = 0;
      try {
        void checkpoints.snapshot(files, 'auto_fs_watcher');
      } catch {
        // snapshot 失败不阻塞监听
      }
    }
  });
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

// ==================== P0-3 SamplerActor:重试 + doom loop 检测 ====================
// 灵感来源:参考行业 Agent 框架的 sampler actor(指数退避重试 + 死循环检测)。
// 简化策略(做减法):只对可重试错误(ratelimit/network/server)重试,auth/forbidden 立即失败。

const SAMPLER_MAX_RETRIES = 3;
const SAMPLER_DOOM_LOOP_THRESHOLD = 3;
const SAMPLER_RETRYABLE_SEVERITIES: ReadonlySet<string> = new Set(['ratelimit', 'network', 'server']);

interface SampleWithRetryOptions {
  modelId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  sampler?: SamplerSettings;
}

interface SampleWithRetryResult {
  error?: string;
}

type RetryCallback = (
  attempt: number,
  errMsg: string,
  severity: SSEErrorSeverity,
  delayMs: number,
) => void;

/** ConsecutiveSignatureDetector:记录连续相同错误/tool_call 签名,超过阈值判定死循环。 */
class ConsecutiveSignatureDetector {
  private lastErrorSignature = '';
  private consecutiveErrorCount = 0;
  private lastToolCallSignature = '';
  private consecutiveToolCallCount = 0;

  recordError(errMsg: string): void {
    const sig = this.signature(errMsg);
    if (sig === this.lastErrorSignature) {
      this.consecutiveErrorCount++;
    } else {
      this.lastErrorSignature = sig;
      this.consecutiveErrorCount = 1;
    }
  }

  recordToolCalls(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): void {
    const sig = toolCalls
      .map((tc) => `${tc.name}(${JSON.stringify(tc.arguments)})`)
      .sort()
      .join('|');
    if (sig === this.lastToolCallSignature) {
      this.consecutiveToolCallCount++;
    } else {
      this.lastToolCallSignature = sig;
      this.consecutiveToolCallCount = 1;
    }
  }

  isDoomLoop(): boolean {
    return (
      this.consecutiveErrorCount >= SAMPLER_DOOM_LOOP_THRESHOLD ||
      this.consecutiveToolCallCount >= SAMPLER_DOOM_LOOP_THRESHOLD
    );
  }

  /** end_turn 时重置,表示对话正常推进,清空累积签名 */
  reset(): void {
    this.lastErrorSignature = '';
    this.consecutiveErrorCount = 0;
    this.lastToolCallSignature = '';
    this.consecutiveToolCallCount = 0;
  }

  private signature(msg: string): string {
    // 简化签名:取首行 + 去数字(避免 token 计数差异干扰)
    return msg.split('\n')[0]?.replace(/\d+/g, 'N').trim().slice(0, 120) ?? '';
  }
}

/**
 * sampleWithRetry:包装 streamChat,对可重试错误(ratelimit/network/server)按指数退避重试。
 * 不可重试错误(auth/forbidden/unknown)立即返回,不重试。
 * onRetry 回调在每次重试前触发,用于日志输出。
 */
async function sampleWithRetry(
  opts: SampleWithRetryOptions,
  onRetry?: RetryCallback,
): Promise<SampleWithRetryResult> {
  for (let attempt = 0; ; attempt++) {
    let errMsg: string | undefined;
    try {
      await streamChat({
        model: opts.modelId,
        messages: opts.messages,
        signal: opts.signal,
        onDelta: opts.onDelta,
        ...(opts.sampler ?? {}),
      } as Parameters<typeof streamChat>[0]);
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }
    if (errMsg === undefined) return {};
    const formatted = formatSSEError(new Error(errMsg));
    // 不可重试错误立即返回
    if (!SAMPLER_RETRYABLE_SEVERITIES.has(formatted.severity)) {
      return { error: errMsg };
    }
    // 达到最大重试次数,返回最后一次错误
    if (attempt >= SAMPLER_MAX_RETRIES) {
      return { error: errMsg };
    }
    // 指数退避:1s, 2s, 4s...(ratelimit 至少 5s)
    const base = formatted.severity === 'ratelimit' ? 5000 : 1000;
    const delayMs = base * Math.pow(2, attempt);
    onRetry?.(attempt + 1, errMsg, formatted.severity, delayMs);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, delayMs);
      opts.signal?.addEventListener('abort', () => {
        clearTimeout(t);
        resolve();
      }, { once: true });
    });
    if (opts.signal?.aborted) return { error: 'aborted' };
  }
}

/**
 * createCompactionSampler:基于 streamChat 构造真实 LLM CompactionSampler。
 * 复用 packages/api-client 的 streamChat(流式 + onDelta 回调),不重新实现 LLM 调用。
 * 超时由 AbortController 触发,V2 的 classifyError 会分类为瞬态 → sampleWithRetry 重试。
 */
export function createCompactionSampler(model: string): CompactionSampler {
  return {
    async sampleCompaction(messages, opts) {
      let response = '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        await streamChat({
          model,
          messages: [
            { role: 'system', content: '你是上下文压缩器。把以下对话历史压缩为结构化摘要,保留:1) 用户主要请求 2) 关键技术决策 3) 涉及的文件路径与代码段 4) 当前工作进度 5) 待办任务。输出纯文本,不要 <analysis> 等标签。' },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
          signal: controller.signal,
          onDelta: (delta) => { response += delta; },
        });
        return { response };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * decideCompaction:根据 settings.compactionV2 feature flag 决定走 V2 或 V1 路径。
 * - V2 启用 → 调 compressContextV2(LLM 摘要 + reduction guard + retry),注入 sampler + observer
 * - V2 抛错 → fallback 到 compressContextIfNeeded(双保险,V2 内部已有 fallback,这里再加一层)
 * - V2 未启用 → 直接走 V1(纯正则,向后兼容)
 * 提取为独立导出函数便于集成测试(vi.mock 依赖项即可,无需启动 runToolLoop)。
 */
export async function decideCompaction(
  messages: ChatMessage[],
  settings: Settings,
  opts: { contextLimit: number; modelId: string },
): Promise<CompressionResult> {
  const v2Config = settings.compactionV2;
  if (v2Config?.enabled === true) {
    try {
      const sampler = createCompactionSampler(v2Config.model || opts.modelId || 'default-model');
      const observer: CompactionObserver = {
        onSuccess: ({ tokensBefore, tokensAfter, turnsCompacted, elapsedMs }) => {
          console.info(chalk.dim(`  🗜️ compaction-v2: ${tokensBefore}→${tokensAfter} tokens, ${turnsCompacted} turns, ${elapsedMs}ms`));
        },
        onError: ({ statusLabel, error }) => {
          console.warn(chalk.yellow(`  ⚠️ compaction-v2 error (${statusLabel}): ${error?.message ?? 'unknown'}`));
        },
      };
      return await compressContextV2(messages, {
        contextLimit: opts.contextLimit,
        triggerRatio: v2Config.triggerRatio,
        targetRatio: v2Config.targetRatio,
        samplingTimeoutMs: v2Config.samplingTimeoutMs,
        sampler,
        observer,
      });
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠️ compaction-v2 failed, fallback to v1: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  return compressContextIfNeeded(messages, { contextLimit: opts.contextLimit });
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
  let lastErrorMessage = '';
  const consecutiveFailures = new Map<string, number>();
  const FAILURE_REFLECTION_THRESHOLD = 2;
  // P1-2 Reminders:跨迭代持久化已注入的 reminder 类型(避免重复注入)
  const reminderInjected = new Set<string>();
  // P0-3 SamplerActor:连续签名检测器(连续 N 次相同错误签名 / tool_call 模式判定死循环)
  const signatureDetector = new ConsecutiveSignatureDetector();
  let signatureDoomDetected = false;
  // P0-3 DoomLoopDetector(滑动窗口):检测 LLM 重复调用相同工具相同参数的死循环
  // 灵感来源:参考行业 Agent 框架的 doom_loop 理念,简化为客户端工具调用层滑动窗口检测
  const doomLoopDetector = new DoomLoopDetector();
  let consecutiveDoomAlerts = 0;
  let slidingWindowDoomDetected = false;

  // P2-5 UsageLedger:使用调用方传入的账本(若无则内部创建临时实例,仅用于结果汇总)
  // 调用方传入时可通过 ledger.history / getChatState 获取详细使用情况
  const usageLedger = opts.usageLedger ?? new UsageLedger({ budgetCostUsd: opts.maxCostUsd });

  // P0-2 Interject:drain pending buffer 并作为新 user 消息追加。返回是否有 interjection 被 drain。
  // P0-4 扩展:支持 image content block,通过 formatInterjectionBlocks 转为文本
  function drainAndAppendInterjections(): boolean {
    if (!opts.drainInterjections) return false;
    const interjections = opts.drainInterjections();
    if (interjections.length === 0) return false;
    // P0-4 用 formatInterjectionBlocks 把 text/image 块统一转为字符串
    const content = formatInterjectionBlocks(interjections);
    if (content.length > 0) {
      opts.messages.push({ role: 'user', content });
    }
    return true;
  }

  // P1-2 Compaction V2:加载 settings 一次(feature flag 默认关闭,启用后用 LLM 摘要压缩)
  const settings = loadSettings();

  try {
    for (let i = 0; i < opts.maxIterations; i++) {
      iterations = i + 1;
      await opts.onIteration?.(iterations, opts.maxIterations);

      // P2-4 agent-lifecycle:turnStart hook(每轮开始触发,粒度细于 sessionStart)
      runHook('turnStart', {
        workspacePath: opts.ctx.workspacePath,
        sessionId: opts.sessionId,
        turnNumber: iterations,
        maxTurns: opts.maxIterations,
      });

      // P0-2 Interject:本轮 LLM 调用前 drain,处理上一轮工具执行期间用户输入的 interjection
      // 让 LLM 本轮看到 tool_result + user interjection,自然响应
      drainAndAppendInterjections();

      const compression = await decideCompaction(opts.messages, settings, {
        contextLimit: opts.contextLimit ?? 8000,
        modelId: opts.modelId,
      });
      const effectiveMessages = compression.messages;

      let iterationText = '';
      let iterError = false;

      // P0-3 SamplerActor:用 sampleWithRetry 包裹 streamChat,添加指数退避重试 + doom_loop 检测
      const samplerResult = await sampleWithRetry(
        {
          modelId: opts.modelId,
          messages: effectiveMessages,
          signal: opts.signal,
          onDelta: (delta) => {
            iterationText += delta;
            void opts.onDelta?.(delta);
          },
          sampler: opts.sampler,
        },
        (attempt, errMsg, severity, delayMs) => {
          const formatted = formatSSEError(new Error(errMsg));
          process.stderr.write(
            chalk.yellow(`[retry] 第 ${attempt}/${SAMPLER_MAX_RETRIES} 次重试(${severity})${delayMs}ms 后: ${formatted.message}\n`),
          );
        },
      );

      if (samplerResult.error) {
        iterError = true;
        hadError = true;
        const formatted = formatSSEError(new Error(samplerResult.error));
        lastErrorMessage = formatted.message;
        if (formatted.severity === 'auth' || formatted.severity === 'forbidden') {
          process.stderr.write(chalk.red(`[${formatted.severity}] ${formatted.title}: ${formatted.rawMessage}\n`));
        } else if (formatted.severity === 'ratelimit') {
          process.stderr.write(chalk.yellow(`[rate-limit] ${formatted.message}\n`));
        } else if (formatted.severity === 'server') {
          process.stderr.write(chalk.red(`[server] ${formatted.title}: ${formatted.rawMessage}\n`));
        } else {
          process.stderr.write(chalk.red(`[error] ${formatted.title}: ${formatted.rawMessage}\n`));
        }
        void opts.onError?.(formatted.message);
        // P0-3 记录错误签名,检测 doom loop(连续 N 次相同错误)
        signatureDetector.recordError(samplerResult.error);
        if (signatureDetector.isDoomLoop()) {
          signatureDoomDetected = true;
          process.stderr.write(
            chalk.red(`[doom-loop] 连续 ${SAMPLER_DOOM_LOOP_THRESHOLD} 次相同错误签名,判定陷入死循环,终止\n`),
          );
          void opts.onError?.(`Doom loop detected: 连续 ${SAMPLER_DOOM_LOOP_THRESHOLD} 次相同错误`);
          break;
        }
      }

      if (iterError) {
        // P2-4 agent-lifecycle:turnError hook(本轮出错,单轮失败不等于 agent 终止)
        runHook('turnError', {
          workspacePath: opts.ctx.workspacePath,
          sessionId: opts.sessionId,
          turnNumber: iterations,
          error: lastErrorMessage,
        });
        break;
      }

      // Token 累计:prompt 从压缩后 messages 估算,completion 从 iterationText 估算
      const iterPromptTokens = estimateMessagesTokens(effectiveMessages);
      const iterCompletionTokens = estimateTokens(iterationText);
      totalPromptTokens += iterPromptTokens;
      totalCompletionTokens += iterCompletionTokens;
      const iterCostUsd = estimateIterationCost(opts.modelId, iterPromptTokens, iterCompletionTokens);
      totalCostUsd += iterCostUsd;

      // P2-5 UsageLedger:记录本轮 token 使用(供调用方查询历史/预算状态)
      usageLedger.recordTurn(iterPromptTokens, iterCompletionTokens, iterCostUsd);

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
        // P0-3 end_turn(LLM 主动结束)时重置连续签名检测器,表示对话正常推进
        signatureDetector.reset();
        // P2-4 agent-lifecycle:turnEnd hook(本轮成功结束 - end_turn)
        runHook('turnEnd', {
          workspacePath: opts.ctx.workspacePath,
          sessionId: opts.sessionId,
          turnNumber: iterations,
        });
        break;
      }

      // P0-3 记录 tool_call 签名,检测 doom loop(连续 N 轮相同 tool_call 模式 → 死循环)
      signatureDetector.recordToolCalls(toolCalls);
      if (signatureDetector.isDoomLoop()) {
        signatureDoomDetected = true;
        process.stderr.write(
          chalk.red(`[doom-loop] 连续 ${SAMPLER_DOOM_LOOP_THRESHOLD} 轮相同的 tool_call 模式,判定陷入死循环,终止\n`),
        );
        void opts.onError?.(`Doom loop detected: 连续 ${SAMPLER_DOOM_LOOP_THRESHOLD} 轮相同的 tool_call 模式`);
        break;
      }

      // Plan Mode 强制阻断:planFirst 开启且未批准时,要求 LLM 先输出 plan 块再执行工具
      if (opts.planFirst && !opts.planApproved && toolCalls.length > 0) {
        const planBlock = parsePlanBlock(iterationText);
        if (planBlock) {
          // LLM 输出了 plan 块,自动批准,本迭代跳过工具执行
          opts.planApproved = true;
          // PlanMachine 联动:gathering → executing(解除写入硬阻断)
          // canTransition 守门:若 PlanMachine 已在 executing/done 等状态则跳过(避免抛错)
          if (opts.planMachine?.canTransition('gather_complete')) {
            opts.planMachine.transition('gather_complete');
          }
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

      // PlanMachine 集成(最小集成):gathering 状态阻断写操作,isWriteBlocked=true 时跳过工具执行
      // 与 planFirst 并存(planFirst 是软 flag,planMachine 是硬状态机,两者可同时存在)
      if (opts.planMachine?.isWriteBlocked() && toolCalls.length > 0) {
        opts.messages.push({
          role: 'user',
          content: 'plan gathering 中,跳过写操作',
        });
        continue;
      }

      // P0-3 DoomLoopDetector(滑动窗口):每次执行工具前检测重复调用相同工具相同参数
      // 灵感来源:参考行业 Agent 框架的 doom_loop 理念,客户端工具调用层滑动窗口检测
      // 连续 2 轮触发 alert → 终止循环,返回 stopReason='doom_loop';首轮 alert 注入反思提示
      const doomAlerts: DoomLoopAlert[] = [];
      for (const call of toolCalls) {
        const alert = doomLoopDetector.record(call.name, call.arguments);
        if (alert) doomAlerts.push(alert);
      }
      if (doomAlerts.length > 0) {
        consecutiveDoomAlerts++;
        const alertText = doomAlerts
          .map((a) => `[DOOM_LOOP_ALERT] ${a.message}\n${a.suggestion}`)
          .join('\n\n');
        if (consecutiveDoomAlerts >= 2) {
          slidingWindowDoomDetected = true;
          process.stderr.write(
            chalk.red(`[doom-loop] 连续 2 轮触发滑动窗口死循环检测,终止\n`),
          );
          void opts.onError?.(`Doom loop detected: ${doomAlerts[0]!.message}`);
          break;
        }
        // 首轮 alert:注入反思提示,跳过本轮工具执行,让 LLM 重新考虑
        opts.messages.push({ role: 'user', content: alertText });
        void opts.onError?.(alertText);
        continue;
      } else {
        consecutiveDoomAlerts = 0;
      }

      const resultParts: string[] = [];
      // P0-1 Tool parallelism:先按顺序触发 onToolCall,再用 Promise.all 并行执行,最后按顺序处理结果
      // 单工具时 Promise.all 退化为串行,无额外开销,UI 体验与原串行实现一致
      for (const call of toolCalls) {
        await opts.onToolCall?.(call.name, call.arguments);
        if (call.name === 'dispatch_subagent') {
          const subId = String(call.arguments.subagentId ?? call.arguments.task ?? '').slice(0, 80);
          const subType = String(call.arguments.persona ?? 'general');
          runHook('subagentStart', {
            workspacePath: opts.ctx.workspacePath,
            sessionId: opts.sessionId,
            subagentId: subId,
            subagentType: subType,
          });
        }
        // Plugin hooks 入口:preToolCall(若 plugins 存在)
        await runPluginHooks(opts.plugins, 'preToolCall', {
          toolName: call.name,
          args: call.arguments,
        });
      }
      const mode = opts.ctx.permissionMode ?? 'default';
      const parallelResults = await Promise.all(
        toolCalls.map(async (call) => {
          const startTime = Date.now();
          const tool = getTool(call.name);
          const dangerLevel = tool?.dangerLevel ?? 'read';
          const decision = checkPermission(call.name, opts.ctx.permissions, mode, dangerLevel);
          if (decision === 'deny') {
            return {
              call,
              result: {
                success: false,
                output: '',
                error: `工具 ${call.name} 被权限模式 ${mode} 拒绝(dangerLevel=${dangerLevel})`,
                errorType: 'permission_denied',
              },
              durationMs: Date.now() - startTime,
            };
          }
          if (decision === 'ask' && dangerLevel !== 'dangerous') {
            const allowed = opts.ctx.confirmDangerous
              ? await opts.ctx.confirmDangerous(tool!, call.arguments)
              : false;
            if (!allowed) {
              return {
                call,
                result: {
                  success: false,
                  output: '',
                  error: `工具 ${call.name} 需要用户确认但被拒绝(mode=${mode})`,
                  errorType: 'permission_denied',
                },
                durationMs: Date.now() - startTime,
              };
            }
          }
          const result = await executeToolCall(call, opts.ctx);
          if (call.name === 'dispatch_subagent') {
            const subId = String(call.arguments.subagentId ?? call.arguments.task ?? '').slice(0, 80);
            runHook('subagentStop', {
              workspacePath: opts.ctx.workspacePath,
              sessionId: opts.sessionId,
              subagentId: subId,
              reason: result.success ? 'completed' : 'failed',
            });
          }
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
        // P3-2 Telemetry:工具调用完成后上报(失败忽略,不影响主流程)
        trackTelemetry('tool_call_completed', {
          toolName: call.name,
          success: result.success,
          durationMs,
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
        // Plugin hooks 入口:postToolCall(若 plugins 存在)
        await runPluginHooks(opts.plugins, 'postToolCall', {
          toolName: call.name,
          args: call.arguments,
          result,
        });
        resultParts.push(formatToolResult(call, result));
      }

      // P1-2 Reminders:工具结果后自动注入系统提醒(context budget / iteration progress)
      // 灵感来源:参考行业 Agent 框架的 reminders 设计,让 LLM 被动接收关键状态信息
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

      // P2-1 fsnotify:把最近 60s 文件变更事件注入 user 消息(让 LLM 感知外部编辑)
      if (opts.fsEventSource) {
        const fsContext = formatFsEventsForPrompt(opts.fsEventSource.getRecentEvents(60_000));
        if (fsContext) {
          resultParts.push(fsContext);
        }
      }

      opts.messages.push({ role: 'user', content: resultParts.join('\n\n') });

      // P2-4 agent-lifecycle:turnEnd hook(本轮成功结束 - 工具调用执行完毕)
      runHook('turnEnd', {
        workspacePath: opts.ctx.workspacePath,
        sessionId: opts.sessionId,
        turnNumber: iterations,
      });
    }
  } catch (err) {
    if (opts.signal?.aborted) {
      // abort 不是错误,由 stopReason 逻辑处理为 'cancelled'
    } else {
      hadError = true;
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMessage = msg;
      // P2-4 agent-lifecycle:turnError hook(本轮异常 - catch 块)
      runHook('turnError', {
        workspacePath: opts.ctx.workspacePath,
        sessionId: opts.sessionId,
        turnNumber: iterations,
        error: msg,
      });
      await opts.onError?.(msg);
    }
  }

  let stopReason: AgentStopReason;
  if (opts.signal?.aborted) {
    stopReason = 'cancelled';
  } else if (slidingWindowDoomDetected) {
    // P0-3 doom_loop:滑动窗口检测到连续 2 轮重复调用相同工具相同参数
    stopReason = 'doom_loop';
  } else if (signatureDoomDetected) {
    // P0-3 doom loop:连续相同错误签名 / tool_call 模式,判定死循环,按 error 终止
    stopReason = 'error';
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

  // Hook 埋点:stop / stopFailure / notification
  const hookCtx = { workspacePath: opts.ctx.workspacePath, sessionId: opts.sessionId };
  if (stopReason === 'error') {
    runHook('stopFailure', { ...hookCtx, error: lastErrorMessage || 'unknown error' });
    runHook('notification', { ...hookCtx, notificationText: `Agent 因错误终止: ${lastErrorMessage || 'unknown'}` });
  } else if (stopReason === 'doom_loop') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 因死循环检测终止 (连续 2 轮重复工具调用)` });
  } else if (stopReason === 'max_iterations') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 达到最大迭代数 ${opts.maxIterations}` });
  } else if (stopReason === 'budget_limited') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 因预算上限停止 (cost >= ${opts.maxCostUsd ?? 'N/A'})` });
  }
  runHook('stop', hookCtx);

  // P2-4 agent-lifecycle:turnComplete hook(agent 完成所有轮次,与 stop 配对,携带最终 stopReason)
  runHook('turnComplete', {
    ...hookCtx,
    totalTurns: iterations,
    stopReason,
  });

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

  const { systemPrompt, ctx, pluginRegistry } = await setupAgentTools({
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
    permissions: opts.permissions,
    permissionMode: opts.permissionMode,
    confirmDangerous: async (tool, args) => {
      if (opts.allowDangerous) {
        if (!silent) console.info(chalk.yellow(`  ⚠ 自动允许危险操作: ${tool.name} ${JSON.stringify(args).slice(0, 100)}`));
        return true;
      }
      if (!silent) console.error(chalk.red(`  ✗ 危险操作被拒绝(需 --allow-dangerous): ${tool.name}`));
      return false;
    },
  });

  // P1-6 Codegraph 增量索引:按 feature flag 启用(默认关闭,启用后加载缓存 + 全量索引一次)
  const codegraphSettings = loadSettings();
  if (codegraphSettings.codegraphIncremental?.enabled === true) {
    try {
      await enableCodegraphIncremental(opts.workspacePath);
    } catch {
      // 增量索引启用失败不阻塞主流程(工具内部会 fallback 到全量扫描)
    }
  }

  // P2-1 fsnotify 文件监听:按 feature flag 启用(默认关闭,启用后注入工作区文件变更到 prompt)
  let fsEventSource: FsEventSource | undefined;
  if (codegraphSettings.fsWatcher?.enabled === true) {
    try {
      fsEventSource = new FsEventSource(
        opts.workspacePath,
        codegraphSettings.fsWatcher.ignore ?? [],
      );
      fsEventSource.start();
      // P2-1 checkpoints 集成:文件改动 N 次(N=20)后自动 snapshot 受影响文件
      if (opts.checkpoints) {
        attachCheckpointAutoSnapshot(fsEventSource, opts.checkpoints, 20);
      }
      if (!silent) {
        console.info(chalk.dim(`  📂 fsnotify 已启动(监听工作区文件变更)`));
      }
    } catch {
      // 监听启动失败不阻塞主流程
      fsEventSource = undefined;
    }
  }

  // P3-2 Telemetry:按 feature flag 启用(默认关闭,启用后 initTelemetry + session_start 事件)
  // 关闭时 track 调用 no-op(零回归)
  if (codegraphSettings.telemetry?.enabled === true) {
    initTelemetry({
      enabled: true,
      endpoint: codegraphSettings.telemetry.endpoint,
      batchSize: codegraphSettings.telemetry.batchSize,
      flushIntervalMs: codegraphSettings.telemetry.flushIntervalMs,
    });
    trackTelemetry('session_start', {
      modelId: opts.modelId,
      workspacePath: opts.workspacePath,
      hasSession: !!opts.session,
    });
    if (!silent) {
      console.info(chalk.dim(`  📊 telemetry 已启用(上报到 ${codegraphSettings.telemetry.endpoint ?? 'N/A'})`));
    }
  }

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

  // Hook 埋点:userPromptSubmit
  runHook('userPromptSubmit', {
    workspacePath: opts.workspacePath,
    sessionId: opts.session?.id,
    prompt: opts.prompt,
  });

  // P3-2 Telemetry:记录 session 起始时间(用于 finally 块中计算 durationMs)
  const sessionStartTime = Date.now();
  let sessionResult: AgentResult | undefined;

  try {
    const result = await runToolLoop({
      modelId: opts.modelId,
      messages,
      ctx,
      maxIterations: opts.maxIterations,
      signal: opts.signal,
      sessionId: opts.session?.id,
      planFirst: opts.planFirst,
      sampler: opts.sampler,
      plugins: pluginRegistry,
      fsEventSource,
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
    sessionResult = result;

    if (spinner?.isSpinning) spinner.stop();

    if (!isStructured) {
      console.info(chalk.green(`\n✨ 完成 (${result.iterations} 轮迭代, ${result.stopReason})`));
      const u = result.usage;
      const cost = u.estimatedCostUsd > 0 ? `$${u.estimatedCostUsd.toFixed(4)}` : 'plan 套餐';
      console.info(chalk.dim(`📊 tokens: ${u.totalTokens} (prompt ${u.promptTokens} + completion ${u.completionTokens}) — ${cost}\n`));
    }
    emit({ type: 'complete', stopReason: result.stopReason, iterations: result.iterations, usage: result.usage });

    // P3-1 Mermaid 渲染:feature flag 启用时,LLM 输出包含 ```mermaid 块则自动渲染为图片
    // 失败不阻塞主流程(只打印警告)
    if (codegraphSettings.mermaid?.enabled === true && result.assistantText) {
      const mermaidBlocks = extractMermaidBlocks(result.assistantText);
      if (mermaidBlocks.length > 0) {
        for (const source of mermaidBlocks) {
          try {
            const renderResult = await renderMermaid(source);
            const filePath = await writeMermaidToWorkspace(
              opts.workspacePath,
              renderResult.buffer,
              renderResult.mimeType,
            );
            if (!isStructured) {
              console.info(chalk.cyan(`  📊 Mermaid 已渲染 [${renderResult.engine}] → ${filePath}`));
            } else {
              emit({ type: 'tool_result', name: 'mermaid_render', success: true, output: filePath });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!isStructured) {
              console.warn(chalk.yellow(`  ⚠ Mermaid 渲染失败: ${msg}`));
            }
          }
        }
      }
    }

    return result;
  } finally {
    runSessionEndHooks(hooksConfig, sessionHookCtx);
    // P1-6 Codegraph 增量索引:退出时持久化缓存(供下次启动加载)
    if (codegraphSettings.codegraphIncremental?.enabled === true) {
      try {
        await persistCodegraphCache(opts.workspacePath);
      } catch {
        // 持久化失败不阻塞退出
      }
    }
    // P2-1 fsnotify:停止文件监听,释放系统资源
    if (fsEventSource) {
      try {
        fsEventSource.stop();
      } catch {
        // 停止失败不阻塞退出
      }
    }
    // 任何路径(完成/错误/中断)都持久化 messages 到 session,供 --resume 恢复
    if (opts.session) {
      opts.session.history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
      saveSession(opts.session);
    }
    // P3-2 Telemetry:session_end + shutdown(失败不阻塞退出)
    if (codegraphSettings.telemetry?.enabled === true) {
      try {
        trackTelemetry('session_end', {
          totalTokens: sessionResult?.usage.totalTokens ?? 0,
          durationMs: Date.now() - sessionStartTime,
        });
        await shutdownTelemetry();
      } catch {
        // telemetry 失败不阻塞退出
      }
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
    case 'doom_loop':
      return 2;
    case 'cancelled':
      return 130;
    default:
      return 1;
  }
}
