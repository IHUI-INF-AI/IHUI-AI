// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP (Agent Client Protocol) server — 让 IHUI CLI 可被 Zed/VSCode+ACP 扩展/Cursor 等编辑器作为 agent 后端启动。
 *
 * 协议规范:https://agentclientprotocol.com
 * SDK:@agentclientprotocol/sdk
 *
 * 启动方式:`ihui acp` (默认 stdio NDJSON 传输)
 *
 * P0-2 扩展方法(参考行业 Agent 框架的 `x.ai/*` 私有扩展命名空间,使用 SDK 自定义方法三参数重载):
 *   - `x.ai/session/repair`:自愈当前会话历史(清理非法 role / 空消息 / 连续重复 / interjection 残留)
 *   - `x.ai/rewind/points`:列出可回退的 prompt 点(user 消息位置)
 *   - `x.ai/rewind/execute`:回退 history 到指定 prompt 索引(支持 RewindMode + force)
 *
 * 危险工具(默认拒绝):Editor 内无交互确认通道,需在 `~/.ihui/settings.json` 设置
 * `allowDangerous: true` 或启动时加 `--allow-dangerous` flag(自负风险)。
 */

import { Readable, Writable } from 'node:stream';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as acp from '@agentclientprotocol/sdk';
import { setBaseUrl, type ToolDeltaEvent } from '@ihui/api-client';
import { registerCliTokenProvider } from '../lib/auth-refresh.js';
import {
  createToolDeltaPreviewStore,
  pickToolDeltaPreviewText,
  type ToolDeltaPreviewStore,
} from '../tools/file-edit-preview.js';
import {
  createSession,
  saveSession,
  loadSession,
  deleteSession,
  listSessions,
  repairSessionHistoryReport,
  listRewindPoints,
  rewindHistory,
  type Session,
  type ChatMessage,
  type RepairSessionResponse,
  type RewindRequest,
  type RewindResponse,
  type RewindPoint,
} from '../commands/session.js';
import { planAcpReplay, type AcpReplayOutcome } from './session-replay.js';
import {
  applyTurnTransition,
  createTurnRecord,
  isWakeable,
  needsAttention,
  type TurnRecord,
  type TurnRejectionCode,
  type TurnTransition,
} from './turn-lifecycle.js';
import {
  applyGoalTransition,
  createGoal,
  listWakeableTurns,
  loadGoals,
  loadSessionRuntime,
  nextTurnOrdinal,
  upsertGoal,
  upsertTurn,
  type GoalRecord,
  type GoalStatus,
  type SessionRuntime,
} from './turn-store.js';
import { setupAgentTools, runToolLoop, type ToolContext } from '../commands/agent.js';
// G-639:取消出口逐未完成的 tool_call 合成各自的 cancelled 帧(不悬空、不整体一帧了事)
import { synthesizeCancelledToolFrames } from '../stream-cancel-frames.js';
import { createAuditedDangerGate } from '../tools/danger-gate-audit.js';
import { PlanMachine } from '../plan/machine.js';
import { CheckpointManager, type CheckpointDiffEntry } from '../checkpoints/index.js';
import { PlanBuildCoordinator, type PlanBuildMode } from '../modes/plan-build.js';
import { runHook, surfaceHookOutcome } from '../hooks/index.js';
import {
  listManagedClients,
  getManagedClient,
  reconnectManagedClient,
} from '../tools/mcp-runtime.js';

/**
 * `session/resume` 未给 `last` 时的默认分页粒度。
 * 取 50 与 ACP 客户端常见的编辑区滚动粒度对齐;`session/load` 不走这个值
 * (load 恒全量,理由见 loadSession 内的注释)。
 */
const DEFAULT_REPLAY_PAGE_SIZE = 50;

/** `x.ai/checkpoint/*` 的对外形状(刻意只暴露摘要,不含 files 明细)。 */
interface CheckpointSummary {
  id: string;
  createdAt: string;
  reason: string;
  fileCount: number;
  skippedCount: number;
}

/** 审批选项入参(kind 收敛为 ACP PermissionOptionKind 子集) */
export interface PermissionOptionInput {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

/**
 * D5(2026-09-18)工具级审批统一通道:经 ACP `session/request_permission` 向编辑器
 * 请求审批,plan 审批与危险工具审批共用同一实现(此前 confirmDangerous 静默返回 false,
 * IDE 内危险操作无任何弹窗)。
 *
 * 返回选中的 optionId;编辑器不支持/超时/取消返回 null(调用方决定降级语义——
 * 安全默认一律视为拒绝)。
 */
/** F-067:审批请求超时 —— SDK 侧 pending 只在收到响应/连接关闭时结算,编辑器不回就永久挂起 */
export const PERMISSION_TIMEOUT_MS = 60_000;

/** F-067:给 promise 套超时;到点返回 null(调用方按"编辑器不支持/未响应"降级为拒绝)。 */
function withPermissionTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T | null>;
}

export async function requestPermissionFromEditor(
  cx: acp.AgentContext,
  sessionId: string,
  input: {
    toolCallId: string;
    kind: acp.ToolKind;
    title: string;
    contentText?: string;
    options: PermissionOptionInput[];
  },
): Promise<string | null> {
  try {
    const response: acp.RequestPermissionResponse | null = await withPermissionTimeout(
      cx.request(
        acp.methods.client.session.requestPermission,
        {
          sessionId,
          toolCall: {
            toolCallId: input.toolCallId,
            kind: input.kind,
            status: 'pending' as const,
            title: input.title,
            ...(input.contentText
              ? {
                  content: [
                    { type: 'content' as const, content: { type: 'text' as const, text: input.contentText } },
                  ],
                }
              : {}),
          },
          options: input.options,
        },
      ),
      PERMISSION_TIMEOUT_MS,
    );
    const outcome = response?.outcome;
    return outcome?.outcome === 'selected' ? outcome.optionId : null;
  } catch {
    return null;
  }
}

/** 审批终态:批准 / 显式拒绝 / 取消(含编辑器不支持、请求异常、用户未应答) */
export type ApprovalDecision = 'approved' | 'rejected' | 'cancelled';

/**
 * 审批卡终态收口(格①):审批卡的 tool_call 以 status:'pending' 发出
 * (见 requestPermissionFromEditor 内 `status: 'pending'`),而 dangerous-* 与
 * plan-approval-* 两类审批 toolCallId 此前在全仓没有任何 tool_call_update
 * (普通工具走 onToolResult 的队列配对完成 in_progress→completed/failed 状态流),
 * 于是用户批/拒之后 IDE 面板上那张卡永远显示"等待中"。
 *
 * 本函数在审批得到结果后按**真实决定**落终态:
 *   - approved → completed
 *   - rejected / cancelled(未收到回复、编辑器不支持、请求抛错)→ failed
 * 即刻意不把"没收到回复"写成 completed。通知失败吞掉:与本文件其余 session/update
 * 发射点同一约定 —— IDE 渲染失败不得中断 agent 执行。
 */
export async function emitApprovalTerminalUpdate(
  cx: acp.AgentContext,
  sessionId: string,
  toolCallId: string,
  decision: ApprovalDecision,
): Promise<void> {
  const approved = decision === 'approved';
  try {
    await cx.notify(acp.methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: approved ? ('completed' as const) : ('failed' as const),
        content: [
          {
            type: 'content' as const,
            content: { type: 'text' as const, text: `Approval ${decision}.` },
          },
        ],
        rawOutput: { approval: decision },
      },
    });
  } catch {
    // IDE 渲染失败不中断 agent
  }
}

/**
 * G-639(2026-09-29)取消出口的逐卡终态:对每个未完成(已建卡未出结果)的
 * tool_call 合成各自的 cancelled 帧,不得悬空、也不得一帧整体 cancelled 了事。
 * 合成在 stream-cancel-frames.ts(协议无关,两帧判据在那里钉);这里的映射口径:
 * ACP ToolCallStatus 无 'cancelled' 档 → status:'failed' + rawOutput.cancelled=true
 * + 文本注明(与审批卡 cancelled → failed 的既有映射同形,"回合被取消"是真实
 * 事实,不是伪造终态)。通知失败吞掉:与本文件其余 session/update 发射点同一约定。
 */
async function emitCancelledToolCallFrames(
  cx: acp.AgentContext,
  sessionId: string,
  openToolCallIds: readonly string[],
): Promise<void> {
  const frames = synthesizeCancelledToolFrames(
    openToolCallIds.map((toolCallId) => ({ toolCallId })),
  );
  for (const frame of frames) {
    try {
      await cx.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: frame.toolCallId,
          status: 'failed' as const,
          content: [
            {
              type: 'content' as const,
              content: { type: 'text' as const, text: 'cancelled before tool result arrived' },
            },
          ],
          rawOutput: { cancelled: true },
        },
      });
    } catch {
      // IDE 渲染失败不中断 agent
    }
  }
}

/**
 * D113(2026-09-27)三面接线之 ACP 面 —— 流中 diff 预览落到 ACP 已有的
 * `tool_call_update` 形态,**不新增协议方法、不伪造终态**。
 *
 * 与 headless / agent-core 两面的三点不同(所以它不走 `createToolDeltaBridge`):
 *  ① ACP 有**自己的 toolCallId 空间**(`tool_call` 由本端 randomUUID 建卡),
 *     本地派生帧带的 `cli-preview-*` id 对 IDE 毫无意义 ⇒ 必须**重划**到卡 id 上;
 *  ② ACP 的终态本来就是 `tool_call_update` 覆盖同一 id(见 onToolResult),
 *     所以"预览不得与结果同屏"由**协议自己的覆盖语义**保证,不需要额外 clear 帧;
 *  ③ 帧与卡的配对不能按名(headless 那种),只能按"最近一次 onToolCall 建的那张卡"
 *     —— runToolLoop 对每个 call 先 onToolCall 再同步发帧,故帧必属于队尾那张卡;
 *     配不上卡(队列为空 / id 空) ⇒ **不出帧**,不伪造归属。
 *
 * 派生算法/取键顺序/截断预算仍只有 `tools/file-edit-preview.ts` 一份(唯一出口),
 * 本面只搬运,绝不 `JSON.stringify(args)` 凑一段文本当预览。
 */
export const ACP_TOOL_DELTA_PREVIEW_MARKER = '[D113 流中预览 · 非终态结果]';

