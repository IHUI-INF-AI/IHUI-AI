// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { streamChat, setBaseUrl, setTokenProvider, formatSSEError, getModelContextCapacity, type StreamChatOptions, type SSEErrorInfo, type SSEErrorSeverity, type PlanUpdateEvent, type TerminalDeltaEvent, type ToolDeltaEvent } from '@ihui/api-client';
// L1-4(2026-07-25 立):doom_loop 反思沉淀 procedural memory,需 loadConfig 拿 ai-service URL
import { loadConfig } from '../config/index.js';
// 2026-09-27:doom_loop pattern 外发前过一次脱敏兜底(防原文字段流入服务端落库)
import { redactSecrets } from '../redact.js';
import {
  registerTools,
  registerBrowserTools,
  listTools,
  buildSystemPrompt,
  parsePlanBlock,
  executeToolCall,
  formatToolResult,
  toolsToProviderSchema,
  extractToolCalls,
  type ParsedToolCall,
  clearTools,
  getTool,
  enableToolHub,
  setHubRemoteRegistry,
  type Tool,
  type ToolContext,
} from '../tools/index.js';
import { BUILTIN_TOOLS } from '../tools/builtins.js';
import { createFileEditTools } from '../tools/file-edit.js';
import {
  buildFileEditPreviewEvents,
  createToolDeltaPreviewStore,
  pickToolDeltaPreviewText,
} from '../tools/file-edit-preview.js';
import type { ToolDeltaPreviewStore } from '../tools/file-edit-preview.js';
import { GIT_TOOLS } from '../tools/git.js';
import { FETCH_TOOLS } from '../tools/fetch-url.js';
import { WEB_SEARCH_TOOLS } from '../tools/web-search.js';
import { TEST_TOOLS } from '../tools/run-tests.js';
import { DIAGNOSTIC_TOOLS } from '../tools/diagnostics.js';
import { DEBUG_TOOLS } from '../tools/debug.js';
import { CODEGRAPH_TOOLS, enableCodegraphIncremental, persistCodegraphCache } from '../tools/codegraph.js';
import { createSubagentTool } from '../tools/subagent.js';
import { type DangerGate } from '../tools/danger-gate.js';
import { createAuditedDangerGate } from '../tools/danger-gate-audit.js';
import {
  __resetAuditIngestClientWarnForTest,
  resolveAuditIngestClient,
} from '../utils/audit-ingest-client.js';
import { CLIPBOARD_TOOLS } from '../tools/clipboard.js';
import { checkPermission, type PermissionRules, type PermissionMode } from '../tools/permissions.js';
import { createMarkdownRenderer } from './markdown-renderer.js';
import { resolveProvider, streamOpenAiCompatible, type ChatCompletionMessage } from '../provider/local.js';
// G-686:进程级、按 provider/model 分桶的 AIMD 准入闸门(默认关 —— 见该文件头注的翻转前置)。
import {
  admissionBucketKey,
  getRequestAdmission,
  isAdmissionAbortError,
  isRequestAdmissionEnabled,
  type AttemptSignalInput,
  type AdmissionTicket,
  type RequestAdmission,
} from '../provider/request-admission.js';
import { isModelStreamIdleError } from '@ihui/shared/utils/stream-idle';
import { resolveSandboxOptions } from '../sandbox/index.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import type { HunkTracker } from '../checkpoints/hunk-tracker.js';
import { compressContextIfNeeded, estimateTokens, estimateMessagesTokens, type CompressionResult, UsageLedger } from '../context.js';
import { compressContextV2, type CompactionSampler, type CompactionObserver } from '../compaction-v2.js';
import { CONTEXT_BUDGET_THRESHOLD, DEFAULT_TRIGGER_RATIO } from '@ihui/context-compaction';
// WP-2 三道有效性守卫的运行期装配 + WP-3 工具结果预算信封与已读状态跟踪
import { ContextGuards } from '../context-guards.js';
import { isPromptTooLongErrorMessage, recoverAfterOverflow } from '../context-guards.js';
import { envelopeToolResult, ReadStateTracker } from '../tools/result-envelope/index.js';
// 流式期工具登记账本:登记 + 提前执行 + 恢复锚点(机制在 stream-tool-ledger.ts)
import {
  StreamToolLedger,
  formatLedgerSummary,
  buildToolLedgerAuditIngest,
  type LedgerSnapshot,
} from '../stream-tool-ledger.js';
// G-633 回合起点预留号:并发回合不得复用同一 turnId(先 reserve 再落盘)
import { reserveTurnNumber } from '../turn-reservation.js';
// G-634 被取消的流也必须持久化:取消路径与正常完成同走结算出口
import { buildCancelledStreamSettlement } from '../cancelled-stream-settlement.js';
import {
  primeCompactionSummary,
  getCachedCompactionSummary,
  writeCompactionSummaryCache,
} from '../compaction-cache.js';
import { generateReminders } from '../reminders.js';
import { loadMcpTools, loadMcpConnections } from '../tools/mcp-runtime.js';
import { registerMcpToolsToHub } from '../tools/hub/mcp-adapter.js';
import { InMemoryRegistry } from '../tools/hub/registry.js';
import { loadSkills, formatSkillsForPrompt, type Skill } from '../skills/index.js';
import { frameSystemReminder, neutralizeBoundaries } from '../utils/prompt-boundary.js';
import { injectHostSection, injectReminderSection } from '../utils/prompt-injection-registry.js';
import { loadMemory, formatMemoryForPrompt, type MemoryEntry } from '../memory/index.js';
import { auditLog } from '../audit.js';
import { loadHooks, runSessionStartHooks, runSessionEndHooks, runHook } from '../hooks/index.js';
import { loadSettings, type SamplerSettings, type Settings } from './settings.js';
import {
  createOutputTokenContinuationMessage,
  classifyOutputTokenContinuation,
  isOutputTokenLimitFinishReason,
} from './agent-output-continuation.js';
import type { Session } from './session.js';
import { saveSession } from './session.js';
// G-632:异步解算启动时捕获分支代数 —— 解算期间分支被切换则本轮结果在落地口作废
import { captureBranchGeneration } from './branch-generation.js';
// G-728:装载调用点改走诊断出口(loadPluginsWithDiagnostics),数组薄封装 loadPlugins 会把诊断丢进垃圾桶
import {
  PluginRegistry,
  loadPluginsWithDiagnostics,
  type PluginDiagnostic,
  type PluginHookContext,
  type PluginLogger,
} from '../plugins/index.js';
import type { PlanMachine } from '../plan/index.js';
import {
  DoomLoopDetector,
  DoomLoopSignatureDetector,
  createFailureStreakTracker,
  planDoomAlertResponse,
  DOOM_ALERT_ROUNDS_TO_TERMINATE,
  STUCK_CONSECUTIVE_THRESHOLD,
  type DoomLoopAlert,
} from '../doom-loop-detector.js';
import { FsEventSource, type FsEvent } from '../fs-watcher/index.js';
import { t } from '../i18n/index.js';
import {
  applyGoalVerificationToStopReason,
  decideGoalContinuation,
  runGoalVerification,
  STOP_GOAL_BLOCKED,
  type GoalToolCallRecord,
  type GoalVerifyRequest,
} from '../goal-verification.js';
import type { GoalHardCriterion, GoalVerification } from '@ihui/api-client';
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

// 与 @ihui/types ChatRole 对齐(含 'tool'):repl state.history(session 持久化)与压缩
// 结果(CompressionResult)均可能携带 tool role,窄版类型会在 decideCompaction 接线处不兼容
type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
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
  /**
   * P0-C(2026-09-17 立):自动批准 LLM 提出的 plan 块(危险)。
   * 仅在 --auto-approve-plan 显式开启或 bypassPermissions 模式下生效;
   * 默认 false — plan 必须经用户审批(onPlanApproval 回调)才能执行工具。
   */
  autoApprovePlan?: boolean;
  /** LLM 采样参数(透传到 streamChat) */
  sampler?: SamplerSettings;
  /** P0-7 Permission rules:白名单/黑名单控制(--tools/--disallowed-tools CLI flag 注入) */
  permissions?: PermissionRules;
  /** 权限模式:default|acceptEdits|bypassPermissions|plan|manual */
  permissionMode?: PermissionMode;
  /** WP-8③ —— 执行前声明的硬性指标;非空即 goal 模式(见 RunToolLoopOptions 同名注释) */
  goalCriteria?: GoalHardCriterion[];
  /** goal 原文(与指标一起送进独立校验轮) */
  goal?: string;
  /** 校验请求注入点(测试/离线部署) */
  requestGoalVerification?: (req: GoalVerifyRequest) => Promise<unknown>;
  /** 结论到达调用方的出口 —— §8 要求"落到用户可见处",命令层在此打印 */
  onGoalVerification?: (v: GoalVerification) => void | Promise<void>;
}

export type AgentStopReason =
  | 'end_turn'
  | 'cancelled'
  | 'max_iterations'
  | 'budget_limited'
  | 'doom_loop'
  | 'error'
  // P0-C(2026-09-17 立):plan 审批门修复 — LLM 提出 plan 但无可用审批机制(非交互、无回调、未显式 auto)时终止
  | 'plan_approval_required'
  /**
   * WP-8③(2026-09-26 立):goal 模式下循环自宣完成,但**独立校验轮没让它过**。
   * 两个档名与 ai-service `goal_completion_gate.py` 的 `STOP_VERIFICATION_*` 逐字同值 ——
   * 一族两值,两处必须同形(真源在 Python 侧,这里是对齐不是另立)。
   */
  | 'verification_not_achieved'
  | 'verification_undetermined'
  /**
   * AGENTS.md §8 第 4 步(2026-09-26 立):goal 模式的独立校验**连续**未过到达上限,
   * 循环不再续跑。与上面两档是三个不同档 —— 那两档是"这次没验过"(还在跑),
   * 这一档是"生命周期收口"(别再跑了)。合并任何一档都会让恢复端看不出还剩几次机会。
   */
  | typeof STOP_GOAL_BLOCKED;

export interface AgentResult {
  stopReason: AgentStopReason;
  assistantText: string;
  iterations: number;
  usage: TokenUsage;
  /** goal 模式的独立校验结论;未声明硬性指标(非 goal 模式)时为 null */
  verification?: GoalVerification | null;
  /** G-425:最后一次模型响应的 finish_reason(本地 provider 面才有;远端流拿不到 ⇒ 不带) */
  finishReason?: string;
  /** G-425:最终一次响应是否仍被输出长度上限截断(续写预算耗尽后仍未说完) */
  outputTruncated?: boolean;
}

// ==================== P1-5 Headless 多格式输出(实现在 src/headless-format.ts,此处仅 re-export)====================
// 灵感来源:参考行业 Agent 框架的 LeaderOutput/HeadlessFormat 设计(支持 text/json/markdown/yaml)。
// 简化策略(做减法):不引入外部 yaml 库,自实现 30 行极简序列化器(只覆盖常见类型),流式输出不缓冲。
export type { OutputFormat, HeadlessEvent } from '../headless-format.js'
export { parseOutputFormat, formatHeadlessEvent } from '../headless-format.js'
import { createHeadlessEventGate, formatHeadlessEvent } from '../headless-format.js'
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
  /**
   * 会话级危险旁路(--allow-dangerous)。影子披露字段:随 ctx 下发给工具层做日志/披露追溯
   * (见 ToolContext.allowDangerous 与 danger-gate 的 noteDangerousApproval),
   * 不参与确认决策 —— 放行语义仍完全由 confirmDangerous 决定。
   */
  allowDangerous?: boolean;
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

/**
 * G-728 — 插件装载诊断的唯一派发出口:按 severity 分档送进 logger。
 *
 * 装载器(G-683/G-684)早已把"某份清单为什么没生效"编码成数据,但生产调用点长期走
 * 数组薄封装 loadPlugins() —— 诊断被整块丢弃,坏清单 / 同名弃权对用户不可见,
 * 即守门 64/70/81/115/138 记过的「出口在位而无人调用」那一型。本函数就是"调用"这一半:
 *   - severity === 'error'   ⇒ logger.error(有清单没被装载)
 *   - severity === 'warning' ⇒ logger.warn (装载了,但有内容被优先级忽略)
 * 日志行逐条点名 code + 清单绝对路径(只转述 message 会让路径信息随文案改版而丢)。
 * 单条派发不得抛穿:logger 实现若抖,由调用点的 try 兜 —— 诊断失败不得拖垮 agent 启动。
 */