/** 一帧要落到 ACP 卡上的预览(已按卡 id 重划、已读"当前累积值") */
export interface AcpToolDeltaPreviewPlan {
  /** 按 seq 收敛追加后的累计预览文本(本帧即当前全量) */
  text: string;
  /** 帧序(来自 ToolDeltaEvent,原样带上以便追溯) */
  seq: number;
  /** 该批预览被预算截断(400 行 / 32KB / 10 帧) */
  truncated: boolean;
  /** 本地派生帧的原始 toolCallId(仅追溯用,与 IDE 卡无对应关系) */
  sourceToolCallId: string;
}

/**
 * 纯判据:把一批本地派生帧落到"这张卡还开着吗"这个闸门上。
 * 返回 `null` = 本次不发(无卡 id / 0 帧 / 卡已落终态 ⇒ 第三条就是
 * "终态必须清预览":关闭的卡绝不再被预览覆盖,而 clear 由 store 完成)。
 * 抽成纯函数是为了让这条规则被行为测试直接问,而不是靠读渲染代码里的字符串。
 */
export function planAcpPreviewUpdate(input: {
  store: ToolDeltaPreviewStore;
  events: readonly ToolDeltaEvent[];
  /** 本批帧所属的 ACP 卡 id;空串 = 配不上卡 ⇒ 一律不发 */
  acpToolCallId: string;
  /** 该卡是否仍开着(未出队 ⇒ 未落终态) */
  open: boolean;
}): AcpToolDeltaPreviewPlan | null {
  const { store, events, acpToolCallId, open } = input;
  if (!acpToolCallId || events.length === 0) return null;
  // 重划到卡 id:同一批增量帧按 seq 收敛追加(重传/乱序按 seq 幂等丢弃)
  for (const event of events) {
    store.apply({ ...event, toolCallId: acpToolCallId });
  }
  const last = events[events.length - 1];
  if (!last) return null;
  const text = pickToolDeltaPreviewText({
    running: open,
    preview: store.get(acpToolCallId),
  });
  if (text === null) return null;
  return {
    text,
    seq: last.seq,
    truncated: last.truncated === true,
    sourceToolCallId: last.toolCallId,
  };
}

/**
 * 把预览作为**非终态** `tool_call_update` 发给编辑器:
 * status 恒为 `in_progress`(刻意不写 completed/failed —— 那是伪造终态),
 * content 前缀带 ACP_TOOL_DELTA_PREVIEW_MARKER 使"这是流中预览"在文本面也辨认得出,
 * rawOutput.toolDeltaPreview 给机器消费方一条明确的结构字段。
 * 通知失败吞掉:与本文件其余 session/update 发射点同一约定(IDE 渲染失败不得中断 agent)。
 */
export async function emitAcpToolDeltaPreview(
  cx: acp.AgentContext,
  sessionId: string,
  toolCallId: string,
  plan: AcpToolDeltaPreviewPlan,
  title?: string,
): Promise<void> {
  if (!toolCallId) return;
  try {
    await cx.notify(acp.methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        ...(title ? { title } : {}),
        status: 'in_progress' as const,
        content: [
          {
            type: 'content' as const,
            content: {
              type: 'text' as const,
              text: `${ACP_TOOL_DELTA_PREVIEW_MARKER}\n${plan.text}${plan.truncated ? '\n…(预览已超预算截断)' : ''}`,
            },
          },
        ],
        rawOutput: {
          toolDeltaPreview: {
            seq: plan.seq,
            truncated: plan.truncated,
            sourceToolCallId: plan.sourceToolCallId,
          },
        },
      },
    });
  } catch {
    // IDE 渲染失败不中断 agent
  }
}

/**
 * G-662(2026-09-29)迟到句柄出口 —— 关停信号**不等**卡住的 init Promise,init 之后
 * 才建成的句柄必须走 disposeLate 且失败打 warn。
 *
 * 与 apps/api/src/utils/shutdown-phases.ts 的 createLateDisposeGate 同判据(cli 不依赖
 * @ihui/api,两包各自实现,各侧行为测试钉住同一规格:信号不等人、迟到句柄必被回收、
 * 回收失败必 warn)。
 */

/** 一个可回收的迟到句柄(close 抛错 = dispose 失败) */
export interface LateInitHandle {
  name: string;
  close: () => unknown | Promise<unknown>;
}

/** 逐个回收迟到句柄;单个失败打 warn 不中断(关停路径不得因回收失败而卡死)。 */
export async function disposeLateHandles(label: string, handles: LateInitHandle[]): Promise<void> {
  for (const h of handles) {
    try {
      await h.close();
    } catch (e) {
      console.warn(
        `[${label}] 迟到句柄 ${h.name} dispose 失败:${e instanceof Error && e.message ? e.message : String(e)}`,
      );
    }
  }
}

/** init 产物里"会建出句柄"的面(结构化最小类型,测试可注入替身) */
export interface LateDisposableInit {
  /** setupAgentTools 建成的插件注册体(runTeardowns 自带失败清单) */
  pluginRegistry?: { runTeardowns: () => Promise<string[]> } | null;
}

/**
 * init 之后才建成的句柄 → 迟到句柄清单的**唯一映射出口**。
 * 今日 init 产物里可回收面 = pluginRegistry;MCP managed clients 是进程级注册表,
 * 由 mcp-runtime 自身 reclaim 出口负责 —— 会话级取消不得清它(多会话共享)。
 */
export async function disposeLateInitHandles(
  label: string,
  init: LateDisposableInit,
): Promise<void> {
  const handles: LateInitHandle[] = [];
  if (init.pluginRegistry) {
    handles.push({
      name: 'pluginRegistry',
      close: async () => {
        const failed = await init.pluginRegistry!.runTeardowns();
        if (failed.length > 0) {
          throw new Error(`teardown 失败插件:${failed.join(', ')}`);
        }
      },
    });
  }
  await disposeLateHandles(label, handles);
}

export type InitRaceOutcome<T> = { kind: 'ready'; value: T } | { kind: 'aborted' };

/**
 * abort 胜出路径的迟到回收接线:init 在后台继续,resolve 后句柄走 disposeLate。
 * 单独导出以便测试直接构造同一编排(abort 早于 create resolve ⇒ disposeLate 被调用),
 * prompt() 与测试共用这一条链,不复制编排。
 */
export function attachLateDispose<T extends LateDisposableInit>(
  init: Promise<T>,
  label = 'acp-init',
): void {
  void init
    .then((r) => disposeLateInitHandles(label, r))
    .catch(() => { /* init 自身失败:没有句柄出生,无需回收 */ });
}

/**
 * init 竞态:关停信号(abort)与 init Promise 谁先到。
 * - abort 先(含调用时已 aborted)⇒ `{kind:'aborted'}` —— 调用方**不得**再等 init;
 * - init 先 resolve ⇒ `{kind:'ready'}`;init 先 reject ⇒ 原样上抛(与旧裸 await 同语义)。
 *
 * 竞态中落败的 init 稍后 reject 会无人接住:这里挂空 catch 防 unhandledRejection
 * (与 shutdown-phases runSinglePhase 同款教训)。
 */
export function raceInitAgainstAbort<T>(
  init: Promise<T>,
  signal: AbortSignal,
): Promise<InitRaceOutcome<T>> {
  if (signal.aborted) {
    init.catch(() => {});
    return Promise.resolve({ kind: 'aborted' });
  }
  return new Promise<InitRaceOutcome<T>>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      init.catch(() => {});
      resolve({ kind: 'aborted' });
    };
    signal.addEventListener('abort', onAbort, { once: true });
    init.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ kind: 'ready', value });
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
    );
  });
}

export interface AcpServerOptions {
  apiUrl: string;
  apiKey?: string;
  modelId: string;
  maxIterations: number;
  enableMcp?: boolean;
  /** 允许危险工具自动执行(默认拒绝,ACP 无交互确认通道) */
  allowDangerous?: boolean;
  /** 强制 LLM 先输出 plan 块再执行工具 */
  planFirst?: boolean;
  /** P0-C 显式自动批准 plan(危险,默认 false;关闭时经 request_permission 转 IDE 审批) */
  autoApprovePlan?: boolean;
  /** F-066:把 agent 实例交给宿主(进程级 SIGINT/SIGTERM 收口要先 abortAllPrompts) */
  onAgentReady?: (agent: IhuiAcpAgent) => void;
}

interface AcpSessionState {
  session: Session;
  pendingAbort: AbortController | null;
  agentReady: boolean;
  systemPrompt: string | null;
  ctx: ToolContext | null;
  checkpoints: CheckpointManager | null;
  /** P0-C plan 审批门:当前 plan 是否已批准(与 onPlanApproval 回调同步) */
  planApproved: boolean;
  /** P0-C plan 审批门:PlanMachine 实例(planFirst 开启时创建,gathering 期间写入硬阻断) */
  planMachine: PlanMachine | undefined;
  /** ACP 会话模式(plan/build/review);undefined = 未显式设置过 */
  modeId?: PlanBuildMode;
}

/** P0-2 `x.ai/session/repair` 请求参数 */
interface RepairSessionParams {
  sessionId: string;
  /** true=只检测不修改(dry_run) */
  dryRun?: boolean;
}

/** P0-2 `x.ai/rewind/points` 请求参数 */
interface RewindPointsParams {
  sessionId: string;
}

/** P0-2 `x.ai/rewind/execute` 请求参数(扩展 RewindRequest 加 sessionId) */
interface RewindExecuteParams extends RewindRequest {
  sessionId: string;
}

/** P1-6 `x.ai/mcp/listServers` 请求参数(无参数,sessionId 仅用于上下文校验) */
interface McpListServersParams {
  sessionId?: string;
}

/** P1-6 `x.ai/mcp/serverStatus` 请求参数 */
interface McpServerStatusParams {
  sessionId?: string;
  /** MCP server 名称(对应 mcp.json 中 server.name) */
  serverName: string;
}

/** P1-6 `x.ai/mcp/callTool` 请求参数 */
interface McpCallToolParams {
  sessionId?: string;
  /** MCP server 名称 */
  serverName: string;
  /** MCP tool 名称(server 的 tools/list 返回的 name) */
  toolName: string;
  /** tool 参数(JSON object) */
  arguments?: Record<string, unknown>;
}

/** P1-6 `x.ai/mcp/reconnect` 请求参数(O46 拍板 B:命令层手动重连) */
interface McpReconnectParams {
  sessionId?: string;
  /** 要强制重连的 MCP server 名称 */
  serverName: string;
}

/** P1-6 单个 MCP server 状态快照(对齐 ManagedMcpClient.getStatus() 返回值) */
interface McpServerStatus {
  serverName: string;
  alive: boolean;
  dead: boolean;
  consecutiveFailures: number;
  lastPingAt: number;
  connected: boolean;
}

/** P1-6 `x.ai/mcp/listServers` 响应 */
interface McpListServersResponse {
  servers: McpServerStatus[];
}

/** P1-6 `x.ai/mcp/serverStatus` 响应 */
interface McpServerStatusResponse {
  server: McpServerStatus | null;
}

/** P1-6 `x.ai/mcp/callTool` 响应 */
interface McpCallToolResponse {
  success: boolean;
  /** tool 输出(content 数组中的 text 拼接) */
  output: string;
  /** 失败时的错误消息 */
  error?: string;
}

/** `x.ai/mcp/reconnect` 响应(O46 命令层手动重连) */
interface McpReconnectResponse {
  /** 重连后(或重连失败当时)的状态快照;server 未注册时为 null */
  server: McpServerStatus | null;
  success: boolean;
  /** 重连失败时的错误消息(原样回传,不静默吞、不自动 Retry) */
  error?: string;
}

// P1-6 export IhuiAcpAgent(供测试直接实例化,不经过 ACP 协议层调用 MCP 扩展方法)
export class IhuiAcpAgent {
  private readonly opts: AcpServerOptions;
  private readonly sessions = new Map<string, AcpSessionState>();
  /**   * 上一个会话的工作区 —— cwdChanged 的唯一事件源。
   *
   * CLI 单进程从不切换工作目录(third-leg 册的结构断言),编辑器客户端却会以不同
   * `cwd` 反复 `newSession`;两次会话之间工作区真的变了,才是一条 cwdChanged 事实。
   * 首个会话没有"变更前",不派发(没发生的事不许报成事件)。
   */
  private lastWorkspacePath: string | null = null;

  constructor(opts: AcpServerOptions) {
    this.opts = opts;
  }