export function reportPluginDiagnostics(diagnostics: readonly PluginDiagnostic[], logger: PluginLogger): void {
  for (const d of diagnostics) {
    // relatedFiles 必须随行进日志:歧义弃权(G-684)的"对方那一份"只住在这个结构化字段里,
    // 不拼进去则人前只看到自己那份路径,裁决"改名还是删一份"的人拿不到另一半证据。
    const related = d.relatedFiles && d.relatedFiles.length > 0 ? ` | related: ${d.relatedFiles.join(', ')}` : '';
    const line = `  [plugin:${d.code}] ${d.file}${d.pluginName ? ` (${d.pluginName})` : ''} — ${d.message}${related}`;
    if (d.severity === 'error') logger.error(line);
    else logger.warn(line);
  }
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
  // DAP 调试会话族(用户已批准注册给模型,2026-09-27;守门 131 点名的最后一格零注册族)
  registerTools(DEBUG_TOOLS);
  registerTools(CODEGRAPH_TOOLS);
  // 浏览器自动化工具:注册后由模型按需调用(执行时经 MCP 连 playwright,不可用自动降级)
  registerBrowserTools();
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
  // loadPluginsWithDiagnostics + registerAll + runSetups(真实接入,消除死代码)。
  // flag 关闭且未注入时,pluginRegistry=undefined,runToolLoop 内 runPluginHooks 直接 return(零回归)
  let pluginRegistry: PluginRegistry | undefined = opts.pluginRegistry;
  if (!pluginRegistry && settings.plugins?.enabled === true) {
    try {
      const pluginsDir = settings.plugins.pluginsDir ?? path.join(opts.workspacePath, '.ihui', 'plugins');
      // G-728:改调诊断出口。薄封装 loadPlugins() 只把 plugins 递出来,diagnostics 整块丢弃,
      // 坏清单 / 同名弃权今天仍然不会报到人前 —— 与守门 64/70/81/115/138 同型。
      const { plugins: defs, diagnostics } = loadPluginsWithDiagnostics({ pluginsDir });
      // 派发放在 defs.length 判据**之前**:全部清单都坏时 defs 为空,旧形态下"一个都没装上"
      // 反而零行日志,那正是本票要消灭的静默。装载继续(永不抛穿),诊断逐条点名到 logger。
      if (!opts.silent) {
        reportPluginDiagnostics(diagnostics, {
          info: (msg, ...rest) => console.info(msg, ...rest),
          warn: (msg, ...rest) => console.warn(msg, ...rest),
          error: (msg, ...rest) => console.error(msg, ...rest),
        });
      }
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
  // G-427 接线:技能段广告按真实工具表门控(Skill 不在表内 ⇒ 整块不出)
  const skillsText = formatSkillsForPrompt(skills, { toolTable: tools.map((t) => t.name) });
  const memoryText = formatMemoryForPrompt(memory);
  // AGENTS.md / memory 是**用户仓库与磁盘上的第三方文本**,直接拼进 system prompt 等于让
  // 它们披宿主语气 —— 走登记出口的 reference_data 档(内部过 neutralizeBoundaries 剥冒充标签)。
  // 没有内容时**不记 skipped**:仓库无 AGENTS.md 是常态不是降级,记一行就等于每轮造假噪声
  // (上一票刚把"本轮没到档位"记成 skipped 判为噪声并回退,不得重犯)。
  const agentsMdSection = agentsMd
    ? injectHostSection('context_agents_md', agentsMd, { kind: 'reference_data' })
    : '';
  const memorySection = memoryText
    ? injectHostSection('context_memory', memoryText, { kind: 'reference_data' })
    : '';
  const extraContext = [agentsMdSection, skillsText, memorySection].filter(Boolean).join('\n\n');
  const systemPrompt = buildSystemPrompt(tools, extraContext, opts.planFirst);
  const resolvedSandbox = resolveSandboxOptions(
    settings.sandbox?.profile,
    settings.sandbox ?? {},
  );
  const ctx: ToolContext = {
    workspacePath: opts.workspacePath,
    confirmDangerous: opts.confirmDangerous,
    allowDangerous: opts.allowDangerous,
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
  /**
   * WP-8③ —— 执行**前**声明的硬性指标。非空即进入 goal 模式:循环自宣完成
   * (`end_turn`)必须先过一次独立校验,未通过 / 未判定的档会被改写,
   * 绝不带着 `end_turn` 交账。不声明 = 现有全部调用方行为逐零差异。
   */
  goalCriteria?: GoalHardCriterion[];
  /** goal 原文(送进校验轮,与执行者自述并列作对照) */
  goal?: string;
  /** 校验请求的注入点(测试与"校验端不在本机"的部署);缺省走 api-client 的 ai-service 出口 */
  requestGoalVerification?: (req: GoalVerifyRequest) => Promise<unknown>;
  /** 结论到达调用方的出口 —— §8 要求"落到用户可见处",不是只进日志 */
  onGoalVerification?: (v: GoalVerification) => void | Promise<void>;
  onIteration?: (count: number, max: number) => void | Promise<void>;
  onError?: (message: string) => void | Promise<void>;
  /** 模型推理过程增量(reasoning/thinking)回调 — 透传 api-client 的 onReasoning,未传时零开销 */
  onReasoning?: (delta: string) => void | Promise<void>;
  /** 执行计划快照(plan_updated)回调 — 透传 api-client 的 onPlanUpdate,REPL 借此驱动实时任务状态行 */
  onPlanUpdate?: (event: PlanUpdateEvent) => void;
  /** D34 上下文注入交代 — 透传 api-client 的同名回调(签名直接取,避免与本端重抄漂移) */
  onInjectionApplied?: NonNullable<StreamChatOptions['onInjectionApplied']>;
  /** D39 上游重试交代 — 同上 */
  onRetryScheduled?: NonNullable<StreamChatOptions['onRetryScheduled']>;
  /** #11 引用溯源 — 同上 */
  onCitations?: NonNullable<StreamChatOptions['onCitations']>;
  /** D106 引导交代(steer) — 透传 api-client 的 onSteer,REPL 借此打印"引导已生效"一行 */
  onSteer?: NonNullable<StreamChatOptions['onSteer']>;
  /** 额度分档告警(budget) — 同上,REPL 据此打印"今日用量较高/即将耗尽"一行 */
  onBudget?: NonNullable<StreamChatOptions['onBudget']>;
  /** G-815976 流式中断标记帧(partial_done) — 透传 api-client 的 onPartialDone,未传时由 sampleWithRetry 落默认 stderr 警告一行 */
  onPartialDone?: NonNullable<StreamChatOptions['onPartialDone']>;
  /** D19 终端实时输出增量(terminal_delta) — 透传 api-client 的 onTerminalDelta,未传时零开销(与 onPlanUpdate 同一条纪律) */
  onTerminalDelta?: NonNullable<StreamChatOptions['onTerminalDelta']>;
  /** D151 命令等待键盘输入(terminal_interaction) — 透传 api-client 的 onTerminalInteraction,未传时零开销(同上) */
  onTerminalInteraction?: NonNullable<StreamChatOptions['onTerminalInteraction']>;
  /** 模型上下文窗口大小(tokens)。达 85% 自动压缩到 60%,默认取当前模型容量 getModelContextCapacity(modelId)(G-916940③④:引用唯一容量出口,不再写字面量)。 */
  contextLimit?: number;
  /** 是否启用 plan 强制阻断(配合 planApproved 控制) */
  planFirst?: boolean;
  /** plan 是否已被批准;true 时跳过阻断,允许工具执行。P0-C 修复后仅由真实审批来源置 true */
  planApproved?: boolean;
  /**
   * P0-C(2026-09-17 立):plan 审批回调 — LLM 输出 plan 块时调用,返回 true=批准执行。
   * REPL 传入 inquirer 交互确认;ACP 可转发 IDE 审批请求;返回 false 视为用户拒绝(要求 LLM 重新规划)。
   */
  onPlanApproval?: (plan: string) => boolean | Promise<boolean>;
  /**
   * P0-C(2026-09-17 立):显式自动批准 plan(危险,默认 false)。
   * 为 true 时跳过审批门直接进入执行(bypassPermissions 权限模式等价于 true)。
   * 非交互且无 onPlanApproval 回调时:默认 fail-fast,stopReason='plan_approval_required'。
   */
  autoApprovePlan?: boolean;
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
  /**
   * 上下文有效性守卫(压缩真值复测 / 快速回填熔断 / 溢出整组丢弃)。
   * 不传则内部按 contextLimit 建一个;注入用于测试断言"熔断真的让循环停了",
   * 以及 REPL/headless 在会话恢复时把上一轮的 latch 带回来。
   */
  contextGuards?: ContextGuards;
  /** 守卫熔断诊断出口(面向用户;每轮挂起都会回调一次) */
  onContextDiagnostic?: (diagnostic: string) => void;
  /**
   * 流式期工具账本快照(每轮流读完时回调一次)。
   * 恢复路径据此判断"上一轮哪些工具确实发出去了",避免断流后重放造成重复副作用。
   */
  onToolLedgerSnapshot?: (snapshot: LedgerSnapshot) => void;
  /**
   * D113(2026-09-27)文件写类工具的**流中 diff 预览**帧(本端本地派生,一次调用一批)。
   *
   * 为什么本端要自己派生:CLI 的工具在进程内执行,服务端 `llm.py` 的 `tool-delta`
   * 发帧路径对本端**永远不会发生**(本端不携带 `agentTools`)。要让"执行前先看一眼
   * 将要写入什么"在四端同形,只能把服务端那套派生规则在本地复算一份 ——
   * 唯一出口 `tools/file-edit-preview.ts`,算法/预算与服务端逐语义对齐,
   * 并由 `apps/cli/tests/file-edit-preview-parity.test.ts` +
   * `apps/ai-service/tests/test_file_edit_preview_parity.py` 两把尺子钉住。
   * 载荷形状与 `@ihui/api-client` 的 `ToolDeltaEvent` 一致,故渲染端与 web/RN/小程序
   * 共用同一条状态语义(按 toolCallId 整帧覆盖、落终态即清除)。
   */
  onToolDeltaFrames?: (events: ToolDeltaEvent[]) => void | Promise<void>;
  /**
   * 压缩动作注入点(默认走 decideCompaction)。
   * 存在的必要:熔断的价值是"真的不再自动压缩",而按默认路径跑没法从外部观察到
   * "这一轮到底调没调压缩"。留出这个接缝后,该结论可以由测试直接数调用次数钉死。
   */
  compactContext?: (
    messages: ChatMessage[],
    ctx: { turnIndex: number; lastActivityAtMs?: number },
  ) => Promise<CompressionResult>;
  /**
   * L1-4(2026-07-25 立):跨会话记忆用户 ID。
   * 若传入,doom_loop 首轮 alert 触发时会 fire-and-forget 调 ai-service POST /api/memory/procedural,
   * 把失败模式沉淀为 procedural memory,让 agent 未来能规避相同陷阱(对标 Hermes Agent 反思沉淀)。
   */
  userId?: string;
  /**
   * 原生 function calling 支持(2026-08-31 新增):
   *   - true:provider 明确支持 tools,原生 schema 下发 + SSE tool-call 事件解析
   *   - false:完全走 prompt 正则路径(不携带 tools)
   *   - 'auto' / undefined:先携带 tools 探测,provider 拒绝("not supported")时自动降级 prompt 模式
   */
  providerSupportsTools?: boolean | 'auto';
}

/** pattern 外发长度上限:超出即截断并在 stderr 点名(不得静默) */
const DOOM_LOOP_PATTERN_MAX_LEN = 256;

// ==================== D113 流中预览的"配对与清场"桥(2026-09-27 三面接线)====================
//
// 派生算法/取键顺序/截断预算**只有一份**,住在 `tools/file-edit-preview.ts`(与服务端
// llm.py 逐语义对齐,由 file-edit-preview-parity.test.ts 钉住)。本桥不重新派生任何文本,
// 只回答两个"只有跑起来才知道"的问题:
//   ① 一批帧属于哪一次工具调用(事件流里没有 toolCallId 可对齐,只能按**工具名**配对
//      第一个仍在场的 —— 与 repl.ts 同一理由:按下标对齐会整体错位一格);
//   ② 落终态/流中断时,哪些预览必须被清掉(预览不得与结果同屏,也不得被读成结果)。
//
// 为什么 headless(agent.ts)与 agent-core **共用这一份**而不是各写十行:
// 两处算同一件事必漂移是本仓记过最多次的失效型,而这一型 typecheck 完全不红
// (两边都能编译过,只是行为分了家)。ACP 面刻意**不走本桥** —— 它有自己的一套
// toolCallId 空间(协议卡 id),终态由 `tool_call_update` 覆盖同 id 完成,
// 见 acp/server.ts 的 planAcpPreviewUpdate。
//
// "running" 判据同样取自唯一出口 `pickToolDeltaPreviewText`(本桥只在卡还开着时出帧,
// 故 running 恒真;留该出口是为了让"空累积文本不出帧"这一条不出现第二份写法)。

/** 一条已出帧、尚未落终态的预览(结构与 repl.ts 的 openPreviews 同形) */
export interface OpenToolDeltaPreview {
  toolCallId: string;
  toolName: string;
}

/** 帧事实:哪次工具调用的哪一帧(各面映射成自己的事件形状) */
export interface ToolDeltaFrameFacts {
  toolName: string;
  event: ToolDeltaEvent;
}

/** 清场事实:该 toolCallId 的预览已作废(终态或中断) */
export interface ToolDeltaSettleFacts {
  toolName: string;
  toolCallId: string;
}

export interface ToolDeltaBridge {
  /** 记录最近一次 onToolCall 的工具名 —— 帧与它同一次派发内同步到达,故即本批帧的主人 */
  noteToolCall(toolName: string): void;
  /** 一批本地派生帧 → 要逐条发出的帧事实(非写类工具/空 id → 空数组,不发空帧) */
  onFrames(events: readonly ToolDeltaEvent[]): ToolDeltaFrameFacts[];
  /** 某工具落终态 → 该清的预览(按名配对;该工具没出过帧则 null,不发幽灵 clear) */
  settle(toolName: string): ToolDeltaSettleFacts | null;
  /** 流中断/报错 → 全部作废并点名(留在账上的预览会被读成"已经写成这样了") */
  abort(): ToolDeltaSettleFacts[];
  /** 只读探针:当前仍持有预览的 toolCallId(测试用来证明"终态确实清了") */
  heldIds(): string[];
  /** 底层 store(唯一状态源;不得在桥外另建一份) */
  readonly store: ToolDeltaPreviewStore;
}

export function createToolDeltaBridge(): ToolDeltaBridge {
  const store = createToolDeltaPreviewStore();
  const open: OpenToolDeltaPreview[] = [];
  let lastToolName = '';
  return {
    noteToolCall(toolName) {
      lastToolName = toolName;
    },
    onFrames(events) {
      const facts: ToolDeltaFrameFacts[] = [];
      for (const event of events) {
        // 空 toolCallId 丢弃(与 web/RN/小程序"空 id 不入 store"同一条纪律)
        if (!store.apply(event)) continue;
        const text = pickToolDeltaPreviewText({
          running: true,
          preview: store.get(event.toolCallId),
        });
        if (text === null) continue;
        if (!open.some((p) => p.toolCallId === event.toolCallId)) {
          open.push({ toolCallId: event.toolCallId, toolName: lastToolName });
        }
        facts.push({ toolName: lastToolName, event });
      }
      return facts;
    },
    settle(toolName) {
      const idx = open.findIndex((p) => p.toolName === toolName);
      if (idx === -1) return null;
      const [settled] = open.splice(idx, 1);
      if (!settled) return null;
      store.clear(settled.toolCallId);
      return { toolName, toolCallId: settled.toolCallId };
    },
    abort() {
      const all = open.map((p) => ({ toolName: p.toolName, toolCallId: p.toolCallId }));
      store.clearAll();
      open.length = 0;
      return all;
    },
    heldIds() {
      return store.ids();
    },
    store,
  };
}

// ==================== 工具账本 → 服务端审计链(86A 接线,2026-09-28)====================
//
// 快照出口 `onToolLedgerSnapshot` 此前生产面零消费者(唯一实现方是测试)= "记了
// 但没人取",工具调用从未进入审计链。本函数是那个**生产消费者**:每轮快照经
// stream-tool-ledger.ts 的写入源投影(fingerprint 作入参摘要,不落 args 原文),
// 走 @ihui/api-client 的 `fetchApi`(自动带 Authorization/X-Requested-With,
// 续期由 fetchApi 单例负责)POST 到 apps/api 的审计摄入入口。
//
// 三条不可漂的口径:
// 1. **请求体不带任何身份字段** —— 属主由服务端从令牌主体取(request.userId),
//    服务端摄入函数(zod strict)会直接拒掉带 userId/user_id 的 body;
// 2. **失败必须可见** —— 非 2xx / 网络错都写 stderr;401/4xx 只回 status 与
//    errorCode,不回显服务端响应体(凭据面纪律,同守门 67 的取向);
// 3. **未登录不是失败** —— 审计事件须有主体,无 token 时跳过且不打扰。
// 404(摄入路由尚未接线)只喊一次并停止本进程重试:每轮都喊等于制造恒常噪声,
// 而原因已经报过;该等待项登记在交付报告,不由这里静默消化。

/** apps/api 侧审计摄入端点(挂载 routes 接线是 86A 的登记余项,见函数头注释) */
export const TOOL_LEDGER_AUDIT_INGEST_PATH = '/api/cli/audit/tool-invokes';

let toolLedgerAuditIngestMissing = false;

/** 仅测试用:重置"404 停止重试 / 出口缺失只喊一次"的模块级状态。 */
export function __resetToolLedgerAuditStateForTest(): void {
  toolLedgerAuditIngestMissing = false;
  __resetAuditIngestClientWarnForTest('tool-ledger-audit');
}

/**
 * 把一轮工具账本快照上报到服务端审计链(fire-and-forget 由调用方决定;
 * 本函数自身 await,以便测试 await 到落定再断言)。
 */
export async function reportToolLedgerSnapshotToAudit(snapshot: LedgerSnapshot): Promise<void> {
  if (toolLedgerAuditIngestMissing) return;
  const client = resolveAuditIngestClient('tool-ledger-audit');
  if (!client) return;
  // 未登录:没有可归属的主体,跳过(这不是上报失败,不产生噪音)。
  if (!client.hasToken()) return;
  const { ingest, dropped } = buildToolLedgerAuditIngest(snapshot);
  if (dropped > 0) {
    // 截断必须喊出来:静默变短等于伪造完整性。
    process.stderr.write(
      chalk.yellow(`[tool-ledger-audit] facts truncated: dropped=${dropped} (turn=${ingest.turn})\n`),
    );
  }
  if (ingest.facts.length === 0) return;
  const res = await client.post<{ recorded: number; failed: number }>(TOOL_LEDGER_AUDIT_INGEST_PATH, {
    method: 'POST',
    body: JSON.stringify(ingest),
  });
  if (res.success) return;
  if (res.status === 404) {
    toolLedgerAuditIngestMissing = true;
    process.stderr.write(
      chalk.yellow(
        `[tool-ledger-audit] ingest endpoint not mounted (404 ${TOOL_LEDGER_AUDIT_INGEST_PATH}); audit reporting disabled for this process\n`,
      ),
    );
    return;
  }
  // 其余失败每轮都报(不静默 catch 后当成功);刻意只回显 status/errorCode,
  // 不把服务端 error 文本转写进 stderr(响应体可能携带任意上游内容)。
  process.stderr.write(
    chalk.yellow(
      `[tool-ledger-audit] report failed status=${res.status ?? 'network'}${res.errorCode ? ` code=${res.errorCode}` : ''} (turn=${ingest.turn})\n`,
    ),
  );
}

// ==================== 审批决策 → 服务端审计链(86H 接线,2026-09-28)====================
//
// 事实本体与"带审计的闸门包装器"住 tools/danger-gate-audit.ts —— 落链站点有五个
// (runAgent / repl / acp / agent-core / subagent),其中三个在 tools/acp/server 层,
// 让它们反向 import commands/agent.js 会造出 agent → tools/index → subagent → agent 的
// 循环;而"一个决策怎么变成一行审计"绝不允许写五份。本文件只留 runAgent 那一站的构造。
/**
 * runAgent 的危险闸门工厂(86H)。
 *
 * 落链本体在 `createAuditedDangerGate`(五个站点共用一份实现),本工厂只加 runAgent
 * 这一站自己的 console 提示。导出它的原因是可测性:「结构化输出档案(silent)下仍必须
 * 落链」这一条只能用行为断言钉 —— 拿文本顺序判会在任何一次加注释或加分支时自己咬自己
 * (闸门闭包的收尾 `});` 本身就含 `})`,brace matching 先在这里错过一次)。
 */
export function buildAgentDangerGate(opts: {
  allowDangerous: boolean;
  /** true = 结构化输出档案:console 静音,但审计事实照落 */
  silent: boolean;
  sessionId?: string | null;
}): DangerGate {
  return createAuditedDangerGate({
    allowDangerous: opts.allowDangerous,
    // 对 createDangerGate 恒传 silent:true —— 提示由下面的 onDecision 自己发,
    // 于是"关提示"与"关落链"两件事被物理分开(落链在包装器里,先于这段判序)。
    silent: true,
    auditSessionId: opts.sessionId,
    onDecision: ({ route, tool, args }) => {
      if (opts.silent) return;
      if (route === 'flag') {
        console.info(
          chalk.yellow(`  ⚠ 自动允许危险操作: ${tool.name} ${JSON.stringify(args).slice(0, 100)}`),
        );
      } else if (route === 'denied') {
        console.error(chalk.red(`  ✗ 危险操作被拒绝(需 --allow-dangerous): ${tool.name}`));
      }
    },
  });
}

/**
 * L1-4(2026-07-25 立):fire-and-forget 把 doom_loop 失败模式沉淀到 procedural memory。
 *
 * 调用 ai-service POST /api/memory/procedural 端点:
 * - pattern: `doom_loop:<toolName>:<inputHash>`(unique 反模式标识;inputHash 段为
 *   定长 SHA-256 hex,2026-09-27 起不再是入参原文 —— 原文含文件路径/正文/命令行,
 *   曾随本 pattern 明文 POST 到服务端长期落库)
 * - success: false
 * - metadata: { source, repeatCount, message, suggestion, workspaceDigest, sessionId }
 *   （`workspaceDigest` 而非 workspacePath：2026-09-27 起绝对路径不再出机 —— 它含用户名与
 *   目录结构，而服务端对 `metadata.workspacePath` 零读者，明文本就没有存在的理由）
 *
 * 失败不阻塞(opts.userId 未传 / 网络故障 / 端点 404 等):由调用方 catch 后 stderr 输出。
 *
 * 对标 Hermes Agent 反思沉淀:agent 检测到死循环后,把失败模式写入 procedural memory,
 * 下次调用工具前可 recall 到这条反模式,主动规避相同陷阱。
 */
export async function persistDoomLoopProcedural(
  opts: RunToolLoopOptions,
  alerts: DoomLoopAlert[],
): Promise<void> {
  if (!opts.userId) return;
  const config = loadConfig();
  const baseUrl = (config.apiUrl || 'http://localhost:8803').replace(/\/+$/, '');
  for (const alert of alerts) {
    // pattern 只由「前缀 + 工具名 + 摘要」构成,不得含任何入参原文:
    // - inputHash 段自 2026-09-27 起为定长 SHA-256 hex(doom-loop-detector.ts hashInput)
    // - toolName/inputHash 仍统一过 redactSecrets 兜底(工具名字段理论上可携带
    //   路径/凭据形态文本;hex 段不含分隔符,脱敏对其为恒等变换)
    // - 前缀 `doom_loop:<toolName>:` 的格式逐字保留(服务端/召回侧按它匹配)
    const safeToolName = redactSecrets(String(alert.toolName ?? ''));
    const safeInputHash = redactSecrets(String(alert.inputHash ?? ''));
    let pattern = `doom_loop:${safeToolName}:${safeInputHash}`;
    if (pattern.length > DOOM_LOOP_PATTERN_MAX_LEN) {
      // 截断必须喊出来:静默变短等于悄悄改了去重键,比超长更危险
      process.stderr.write(
        chalk.yellow(
          `[doom-loop] pattern 超长已截断:${pattern.length} > ${DOOM_LOOP_PATTERN_MAX_LEN} 字符(tool=${safeToolName.slice(0, 60)})\n`,
        ),
      );
      pattern = pattern.slice(0, DOOM_LOOP_PATTERN_MAX_LEN);
    }
    const body = {
      user_id: opts.userId,
      pattern,
      tool_name: alert.toolName,
      success: false,
      metadata: {
        source: 'doom_loop_detector',
        repeatCount: alert.repeatCount,
        message: alert.message,
        suggestion: alert.suggestion,
        // 绝对路径含用户名与目录结构,而服务端对这一格零读者 ⇒ 只发摘要,不发路径
        workspaceDigest: createHash('sha256')
          .update(String(opts.ctx.workspacePath ?? ''))
          .digest('hex'),
        sessionId: opts.sessionId ?? null,
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${baseUrl}/api/memory/procedural`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
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
  // 走登记出口:fs 事件是**第三方内容**(宿主观察到的事实,不是宿主的指令),
  // 旧写法给它套 `[系统提示]` 前缀 = 让第三方内容冒充宿主语气,模型无从分辨。
  return injectHostSection(
    'context_fs_events',
    `工作区最近文件变更(60s 内,共 ${events.length} 条,显示最近 ${lines.length} 条):\n${lines.join('\n')}`,
    { kind: 'reference_data' },
  );
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
  /** goal 模式的独立校验结论;非 goal 模式为 null(行为与接线前逐零差异) */
  verification?: GoalVerification | null;
  /** G-632:解算启动时捕获的分支代数 —— 落地前与当前代数比对,不等 ⇒ 结果作废 */
  branchGeneration: number;
  /** G-425:最后一次模型响应的 finish_reason(本地 provider 面才有;远端流拿不到 ⇒ 不带此字段) */
  finishReason?: string;
  /**
   * G-425:最终一次响应是否仍被输出长度上限截断(true = 有界续写预算耗尽/轮次耗尽后
   * 仍没说完)。端上据此提示"回复不完整",与 stderr 的 [truncated] 行同源。
   */
  outputTruncated?: boolean;
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
// V3#54(2026-09-28):死循环阈值不再本地抄数字 —— 唯一来源是共享层
// packages/shared/src/agent/doom-loop-detector.ts(STUCK_CONSECUTIVE_THRESHOLD)。
const SAMPLER_RETRYABLE_SEVERITIES: ReadonlySet<string> = new Set(['ratelimit', 'network', 'server']);

interface SampleWithRetryOptions {
  modelId: string;
  // role 含 'tool':与 @ihui/context-compaction 的 ChatMessage 及 OpenAI 兼容协议对齐
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  sampler?: SamplerSettings;
  /**
   * G-686 准入闸门三件套(未启用时三个都是 undefined ⇒ 本函数路径与改动前逐字同行为)。
   *
   * 粒度是**每一次尝试**:退避 sleep 之前必须先结算(不持槽),所以下面每个 return 点
   * 都要先 `settle`。run 身份由调用方给(同一进程里多条 run 要靠它做轮转防饿死),
   * 桶键由 `${provider}/${model}` 决定(同 provider 不同模型是两个配额,不得并桶)。
   */
  admission?: RequestAdmission;
  admissionRunId?: string;
  admissionKey?: string;
  /** 推理过程增量回调(reasoning/thinking)— 透传 api-client 的 onReasoning */
  onReasoning?: (delta: string) => void;
  /** 原生 function calling:附加到请求体末尾的字段(如 { tools: [...] }) */
  extraBody?: Record<string, unknown>;
  /** 原生 function calling:SSE tool-call 事件回调 */
  onToolCallEvent?: (event: { type: string; toolCallId: string; toolName: string; args?: Record<string, unknown> }) => void;
  /** 执行计划快照(plan_updated)— 透传 api-client 的 onPlanUpdate,未传时零开销 */
  onPlanUpdate?: (event: PlanUpdateEvent) => void;
  /** D34 上下文注入交代 — 未传时零开销(与 onPlanUpdate 同一条纪律) */
  onInjectionApplied?: NonNullable<StreamChatOptions['onInjectionApplied']>;
  /** D39 上游重试交代 — 同上 */
  onRetryScheduled?: NonNullable<StreamChatOptions['onRetryScheduled']>;
  /** #11 引用溯源 — 同上 */
  onCitations?: NonNullable<StreamChatOptions['onCitations']>;
  /** D106 引导交代(steer) — 未传时零开销(与 onPlanUpdate 同一条纪律) */
  onSteer?: NonNullable<StreamChatOptions['onSteer']>;
  /** 额度分档告警(budget) — 未传时零开销(与 onPlanUpdate 同一条纪律) */
  onBudget?: NonNullable<StreamChatOptions['onBudget']>;
  /** G-815976 流式中断标记帧(partial_done) — 调用方未传时默认落 stderr 警告一行(半截回答不得与完整回答同形) */
  onPartialDone?: NonNullable<StreamChatOptions['onPartialDone']>;
  /**
   * provider usage 帧 — WP-2 守卫一「压缩后真值复测」的唯一权威基准。
   * 未传时零开销(与 onPlanUpdate 同一条纪律)。
   */
  onUsage?: NonNullable<StreamChatOptions['onUsage']>;
  /** D19 终端实时输出增量(terminal_delta)— 未传时零开销(与 onPlanUpdate 同一条纪律) */
  onTerminalDelta?: NonNullable<StreamChatOptions['onTerminalDelta']>;
  /** D151 命令等待键盘输入(terminal_interaction)— 未传时零开销(与 onPlanUpdate 同一条纪律) */
  onTerminalInteraction?: NonNullable<StreamChatOptions['onTerminalInteraction']>;
}

/**
 * D19(2026-09-25 接):terminal_delta 帧 → 「已完整成行」的终端输出行。
 *
 * 后端在命令执行期间逐块下发 stdout/stderr 增量(web/extension/mobile-rn 有卡片面板,
 * CLI 没有卡片宿主 — 最自然的渲染就是逐行打进输出流,与 noteLine 家族同一出口)。
 * 防洪泛纪律:delta 块在**行中**断开是常态,半行单独打印会把正文打碎,
 * 故只输出已带 `\n` 收尾的整行,未满行留在 pending[terminalId] 等下一帧拼接
 * (调用方持有一轮对话的 pending;与 statusline「数据源低频才逐行」的前提兼容:
 * 逐 delta 帧只在真有一整行输出时才算一次行)。
 * 空 terminalId / 空 text 整帧丢弃(与 web send-message 的 onTerminalDelta 守卫同口径)。
 */
export const TERMINAL_LINE_MAX_CHARS = 200;

export function takeTerminalDeltaLines(
  pending: Record<string, string>,
  event: Pick<TerminalDeltaEvent, 'terminalId' | 'command' | 'stream' | 'text'>,
): string[] {
  if (!event.terminalId || !event.text) return [];
  const buffered = (pending[event.terminalId] ?? '') + event.text;
  const parts = buffered.split('\n');
  const rest = parts.pop() ?? '';
  if (rest) pending[event.terminalId] = rest;
  else delete pending[event.terminalId];
  const tag = event.stream === 'stderr' ? '[terminal:err]' : '[terminal]';
  const prefix = event.command ? `${tag} ${event.command} · ` : `${tag} `;
  const lines: string[] = [];
  for (const raw of parts) {
    const line = raw.trim();
    if (!line) continue;
    lines.push(line.length > TERMINAL_LINE_MAX_CHARS ? `${prefix}${line.slice(0, TERMINAL_LINE_MAX_CHARS)}…` : `${prefix}${line}`);
  }
  return lines;
}

/**
 * D19 打印汇(装车点:repl.ts 的 runToolLoop.onTerminalDelta 用它)。
 * 内部持有本轮 terminalId→半行缓冲,把 terminal_delta 事件流转成 noteLine 调用。
 */
export function createTerminalDeltaSink(
  noteLine: (line: string) => void,
): (event: TerminalDeltaEvent) => void {
  const pending: Record<string, string> = {};
  return (event) => {
    for (const line of takeTerminalDeltaLines(pending, event)) noteLine(line);
  };
}

interface SampleWithRetryResult {
  error?: string;
  /**
   * G-425:最后一次响应的结束原因。本地 provider 面(streamOpenAiCompatible)会把
   * `choice.finish_reason` 带出来;远端 streamChat 的 SSE 契约今天不携带 stop/finish
   * reason ⇒ 这一路恒 undefined(截断续写在远端暂不生效,属 ai-service 契约那一格)。
   */
  finishReason?: string;
}

/** 判断错误是否为 provider 不支持原生 tools(auto 探测降级依据) */
function isToolsUnsupportedError(errMsg: string): boolean {
  const e = errMsg.toLowerCase();
  if (!e.includes('tool')) return false;
  return e.includes('not supported') || e.includes('does not support') || e.includes('unsupported');
}

type RetryCallback = (
  attempt: number,
  errMsg: string,
  severity: SSEErrorSeverity,
  delayMs: number,
) => void;

/**
 * V3#54(2026-09-28):本地 ConsecutiveSignatureDetector 已上提到共享层
 * (packages/shared/src/agent/doom-loop-detector.ts),CLI 侧改用薄适配器
 * DoomLoopSignatureDetector(定义于 src/doom-loop-detector.ts)。
 * 这里删除本地类,消除"第二份 stuck 判据"。
 */

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
    // G-686:闸门粒度 = **每一次尝试**(含退避后的重发)。未启用时(三件套缺任一)ticket 恒
    // undefined,下面每个 settle 都是可选链 no-op ⇒ 这条路径与改动前逐字同行为。
    let ticket: AdmissionTicket | undefined;
    if (opts.admission && opts.admissionRunId && opts.admissionKey) {
      try {
        ticket = await opts.admission.acquire(opts.admissionRunId, opts.admissionKey, {
          signal: opts.signal,
        });
      } catch (e) {
        // 排队期间被取消 ⇒ 不发起这一次尝试,也不喂任何 AIMD 信号;走既有 'aborted' 语义
        if (isAdmissionAbortError(e)) return { error: 'aborted' };
        throw e;
      }
    }
    const settleAttempt = (input: AttemptSignalInput): void => {
      ticket?.settleFromInput(input);
    };
    let errMsg: string | undefined;
    let streamIdleTimeout = false;
    // 吞错修复(2026-09-04):streamChat 对流内 error 事件耗尽内部重试后只走 onError 回调
    // 且正常 resolve(不抛出)。不传 onError 时错误被彻底丢弃,上层把失败当"成功的空补全"
    // (如 provider 402 配额耗尽 → completionTokens:0 + end_turn)。此处捕获回调错误并
    // 转入 errMsg 路径,走既有 formatSSEError 分类/重试逻辑。
    let streamErr: string | undefined;
    // onError 的第二参数(errorCode 等元信息)必须一起留存:厂商账号额度耗尽
    // (PROVIDER_QUOTA_EXHAUSTED)只靠 errorCode 判定 —— ai-service 未登记该码的 HTTP 状态,
    // 实际仍回落默认 502,按状态码分类会被误判成"稍后重试",而重试必然再撞。
    let streamErrInfo: SSEErrorInfo | undefined;
    try {
      await streamChat({
        model: opts.modelId,
        messages: opts.messages,
        signal: opts.signal,
        onDelta: opts.onDelta,
        ...(opts.extraBody ? { extraBody: opts.extraBody } : {}),
        ...(opts.onToolCallEvent ? { onToolCall: opts.onToolCallEvent } : {}),
        ...(opts.onReasoning ? { onReasoning: opts.onReasoning } : {}),
        ...(opts.onPlanUpdate ? { onPlanUpdate: opts.onPlanUpdate } : {}),
        ...(opts.onInjectionApplied ? { onInjectionApplied: opts.onInjectionApplied } : {}),
        ...(opts.onRetryScheduled ? { onRetryScheduled: opts.onRetryScheduled } : {}),
        ...(opts.onCitations ? { onCitations: opts.onCitations } : {}),
        ...(opts.onSteer ? { onSteer: opts.onSteer } : {}),
        ...(opts.onBudget ? { onBudget: opts.onBudget } : {}),
        // G-815976 流式中断标记帧(partial_done):未传回调时由这里落默认 stderr 警告一行
        // (走 stderr 避免污染 stdout 的流式正文;chalk.yellow 与 [retry]/[truncated] 警告族同风格)。
        onPartialDone:
          opts.onPartialDone ??
          (() => {
            process.stderr.write(chalk.yellow(`${t('cli.partialDoneTitle')}\n`));
          }),
        ...(opts.onUsage ? { onUsage: opts.onUsage } : {}),
        ...(opts.onTerminalDelta ? { onTerminalDelta: opts.onTerminalDelta } : {}),
        ...(opts.onTerminalInteraction ? { onTerminalInteraction: opts.onTerminalInteraction } : {}),
        ...(opts.sampler ?? {}),
        onError: (msg, info) => { streamErr = msg; streamErrInfo = info; },
      } as Parameters<typeof streamChat>[0]);
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
      // 流 idle 超时有结构化 code(MODEL_STREAM_IDLE_CODE),不是文案 —— 它是 timeout 档的
      // 唯一非文案依据(本仓禁止"拿错误文本决定分支")
      streamIdleTimeout = isModelStreamIdleError(e);
    }
    if (streamErr !== undefined) errMsg = streamErr;
    if (errMsg === undefined) {
      settleAttempt({ ok: true });
      return {};
    }
    const formatted = formatSSEError(new Error(errMsg), streamErrInfo);
    // 这一次尝试的失败画像(结构化字段构成,不做任何文案匹配)
    const failureSignal: AttemptSignalInput = {
      ok: false,
      severity: formatted.severity,
      isStreamIdleTimeout: streamIdleTimeout,
      ...(formatted.code !== undefined ? { status: formatted.code } : {}),
      ...(formatted.retryAfter !== undefined ? { retryAfterSeconds: formatted.retryAfter } : {}),
      ...(formatted.retryable !== undefined ? { retryable: formatted.retryable } : {}),
    };
    // 不可重试错误立即返回
    if (!SAMPLER_RETRYABLE_SEVERITIES.has(formatted.severity)) {
      settleAttempt(failureSignal);
      return { error: errMsg };
    }
    // retryable === false:厂商账号额度已耗尽,全部候选通道都失败,退避重试必然再撞
    if (formatted.retryable === false) {
      settleAttempt(failureSignal);
      return { error: errMsg };
    }
    // 达到最大重试次数,返回最后一次错误
    if (attempt >= SAMPLER_MAX_RETRIES) {
      settleAttempt(failureSignal);
      return { error: errMsg };
    }
    // 指数退避:1s, 2s, 4s...(ratelimit 至少 5s)
    const base = formatted.severity === 'ratelimit' ? 5000 : 1000;
    const delayMs = base * Math.pow(2, attempt);
    onRetry?.(attempt + 1, errMsg, formatted.severity, delayMs);
    // **退避期不持槽**:在排定 sleep 之前结算 —— 否则一次 ratelimit 退避(5s/10s/20s)会把
    // 一个名额白占着,别的 run 明明有空位却进不来,闸门会被退避时钟放大成串行器。
    settleAttempt(failureSignal);
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
 * COMPACTION_SUMMARY_PROMPT — 结构化四段式压缩摘要 system prompt(2026-09-02 升级)。
 *
 * 设计动机:对齐行业第一梯队的上下文压缩信息密度 —— 泛化的"保留请求/决策/文件"清单
 * 导致 LLM 输出空洞套话;四段式强制结构化输出,每段有明确写法要求,信息密度显著更高。
 * 500 字符下限与 compaction-v2 的 isDegenerateSummary 阈值对齐(不达标即 fallback V1)。
 */
export const COMPACTION_SUMMARY_PROMPT = [
  '你是上下文压缩器。把以下对话历史压缩为结构化摘要,严格按以下四个 markdown 段落输出(段名原样保留,段落间用一个空行分隔):',
  '',
  '## 任务目标',
  '用户会话要达成的核心目标,包括原始请求的完整语义与约束条件。',
  '',
  '## 已做决策',
  '会话中确定的技术选择及其理由(选型、方案、取舍),每条决策一行,写明"选了什么+为什么"。',
  '',
  '## 文件与工具变更',
  '涉及的文件路径(原样保留路径原文)、改动要点、调用的工具名及结果成败(✓/✗)。',
  '',
  '## 未完成事项与下一步',
  '遗留问题、失败未解决的操作、建议的下一步行动,按优先级排列。',
  '',
  '硬性要求:',
  '1. 总输出不少于 500 字符(不足视为退化摘要);',
  '2. 不输出 <analysis>/<summary>/<thinking> 等任何控制标签;',
  '3. 文件路径、工具名、命令保留原文,不要意译;',
  '4. 只写事实性内容(发生了什么/决定了什么/改了什么/还差什么),不写空洞套话与客套语。',
].join('\n');

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
            { role: 'system', content: COMPACTION_SUMMARY_PROMPT },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
          signal: controller.signal,
          // 2026-08-16 修复:显式声明流式,避免后端/中间件对 request.stream 做严格字段检测时关闭 SSE。
          stream: true,
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
  opts: {
    contextLimit: number;
    modelId: string;
    sessionId?: string;
    triggerRatioOverride?: number;
    /**
     * 会话最近一次活动时间戳(ms)—— 透给 compressContextV2 的 reclaim 空闲触发。
     * 不传则回收只有"窗口比例"这一条触发路径(此前调用方一个都没传,
     * 空闲触发等于不存在 —— 守卫造好了没接线)。
     */
    lastActivityAtMs?: number;
    /** 判定时钟(测试注入) */
    nowMs?: number;
  },
): Promise<CompressionResult> {
  const v2Config = settings.compactionV2;
  // P2:走到最后的 V1 兜底有两种语义 —— "V2 没开"与"V2 抛了",闭集 reason 必须分清,
  // 否则消费面读到 disabled 会以为没人尝试过摘要。
  let v2AttemptFailed = false;
  if (v2Config?.enabled === true) {
    try {
      const sessionId = opts.sessionId ?? 'cli-default';
      const sampler = createCompactionSampler(v2Config.model || opts.modelId || 'default-model');
      const observer: CompactionObserver = {
        onSuccess: ({ tokensBefore, tokensAfter, turnsCompacted, elapsedMs }) => {
          console.info(chalk.dim(`  🗜️ compaction-v2: ${tokensBefore}→${tokensAfter} tokens, ${turnsCompacted} turns, ${elapsedMs}ms`));
        },
        onError: ({ statusLabel, error }) => {
          console.warn(chalk.yellow(`  ⚠️ compaction-v2 error (${statusLabel}): ${error?.message ?? 'unknown'}`));
        },
      };
      // 70% 后台预压缩(2026-09-01 立,代差能力 A 的 CLI 同构):usageRatio ≥ 0.7 且未达触发
      // 阈值时 fire-and-forget 预生成摘要缓存(复用同一 sampler 路径,产物与实时生成一致);
      // 88% 真压缩时命中缓存 → compressContextV2 零 LLM 调用,首响应零摘要阻塞。
      // P3-11 同构收敛:兜底阈值引用共享包单源(此前二次写死 0.88 造成漂移面)。
      const triggerRatio = v2Config.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
      const tokensBefore = estimateMessagesTokens(messages);
      const usageRatio = opts.contextLimit > 0 ? tokensBefore / opts.contextLimit : 0;
      if (usageRatio >= CONTEXT_BUDGET_THRESHOLD && tokensBefore < Math.floor(opts.contextLimit * triggerRatio)) {
        void primeCompactionSummary(sessionId, messages, async (toCompressText) => {
          // 复用同一 sampler 路径(与实时生成同 prompt/模型,保证缓存产物一致)
          const r = await sampler.sampleCompaction(
            [{ role: 'user', content: toCompressText }],
            { timeoutMs: v2Config.samplingTimeoutMs ?? 30_000 },
          );
          return r.response;
        });
      }
      // 88% 真压缩:缓存命中 → 跳过阻塞式 LLM 摘要;未命中 → 实时生成并回写缓存
      const cachedSummary = getCachedCompactionSummary(sessionId, messages) ?? undefined;
      const result = await compressContextV2(messages, {
        contextLimit: opts.contextLimit,
        triggerRatio: opts.triggerRatioOverride ?? v2Config.triggerRatio,
        targetRatio: v2Config.targetRatio,
        samplingTimeoutMs: v2Config.samplingTimeoutMs,
        sampler,
        observer,
        cachedSummary,
        sessionId,
        // 回收的空闲触发只有调用方知道"上次真实活动是几点",这里透传给 reclaim;
        // 不传则 reclaim 永远只能靠窗口比例触发(空闲那条腿等于没装)。
        ...(typeof opts.lastActivityAtMs === 'number' ? { lastActivityAtMs: opts.lastActivityAtMs } : {}),
      });
      if (result.compressed && !cachedSummary) {
        // 回写:把本次压缩覆盖的消息序列与摘要正文写入缓存(hash 基于除最近 6 条外的序列化,
        // 与 prime/getCached 同 key 逻辑,下次同范围压缩直接命中)
        writeCompactionSummaryCache(sessionId, messages, extractSummaryBody(result.messages));
      }
      return result;
    } catch (err) {
      v2AttemptFailed = true;
      console.warn(chalk.yellow(`  ⚠️ compaction-v2 failed, fallback to v1: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  const v1Result = compressContextIfNeeded(messages, {
    contextLimit: opts.contextLimit,
    // /compact 手动压缩:伪造阈值 0.87 使 ceil(t/0.87)*0.87 的 floor 恰为 t,必然触发
    ...(opts.triggerRatioOverride !== null && opts.triggerRatioOverride !== undefined ? { triggerRatio: opts.triggerRatioOverride } : {}),
  });
  return { ...v1Result, reason: v2AttemptFailed ? 'sampler-failed' : 'disabled' };
}

/** 从压缩结果中提取摘要消息正文(去掉 '[上下文摘要 — 之前 N 条已压缩]' 标记行),供缓存回写 */
function extractSummaryBody(messages: CompressionResult['messages']): string {
  const summaryMsg = messages.find(
    (m) => m.role === 'user' && m.content.startsWith('[上下文摘要'),
  );
  if (!summaryMsg) return '';
  const markerEnd = summaryMsg.content.indexOf(']\n');
  return markerEnd >= 0 ? summaryMsg.content.slice(markerEnd + 2) : '';
}

/** 执行多轮工具循环,直到 end_turn 或 maxIterations。messages 数组会被原地修改(追加 assistant + tool_result 消息) */
export async function runToolLoop(opts: RunToolLoopOptions): Promise<RunToolLoopResult> {
  // G-632:异步解算启动即捕获当下分支代数 —— 解算期间 /fork、/branch、/sessions resume
  // 任何一次分支装配都会使代数 +1,落地口比对不等即作废本轮结果。
  const branchGeneration = captureBranchGeneration();
  let assistantText = '';
  let hadError = false;
  let iterations = 0;
  // G-633(2026-09-29):回合起点预留号。每轮循环开始时向进程级分配器原子预留,
  // 账本 turn/streamId 前缀都用它 —— 并发回合(多会话/多 agent)绝不复用同一 turnId。
  // 0 = 尚无预留(0 号永不发出,循环未启动时预建账本不会带号落盘)。
  let reservedTurnNumber = 0;
  // G-634(2026-09-29):取消结算观测口 —— 当前流已收到的内容(onDelta 实时同步;
  // 整轮文本落盘后即清零,保证结算出口只兜"未落盘的残段",绝不重复入账)。
  let inFlightStreamText = '';
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let budgetLimited = false;
  let lastErrorMessage = '';
  // V3#54(2026-09-28):工具连续失败反思换策略 —— 判据/阈值上提共享层
  // (createFailureStreakTracker + FAILURE_STREAK_STRATEGY_THRESHOLD,Python 等价
  // app/core/doom_loop.py 的 FailureStreakTracker;parity 由守门钉死)。
  const failureStreak = createFailureStreakTracker();
  // P1-2 Reminders:跨迭代持久化已注入的 reminder 类型(避免重复注入)
  const reminderInjected = new Set<string>();
  // P0-3 SamplerActor:连续签名检测器(连续 N 次相同错误签名 / tool_call 模式判定死循环)
  const signatureDetector = new DoomLoopSignatureDetector();
  let signatureDoomDetected = false;
  // P0-3 DoomLoopDetector(滑动窗口):检测 LLM 重复调用相同工具相同参数的死循环
  // 灵感来源:参考行业 Agent 框架的 doom_loop 理念,简化为客户端工具调用层滑动窗口检测
  const doomLoopDetector = new DoomLoopDetector();
  let consecutiveDoomAlerts = 0;
  let slidingWindowDoomDetected = false;
  // P0-C(2026-09-17 立):plan 审批门 — 无可用审批机制时置 true,终止循环并返回 plan_approval_required
  let planApprovalRequired = false;

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

  // ===== WP-2 三道守卫 + WP-3 已读状态:一次运行一个实例 =====
  // G-916940③:兜底默认改引用唯一容量出口 —— 用户没传 contextLimit 就按当前模型取容量;
  // 未知/空模型 id 时出口自身回落 DEFAULT_CONTEXT_CAPACITY,兜底语义("没传就用默认")不变。
  const guardContextLimit = opts.contextLimit ?? getModelContextCapacity(opts.modelId);
  const contextGuards = opts.contextGuards ?? new ContextGuards({ contextLimit: guardContextLimit });
  /** 已读文件跟踪器:压缩后重建提醒的数据源(信封落盘时也由它记账) */
  const readState = new ReadStateTracker();
  readState.collectFromMessages(opts.messages);
  /** 提醒段一旦因压缩点亮就持续注入(压缩掉的已读事实不会自己回来,直到本次运行结束) */
  let contextReminderActive = false;

  // 原生 function calling 三态解析(优先级:显式 opts.providerSupportsTools > settings.nativeFunctionCalling > 'auto')
  // 注意 false 是合法值,不能用 ?? 判断「是否显式传入」,必须用 !== undefined
  const nativeToolsMode =
    opts.providerSupportsTools !== undefined
      ? opts.providerSupportsTools
      : settings.nativeFunctionCalling ?? 'auto';
  // true/'auto' → 携带 tools 下发;false → 完全走 prompt 正则路径;auto 探测失败自动降级
  let nativeToolsEnabled = nativeToolsMode !== false;

  // 生态扩展:本地 provider(Ollama / vLLM openai-compatible)直连采样。
  // resolveProvider 返回 kind 时,runToolLoop 用 streamOpenAiCompatible 替换默认 streamChat 远端路径;
  // 未配置本地 provider 时 kind 为 undefined,零回归。
  const localProvider = resolveProvider(settings);
  /**
   * G-686:本次 run 的 provider 请求准入句柄。
   *
   * **默认关**:`isRequestAdmissionEnabled()` 为 false 时 `requestAdmission` 与 `admissionKey`
   * 都是 undefined(`admissionRunId` 退化成空串,不派生 uuid),
   * 下面两处尝试点(`doSample` 的每一次尝试 / `sampleOnceLocal` 的每一次尝试)走的是
   * 与改动前逐字相同的路径。翻默认开的前置条件写在该模块头注,不在这里重复。
   *
   * run 身份每次 runToolLoop 一个(`randomUUID`):同一进程里并发多条 run 必须能互相区分,
   * 否则"按 run 轮转防饿死"会退化成"按 uuid 轮转"而永远只有一个桶。
   * 桶键 `${provider}/${model}`:本地 provider 用它的 kind,远端用 'remote'。
   */
  const requestAdmission: RequestAdmission | undefined = isRequestAdmissionEnabled()
    ? getRequestAdmission()
    : undefined;
  const admissionRunId = requestAdmission ? randomUUID() : '';
  const admissionKey = requestAdmission
    ? admissionBucketKey(localProvider.kind ?? 'remote', opts.modelId)
    : undefined;
  /** tool 结果消息的 tool_call_id 队列(与 OpenAI 协议对齐,按流内 tool_calls 顺序消费) */
  const pendingToolCallIds: string[] = [];

  /** 把内部消息列表映射为 OpenAI 兼容消息(role 'tool' 补 tool_call_id) */
  function toOpenAiMessages(
    msgs: Array<{ role: string; content: string }>,
  ): ChatCompletionMessage[] {
    return msgs.map((m) => {
      const role = m.role as ChatCompletionMessage['role'];
      if (role === 'tool') {
        return {
          role,
          content: m.content,
          tool_call_id: pendingToolCallIds.shift() ?? '',
        };
      }
      return { role, content: m.content };
    });
  }

  // ── 流式期工具登记账本(见 ../stream-tool-ledger.ts)──────────────────
  // 每轮一条流一个账本。登记发生在 tool-call-start 到达的**当下**,不等流结束;
  // 满足准入线的只读调用当场提前发起执行,主执行路径再经 runOnce 复用同一个
  // promise —— 所以"提前跑"只会少等,绝不会多跑一次。
  // 辅助函数定义在循环外:收尾(finalizeLedger)必须在所有退出路径
  // (换册 / break / 被 catch 的异常)都跑得动,放循环体内它出不了作用域。
  /**
   * 提前执行的准入线(四条同时成立):
   * 1. 非 plan 待批 / 非 gathering 写阻断 —— 否则等于绕过 Plan Mode 的安全闸;
   * 2. 工具已注册且 dangerLevel === 'read' —— 有副作用的一律等主路径;
   * 3. 权限判定不落在 deny/ask —— 需要确认的必须回主路径走确认;
   * 4. 未挂 plugins —— preToolCall 钩子可能改写参数,提前跑就绕过了它。
   * 已知取舍:第 4 条让带插件的会话拿不到提前执行收益,这是有意的保守。
   */
  const mayDispatchEarly = (toolName: string): boolean => {
    if (opts.signal?.aborted) return false;
    if (opts.planFirst && !opts.planApproved) return false;
    if (opts.planMachine?.isWriteBlocked()) return false;
    if (opts.plugins) return false;
    const tool = getTool(toolName);
    if (!tool || tool.dangerLevel !== 'read') return false;
    const mode = opts.ctx.permissionMode ?? 'default';
    return checkPermission(toolName, opts.ctx.permissions, mode, tool.dangerLevel, undefined, tool.nameAliases) === 'allow';
  };
  /**
   * 提前发起一次只读执行;抛错原样上送,由账本记成 ok=false。
   * 同步返回 promise(不包 async)—— 时序敏感测试对微任务跳数敏感,包装层会
   * 平白多推节拍,让"登记即起跑"在断言里慢一拍。
   */
  const dispatchEarlyTool =
    (name: string, args: Record<string, unknown>) =>
    (): Promise<unknown> =>
      executeToolCall({ name, arguments: args }, opts.ctx);
  const newLedger = (): StreamToolLedger =>
    new StreamToolLedger({
      // G-633:turn 用回合起点 reserve 出的进程级唯一号,不再用会话内迭代计数 ——
      // 并发回合各自从 1 数起会复用同一 turnId,落盘的快照/审计事实就无法归轮。
      turn: reservedTurnNumber,
      // streamId 带预留号前缀:跨流日志/对账一眼能定位是哪个回合发的流(uuid 仍保证唯一)
      streamId: `t${reservedTurnNumber}-${randomUUID()}`,
      mayRunEarly: mayDispatchEarly,
    });
  let ledger = newLedger();
  let ledgerFinalized = false;
  /**
   * 收尾当前账本并交付快照。幂等 —— 换册前、每轮尾、循环退出后都可放心调。
   * end_of_stream 的真实时机是**本轮所有调用都已派发/裁决之后**:在派发之前
   * 收尾会把"待主路径执行"的条目误判成 stranded,快照也会谎报它们没跑过。
   */
  const finalizeLedger = (): void => {
    if (ledgerFinalized) return;
    ledgerFinalized = true;
    const stranded = ledger.markEndOfStream();
    if (stranded.length > 0) {
      process.stderr.write(
        chalk.yellow(
          `[tool-ledger] ${formatLedgerSummary(ledger.snapshot())} stranded=${stranded.map((e) => e.toolName).join(',')}\n`,
        ),
      );
    }
    // 空账本不发工件:没有调用的轮次不需要对账,回调不该为它制造噪音
    if (ledger.size > 0) {
      const snap = ledger.snapshot();
      // 两条独立出口:外部回调是 REPL/恢复对账接缝(可选);审计上报是
      // 生产写入源(86A)—— 它不依赖外部回调是否被传入,否则"接线"又会被
      // 下一个没传 opts 的入口静默旁路。
      opts.onToolLedgerSnapshot?.(snap);
      void reportToolLedgerSnapshotToAudit(snap);
    }
  };
  /** 换一条新流 = 先收尾旧册(已提前发起的执行不得没有记录),再开新册 */
  const installFreshLedger = (): void => {
    finalizeLedger();
    ledger = newLedger();
    ledgerFinalized = false;
  };

  /**
   * WP-8③ 采集面:goal 校验只认"本轮真跑过什么"。这里存的是工具调用与结果,
   * **不含**模型自述 —— 自述只能当对照,不构成证据(§8 禁止模型自评 yes)。
   */
  const goalCallRecords: GoalToolCallRecord[] = [];

  /**
   * §8 第 4 步续跑所需的三个状态:本轮结论、连续未过计数、收口标志。
   * `verification` 在这里声明而不是在循环尾部声明,是因为校验现在发生在**循环内的
   * end_turn 位**(未过要回灌续跑);循环尾部那段只兜"根本没走到 end_turn 校验位"的路径。
   */
  let verification: GoalVerification | null = null;
  let goalConsecutiveFailures = 0;
  let goalBlocked = false;
  let goalDeliverUnverified = false;

  /**
   * G-425(2026-10-07 拍板)输出截断有界续写的三个状态位:
   * - outputTokenContinuationCount:当前恢复段已用续写次数(正常步归零,≤3 次,判据在
   *   ./agent-output-continuation.ts,与上游 turn-output-token-continuation.ts 同形);
   * - pendingOutputContinuationPrompt:待下发的续写补丁。**只进下一轮的 requestMessages
   *   (每轮从 opts.messages 重建的局部视图),绝不 push 进 opts.messages** —— 这是
   *   "续写 prompt 排除出持久历史"的承载方式:--resume / 会话落库(saveSession 只收
   *   messages)/ 压缩历史里结构性不存在这条补丁;
   * - lastFinishReason:最后一次成功响应的结束原因,终局随 RunToolLoopResult 透传给端上。
   */
  let outputTokenContinuationCount = 0;
  let pendingOutputContinuationPrompt: { role: 'user'; content: string } | null = null;
  let lastFinishReason: string | undefined;

  try {
    for (let i = 0; i < opts.maxIterations; i++) {
      iterations = i + 1;
      // G-633 回合起点预留号:先 reserve 再落盘 —— 本轮的账本登记/快照/审计上报
      // 都归属这个进程级唯一号;换流(supersede/超限重读)沿用同一号(粒度是回合)。
      reservedTurnNumber = reserveTurnNumber();
      await opts.onIteration?.(iterations, opts.maxIterations);

      // P2-4 agent-lifecycle:turnStart hook(每轮开始触发,粒度细于 sessionStart)
      runHook('turnStart', {
        workspacePath: opts.ctx.workspacePath,
        sessionId: opts.sessionId,
        turnNumber: iterations,
        maxTurns: opts.maxIterations,
      }, { signal: opts.signal });

      // P0-2 Interject:本轮 LLM 调用前 drain,处理上一轮工具执行期间用户输入的 interjection
      // 让 LLM 本轮看到 tool_result + user interjection,自然响应
      drainAndAppendInterjections();

      // 默认 128K:与 @ihui/api-client DEFAULT_CONTEXT_CAPACITY 跨端一致,旧值 8000 会在 ~7k token 就触发 88% 自动压缩
      const guarded = await contextGuards.compactIfNeeded(
        opts.messages,
        iterations,
        opts.compactContext
          ? (msgs, gctx) => Promise.resolve(opts.compactContext!(msgs as ChatMessage[], gctx))
          : (msgs, gctx) =>
              decideCompaction(msgs as ChatMessage[], settings, {
                contextLimit: guardContextLimit,
                modelId: opts.modelId,
                sessionId: opts.sessionId,
                lastActivityAtMs: gctx.lastActivityAtMs,
              }),
      );
      if (guarded.userDiagnostic) {
        // 熔断后不再自动压缩,但**必须**让用户知道为什么不动了(静默停止会被当成卡死)
        process.stderr.write(chalk.yellow(`[context-guard] ${guarded.userDiagnostic}\n`));
        opts.onContextDiagnostic?.(guarded.userDiagnostic);
      }
      // 本轮真正下发的消息:压缩后的结果 + (压缩过则)重建的"最近已读文件"提醒段
      let requestMessages = guarded.messages;
      const readStateReminder = contextReminderActive || guarded.compressed ? readState.buildReminder() : null;
      if (readStateReminder) {
        contextReminderActive = true;
        requestMessages = [...requestMessages, { role: 'user' as const, content: readStateReminder }];
      }
      // G-425:上一轮被截断 ⇒ 续写补丁作为最后一条 user 消息进**本轮下发视图**(排在
      // read-state 提醒之后,保证"接着说"是模型看到的最后一条指令)。下发后立即清空:
      // 补丁只服务一次请求;若本次续写又被截断,决策点会再放一份新的进来。
      if (pendingOutputContinuationPrompt !== null) {
        requestMessages = [...requestMessages, pendingOutputContinuationPrompt];
        pendingOutputContinuationPrompt = null;
      }

      let iterationText = '';
      let iterError = false;

      // 原生 function calling:携带 tools schema 下发 + 收集 SSE tool-call 事件
      // auto 模式下 nativeToolsEnabled 探测失败会被置 false,后续迭代永久降级 prompt 模式
      let nativeToolEvents: ParsedToolCall[] = [];
      const useNativeTools = nativeToolsEnabled && listTools().length > 0;
      const nativeExtraBody = useNativeTools ? { tools: toolsToProviderSchema(listTools()) } : undefined;

      // 每轮一条流:换册前先收尾旧册(finalizeLedger 幂等 —— 上一轮尾已收尾则此处为 no-op;
      // 走过 continue 早退路径的旧册则在此交账,已提前发起的执行不得没有记录)。
      installFreshLedger();

      const doSample = (withTools: boolean) =>
        sampleWithRetry(
          {
            modelId: opts.modelId,
            messages: requestMessages as ChatMessage[],
            signal: opts.signal,
            // WP-2 守卫一的取数口:provider 回来的 usage 是真值复测唯一的权威基准,
            // 估算(BPE)与实发量可能差数千 token,只按估算判"压没压下去"会误判成功。
            onUsage: (u) => {
              contextGuards.recordProviderUsage({ promptTokens: u.promptTokens, totalTokens: u.totalTokens });
            },
            onDelta: (delta) => {
              iterationText += delta;
              inFlightStreamText = iterationText; // G-634 取消结算观测口实时同步
              void opts.onDelta?.(delta);
            },
            // 推理过程增量透传:未传 onReasoning 时零开销(opts.onReasoning 为 undefined 则不开 onReasoning)
            ...(opts.onReasoning
              ? { onReasoning: (delta: string) => { void opts.onReasoning?.(delta); } }
              : {}),
            // 执行计划快照透传(plan_updated):REPL 借此驱动实时任务状态行
            ...(opts.onPlanUpdate ? { onPlanUpdate: opts.onPlanUpdate } : {}),
        ...(opts.onInjectionApplied ? { onInjectionApplied: opts.onInjectionApplied } : {}),
        ...(opts.onRetryScheduled ? { onRetryScheduled: opts.onRetryScheduled } : {}),
        ...(opts.onCitations ? { onCitations: opts.onCitations } : {}),
        ...(opts.onSteer ? { onSteer: opts.onSteer } : {}),
        ...(opts.onBudget ? { onBudget: opts.onBudget } : {}),
        ...(opts.onPartialDone ? { onPartialDone: opts.onPartialDone } : {}),
        // D19 终端实时输出增量透传(terminal_delta):REPL 借此把命令 stdout/stderr 逐行打进终端
        ...(opts.onTerminalDelta ? { onTerminalDelta: opts.onTerminalDelta } : {}),
        // D151 命令等待键盘输入透传(terminal_interaction):REPL 借此在终端交代"命令在等你敲一行"
        ...(opts.onTerminalInteraction ? { onTerminalInteraction: opts.onTerminalInteraction } : {}),
            sampler: opts.sampler,
            // G-686 准入(未启用时整块展开为空 ⇒ 与改动前逐字同行为)
            ...(requestAdmission && admissionKey
              ? { admission: requestAdmission, admissionRunId, admissionKey }
              : {}),
            ...(withTools && nativeExtraBody ? { extraBody: nativeExtraBody } : {}),
            ...(withTools
              ? {
                  onToolCallEvent: (event: { type: string; toolCallId: string; toolName: string; args?: Record<string, unknown> }) => {
                    if (event.type === 'tool-call-start') {
                      const args = event.args ?? {};
                      nativeToolEvents.push({ name: event.toolName, arguments: args });
                      // 流内即时登记:满足准入线的只读调用当场开跑,不等整条流读完
                      ledger.register(
                        { toolCallId: event.toolCallId, toolName: event.toolName, args },
                        dispatchEarlyTool(event.toolName, args),
                      );
                    }
                  },
                }
              : {}),
          },
          (attempt, errMsg, severity, delayMs) => {
            const formatted = formatSSEError(new Error(errMsg));
            process.stderr.write(
              chalk.yellow(`[retry] 第 ${attempt}/${SAMPLER_MAX_RETRIES} 次重试(${severity})${delayMs}ms 后: ${formatted.message}\n`),
            );
          },
        );

      // 本地 provider(Ollama/vLLM)单次采样:错误语义与 sampleWithRetry 对齐(不抛出,返回 { error })
      const sampleOnceLocal = async (withTools: boolean): Promise<{ error?: string; finishReason?: string }> => {
        // G-686:本地直连也是"对 provider 的一次尝试",同一把闸门;未启用时 ticket 恒 undefined。
        let localTicket: AdmissionTicket | undefined;
        if (requestAdmission && admissionKey) {
          try {
            localTicket = await requestAdmission.acquire(admissionRunId, admissionKey, {
              signal: opts.signal,
            });
          } catch (e) {
            if (isAdmissionAbortError(e)) return { error: 'aborted' };
            throw e;
          }
        }
        const result = await streamOpenAiCompatible({
          url: localProvider.chatCompletionsUrl!,
          model: localProvider.model || opts.modelId,
          messages: toOpenAiMessages(requestMessages),
          ...(withTools && nativeExtraBody
            ? { tools: (nativeExtraBody as { tools?: unknown[] }).tools }
            : {}),
          ...(opts.sampler?.temperature !== undefined
            ? { temperature: opts.sampler.temperature }
            : {}),
          ...(opts.sampler?.maxTokens !== undefined
            ? { maxTokens: opts.sampler.maxTokens }
            : {}),
          signal: opts.signal,
          onDelta: (delta) => {
            iterationText += delta;
            inFlightStreamText = iterationText; // G-634 取消结算观测口实时同步
            void opts.onDelta?.(delta);
          },
        });
        /**
         * 输出被长度上限截断**必须让用户看得见**。
         *
         * 立因:`streamOpenAiCompatible` 早就把 `choice.finish_reason` 收进了结果
         * (`provider/local.ts` 的 `acc.finishReason`),但本消费点此前只取 `result.error`,
         * 结束原因被原地丢弃 —— 于是模型话说一半就停,终端看起来与"正常说完"逐字相同,
         * 用户把残缺回复当成完整回复(本仓"静默变短等于伪造完整性"同一条禁令,
         * 见本文件 [doom-loop] pattern 超长那处的写法)。
         *
         * 口径:只认 `finishReason === 'length'`(provider 明示"因长度上限而停")。
         * `stop` / `tool_calls` / 上游根本没发 三档**一律不喊**,所以本提示不会误报;
         * 远端 `streamChat` 那一侧今天拿不到这个字段(内部 SSE 契约不携带 stop/length 原因),
         * 属 ai-service 契约那一格,不在本票射程。
         *
         * 形态选择:沿用本文件既有同类提示(`[context-guard]` / `[native-fc]` / `[doom-loop]`)
         * 的 stderr + chalk 一档,不新增 SSE 事件、不改 local.ts 的解析语义;措辞走
         * `cli.truncatedByLength` 词表(五语言)—— 这一族的界面措辞在本端已收进语言包
         * (与 `cli.steerApplied` / `cli.citationSources` 同形),不在此写死中文。
         */
        if (result.finishReason === 'length') {
          process.stderr.write(chalk.yellow(`[truncated] ${t('cli.truncatedByLength')}\n`));
        }
        for (const tc of result.toolCalls) {
          nativeToolEvents.push({ name: tc.name, arguments: tc.arguments });
          pendingToolCallIds.push(tc.id);
          // 本地 provider 的 tool_calls 在流读完才拿到:登记仍要做(账本是对账依据),
          // 但提前执行没有意义,所以不传 run。
          ledger.register({ toolCallId: tc.id, toolName: tc.name, args: tc.arguments });
        }
        /**
         * G-686 结算。
         *
         * `retryable: false` 是**如实登记而不是判据**:`provider/local.ts` 的失败面只有一个
         * `error: string`(HTTP 状态被拼进文案 `请求失败（${resp.status}）`),没有结构化
         * status/severity 可喂 —— 按本仓"不得拿错误文本决定分支"的禁令,这里不做文案解析,
         * 于是本地 provider 的失败一律落 'ended'(只归还名额、不喂限流信号)。
         * ⇒ **Ollama/vLLM 这一侧今天只有"限并发"生效,"减 cap"那一半不生效**,已登记为未覆盖格。
         */
        localTicket?.settleFromInput({ ok: !result.error, retryable: false });
        // G-425:结束原因必须随采样结果上交 —— 本地 provider 面唯一拿得到 finish_reason
        // 的出口,截断续写的判据与 result.finishReason 透传都从这里取数。
        return result.error ? { error: result.error, finishReason: result.finishReason } : { finishReason: result.finishReason };
      };

      const sampleOnce = localProvider.kind
        ? (withTools: boolean) => sampleOnceLocal(withTools)
        : (withTools: boolean) => doSample(withTools);

      let samplerResult = await sampleOnce(useNativeTools);

      // auto 探测降级:provider 拒绝 tools("not supported")→ 本轮降级 prompt 模式重试,后续不再携带 tools
      if (samplerResult.error && useNativeTools && isToolsUnsupportedError(samplerResult.error)) {
        nativeToolsEnabled = false;
        iterationText = '';
        nativeToolEvents = [];
        // 重读同一条逻辑流:旧账本先收尾交账再作废(否则上一趟的登记会被误判成 stranded,
        // 而已提前发起的执行会随旧册一起"执行过但账本无记录")
        installFreshLedger();
        process.stderr.write(chalk.dim('[native-fc] provider 不支持原生 tools,降级为 prompt 模式\n'));
        samplerResult = await sampleOnce(false);
      }

      // WP-2 守卫三装车:连请求本身都被拒(prompt-too-long)时,按**完整 round 边界**
      // 整组丢弃最老轮次后重试一次。只改写本轮下发的 requestMessages,
      // 不动 opts.messages(与压缩同构:历史是事实,下发的是裁剪后的视图)。
      if (samplerResult.error && isPromptTooLongErrorMessage(samplerResult.error)) {
        const recovery = recoverAfterOverflow(requestMessages, { contextLimit: guardContextLimit });
        if (recovery.resolved) {
          requestMessages = recovery.messages;
          contextGuards.touchActivity();
          iterationText = '';
          nativeToolEvents = [];
          // 同上一条:重发本轮请求 = 新的一条流,旧账本先收尾(快照照交)再作废
          installFreshLedger();
          process.stderr.write(
            chalk.yellow(
              `[context-guard] 上下文超长:已整组丢弃最老 ${recovery.droppedRounds} 轮后重试(${recovery.beforeTokens}→${recovery.afterTokens} tokens)\n`,
            ),
          );
          samplerResult = await sampleOnce(useNativeTools);
        } else {
          const diagnostic =
            contextGuards.diagnosticMessage ??
            '上下文已超出模型窗口且没有可整组丢弃的历史轮次,请开新会话或改用分块读取(offset/limit)后重试。';
          process.stderr.write(chalk.yellow(`[context-guard] ${diagnostic}\n`));
          opts.onContextDiagnostic?.(diagnostic);
        }
      }

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
            chalk.red(`[doom-loop] 连续 ${STUCK_CONSECUTIVE_THRESHOLD} 次相同错误签名,判定陷入死循环,终止\n`),
          );
          void opts.onError?.(`Doom loop detected: 连续 ${STUCK_CONSECUTIVE_THRESHOLD} 次相同错误`);
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
        }, { signal: opts.signal });
        break;
      }

      // G-425:留档最后一次成功响应的结束原因(终局随 result 透传给端上;远端流拿不到 ⇒ undefined)
      lastFinishReason = samplerResult.finishReason;

      // Token 累计:prompt 从压缩后 messages 估算,completion 从 iterationText 估算
      const iterPromptTokens = estimateMessagesTokens(requestMessages);
      const iterCompletionTokens = estimateTokens(iterationText);
      // WP-2 守卫一装车:压缩过的轮次用 provider 真值复测,不把"摘要生成成功"当"压缩成功"。
      // 未压缩的轮次内部直接返回 null(不给无关请求打分)。
      const reverified = contextGuards.verifyAfterRequest({
        messages: requestMessages,
        ...(typeof guarded.compression?.compressedTokens === 'number'
          ? { tokensAfterCompaction: guarded.compression.compressedTokens }
          : {}),
      });
      if (reverified && !reverified.meetsTarget) {
        console.warn(
          chalk.yellow(
            `  ⚠️ [context-guard] 压缩后仍高于目标线:${reverified.effectiveTokens}/${guardContextLimit}` +
              `(source=${reverified.source},下一轮预测 ${reverified.nextTurnPredictedTokens},` +
              `${reverified.nextTurnWouldTrigger ? '仍会触发压缩' : '预计不再触发'})`,
          ),
        );
      }
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
        inFlightStreamText = ''; // G-634:已落盘的内容移交完毕,结算口清零防重
        break;
      }

      opts.messages.push({ role: 'assistant', content: iterationText });
      assistantText += iterationText;
      inFlightStreamText = ''; // G-634:已落盘的内容移交完毕,结算口清零防重

      // 账本收尾不在这里 —— markEndOfStream 必须发生在**本轮派发/裁决之后**:
      // 在派发前收尾会把"待主路径执行"的条目谎报成 stranded,快照也会谎报没跑过。
      // 单一出口是 finalizeLedger(本轮尾 + 循环退出后各调一次,幂等)。

      // 工具调用提取:原生 SSE tool-call 事件优先,解析不到降级走正则(无 FC 能力模型路径)
      const toolCalls = extractToolCalls(
        nativeToolEvents.length > 0 ? { tool_calls: nativeToolEvents } : undefined,
        iterationText,
      );

      if (toolCalls.length > 0) {
        // G-425:模型给出工具调用 ⇒ turn 正常推进,截断恢复段自然结束,续写预算归零
        // (上游 completeOutputTokenRecovery 同语义)。
        outputTokenContinuationCount = 0;
      }

      if (toolCalls.length === 0) {
        /**
         * G-425(2026-10-07 拍板:抄上游)—— 输出被 max_tokens 截断 ⇒ 有界续写(≤3 次)。
         *
         * 走到这里时部分 assistant 文本已在上文照常落历史/assistantText(上游同语义:
         * partial 照存,用户已流式看到的残句不蒸发)。本步只做续写裁决:
         * - 'continue':续写补丁挂进 pendingOutputContinuationPrompt(下一轮顶端追加到
         *   requestMessages,**不进 opts.messages**),计数 +1 后 continue —— 不走 end_turn
         *   的 goal 校验/interjection 收口,因为"话说一半被上限掐断"不是"模型自宣完成";
         * - 'exhausted':3 次续写预算用尽仍截断,必须喊出来(静默变短=伪造完整性),
         *   并随 result.outputTruncated=true 让端上可判;随后照常走 end_turn 收口;
         * - 'none':本步不是截断(正常 stop / tool_calls / 上游没发),恢复预算归零。
         */
        const continuationDecision = classifyOutputTokenContinuation({
          finishReason: samplerResult.finishReason,
          toolCallCount: 0,
          continuationCount: outputTokenContinuationCount,
        });
        if (continuationDecision === 'continue') {
          outputTokenContinuationCount += 1;
          pendingOutputContinuationPrompt = createOutputTokenContinuationMessage();
          continue;
        }
        if (continuationDecision === 'exhausted') {
          process.stderr.write(chalk.yellow(`[truncated] ${t('cli.truncatedContinuationExhausted')}\n`));
        }
        outputTokenContinuationCount = 0;
        // P0-2 Interject:end_turn 时再 drain 一次,处理 LLM 调用期间用户输入的 interjection
        // 如果有 interjection,不 break,continue 进入下一轮让 LLM 响应
        if (drainAndAppendInterjections()) {
          continue;
        }
        /**
         * AGENTS.md §8 第 3+4 步 —— 交账前的独立校验与续跑判定。
         *
         * 为什么要挪进循环:接线的第一版把校验放在循环**外**,于是"未过"只能一次性地
         * 改写档位,§8 的"连续 N 轮 no → blocked"永远数不到第 2 轮 —— 计数方没有续跑
         * 这件事可数。放进来之后:未过且有预算 ⇒ 把未达标项作为一条反馈回灌,循环继续干活;
         * 连续未过到达上限 ⇒ 收口 goal_blocked;没预算 ⇒ 按未达标交账(绝不当 pass)。
         */
        if (opts.goalCriteria && opts.goalCriteria.length > 0) {
          verification = await runGoalVerification({
            goal: opts.goal ?? '',
            criteria: opts.goalCriteria,
            calls: goalCallRecords,
            executorClaim: assistantText,
            executorModel: opts.modelId,
            requestVerification: opts.requestGoalVerification,
          });
          if (verification) {
            await opts.onGoalVerification?.(verification);
            const decision = decideGoalContinuation({
              verification,
              consecutiveFailures: goalConsecutiveFailures,
              iterationsRemaining: opts.maxIterations - iterations,
            });
            goalConsecutiveFailures = decision.consecutiveFailures;
            verification = decision.verification;
            // 这一路是 hook/审计流水,刻意用 ASCII 键值形态:结论的人话版本由命令层
            // 经 i18n 出口打印(§19),此处只求"任何抓日志的人都能机器判读档位"。
            runHook('notification', {
              workspacePath: opts.ctx.workspacePath,
              sessionId: opts.sessionId,
              notificationText:
                `goal-verification status=${decision.verification.goal_status} ` +
                `action=${decision.action} ` +
                `consecutive_failures=${decision.consecutiveFailures}/${decision.maxConsecutiveFailures} ` +
                `criteria=${decision.verification.criteria.length} ` +
                `reason=${decision.verification.unavailable_reason ?? '-'}`,
            }, { signal: opts.signal });
            if (decision.action === 'continue' && decision.feedback) {
              opts.messages.push({ role: 'user', content: decision.feedback });
              continue;
            }
            if (decision.action === 'blocked') {
              goalBlocked = true;
            } else if (decision.action === 'deliver_unverified') {
              goalDeliverUnverified = true;
            }
          }
        }
        // P0-3 end_turn(LLM 主动结束)时重置连续签名检测器,表示对话正常推进
        signatureDetector.reset();
        // P2-4 agent-lifecycle:turnEnd hook(本轮成功结束 - end_turn)
        runHook('turnEnd', {
          workspacePath: opts.ctx.workspacePath,
          sessionId: opts.sessionId,
          turnNumber: iterations,
        }, { signal: opts.signal });
        break;
      }

      // P0-3 记录 tool_call 签名,检测 doom loop(连续 N 轮相同 tool_call 模式 → 死循环)
      signatureDetector.recordToolCalls(toolCalls);
      if (signatureDetector.isDoomLoop()) {
        signatureDoomDetected = true;
        process.stderr.write(
          chalk.red(`[doom-loop] 连续 ${STUCK_CONSECUTIVE_THRESHOLD} 轮相同的 tool_call 模式,判定陷入死循环,终止\n`),
        );
        void opts.onError?.(`Doom loop detected: 连续 ${STUCK_CONSECUTIVE_THRESHOLD} 轮相同的 tool_call 模式`);
        break;
      }

      // Plan Mode 强制阻断:planFirst 开启且未批准时,要求 LLM 先输出 plan 块再执行工具
      // P0-C(2026-09-17 立):审批门修复 — LLM 输出 plan 块后不再自动批准。
      // 原实现"LLM 输出 plan 块即自动置 planApproved=true"使 PlanMachine 的
      // approved===true 强校验形同虚设(机器自己批准自己),/plan approve 命令也被绕过。
      // 新审批来源优先级:
      //   1. autoApprovePlan===true 或 permissionMode==='bypassPermissions'(显式 auto,危险)
      //   2. onPlanApproval 回调(REPL 交互确认 / ACP 转发 IDE 审批)
      //   3. 都没有 → fail-fast:stopReason='plan_approval_required',提示 --auto-approve-plan
      // 用户拒绝(回调返回 false)→ 注入拒绝消息要求 LLM 重新规划(与 /plan reject 语义一致)
      if (opts.planFirst && !opts.planApproved && toolCalls.length > 0) {
        const planBlock = parsePlanBlock(iterationText);
        if (planBlock) {
          const autoApproved =
            opts.autoApprovePlan === true || opts.ctx.permissionMode === 'bypassPermissions';
          let approved = false;
          if (autoApproved) {
            approved = true;
          } else if (opts.onPlanApproval) {
            approved = await opts.onPlanApproval(planBlock);
          } else {
            // 非交互无回调且未显式 auto:安全优先,不放行
            approved = false;
            planApprovalRequired = true;
            void opts.onError?.(
              'Plan approval required: LLM 已提出 plan,但无审批机制可用。' +
                '请使用 --auto-approve-plan 显式开启自动批准,或在 REPL/ACP 交互模式下审批后重试。',
            );
            break;
          }
          if (approved) {
            // 用户(或显式 auto 模式)批准,本迭代跳过工具执行,下轮开始执行
            opts.planApproved = true;
            // PlanMachine 联动:gathering → executing(解除写入硬阻断)
            // canTransition 守门:若 PlanMachine 已在 executing/done 等状态则跳过(避免抛错)
            if (opts.planMachine?.canTransition('gather_complete')) {
              opts.planMachine.transition('gather_complete', { approved: true });
            }
            opts.messages.push({
              role: 'user',
              content: 'Plan 已记录,请按计划逐步执行工具。每完成一步简要说明进度。',
            });
          } else {
            // 用户拒绝当前 plan:注入拒绝消息,要求 LLM 重新规划(不执行任何工具)
            opts.messages.push({
              role: 'user',
              content: '用户拒绝了该 plan,请重新规划任务步骤(输出 ```plan 代码块),不要执行工具。',
            });
          }
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
      // V3#54(2026-09-28):升级决策(报警首轮反思+跳过执行,连续第 N 轮报警终止)
      // 上提共享层 planDoomAlertResponse —— N 与动作集合的唯一来源在
      // packages/shared/src/agent/doom-loop-detector.ts,Python 等价实现见
      // apps/ai-service/app/core/doom_loop.py(parity 守门 scripts/check-doom-loop-parity.mjs)。
      const doomAlerts: DoomLoopAlert[] = [];
      for (const call of toolCalls) {
        const alert = doomLoopDetector.record(call.name, call.arguments);
        if (alert) doomAlerts.push(alert);
      }
      consecutiveDoomAlerts = doomAlerts.length > 0 ? consecutiveDoomAlerts + 1 : 0;
      if (doomAlerts.length > 0) {
        const alertText = doomAlerts
          .map((a) => `[DOOM_LOOP_ALERT] ${a.message}\n${a.suggestion}`)
          .join('\n\n');
        const doomPlan = planDoomAlertResponse(consecutiveDoomAlerts);
        if (doomPlan.actions.includes('terminate_loop')) {
          slidingWindowDoomDetected = true;
          process.stderr.write(
            chalk.red(`[doom-loop] 连续 ${DOOM_ALERT_ROUNDS_TO_TERMINATE} 轮触发滑动窗口死循环检测,终止\n`),
          );
          void opts.onError?.(`Doom loop detected: ${doomAlerts[0]?.message ?? 'repeated identical tool calls'}`);
          break;
        }
        if (doomPlan.actions.includes('inject_reflection')) {
          // 报警首轮:注入反思提示,跳过本轮工具执行,让 LLM 重新考虑
          opts.messages.push({ role: 'user', content: alertText });
          void opts.onError?.(alertText);
          // L1-4(2026-07-25 立):fire-and-forget 沉淀失败模式到 procedural memory
          // 让 agent 未来调用工具前能 recall 到这条反模式,规避相同陷阱(对标 Hermes Agent 反思沉淀)
          void persistDoomLoopProcedural(opts, doomAlerts).catch((err) => {
            process.stderr.write(
              chalk.yellow(`[doom-loop] procedural 记忆沉淀失败(非阻塞): ${err}\n`),
            );
          });
        }
        if (doomPlan.actions.includes('skip_tool_execution')) continue;
      }

      const resultParts: string[] = [];
      // P0-1 Tool parallelism:先按顺序触发 onToolCall,再用 Promise.all 并行执行,最后按顺序处理结果
      // 单工具时 Promise.all 退化为串行,无额外开销,UI 体验与原串行实现一致
      for (const call of toolCalls) {
        await opts.onToolCall?.(call.name, call.arguments);
        // D113(2026-09-27):文件写类工具在**执行之前**把"将要写入的内容"按服务端的
        // tool-delta 帧契约发一遍(派生唯一出口 tools/file-edit-preview.ts,算法与服务端
        // 同语义、同 400 行/32KB/10 帧预算)。时序与 llm.py 一致:发帧在派发执行之前,
        // 所以权限确认弹窗打开时用户已经看得见改动走向。
        // 非写类工具 / 派生不出文本 / 空 id 一律 0 帧(与三端"空 toolCallId 丢弃"同一条纪律)。
        if (opts.onToolDeltaFrames) {
          const previewEvents = buildFileEditPreviewEvents(
            `cli-preview-${randomUUID()}`,
            call.name,
            call.arguments,
          );
          if (previewEvents.length > 0) await opts.onToolDeltaFrames(previewEvents);
        }
        if (call.name === 'dispatch_subagent') {
          const subId = String(call.arguments.subagentId ?? call.arguments.task ?? '').slice(0, 80);
          const subType = String(call.arguments.persona ?? 'general');
          runHook('subagentStart', {
            workspacePath: opts.ctx.workspacePath,
            sessionId: opts.sessionId,
            subagentId: subId,
            subagentType: subType,
          }, { signal: opts.signal });
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
          const decision = checkPermission(call.name, opts.ctx.permissions, mode, dangerLevel, undefined, tool?.nameAliases);
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
          // 经账本发起执行:流式期已提前跑起来的,这里复用同一个 promise(绝不重复执行);
          // 匹配按 (工具名+参数指纹) 而非下标 —— 上游解析器丢条目时下标会整体错位一格。
          const ledgerEntry = ledger.matchForCall(call.name, call.arguments);
          const result = ledgerEntry
            ? (await ledger.runOnce(ledgerEntry, () => executeToolCall(call, opts.ctx))).value
            : await executeToolCall(call, opts.ctx);
          if (call.name === 'dispatch_subagent') {
            const subId = String(call.arguments.subagentId ?? call.arguments.task ?? '').slice(0, 80);
            runHook('subagentStop', {
              workspacePath: opts.ctx.workspacePath,
              sessionId: opts.sessionId,
              subagentId: subId,
              reason: result.success ? 'completed' : 'failed',
            }, { signal: opts.signal });
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
          failureStreak.record(call.name, true);
        } else {
          const outcome = failureStreak.record(call.name, false);
          if (outcome.changeStrategy) {
            resultParts.push(
              injectReminderSection(
                'reminder_tool_failure',
                frameSystemReminder(
                  'tool_failure_reflection',
                  `工具 ${call.name} 已连续失败 ${outcome.streak} 次。请反思:参数是否正确?是否应该换一种工具或方案?当前失败原因:${result.error ?? '未知'}`,
                ),
              ),
            );
          }
        }
        await opts.onToolResult?.(call.name, result.success, result.output);
        // WP-8③ 采集面:goal 校验只认"本轮真跑过什么"。这里记的是**调用与结果**,
        // 模型的自述(final_response)不进这一列 —— §8 禁止执行者自证完成。
        goalCallRecords.push({
          id: `e${goalCallRecords.length + 1}`,
          toolName: call.name,
          args: call.arguments,
          ok: result.success,
          output: result.output,
        });
        // Plugin hooks 入口:postToolCall(若 plugins 存在)
        await runPluginHooks(opts.plugins, 'postToolCall', {
          toolName: call.name,
          args: call.arguments,
          result,
        });
        // WP-3 预算信封:超限结果**不得整段进上下文** —— 落盘到项目内会话产物目录,
        // 这里只回灌"路径 + 前 K 字符预览 + 已截断说明"的信封(已信封的结果幂等跳过)。
        // 预算优先取工具**声明的**契约结果档(A13 / ToolContractMount),没有才落回登记表。
        const budgeted = envelopeToolResult({
          call,
          result,
          workspacePath: opts.ctx.workspacePath,
          sessionId: opts.sessionId,
          turn: iterations,
          tracker: readState,
          resultBudget: getTool(call.name)?.contract?.resultBudget,
        });
        resultParts.push(
          formatToolResult(call, { ...result, output: neutralizeBoundaries(budgeted.output) }),
        );
      }

      // P1-2 Reminders:工具结果后自动注入系统提醒(context budget / iteration progress)
      // 灵感来源:参考行业 Agent 框架的 reminders 设计,让 LLM 被动接收关键状态信息
      // 默认分母引用唯一容量出口 getModelContextCapacity(opts.modelId)(G-916940④;旧写死值 8000 会在 ~7k token 就触发 88% 自动压缩)
      const reminders = generateReminders({
        iterations,
        maxIterations: opts.maxIterations,
        totalPromptTokens,
        totalCompletionTokens,
        contextLimit: opts.contextLimit ?? getModelContextCapacity(opts.modelId),
        injected: reminderInjected,
      });
      for (const r of reminders) {
        resultParts.push(r);
      }

      // P2-1 fsnotify:把最近 60s 文件变更事件注入 user 消息(让 LLM 感知外部编辑)
      if (opts.fsEventSource) {
        const fsContext = neutralizeBoundaries(
          formatFsEventsForPrompt(opts.fsEventSource.getRecentEvents(60_000)),
        );
        if (fsContext) {
          resultParts.push(fsContext);
        }
      }

      opts.messages.push({ role: 'user', content: resultParts.join('\n\n') });
      // 本轮有真实产出(工具结果已进历史)→ 重置空闲计时。reclaim 的空闲触发以此为准,
      // 不接这一步就等于永远没有 lastActivityAtMs 可传(守卫二/回收触发都会失真)。
      contextGuards.touchActivity();
      // end_of_stream 的真实时机在这里:本轮调用已全部派发/裁决,此刻仍是
      // registered 的条目才是"声明过却没走到执行"。快照在此交账(幂等)。
      finalizeLedger();

      // P2-4 agent-lifecycle:turnEnd hook(本轮成功结束 - 工具调用执行完毕)
      runHook('turnEnd', {
        workspacePath: opts.ctx.workspacePath,
        sessionId: opts.sessionId,
        turnNumber: iterations,
      }, { signal: opts.signal });
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
      }, { signal: opts.signal });
      await opts.onError?.(msg);
    }
  }

  // 断流/异常/预算/plan 审批等所有 break 出口都走到这里再交账。断流恰恰是最需要
  // 对账的时刻 —— 账本没交出去,恢复端就无从判断哪些调用已经真发出去了。
  // (本轮尾已收尾的账本会被幂等标志直接放过,这里只兜"没收尾就退出"的路径。)
  finalizeLedger();

  // G-634(2026-09-29)取消结算出口:取消打断的是"正在流的这一轮",流中已收到
  // 的部分回答此前随 abort 一起整段蒸发(既不进 messages 也不进 assistantText)。
  // 取消路径与正常完成同走结算:已有内容先落进 messages/assistantText,下游
  // --resume / 会话持久化自然带出;终态由 stopReason='cancelled' 承载。内容为空
  // (一个 delta 都没收到)时不落空消息;已整轮落盘的内容在入账处已清零,绝不重记。
  if (opts.signal?.aborted && inFlightStreamText) {
    const settlement = buildCancelledStreamSettlement(inFlightStreamText);
    opts.messages.push({ role: 'assistant', content: settlement.content });
    assistantText += settlement.content;
    inFlightStreamText = '';
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
  } else if (planApprovalRequired) {
    // P0-C:plan 已提出但无审批机制(非交互、无回调、未显式 auto)— 需用户介入,非错误
    stopReason = 'plan_approval_required';
  } else if (goalBlocked) {
    // §8 第 4 步:连续未过到达上限 → 生命周期收口。排在 max_iterations 之前,
    // 因为"验了三次都不过"比"这一轮恰好用完了轮次"更准确地描述了发生了什么。
    stopReason = STOP_GOAL_BLOCKED;
  } else if (goalDeliverUnverified) {
    // 未过但已无预算续跑:按未达标交账,不得退化成 end_turn,也不得记成 blocked
    stopReason = applyGoalVerificationToStopReason('end_turn', verification);
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

  /**
   * WP-8③ —— goal 模式的独立校验轮。
   *
   * 只有 `end_turn`(循环自宣完成)才有"完成"这件事可校验;轮次耗尽 / 预算耗尽 / 错误 /
   * 取消根本不跑校验 —— 更绝不允许把"没跑成"写成"达成了"(校验不可达时
   * `runGoalVerification` 返回 undetermined,同样把档改掉)。
   *
   * `verification === null` 是续跑改造后的必要条件:校验已在循环内的 end_turn 位跑过
   * 并据此决定过续跑/收口,这里再跑一次就是同一次交账问两遍(两遍之间服务端还可能给
   * 出不同结论)。剩下的这一路只兜"没经过循环内校验位就交账"的形态。
   */
  if (stopReason === 'end_turn' && verification === null && opts.goalCriteria && opts.goalCriteria.length > 0) {
    verification = await runGoalVerification({
      goal: opts.goal ?? '',
      criteria: opts.goalCriteria,
      calls: goalCallRecords,
      executorClaim: assistantText,
      executorModel: opts.modelId,
      requestVerification: opts.requestGoalVerification,
    });
    if (verification) {
      await opts.onGoalVerification?.(verification);
      // 这一路是 hook/审计流水,刻意用 ASCII 键值形态:结论的**人话版本**由命令层
      // 经 i18n 出口打印(§19),此处只求"任何抓日志的人都能机器判读档位"。
      runHook('notification', {
        ...hookCtx,
        notificationText:
          `goal-verification status=${verification.goal_status} ` +
          `treat_as_complete=${verification.treat_as_complete} ` +
          `criteria=${verification.criteria.length} ` +
          `reason=${verification.unavailable_reason ?? '-'}`,
      }, { signal: opts.signal });
    }
    stopReason = applyGoalVerificationToStopReason(stopReason, verification);
  }

  if (stopReason === 'error') {
    runHook('stopFailure', { ...hookCtx, error: lastErrorMessage || 'unknown error' }, { signal: opts.signal });
    runHook('notification', { ...hookCtx, notificationText: `Agent 因错误终止: ${lastErrorMessage || 'unknown'}` }, { signal: opts.signal });
  } else if (stopReason === 'doom_loop') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 因死循环检测终止 (连续 2 轮重复工具调用)` }, { signal: opts.signal });
  } else if (stopReason === 'max_iterations') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 达到最大迭代数 ${opts.maxIterations}` }, { signal: opts.signal });
  } else if (stopReason === 'budget_limited') {
    runHook('notification', { ...hookCtx, notificationText: `Agent 因预算上限停止 (cost >= ${opts.maxCostUsd ?? 'N/A'})` }, { signal: opts.signal });
  } else if (stopReason === 'plan_approval_required') {
    // P0-C:plan 待审批通知 — 提示用户用 --auto-approve-plan 或交互模式审批
    runHook('notification', { ...hookCtx, notificationText: 'Agent 因 plan 待用户审批而暂停 (plan_approval_required)' }, { signal: opts.signal });
  }
  runHook('stop', hookCtx, { signal: opts.signal });

  // P2-4 agent-lifecycle:turnComplete hook(agent 完成所有轮次,与 stop 配对,携带最终 stopReason)
  runHook('turnComplete', {
    ...hookCtx,
    totalTurns: iterations,
    stopReason,
  }, { signal: opts.signal });

  // G-425:finish_reason 透传。最后一次响应被输出上限截断 ⇒ 端上可据此提示"回复不完整"
  // (stderr 的 [truncated] 行是人读面,这两个字段是机器面)。远端流拿不到结束原因 ⇒
  // 两个字段都不带,消费方按"未知"处理,不得读成"未截断"。
  return {
    stopReason,
    assistantText,
    iterations,
    usage,
    verification,
    branchGeneration,
    ...(lastFinishReason !== undefined
      ? { finishReason: lastFinishReason, outputTruncated: isOutputTokenLimitFinishReason(lastFinishReason) }
      : {}),
  };
}