  async initialize(_params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
      },
    };
  }

  async authenticate(_params: acp.AuthenticateRequest): Promise<acp.AuthenticateResponse> {
    return {};
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    // cwdChanged:与上一个活动会话的工作区比较(路径规范化后逐字比较)。
    // 派发在会话创建之前,钩子看到的是"切了"这一事实本身;非成功终态喊到 stderr。
    if (this.lastWorkspacePath !== null) {
      const from = path.resolve(this.lastWorkspacePath);
      const to = path.resolve(params.cwd);
      if (from !== to) {
        const hookRes = await runHook('cwdChanged', {
          workspacePath: to,
          cwdFrom: from,
          cwdTo: to,
        });
        surfaceHookOutcome('cwdChanged', hookRes);
      }
    }
    this.lastWorkspacePath = params.cwd;
    const session = createSession(params.cwd, this.opts.modelId);
    const checkpoints = new CheckpointManager({
      sessionId: session.id,
      workspacePath: params.cwd,
    });
    const state: AcpSessionState = {
      session,
      pendingAbort: null,
      agentReady: false,
      systemPrompt: null,
      ctx: null,
      checkpoints,
      planApproved: false,
      planMachine: this.opts.planFirst ? new PlanMachine('gathering') : undefined,
    };
    this.sessions.set(session.id, state);
    return { sessionId: session.id };
  }

  async loadSession(
    params: acp.LoadSessionRequest,
    cx: acp.AgentContext,
  ): Promise<acp.LoadSessionResponse> {
    const existing = loadSession(params.sessionId);
    if (!existing) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    const checkpoints = new CheckpointManager({
      sessionId: existing.id,
      workspacePath: existing.workspacePath,
    });
    const state: AcpSessionState = {
      session: existing,
      pendingAbort: null,
      agentReady: false,
      systemPrompt: null,
      ctx: null,
      checkpoints,
      planApproved: false,
      planMachine: this.opts.planFirst ? new PlanMachine('gathering') : undefined,
    };
    this.sessions.set(existing.id, state);

    // session/load 的语义是"把整段历史复原到编辑器",不是"续传"。
    // 共享层的 planDurableSessionReplay 在无游标时返回 skip(即"不回放"),
    // 所以这里显式构造一条覆盖全场的游标:last 取消息总数,不带 before。
    await this.replayHistoryFrames(existing, cx, existing.history.length);
    return {};
  }

  /**   * 把会话历史按游标翻译成 ACP 帧并逐条 notify。
   *
   * 判据全部在 `@ihui/shared` 的 `planDurableSessionReplay`(skip/empty/window/failure);
   * 本方法只负责"构造游标 → 发帧",不再持有第二套分页逻辑。
   *
   * `pageSize` 为 undefined 时表示"全量"(session/load);给数字时表示按页续传
   * (session/resume)。全量也必须带游标 —— 共享层的 no-cursor 语义是 skip。
   */
  private async replayHistoryFrames(
    existing: Session,
    cx: acp.AgentContext,
    pageSize?: number,
  ): Promise<AcpReplayOutcome> {
    const items = existing.history.map((m, i) => ({
      id: `m${i}`,
      kind: m.role === 'user' ? ('user' as const) : m.role === 'assistant' ? ('assistant' as const) : ('other' as const),
    }));
    const messages = existing.history.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content }));
    const last = pageSize ?? Math.max(existing.history.length, 1);
    const outcome = planAcpReplay({
      items,
      messages,
      replayFrom: { type: 'ihui.replay/turn', last },
      title: this.sessionTitle(existing) ?? undefined,
    });
    if (!outcome.ok) return outcome;
    for (const n of outcome.notifications) {
      await cx.notify(acp.methods.client.session.update, {
        sessionId: existing.id,
        update: { sessionUpdate: n.sessionUpdate, content: n.content },
      });
    }
    return outcome;
  }

  async prompt(
    params: acp.PromptRequest,
    cx: acp.AgentContext,
  ): Promise<acp.PromptResponse> {
    const state = this.sessions.get(params.sessionId);
    if (!state) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    if (!state.agentReady) {
      // G-662:cancel() 走既有 pendingAbort 通道,init 期也必须可达(此前 init 是裸
      // await,关停信号会被卡住的 init Promise 拖住)。
      const initAbort = new AbortController();
      state.pendingAbort = initAbort;
      const initPromise = setupAgentTools({
        workspacePath: state.session.workspacePath,
        checkpoints: state.checkpoints ?? undefined,
        enableMcp: this.opts.enableMcp,
        silent: true,
        planFirst: this.opts.planFirst,
        subagentParent: {
          modelId: this.opts.modelId,
          apiUrl: this.opts.apiUrl,
          apiKey: this.opts.apiKey,
          allowDangerous: this.opts.allowDangerous,
        },
        // D5:危险工具审批接入 request_permission(此前静默 false,IDE 内无弹窗)。
        // 策略收口到唯一出口(经带审计的包装器):silent 保持本端零额外输出,
        // 编辑器不支持/取消 → prompt 非 true → denied(安全默认与旧行为逐路径等价)
        // 86H:IDE 弹窗是"真人批准"的主通路,决策必须落审计链;会话取 ACP 的
        // params.sessionId,入参原文仍不上线(那是 86A 的 tool.invoke 行的事)。
        confirmDangerous: createAuditedDangerGate({
          allowDangerous: this.opts.allowDangerous === true,
          silent: true,
          auditSessionId: params.sessionId,
          prompt: async (tool, args) => {
            // 格①:审批 id 提出为变量,得到结果后必须落 tool_call_update 终态,
            // 否则面板上那张卡永远"等待中"(此前全仓无人对 dangerous-* 发更新)。
            const approvalToolCallId = `dangerous-${tool.name}-${Date.now()}`;
            const selected = await requestPermissionFromEditor(cx, params.sessionId, {
              toolCallId: approvalToolCallId,
              kind: 'execute',
              title: `危险操作审批:${tool.name}`,
              contentText: JSON.stringify(args).slice(0, 2000),
              options: [
                { optionId: 'allow', name: '允许本次执行', kind: 'allow_once' },
                { optionId: 'deny', name: '拒绝', kind: 'reject_once' },
              ],
            });
            const approved = selected === 'allow';
            await emitApprovalTerminalUpdate(
              cx,
              params.sessionId,
              approvalToolCallId,
              selected === null ? 'cancelled' : approved ? 'approved' : 'rejected',
            );
            return approved;
          },
        }),
      });
      const outcome = await raceInitAgainstAbort(initPromise, initAbort.signal);
      if (outcome.kind === 'aborted') {
        // 关停信号先到:不等 init(票面"不得等卡住的 init Promise"),立即返回;
        // init 在后台继续,建成后的句柄走 disposeLate(失败 warn)。
        attachLateDispose(initPromise);
        if (state.pendingAbort === initAbort) state.pendingAbort = null;
        return { stopReason: 'cancelled' };
      }
      // 竞态窗:init 与 abort 几乎同时、init 胜出,但信号已 aborted ⇒ 产物已是迟到资源
      if (initAbort.signal.aborted) {
        await disposeLateInitHandles('acp-init', outcome.value);
        if (state.pendingAbort === initAbort) state.pendingAbort = null;
        return { stopReason: 'cancelled' };
      }
      state.systemPrompt = outcome.value.systemPrompt;
      state.ctx = outcome.value.ctx;
      state.agentReady = true;
    }

    state.pendingAbort?.abort();
    const abort = new AbortController();
    state.pendingAbort = abort;

    const userText = extractTextFromPrompt(params.prompt);
    state.session.history.push({ id: randomUUID(), role: 'user', content: userText });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: state.systemPrompt! },
      ...state.session.history.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // D113 三面接线之 ACP:预览按**卡 id** 存(与 headless/agent-core 共用同一个 store 出口),
    // lastAcpCard 记录"最近一次 onToolCall 建的那张卡" —— runToolLoop 对每个 call 先
    // onToolCall 再同步发帧,故本批帧归属它;这不是位置对齐,而是同一派发内的因果事实。
    // 声明在 try **之外**:catch 那一轮也要能清账(见该块第一行)。
    const previewStore = createToolDeltaPreviewStore();
    let lastAcpCard: { id: string; name: string } = { id: '', name: '' };
    // tool_call ↔ tool_call_update 配对队列:onToolCall 入队、onToolResult 出队(FIFO,
    // 因 runToolLoop 先对全部 tool 调 onToolCall 再对全部结果调 onToolResult,顺序一致)。
    // 队列为空(异常 desync)时 onToolResult 跳过转发,宁缺勿假。
    // G-639 起声明在 try **之外**:取消的 catch 出口也要读到"哪些卡未完成"来逐卡发帧。
    const toolCallIdQueue: string[] = [];

    try {
      const result = await runToolLoop({
        modelId: this.opts.modelId,
        messages,
        ctx: state.ctx!,
        maxIterations: this.opts.maxIterations,
        signal: abort.signal,
        // P0-C plan 审批门:planFirst 开启时,LLM 提出 plan 块须经 IDE 审批才能执行工具
        planFirst: this.opts.planFirst,
        planApproved: state.planApproved,
        planMachine: state.planMachine,
        autoApprovePlan: this.opts.autoApprovePlan,
        // P0-C ACP 审批通道:转发 session/request_permission 给编辑器(Zed/VSCode 原生审批 UI)
        onPlanApproval: async (plan) => {
          // 先把 plan 内容作为消息推给客户端展示(审批前用户需要看到 plan 全文)
          await cx.notify(acp.methods.client.session.update, {
            sessionId: params.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: `\n📋 Plan 提案(等待审批):\n${plan.trim()}\n` },
            },
          });
          // D5:审批统一走 requestPermissionFromEditor(plan 与危险工具同一通道)
          // 格①:plan-approval-* 同样必须落终态(批准→completed;拒绝/取消→failed)。
          const approvalToolCallId = `plan-approval-${Date.now()}`;
          const selected = await requestPermissionFromEditor(cx, params.sessionId, {
            toolCallId: approvalToolCallId,
            kind: 'other',
            title: 'Plan 审批(Plan Mode)',
            contentText: plan.trim(),
            options: [
              { optionId: 'approve', name: '批准 Plan 并执行', kind: 'allow_once' },
              { optionId: 'reject', name: '拒绝并重新规划', kind: 'reject_once' },
            ],
          });
          const approved = selected === 'approve';
          await emitApprovalTerminalUpdate(
            cx,
            params.sessionId,
            approvalToolCallId,
            selected === null ? 'cancelled' : approved ? 'approved' : 'rejected',
          );
          if (selected === null) {
            // 编辑器不支持 request_permission 或请求超时/取消:安全降级为拒绝(不崩溃)
            await cx.notify(acp.methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: {
                  type: 'text',
                  text: `\n⚠ Plan 审批请求失败或被取消,默认拒绝。请升级编辑器 ACP 支持或改用 --auto-approve-plan。\n`,
                },
              },
            });
          }
          // 同步会话状态(与 REPL /plan approve|reject 语义一致)
          state.planApproved = approved;
          if (approved) {
            if (state.planMachine?.canTransition('gather_complete')) {
              state.planMachine.transition('gather_complete', { approved: true });
            }
          } else if (state.planMachine) {
            state.planMachine.reset();
            state.planMachine.transition('start');
          }
          return approved;
        },
        onDelta: async (delta) => {
          await cx.notify(acp.methods.client.session.update, {
            sessionId: params.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: delta },
            },
          });
        },
        // 推理过程(reasoning/thinking)透传为 agent_thought_chunk(IDE 思考可视化)。
        // 回调内异常吞掉:IDE 渲染失败不能中断 agent 执行。
        onReasoning: async (delta) => {
          try {
            await cx.notify(acp.methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: 'agent_thought_chunk',
                content: { type: 'text', text: delta },
              },
            });
          } catch {
            // IDE 渲染失败不中断 agent
          }
        },
        // 工具调用开始:发 tool_call(in_progress),并登记 toolCallId 供结果配对。
        onToolCall: async (name, args) => {
          try {
            const toolCallId = randomUUID();
            toolCallIdQueue.push(toolCallId);
            lastAcpCard = { id: toolCallId, name };
            await cx.notify(acp.methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: 'tool_call',
                toolCallId,
                title: name,
                kind: mapToolKind(name),
                status: 'in_progress',
                rawInput: args,
                content: [],
              },
            });
          } catch {
            // IDE 渲染失败不中断 agent
          }
        },
        // D113 三面接线之 ACP:写类工具执行前的流中预览,落到刚建的那张卡上。
        // 配不上卡(建卡失败 / 队列为空 ⇒ 卡已出队落终态)一律**不发帧**,不伪造归属;
        // 终态仍由下面 onToolResult 的 tool_call_update 覆盖同 id,预览因此不会与结果同屏。
        onToolDeltaFrames: async (events) => {
          const plan = planAcpPreviewUpdate({
            store: previewStore,
            events,
            acpToolCallId: lastAcpCard.id,
            open: lastAcpCard.id !== '' && toolCallIdQueue.includes(lastAcpCard.id),
          });
          if (!plan) return;
          await emitAcpToolDeltaPreview(cx, params.sessionId, lastAcpCard.id, plan, lastAcpCard.name);
        },
        // 工具结果:从队列取 toolCallId 配对,发 tool_call_update(completed/failed),
        // 结果文本安全截断(≤8000 字符)。toolCallId 缺失/空串或队列排空时跳过转发。
        onToolResult: async (name, success, output) => {
          try {
            const toolCallId = toolCallIdQueue.shift();
            if (!toolCallId) return;
            // 终态清预览(与 web/RN/小程序"result 到达即清 partialDiff"同一条纪律):
            // 上面的 tool_call_update 会用最终 diff 覆盖同一张卡,故这里清的是本端账,
            // 保证卡落终态后不再被任何后续帧(重放/迟到帧)写回预览。
            previewStore.clear(toolCallId);
            if (lastAcpCard.id === toolCallId) lastAcpCard = { id: '', name: lastAcpCard.name };
            const text =
              output.length > 8000 ? `${output.slice(0, 8000)}…(结果已截断)` : output;
            await cx.notify(acp.methods.client.session.update, {
              sessionId: params.sessionId,
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId,
                title: name,
                status: success ? 'completed' : 'failed',
                content: [{ type: 'content', content: { type: 'text', text } }],
              },
            });
          } catch {
            // IDE 渲染失败不中断 agent
          }
        },
        onError: (err) => {
          throw new Error(typeof err === 'string' ? err : String(err));
        },
      });

      // G-639:取消回合不得只交一帧整体 cancelled —— 已建卡未出结果的 tool_call
      // 逐卡合成各自的 cancelled 终态帧,IDE 面板上的卡不悬空。
      if (result.stopReason === 'cancelled' && toolCallIdQueue.length > 0) {
        await emitCancelledToolCallFrames(cx, params.sessionId, toolCallIdQueue);
        toolCallIdQueue.length = 0;
      }

      if (result.assistantText) {
        state.session.history.push({ id: randomUUID(), role: 'assistant', content: result.assistantText });
      }
      if (result.usage && result.usage.totalTokens > 0) {
        const costStr = result.usage.estimatedCostUsd > 0
          ? `$${result.usage.estimatedCostUsd.toFixed(6)}`
          : 'plan 套餐';
        await cx.notify(acp.methods.client.session.update, {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: `\n\n📊 tokens: ${result.usage.totalTokens} (prompt ${result.usage.promptTokens} + completion ${result.usage.completionTokens}) — ${costStr}`,
            },
          },
        });
      }
      saveSession(state.session);
      return { stopReason: toAcpStopReason(result.stopReason) };
    } catch (err) {
      // D113:流中断/报错 ⇒ 本端预览账全部作废。completed/failed 这类**结果性**
      // 终态依然不写(调用结果此刻确实未知,写 completed/failed 是伪造);但
      // G-639(2026-09-29)起,回合取消这一事实本身要逐卡落终态:未完成的
      // tool_call 各自合成 cancelled 帧(status: failed + rawOutput.cancelled=true,
      // "没跑完"是已知的真话),不再悬空。迟到/重放的帧不得再把预览刷回一张
      // 已经没人负责收尾的卡上(下面先清本端账再发帧)。
      previewStore.clearAll();
      lastAcpCard = { id: '', name: lastAcpCard.name };
      if (abort.signal.aborted) {
        const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
        if (lastAssistant) {
          state.session.history.push({
            id: randomUUID(),
            role: 'assistant',
            content: lastAssistant.content,
          });
          saveSession(state.session);
        }
        // G-639:与正常取消返回路径同口径 —— 逐未完成 tool_call 合成 cancelled 帧
        if (toolCallIdQueue.length > 0) {
          await emitCancelledToolCallFrames(cx, params.sessionId, toolCallIdQueue);
          toolCallIdQueue.length = 0;
        }
        return { stopReason: 'cancelled' };
      }
      throw err;
    } finally {
      if (state.pendingAbort === abort) {
        state.pendingAbort = null;
      }
    }
  }

  cancel(params: acp.CancelNotification): void {
    this.sessions.get(params.sessionId)?.pendingAbort?.abort();
  }

  closeSession?(params: acp.CloseSessionRequest): void {
    // F-066:先中止在飞 prompt 再删会话 —— 只 delete 的话 runToolLoop 继续
    // 生成/落盘,fetch 与定时器还钉着进程,关不干净。
    const state = this.sessions.get(params.sessionId);
    state?.pendingAbort?.abort();
    if (state) state.pendingAbort = null;
    this.sessions.delete(params.sessionId);
  }

  /** F-066:中止全部会话的在飞 prompt(进程级 SIGINT/SIGTERM 收口用)。 */
  abortAllPrompts(): void {
    for (const state of this.sessions.values()) {
      state.pendingAbort?.abort();
      state.pendingAbort = null;
    }
  }

  // ==================== ACP 标准会话生命周期 ====================
  //
  // 背景(REA 取证 E1):ACP SDK 1.3.0 的 `schema.AGENT_METHODS` 定义了
  // session/{new,load,prompt,close,resume,fork,list,delete,set_mode,set_config_option},
  // 而本仓原先只注册了前 4 个。对照程序 WorkBuddy 的 harness 把 resume/fork/list
  // 当作一等能力(`protocol/acp-v2-sdk.js` 的 `session_resume`/`session_fork`/`session_list`)。
  // 缺口不是"能力没有",而是"已有能力没接到标准协议名上":本类已有的
  // listSessions / branchConversationFrom 语义、会话存储、checkpoint 都在,
  // 但编辑器按标准方法名来调时会拿不到。
  //
  // 超越轴:对照程序的 `resume` 只回帧、不回"还剩多少";我方在响应 `_meta` 里
  // 回 `hasMore`/`endCursor`/`total`,客户端不必自己拿 `last` 反推。

  /**   * `session/list` — 列出本机已存会话。
   *
   * 直接复用 `listSessions()`(它已带符号链接越界跳过),不新增第二份目录扫描。
   */
  async listSessions(params: { cwd?: string | null; cursor?: string | null }): Promise<{
    sessions: acp.SessionInfo[];
  }> {
    const all = listSessions();
    // cwd 过滤:规范化后逐字比较。给了不存在的 cwd 不报错、返回空集 ——
    // 编辑器切工作区时问到空目录是常态,报错会让它以为 agent 挂了。
    const want = typeof params.cwd === 'string' && params.cwd.length > 0 ? path.resolve(params.cwd) : null;
    const filtered = want === null ? all : all.filter((s) => path.resolve(s.workspacePath) === want);
    return {
      sessions: filtered.map((s) => ({
        sessionId: s.id,
        cwd: s.workspacePath,
        title: this.sessionTitle(s),
        updatedAt: s.updatedAt,
      })),
    };
  }

  /** 会话标题:取首条 user 消息前 80 字符;没有 user 消息时为 null(不编造)。 */
  private sessionTitle(session: Session): string | null {
    const firstUser = session.history.find((m) => m.role === 'user' && m.content.trim().length > 0);
    if (!firstUser) return null;
    const text = firstUser.content.trim().replace(/\s+/g, ' ');
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  /**   * `session/resume` — 从已存会话续传,并按 `replayFrom` 游标重放帧。
   *
   * 与 `session/load` 的差别:load 恒全量;resume 走共享层游标,只回一页。
   * 游标非法 / 会话不存在 ⇒ 抛错(由 ACP 映射成 invalid params),
   * 不静默降级成"从头全量重放"—— 那会让客户端以为续传成功、实际重复插入历史。
   */
  async resumeSession(
    params: { sessionId: string; replayFrom?: unknown },
    cx: acp.AgentContext,
  ): Promise<{ _meta: { planKind: string; hasNextPage: boolean; endCursor: string | null } }> {
    const existing = loadSession(params.sessionId);
    if (!existing) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    const checkpoints = new CheckpointManager({
      sessionId: existing.id,
      workspacePath: existing.workspacePath,
    });
    this.sessions.set(existing.id, {
      session: existing,
      pendingAbort: null,
      agentReady: false,
      systemPrompt: null,
      ctx: null,
      checkpoints,
      planApproved: false,
      planMachine: this.opts.planFirst ? new PlanMachine('gathering') : undefined,
    });

    // 未给 replayFrom 时补一个"取最后一页"的游标:ACP 的 resume 语义是续传,
    // 而不是"什么都不回"。共享层把 no-cursor 判成 skip(那是它的调用方语义)。
    const replayFrom =
      params.replayFrom === undefined || params.replayFrom === null
        ? { type: 'ihui.replay/turn', last: DEFAULT_REPLAY_PAGE_SIZE }
        : params.replayFrom;

    const items = existing.history.map((m, i) => ({
      id: `m${i}`,
      kind:
        m.role === 'user' ? ('user' as const) : m.role === 'assistant' ? ('assistant' as const) : ('other' as const),
    }));
    const messages = existing.history.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content }));
    const outcome = planAcpReplay({
      items,
      messages,
      replayFrom,
      ...(this.sessionTitle(existing) !== null ? { title: this.sessionTitle(existing)! } : {}),
    });
    if (!outcome.ok) {
      throw new Error(outcome.message);
    }
    for (const n of outcome.notifications) {
      await cx.notify(acp.methods.client.session.update, {
        sessionId: existing.id,
        update: { sessionUpdate: n.sessionUpdate, content: n.content },
      });
    }
    return {
      _meta: {
        planKind: outcome.planKind,
        hasNextPage: outcome.hasNextPage,
        endCursor: outcome.endCursor,
      },
    };
  }

  // ==================== ACP checkpoint 通道 ====================
  //
  // 背景(REA E1):本仓 `Checkpoints` 早已完整(快照/列举/读取/还原/差异/删除 + 损坏隔离
  // + GC),但 `apps/cli/src/acp/server.ts` 里对它的引用只有 `new CheckpointManager(...)`,
  // 从没有一个 onRequest —— 编辑器侧完全看不到检查点。对照程序 WorkBuddy 的 harness 把
  // checkpoint 做成三个一等 RPC(list / read / restore,见其 `checkpoint/rpcs.js`),
  // 且读取响应经 `decodeAgentHarnessCheckpointReadResponse` 严格解码,
  // 解不出就抛 "session storage response has invalid checkpoint read data"。
  //
  // 我方策略:方法名沿用本仓既有 `x.ai/*` 私有命名空间(标准 ACP 没有 checkpoint 方法,
  // 自造 `session/checkpoint/*` 会与将来标准冲突);判据一律不重写,直接调 CheckpointManager。

  /** `x.ai/checkpoint/list` — 列出本会话检查点(纯只读,不动文件)。 */
  async listCheckpoints(params: { sessionId: string }): Promise<{ checkpoints: CheckpointSummary[] }> {
    const mgr = this.requireCheckpointManager(params.sessionId);
    return {
      checkpoints: mgr.list().map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        reason: m.reason,
        fileCount: Object.keys(m.files).length,
        skippedCount: m.skipped?.length ?? 0,
      })),
    };
  }

  /** `x.ai/checkpoint/read` — 读一个检查点的元数据与差异(不还原)。 */
  async readCheckpoint(params: { sessionId: string; checkpointId: string }): Promise<{
    checkpoint: CheckpointSummary;
    diff: CheckpointDiffEntry[];
  }> {
    const mgr = this.requireCheckpointManager(params.sessionId);
    const meta = mgr.get(params.checkpointId);
    // get() 返回 null 表示"确实没有这个检查点";损坏会抛错(不折成"不存在")。
    if (meta === null) {
      throw new Error(`检查点 ${params.checkpointId} 不存在`);
    }
    return {
      checkpoint: {
        id: meta.id,
        createdAt: meta.createdAt,
        reason: meta.reason,
        fileCount: Object.keys(meta.files).length,
        skippedCount: meta.skipped?.length ?? 0,
      },
      diff: mgr.diff(params.checkpointId),
    };
  }

  /**   * `x.ai/checkpoint/restore` — 还原到某个检查点。
   *
   * 返回三档结果(restored / removed / notRestored):`notRestored` 非空时**不是成功**,
   * 调用方必须看它。不用抛错表示"部分未还原"—— 那会让已成功的那部分也看起来没发生。
   */
  async restoreCheckpoint(params: { sessionId: string; checkpointId: string }): Promise<{
    restored: string[];
    removed: string[];
    notRestored: string[];
    complete: boolean;
  }> {
    const mgr = this.requireCheckpointManager(params.sessionId);
    const res = await mgr.restore(params.checkpointId);
    return { ...res, complete: res.notRestored.length === 0 };
  }

  // ==================== ACP 会话模式 / 配置项 ====================
  //
  // 背景(守门 check-acp-method-registration.mjs 实证):SDK 的 AGENT_METHODS 声明了
  // `session/set_mode` 与 `session/set_config_option`,本仓两个都没注册 ——
  // 编辑器切 Plan/Build 模式时拿到的是 -32601,而这是 Agent 最常用的交互之一。
  //
  // 不另造模式枚举:模式语义直接用 `apps/cli/src/modes/plan-build.ts` 的
  // `PlanBuildMode`('plan' | 'build' | 'review'),它带持久化与迁移历史(§0.6 单一真相源)。

  /** `session/set_mode` — 切换会话的 Plan/Build/Review 模式。 */
  async setSessionMode(params: {
    sessionId: string;
    modeId: string;
  }): Promise<{ _meta: { modeId: PlanBuildMode } }> {
    const state = this.requireOrAdoptSession(params.sessionId);
    const mode = params.modeId as PlanBuildMode;
    // 只接受 PlanBuildMode 的三档;别的一律拒绝并点名,不静默降级成 build
    if (mode !== 'plan' && mode !== 'build' && mode !== 'review') {
      throw new Error('session/set_mode 不支持的模式: ' + params.modeId + '(仅 plan / build / review)');
    }
    const coordinator = new PlanBuildCoordinator(state.session.workspacePath);
    if (mode === 'plan') coordinator.enterPlanning();
    else if (mode === 'review') coordinator.enterReviewing();
    else coordinator.enterBuilding();
    state.modeId = mode;
    return { _meta: { modeId: mode } };
  }

  /**   * `session/set_config_option` — 设置会话配置项。
   *
   * 本仓 ACP 面当前只暴露一个可写配置项 `model`(其余配置走 settings 文件)。
   * 未知 configId **拒绝并点名**已支持的项,而不是静默成功 ——
   * 静默成功会让编辑器显示"已切换",而实际什么都没变。
   */
  async setSessionConfigOption(params: {
    sessionId: string;
    configId: string;
    value: unknown;
  }): Promise<{
    configOptions: {
      id: string;
      name: string;
      type: 'select';
      currentValue: string;
      options: { value: string; name: string }[];
    }[];
  }> {
    const state = this.requireOrAdoptSession(params.sessionId);
    if (params.configId !== 'model') {
      throw new Error(
        'session/set_config_option 不支持的 configId: ' + params.configId + '(当前仅支持 model)',
      );
    }
    const raw = params.value;
    let value = '';
    if (typeof raw === 'string') value = raw;
    else if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      value = String((raw as { value: unknown }).value);
    }
    if (value.length === 0) {
      throw new Error('session/set_config_option 的 value 必须是非空字符串');
    }
    state.session.modelId = value;
    saveSession(state.session);
    return {
      configOptions: [
        {
          id: 'model',
          name: 'Model',
          type: 'select',
          currentValue: value,
          // 选项集来自运行时配置,不在协议层硬编码候选;客户端可据 currentValue 回显
          options: [{ value, name: value }],
        },
      ],
    };
  }

  /** 取会话的检查点管理器;会话不在内存态时按 id 反查落盘会话再建。 */
  private requireCheckpointManager(sessionId: string): CheckpointManager {
    const state = this.sessions.get(sessionId);
    if (state?.checkpoints) return state.checkpoints;
    const existing = loadSession(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);
    return new CheckpointManager({ sessionId: existing.id, workspacePath: existing.workspacePath });
  }

  /**   * `session/fork` — 从某个已存会话复制出一个新会话。
   *
   * 分流点语义:整段复制(ACP 的 ForkSessionRequest 不带游标字段),不在这里
   * 自造"从第 N 轮分叉" —— 那属于 `_meta` 扩展,未取证前不加。
   * 新会话 id 由 `createSession` 生成,历史逐条浅拷贝(content 是字符串,值语义)。
   */
  async forkSession(params: { sessionId: string; cwd?: string | null }): Promise<{
    sessionId: string;
  }> {
    const source = loadSession(params.sessionId);
    if (!source) {
      throw new Error(`Session ${params.sessionId} not found`);
    }
    const cwd = typeof params.cwd === 'string' && params.cwd.length > 0 ? params.cwd : source.workspacePath;
    const forked = createSession(cwd, source.modelId);
    forked.history = source.history.map((m) => ({ ...m }));
    saveSession(forked);
    return { sessionId: forked.id };
  }

  /**   * `session/delete` — 删除一个已存会话。
   *
   * 先从内存态摘除(避免后续 prompt 还挂着一个已被删的会话),再删文件。
   * 文件不存在按"已删除"处理(幂等),不报"找不到会话" —— delete 的语义
   * 是"让它不存在",不是"证明它曾经存在"。
   */
  async deleteSessionFile(params: { sessionId: string }): Promise<Record<string, never>> {
    this.sessions.delete(params.sessionId);
    deleteSession(params.sessionId);
    return {};
  }

  // ==================== P0-2 ACP 扩展方法实现 ====================

  /**   * `x.ai/session/repair` — 自愈当前会话历史。
   * 调用 repairSessionHistoryReport(dry_run 可选),并持久化到 session。
   */
  async repairSession(params: RepairSessionParams): Promise<RepairSessionResponse> {
    const state = this.requireSession(params.sessionId);
    const report = repairSessionHistoryReport(state.session.history, {
      dryRun: params.dryRun === true,
      persistToSession: params.dryRun === true ? undefined : state.session,
    });
    return report;
  }

  /**   * `x.ai/rewind/points` — 列出可回退的 prompt 点。纯只读。
   */
  async rewindPoints(params: RewindPointsParams): Promise<{ points: RewindPoint[] }> {
    const state = this.requireSession(params.sessionId);
    const points = listRewindPoints(state.session.history);
    return { points };
  }

  /**   * `x.ai/rewind/execute` — 回退 history 到指定 prompt 索引。
   * 成功则更新 session.history 并持久化,失败(rewound=false)返回原 history 不变 + reason。
   */
  async rewindExecute(params: RewindExecuteParams): Promise<RewindResponse> {
    const state = this.requireSession(params.sessionId);
    const request: RewindRequest = {
      targetPromptIndex: params.targetPromptIndex,
      force: params.force,
      mode: params.mode,
    };
    const response = rewindHistory(state.session.history, request);
    if (response.rewound) {
      state.session.history = response.rewoundHistory;
      saveSession(state.session);
    }
    return response;
  }

  // ==================== P1-6 ACP MCP 扩展方法实现 ====================
  //
  // 三个方法都委托给 mcp-runtime.ts 的全局 managedClients 注册表:
  //   - x.ai/mcp/listServers:列出所有 ManagedMcpClient 状态
  //   - x.ai/mcp/serverStatus:查询单个 server 的 liveness
  //   - x.ai/mcp/callTool:转发 tool 调用到 ManagedMcpClient
  //
  // feature flag 关闭(settings.mcp.advanced.enabled !== true)时,
  // managedClients 注册表为空,listServers 返回空数组,serverStatus 返回 null,
  // callTool 返回 success=false + error 提示(对调用方友好降级)。

  /** `x.ai/mcp/listServers` — 列出所有已注册 ManagedMcpClient 的状态快照 */
  async listMcpServers(_params: McpListServersParams): Promise<McpListServersResponse> {
    const servers = listManagedClients();
    return { servers };
  }

  /** `x.ai/mcp/serverStatus` — 查询单个 server 的 liveness 状态 */
  async mcpServerStatus(params: McpServerStatusParams): Promise<McpServerStatusResponse> {
    const client = getManagedClient(params.serverName);
    if (!client) return { server: null };
    return { server: client.getStatus() };
  }

  /**   * `x.ai/mcp/callTool` — 转发 tool 调用到指定 MCP server。
   * - server 未注册 → success=false + error
   * - server 已注册但调用失败 → success=false + error(不抛异常,降级返回)
   * - 成功 → 解析 content 数组中的 text 项拼接为 output
   */
  async mcpCallTool(params: McpCallToolParams): Promise<McpCallToolResponse> {
    const client = getManagedClient(params.serverName);
    if (!client) {
      return {
        success: false,
        output: '',
        error: `MCP server 未注册: ${params.serverName}`,
      };
    }
    try {
      const raw = await client.callTool(params.toolName, params.arguments ?? {});
      const result = raw as { content?: Array<{ type: string; text?: string }> } | null;
      if (!result?.content) {
        return { success: true, output: '(无输出)' };
      }
      const texts = result.content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');
      return { success: true, output: texts || '(无文本输出)' };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**   * `x.ai/mcp/reconnect` — 命令层手动重连(O46 拍板 B,非自动 Retry):
   * 强制断开并立即重建指定 server 的连接,返回重连后状态。
   * - server 未注册 → success=false + error(对调用方友好降级)
   * - 重连失败 → success=false + error + 当时状态(不抛异常,也不静默吞红)
   * - 成功 → success=true + 重连后状态
   */
  async mcpReconnect(params: McpReconnectParams): Promise<McpReconnectResponse> {
    const client = getManagedClient(params.serverName);
    if (!client) {
      return {
        server: null,
        success: false,
        error: `MCP server 未注册: ${params.serverName}`,
      };
    }
    try {
      await reconnectManagedClient(params.serverName);
      return { server: client.getStatus(), success: true };
    } catch (err) {
      return {
        server: client.getStatus(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** 内部:根据 sessionId 查找 AcpSessionState,不存在则抛错 */
  /**   * 取会话态;内存里没有就从磁盘收养一场。
   *
   * 为什么需要:编辑器可以随时 `session/set_mode`,而进程可能刚启动、
   * 会话只在磁盘上。`load` / `resume` / `fork` 都做了"按 id 反查落盘会话",
   * 这两个方法若只查内存态,就会对一场明明存在的会话回 "not found" ——
   * 用户看到的是"切模式失败",而原因是内部状态口径不一致。
   */
  private requireOrAdoptSession(sessionId: string): AcpSessionState {
    const inMemory = this.sessions.get(sessionId);
    if (inMemory) return inMemory;
    const existing = loadSession(sessionId);
    if (!existing) throw new Error(`Session ${sessionId} not found`);
    const adopted: AcpSessionState = {
      session: existing,
      pendingAbort: null,
      agentReady: false,
      systemPrompt: null,
      ctx: null,
      checkpoints: new CheckpointManager({
        sessionId: existing.id,
        workspacePath: existing.workspacePath,
      }),
      planApproved: false,
      planMachine: this.opts.planFirst ? new PlanMachine('gathering') : undefined,
    };
    this.sessions.set(existing.id, adopted);
    return adopted;
  }

  // ==================== 回合运行态 / 目标态 ====================
  //
  // 补的是「长任务闭环」的三处缺口(取证见 outputs/reverse-2026-11-12/TRAE-BINARY-REPORT.md):
  //   ① 回合被中断后,重连只知道"消息到哪了",不知道"这一回合原本要做什么、做到哪一步";
  //   ② 没有"暂时做不完,挂起等条件满足再继续"的表达 —— 只能整段结束;
  //   ③ 上游没给结束信号时,历史留下半截消息,分不清"正常结束"与"异常中断"。
  //
  // 判据全在 `turn-lifecycle.ts`(纯状态机)与 `turn-store.ts`(持久化),本类只做协议翻译。

  /** `x.ai/turn/create` — 为一个会话开一条新回合(初始 phase = prepare)。 */
  async createTurn(params: { sessionId: string; now?: number }): Promise<{
    turn: TurnRecord;
    runtime: SessionRuntime;
  }> {
    this.assertSessionOnDisk(params.sessionId);
    const at = params.now ?? Date.now();
    const ordinal = nextTurnOrdinal(params.sessionId);
    const record = createTurnRecord({
      id: `turn_${params.sessionId}_${ordinal}_${at}`,
      sessionId: params.sessionId,
      ordinal,
      at,
    });
    const runtime = upsertTurn(params.sessionId, record);
    return { turn: record, runtime };
  }

  /**   * `x.ai/turn/transition` — 对某个回合施加一次状态迁移。
   *
   * 拒绝是**结构化返回**而不是抛错:调用方要能区分 `terminal` / `illegal-phase` /
   * `time-travel` / `missing-synthetic-reason` 并做不同处置(重试 / 放弃 / 补齐原因)。
   */
  async transitionTurn(params: {
    sessionId: string;
    turnId: string;
    transition: TurnTransition;
  }): Promise<
    | { ok: true; turn: TurnRecord; runtime: SessionRuntime }
    | { ok: false; code: TurnRejectionCode; message: string }
  > {
    this.assertSessionOnDisk(params.sessionId);
    const runtime = loadSessionRuntime(params.sessionId);
    const current = runtime.turns.find((t) => t.id === params.turnId);
    if (!current) {
      return { ok: false, code: 'illegal-phase', message: `回合 ${params.turnId} 不存在` };
    }
    const result = applyTurnTransition(current, params.transition);
    if (!result.ok) return result;
    const nextRuntime = upsertTurn(params.sessionId, result.next);
    return { ok: true, turn: result.next, runtime: nextRuntime };
  }

  /** `x.ai/turn/state` — 读一个会话的回合运行态(含活跃回合与可唤醒判定)。 */
  async getTurnState(params: { sessionId: string; now?: number }): Promise<{
    runtime: SessionRuntime;
    wakeable: string[];
    attention: { turnId: string; reason: string }[];
  }> {
    this.assertSessionOnDisk(params.sessionId);
    const now = params.now ?? Date.now();
    const runtime = loadSessionRuntime(params.sessionId);
    return {
      runtime,
      wakeable: runtime.turns.filter((t) => isWakeable(t, now)).map((t) => t.id),
      attention: runtime.turns
        .map((t) => ({ turnId: t.id, ...needsAttention(t, now) }))
        .filter((x) => x.needed)
        .map((x) => ({ turnId: x.turnId, reason: x.reason ?? '' })),
    };
  }

  /**
   * `x.ai/turn/parked` —— 跨会话列出此刻可被唤醒的挂起回合(2026-11-12 接线)。
   *
   * 与 `x.ai/turn/state` 的分工:state 只看一个会话;本方法扫全部会话。
   * 它存在的理由是编辑器侧需要一个「该处理哪些挂起任务」的总览 ——
   * 没有它,listWakeableTurns 就是死码(判据在、链路不在)。
   *
   * 只返回到点可唤醒的(有 notBefore 且已到期);纯事件式挂起不在此列,
   * 它必须由具体事件显式 wake —— 混在一起会让人以为事件式挂起会自己醒。
   */
  async listParkedTurns(params: { now?: number }): Promise<{
    now: number;
    parked: {
      sessionId: string;
      turnId: string;
      ordinal: number;
      reason: string;
      notBefore: number;
    }[];
  }> {
    const now = params.now ?? Date.now();
    return {
      now,
      parked: listWakeableTurns(now).map((x) => ({
        sessionId: x.sessionId,
        turnId: x.turn.id,
        ordinal: x.turn.ordinal,
        reason: x.turn.wake?.reason ?? 'unknown',
        notBefore: x.turn.wake?.notBefore ?? 0,
      })),
    };
  }

  /**   * `x.ai/turn/synthetic-finish` — 上游没给结束信号时,由本地把回合收成 completed。
   *
   * 与普通 complete 分开:它**必须**说明原因。否则调用方可以把"连接断了"伪装成
   * "正常完成",而这正是要防的那类静默失败。
   */
  async syntheticFinishTurn(params: {
    sessionId: string;
    turnId: string;
    detail: string;
    now?: number;
  }): Promise<
    | { ok: true; turn: TurnRecord }
    | { ok: false; code: TurnRejectionCode; message: string }
  > {
    const res = await this.transitionTurn({
      sessionId: params.sessionId,
      turnId: params.turnId,
      transition: { type: 'synthetic-finish', at: params.now ?? Date.now(), detail: params.detail },
    });
    if (!res.ok) return { ok: false, code: res.code, message: res.message };
    return { ok: true, turn: res.turn };
  }

  /** `x.ai/goal/create` — 为一个会话建立目标(一等实体,不是对话里的一句话)。 */
  async createGoal(params: {
    sessionId: string;
    statement: string;
    now?: number;
  }): Promise<{ goal: GoalRecord; goals: GoalRecord[] }> {
    this.assertSessionOnDisk(params.sessionId);
    const at = params.now ?? Date.now();
    const goal = createGoal({
      id: `goal_${params.sessionId}_${at}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: params.sessionId,
      statement: params.statement,
      at,
    });
    return { goal, goals: upsertGoal(goal) };
  }

  /** `x.ai/goal/list` — 列出会话的全部目标。 */
  async listGoals(params: { sessionId: string }): Promise<{ goals: GoalRecord[] }> {
    this.assertSessionOnDisk(params.sessionId);
    return { goals: loadGoals(params.sessionId) };
  }

  /**   * `x.ai/goal/update` — 目标状态迁移(active → achieved / abandoned)。
   * 终态不可再迁;同态迁移按 `no-op` 拒绝,不静默成功。
   */
  async updateGoal(params: {
    sessionId: string;
    goalId: string;
    status: GoalStatus;
    note?: string;
    now?: number;
  }): Promise<
    | { ok: true; goal: GoalRecord; goals: GoalRecord[] }
    | { ok: false; code: string; message: string }
  > {
    this.assertSessionOnDisk(params.sessionId);
    const goals = loadGoals(params.sessionId);
    const current = goals.find((g) => g.id === params.goalId);
    if (!current) {
      return { ok: false, code: 'not-found', message: `目标 ${params.goalId} 不存在` };
    }
    const res = applyGoalTransition(current, params.status, params.now ?? Date.now(), params.note);
    if (!res.ok) return res;
    return { ok: true, goal: res.next, goals: upsertGoal(res.next) };
  }

  /**   * 断言会话存在(只要求**磁盘上**存在,不要求已在内存装载)。
   *
   * 为什么不能复用 `requireSession`:那个查的是 `this.sessions`(内存 map),
   * 只有走过 `session/new` 或 `session/load` 才会入 map。而回合运行态与目标态的
   * 存储是独立文件(`~/.ihui/turns` / `~/.ihui/goals`),它们的合法性只依赖
   * 「这个会话是否真实存在」—— 把内存装载状态当作前置条件,会让「重启后先查
   * 挂起回合」这种最该支持的场景反而失败。
   */
  private assertSessionOnDisk(sessionId: string): void {
    if (!loadSession(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
  }

  private requireSession(sessionId: string): AcpSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return state;
  }
}

function extractTextFromPrompt(prompt: acp.ContentBlock[] | undefined): string {
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * 把 IHUI 内部工具名映射到 ACP ToolKind(供 IDE 选图标/UI 处理)。
 * 纯前缀/关键字匹配,未命中落 'other'。不依赖外部 registry,零副作用。
 */
function mapToolKind(name: string): acp.ToolKind {
  const n = name.toLowerCase();
  if (n.includes('think') || n.includes('reason')) return 'think';
  if (n.includes('read') || n.includes('list') || n.includes('view') || n.includes('cat')) return 'read';
  if (n.includes('write') || n.includes('edit') || n.includes('create') || n.includes('patch') || n.includes('save')) return 'edit';
  if (n.includes('delete') || n.includes('remove') || n.includes('rm')) return 'delete';
  if (n.includes('move') || n.includes('rename') || n.includes('mv')) return 'move';
  if (n.includes('search') || n.includes('grep') || n.includes('find') || n.includes('ls')) return 'search';
  if (n.includes('fetch') || n.includes('web') || n.includes('http') || n.includes('download') || n.includes('curl')) return 'fetch';
  if (n.includes('execute') || n.includes('run') || n.includes('command') || n.includes('shell') || n.includes('terminal') || n.includes('test') || n.includes('build')) return 'execute';
  if (n.includes('switch') || n.includes('mode')) return 'switch_mode';
  return 'other';
}

/**
 * P0-C stopReason 映射:runToolLoop 的 AgentStopReason → ACP StopReason。
 * ACP 规范只有 end_turn/max_tokens/max_turn_requests/refusal/cancelled 五种,
 * budget_limited/doom_loop/plan_approval_required 等统一降级为 refusal
 * (语义:agent 主动停止而非出错,细节经 agent_message_chunk 已推送给客户端)。
 */
function toAcpStopReason(reason: string): 'end_turn' | 'max_turn_requests' | 'refusal' | 'cancelled' {
  switch (reason) {
    case 'end_turn':
      return 'end_turn';
    case 'cancelled':
      return 'cancelled';
    case 'max_iterations':
      return 'max_turn_requests';
    default:
      return 'refusal';
  }
}

/**
 * 包一层:把 handler 的业务错误转成带原因的 JSON-RPC 错误(见 asRpcError)。
 * 只用于本轮新增的会话/检查点方法 —— 既有方法的错误形态不动(避免行为变更)。
 */
function rpcMethod<Params, Result>(handler: (params: Params) => Promise<Result>) {
  return async (params: Params): Promise<Result> => {
    try {
      return await handler(params)
    } catch (error) {
      throw asRpcError(error)
    }
  }
}

/**
 * 把业务错误转成 **带原因的** JSON-RPC 错误。
 *
 * 为什么必须显式转:
 *   ACP SDK 对 handler 抛出的普通 `Error` 一律回 `-32603 Internal error`,
 *   且**不带 message**。于是客户端看到的只有"内部错误",无法区分
 *   "检查点不存在" / "会话不存在" / "存储损坏" —— 而这三者的正确处置完全不同
 *   (重建 / 换会话 / 报修)。对照程序 WorkBuddy 的 harness 在这点上做对了:
 *   它用 `decodeAgentHarnessCheckpointReadResponse` 严格解码,解不出就抛一条
 *   **点名原因**的错误("...has invalid checkpoint read data"),而不是笼统的 internal。
 *
 * 我方口径:参数/标识类问题一律 `-32602 Invalid params` 并原样带上原因;
 * 真未知异常才让它冒泡成 internal(不把未分类的失败伪装成"参数错误")。
 */
function asRpcError(error: unknown): unknown {
  if (error instanceof acp.RequestError) return error;
  const message = error instanceof Error ? error.message : String(error);
  // 只把"调用方给错了"这一类折成 invalid params;其余保持 internal,不误分类。
  if (/not found|不存在|不支持|必须|互斥|非法|invalid/i.test(message)) {
    return acp.RequestError.invalidParams({ detail: message }, `: ${message}`);
  }
  return error;
}

/**
 * P0-2 自定义方法参数 parser(纯 cast,不做 zod 校验 — 校验在 agent 方法内进行)。
 * SDK `onRequest(method, params, handler)` 三参数重载要求一个 ParamsParser,
 * 既能传 zod schema 也能传函数。这里用最简函数 cast 避免引入 zod 依赖。
 */
function castParams<T>(): (params: unknown) => T {
  return (params: unknown) => params as T;
}

/**
 * 构建 ACP agent app(方法注册表)。
 *
 * 导出是为了让「方法是否真的注册」可被测试:SDK 对未注册方法回 `-32601`,
 * 与"没实现"对客户端无法区分,只有走注册表发一次请求才能证伪。
 * `startAcpServer` 与测试共用这一份注册表,不另建第二份(§0.6)。
 */
export function buildAcpAgentApp(opts: AcpServerOptions): acp.AgentApp {
  setBaseUrl(opts.apiUrl);
  // 凭据续期单点:ACP 会话同样要带 refreshAccessToken,否则 15 分钟后全体 401 无法自愈
  registerCliTokenProvider({ baseUrl: opts.apiUrl, startupToken: opts.apiKey });

  const agent = new IhuiAcpAgent(opts);
  opts.onAgentReady?.(agent);
  return acp
    .agent({ name: 'ihui-cli' })
    .onRequest('initialize', (ctx) => agent.initialize(ctx.params))
    .onRequest('authenticate', (ctx) => agent.authenticate(ctx.params))
    .onRequest('session/new', (ctx) => agent.newSession(ctx.params))
    .onRequest('session/load', (ctx) => agent.loadSession(ctx.params, ctx.client))
    .onRequest('session/prompt', (ctx) => agent.prompt(ctx.params, ctx.client))
    .onRequest('session/close', (ctx) => {
      agent.closeSession?.(ctx.params);
      return {};
    })
    // ACP 标准会话生命周期(补齐 SDK 1.3.0 已定义、本仓原先未注册的四个方法)。
    // 用 SDK 三参数重载:方法名 + params parser + handler。
    .onRequest<acp.ListSessionsRequest, acp.ListSessionsResponse>(
      'session/list',
      castParams<acp.ListSessionsRequest>(),
      (ctx) => rpcMethod((p: acp.ListSessionsRequest) => agent.listSessions(p))(ctx.params),
    )
    .onRequest<acp.ResumeSessionRequest, acp.ResumeSessionResponse>(
      'session/resume',
      castParams<acp.ResumeSessionRequest>(),
      (ctx) => rpcMethod((p: acp.ResumeSessionRequest) => agent.resumeSession(p, ctx.client))(ctx.params),
    )
    .onRequest<acp.ForkSessionRequest, acp.ForkSessionResponse>(
      'session/fork',
      castParams<acp.ForkSessionRequest>(),
      (ctx) => rpcMethod((p: acp.ForkSessionRequest) => agent.forkSession(p))(ctx.params),
    )
    .onRequest<acp.DeleteSessionRequest, acp.DeleteSessionResponse>(
      'session/delete',
      castParams<acp.DeleteSessionRequest>(),
      (ctx) => rpcMethod((p: acp.DeleteSessionRequest) => agent.deleteSessionFile(p))(ctx.params),
    )
    .onRequest<acp.SetSessionModeRequest, acp.SetSessionModeResponse>(
      'session/set_mode',
      castParams<acp.SetSessionModeRequest>(),
      (ctx) => rpcMethod((p: acp.SetSessionModeRequest) => agent.setSessionMode(p))(ctx.params),
    )
    .onRequest<acp.SetSessionConfigOptionRequest, acp.SetSessionConfigOptionResponse>(
      'session/set_config_option',
      castParams<acp.SetSessionConfigOptionRequest>(),
      (ctx) =>
        rpcMethod((p: acp.SetSessionConfigOptionRequest) => agent.setSessionConfigOption(p))(
          ctx.params,
        ),
    )
    // ACP checkpoint 通道(标准 ACP 无此方法,沿用本仓 x.ai/* 私有命名空间)
    .onRequest<{ sessionId: string }, { checkpoints: CheckpointSummary[] }>(
      'x.ai/checkpoint/list',
      castParams<{ sessionId: string }>(),
      (ctx) => rpcMethod((p: { sessionId: string }) => agent.listCheckpoints(p))(ctx.params),
    )
    .onRequest<
      { sessionId: string; checkpointId: string },
      { checkpoint: CheckpointSummary; diff: CheckpointDiffEntry[] }
    >(
      'x.ai/checkpoint/read',
      castParams<{ sessionId: string; checkpointId: string }>(),
      (ctx) => rpcMethod((p: { sessionId: string; checkpointId: string }) => agent.readCheckpoint(p))(ctx.params),
    )
    .onRequest<
      { sessionId: string; checkpointId: string },
      { restored: string[]; removed: string[]; notRestored: string[]; complete: boolean }
    >(
      'x.ai/checkpoint/restore',
      castParams<{ sessionId: string; checkpointId: string }>(),
      (ctx) => rpcMethod((p: { sessionId: string; checkpointId: string }) => agent.restoreCheckpoint(p))(ctx.params),
    )
    // 回合运行态 / 目标态(长任务闭环;标准 ACP 无此方法,沿用 x.ai/* 私有命名空间)
    .onRequest<{ sessionId: string; now?: number }, { turn: TurnRecord; runtime: SessionRuntime }>(
      'x.ai/turn/create',
      castParams<{ sessionId: string; now?: number }>(),
      (ctx) => rpcMethod((p: { sessionId: string; now?: number }) => agent.createTurn(p))(ctx.params),
    )
    .onRequest<
      { sessionId: string; turnId: string; transition: TurnTransition },
      | { ok: true; turn: TurnRecord; runtime: SessionRuntime }
      | { ok: false; code: TurnRejectionCode; message: string }
    >(
      'x.ai/turn/transition',
      castParams<{ sessionId: string; turnId: string; transition: TurnTransition }>(),
      (ctx) =>
        rpcMethod((p: { sessionId: string; turnId: string; transition: TurnTransition }) =>
          agent.transitionTurn(p),
        )(ctx.params),
    )
    .onRequest<
      { sessionId: string; now?: number },
      {
        runtime: SessionRuntime;
        wakeable: string[];
        attention: { turnId: string; reason: string }[];
      }
    >(
      'x.ai/turn/state',
      castParams<{ sessionId: string; now?: number }>(),
      (ctx) => rpcMethod((p: { sessionId: string; now?: number }) => agent.getTurnState(p))(ctx.params),
    )
    .onRequest<
      { now?: number },
      {
        now: number;
        parked: {
          sessionId: string;
          turnId: string;
          ordinal: number;
          reason: string;
          notBefore: number;
        }[];
      }
    >(
      'x.ai/turn/parked',
      castParams<{ now?: number }>(),
      (ctx) => rpcMethod((p: { now?: number }) => agent.listParkedTurns(p))(ctx.params),
    )
    .onRequest<
      { sessionId: string; turnId: string; detail: string; now?: number },
      { ok: true; turn: TurnRecord } | { ok: false; code: TurnRejectionCode; message: string }
    >(
      'x.ai/turn/synthetic-finish',
      castParams<{ sessionId: string; turnId: string; detail: string; now?: number }>(),
      (ctx) =>
        rpcMethod((p: { sessionId: string; turnId: string; detail: string; now?: number }) =>
          agent.syntheticFinishTurn(p),
        )(ctx.params),
    )
    .onRequest<
      { sessionId: string; statement: string; now?: number },
      { goal: GoalRecord; goals: GoalRecord[] }
    >(
      'x.ai/goal/create',
      castParams<{ sessionId: string; statement: string; now?: number }>(),
      (ctx) =>
        rpcMethod((p: { sessionId: string; statement: string; now?: number }) => agent.createGoal(p))(
          ctx.params,
        ),
    )
    .onRequest<{ sessionId: string }, { goals: GoalRecord[] }>(
      'x.ai/goal/list',
      castParams<{ sessionId: string }>(),
      (ctx) => rpcMethod((p: { sessionId: string }) => agent.listGoals(p))(ctx.params),
    )
    .onRequest<
      { sessionId: string; goalId: string; status: GoalStatus; note?: string; now?: number },
      { ok: true; goal: GoalRecord; goals: GoalRecord[] } | { ok: false; code: string; message: string }
    >(
      'x.ai/goal/update',
      castParams<{ sessionId: string; goalId: string; status: GoalStatus; note?: string; now?: number }>(),
      (ctx) =>
        rpcMethod(
          (p: { sessionId: string; goalId: string; status: GoalStatus; note?: string; now?: number }) =>
            agent.updateGoal(p),
        )(ctx.params),
    )
    // P0-2 ACP 私有扩展方法(x.ai/* 命名空间,参考行业 Agent 框架实践)
    // 使用 SDK 三参数重载:onRequest<Params, Response>(method, paramsParser, handler)
    .onRequest<RepairSessionParams, RepairSessionResponse>(
      'x.ai/session/repair',
      castParams<RepairSessionParams>(),
      (ctx) => agent.repairSession(ctx.params),
    )
    .onRequest<RewindPointsParams, { points: RewindPoint[] }>(
      'x.ai/rewind/points',
      castParams<RewindPointsParams>(),
      (ctx) => agent.rewindPoints(ctx.params),
    )
    .onRequest<RewindExecuteParams, RewindResponse>(
      'x.ai/rewind/execute',
      castParams<RewindExecuteParams>(),
      (ctx) => agent.rewindExecute(ctx.params),
    )
    // P1-6 ACP MCP 私有扩展方法(x.ai/mcp/* 命名空间)
    // 让 Zed/VSCode 等编辑器能通过 ACP 直接查询 MCP server 状态 / 调用 MCP 工具。
    // feature flag 关闭时 managedClients 注册表为空,方法仍可调用(返回空/null/失败)。
    .onRequest<McpListServersParams, McpListServersResponse>(
      'x.ai/mcp/listServers',
      castParams<McpListServersParams>(),
      (ctx) => agent.listMcpServers(ctx.params),
    )
    .onRequest<McpServerStatusParams, McpServerStatusResponse>(
      'x.ai/mcp/serverStatus',
      castParams<McpServerStatusParams>(),
      (ctx) => agent.mcpServerStatus(ctx.params),
    )
    .onRequest<McpCallToolParams, McpCallToolResponse>(
      'x.ai/mcp/callTool',
      castParams<McpCallToolParams>(),
      (ctx) => agent.mcpCallTool(ctx.params),
    )
    .onRequest<McpReconnectParams, McpReconnectResponse>(
      'x.ai/mcp/reconnect',
      castParams<McpReconnectParams>(),
      (ctx) => agent.mcpReconnect(ctx.params),
    )
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params));
}

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);
  return buildAcpAgentApp(opts).connect(stream);
}

// P0-2 类型再导出(供 acp 测试 / 其他模块复用)
// P1-6 MCP 扩展方法类型一并导出(供 acp mcp 测试复用)
export type {
  RepairSessionResponse,
  RewindRequest,
  RewindResponse,
  RewindPoint,
  ChatMessage,
  Session,
  McpListServersParams,
  McpListServersResponse,
  McpServerStatusParams,
  McpServerStatusResponse,
  McpCallToolParams,
  McpCallToolResponse,
  McpReconnectParams,
  McpReconnectResponse,
  McpServerStatus,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