// ==================== Agent 模式(非交互式) ====================

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  const hooksConfig = loadHooks();
  const sessionHookCtx = {
    workspacePath: opts.workspacePath,
    sessionId: opts.session?.id,
  };
  const startResult = runSessionStartHooks(hooksConfig, sessionHookCtx, opts.signal);
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
    // 会话级旁路事实随 ctx 下发,工具层披露可追溯(L7905 收口);放行策略走唯一出口
    allowDangerous: opts.allowDangerous,
    // 策略收口到唯一出口(danger-gate):flag 开即放行、无人可问即 denied(fail-closed)。
    // 原有提示文案逐字保留在调用方(onDecision),行为与迁移前逐路径等价。
    confirmDangerous: buildAgentDangerGate({
      allowDangerous: opts.allowDangerous === true,
      silent,
      sessionId: opts.session?.id,
    }),
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

  // P3-2 Telemetry:默认开启(2026-08-31 改,补全 CLI 埋点盲区)。
  // endpoint 未配置时默认上报到项目自身 /api/analytics/track(与 web/mobile 同一张表)。
  // 用户可在设置里 telemetry.enabled = false 显式关闭;关闭时 track 调用 no-op(零回归)。
  // offline 模式下跳过(不初始化、不上报)。
  if (codegraphSettings.telemetry?.enabled === true && codegraphSettings.offline !== true) {
    const defaultEndpoint = `${(codegraphSettings.apiUrl || 'http://localhost:8802').replace(/\/+$/, '')}/api/analytics/track`
    initTelemetry({
      enabled: true,
      endpoint: codegraphSettings.telemetry.endpoint?.trim() || defaultEndpoint,
      batchSize: codegraphSettings.telemetry.batchSize,
      flushIntervalMs: codegraphSettings.telemetry.flushIntervalMs,
    });
    trackTelemetry('session_start', {
      modelId: opts.modelId,
      workspacePath: opts.workspacePath,
      hasSession: !!opts.session,
    });
    if (!silent) {
      console.info(chalk.dim(`  📊 telemetry 已启用(上报到 ${codegraphSettings.telemetry.endpoint?.trim() || defaultEndpoint})`));
    }
  }

  /**
   * P1-5 统一 emit:按 outputFormat 切换序列化方式,流式输出到 stdout。
   * G-814408:出闸判据是本出口唯一放行点 —— 结果行封笔后,普通事件行出不了闸
   * (停写,不是去重;闸的语义见 headless-format.ts 的 createHeadlessEventGate)。
   */
  const headlessEventGate = createHeadlessEventGate();
  const emit = (event: HeadlessEvent): void => {
    if (!headlessEventGate.canEmit(event)) return;
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
  }, { signal: opts.signal });

  // P3-2 Telemetry:记录 session 起始时间(用于 finally 块中计算 durationMs)
  const sessionStartTime = Date.now();
  let sessionResult: AgentResult | undefined;

  // W10 非交互 markdown 渲染:text 模式(非 json/markdown/yaml 结构化输出)复用 REPL 的
  // 流式 markdown 渲染器,`ihui "任务"` 输出不再是无高亮裸文本。结构化模式保持原样。
  const mdStream = isStructured ? null : createMarkdownRenderer();
  let pendingMdLine = '';
  const pushMdDelta = (delta: string): void => {
    if (!mdStream) return;
    pendingMdLine += delta;
    let nl: number;
    while ((nl = pendingMdLine.indexOf('\n')) !== -1) {
      const line = pendingMdLine.slice(0, nl);
      pendingMdLine = pendingMdLine.slice(nl + 1);
      for (const r of mdStream.pushLine(line)) console.info(r);
    }
  };
  const flushMdStream = (): void => {
    if (!mdStream) return;
    if (pendingMdLine) {
      for (const r of mdStream.pushLine(pendingMdLine)) console.info(r);
      pendingMdLine = '';
    }
    for (const r of mdStream.flush()) console.info(r);
  };

  // D113(2026-09-27)headless 面的流中预览配对/清场(与 agent-core 共用同一份桥,
  // 派生算法仍在唯一出口 tools/file-edit-preview.ts)。
  const d113Bridge = createToolDeltaBridge();

  try {
    const result = await runToolLoop({
      modelId: opts.modelId,
      messages,
      ctx,
      maxIterations: opts.maxIterations,
      signal: opts.signal,
      sessionId: opts.session?.id,
      planFirst: opts.planFirst,
      // P0-C:plan 审批门 — 透传显式 auto 标志(headless 非交互无回调时由 runToolLoop fail-fast)
      autoApprovePlan: opts.autoApprovePlan,
      // WP-8③:goal 模式 —— 指标声明 + 校验注入点 + 结论出口(全部可选,不声明即零差异)
      goalCriteria: opts.goalCriteria,
      goal: opts.goal,
      requestGoalVerification: opts.requestGoalVerification,
      onGoalVerification: opts.onGoalVerification,
      sampler: opts.sampler,
      plugins: pluginRegistry,
      fsEventSource,
      onDelta: (delta) => {
        if (isStructured) emit({ type: 'message_delta', text: delta });
        else {
          if (spinner?.isSpinning) spinner.stop();
          pushMdDelta(delta);
        }
      },
      onToolCall: (name, args) => {
        d113Bridge.noteToolCall(name);
        if (isStructured) emit({ type: 'tool_call', name, arguments: args });
        else {
          if (spinner?.isSpinning) spinner.stop();
          console.info(chalk.cyan(`\n  🔧 ${name} ${JSON.stringify(args)}`));
        }
      },
      // D113 三面接线之 headless:流中预览**只走结构化事件出口**(逐帧一条单行 JSON +
      // 一条同 id 的 clear),不往 stdout 打人类排版文本 —— json/markdown/yaml 消费方
      // 都在按行 parse,插一行排版文本就把整条流弄废(本任务口径④)。
      // 文本模式因此刻意不出预览:它没有"更新同一 id"的撤回通道,发出去的一行排版文本
      // 会在终态之后继续挂在流里,正是"把预览读成结果"那一型。要看流中预览请用
      // `--output-format json`(机器面)或 REPL(人读面已按同一出口接好)。
      onToolDeltaFrames: (events) => {
        if (!isStructured) return;
        for (const fact of d113Bridge.onFrames(events)) {
          emit({
            type: 'tool_delta',
            name: fact.toolName,
            toolCallId: fact.event.toolCallId,
            seq: fact.event.seq,
            partialText: fact.event.partialText,
            ...(fact.event.truncated === true ? { truncated: true } : {}),
          });
        }
      },
      onToolResult: (name, success, output) => {
        if (isStructured) {
          // 终态先清预览再落结果:消费方按 toolCallId 撤下流中预览之后才看到最终 diff,
          // 顺序反过来会出现"结果与预览同屏"(repl.ts 同一纪律,靠 settle 而不是再追加一条)。
          const settled = d113Bridge.settle(name);
          if (settled) {
            emit({ type: 'tool_delta_clear', name: settled.toolName, toolCallId: settled.toolCallId });
          }
          emit({ type: 'tool_result', name, success, output });
        } else {
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
        // 流中断/工具报错:尚未落终态的预览一并作废并发 clear —— 留在消费方账上的
        // "将要写入什么"若无对应 result 交代,会被读成"已经写成这样了"(repl.ts 同一条禁令)。
        for (const stale of d113Bridge.abort()) {
          if (isStructured) {
            emit({ type: 'tool_delta_clear', name: stale.toolName, toolCallId: stale.toolCallId });
          }
        }
        if (isStructured) emit({ type: 'error', message });
        else {
          if (spinner?.isSpinning) spinner.stop();
          console.error(chalk.red(`\n❌ ${message}`));
        }
      },
    });
    sessionResult = result;

    if (spinner?.isSpinning) spinner.stop();
    // W10 flush 残留 markdown(未闭合代码块/无换行残片)
    flushMdStream();

    if (!isStructured) {
      // WP-8③:自宣完成不再等于"完成"。校验未过 / 判不了时,终端上那句"✨ 完成"
      // 必须是假的 —— 它会把一次未达标的运行读成成功。
      const v = result.verification;
      if (v && result.stopReason !== 'end_turn') {
        const failed = v.criteria.filter((c) => c.verdict !== 'met');
        console.info(chalk.red(`\n❌ ${t('cli.goalNotAchieved')}`));
        console.info(
          chalk.dim(
            `   status=${v.goal_status} treat_as_complete=${v.treat_as_complete} ` +
              `independent_request=${v.independent_request_made} ` +
              `criteria=${v.criteria.length}/${failed.length ? `unmet ${failed.length}` : 'all met'}`,
          ),
        );
        if (v.unavailable_reason) console.info(chalk.yellow(`   ${v.unavailable_reason}`));
        for (const c of failed.slice(0, 10)) {
          console.info(chalk.dim(`   - [${c.verdict}/${c.basis}] ${c.criterion_id}: ${c.reason}`));
        }
      } else {
        console.info(chalk.green(`\n✨ 完成 (${result.iterations} 轮迭代, ${result.stopReason})`));
      }
      const u = result.usage;
      const cost = u.estimatedCostUsd > 0 ? `$${u.estimatedCostUsd.toFixed(4)}` : 'plan 套餐';
      console.info(chalk.dim(`📊 tokens: ${u.totalTokens} (prompt ${u.promptTokens} + completion ${u.completionTokens}) — ${cost}\n`));
    }
    // P3-1 Mermaid 渲染:feature flag 启用时,LLM 输出包含 ```mermaid 块则自动渲染为图片
    // 失败不阻塞主流程(只打印警告)
    // G-814408:本块在结果行**之前**执行 —— 渲染结果若要出门,必须赶在结果行前
    // ("结果行之后绝不能再冒出事件行",见下方 detachEvents)。
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

    // G-814408:结果行必须最后写 —— 先停事件订阅(detachEvents),再落结果行
    // (上游 headless-workflow.ts:329"结果行之后绝不能再冒出事件行"的结构事实)。
    // 停笔之后闸只放结果行 —— 这是停写,不是去重;事件流单一写者判据见 event-stream-ownership.ts。
    headlessEventGate.detachEvents();
    emit({
      type: 'complete',
      stopReason: result.stopReason,
      iterations: result.iterations,
      usage: result.usage,
      // G-425:finish_reason 透传给端上(可选字段,远端流拿不到时不带,缺省=未知)
      ...(result.finishReason !== undefined
        ? { finishReason: result.finishReason, outputTruncated: result.outputTruncated === true }
        : {}),
    });

    return result;
  } finally {
    // W10 异常路径也 flush 残留 markdown(重复调用幂等:pending 清空后 flush 返回空)
    flushMdStream();
    runSessionEndHooks(hooksConfig, sessionHookCtx, opts.signal);
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
        // 2026-09-14:ChatMessage.id 为必填(W16 消息树地基);本文件 messages 为本地
        // 极简形态(无 id),落库时补生成。role 断言:'tool' 由 repairMessages 在入 LLM
        // 请求前按 VALID_ROLES 清理,此处保持既有落库行为不变。
        .map((m) => ({
          id: randomUUID(),
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));
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
    // P0-C:plan 待审批属于"部分完成/需用户介入",与 max_iterations 同级(exit code 2),非硬错误
    case 'plan_approval_required':
      return 2;
    case 'cancelled':
      return 130;
    // WP-8③:独立校验没过 = 事先声明的验收条件没满足。对脚本/CI 而言这就是失败,
    // 不得因为"循环自己说完成了"而退 0。
    case 'verification_not_achieved':
    case 'verification_undetermined':
    // §8 第 4 步:连续未过收口(goal_blocked)。同样是失败 —— 目标没达成,
    // 只是这一次连"继续试"的资格都用完了;退 0 会让 CI 把未完成的 goal 记成通过。
    case STOP_GOAL_BLOCKED:
      return 1;
    default:
      return 1;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
