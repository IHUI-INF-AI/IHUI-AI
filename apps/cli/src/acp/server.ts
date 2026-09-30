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
import { randomUUID } from 'node:crypto';
import * as acp from '@agentclientprotocol/sdk';
import { setBaseUrl, setTokenProvider, type ToolDeltaEvent } from '@ihui/api-client';
import {
  createToolDeltaPreviewStore,
  pickToolDeltaPreviewText,
  type ToolDeltaPreviewStore,
} from '../tools/file-edit-preview.js';
import {
  createSession,
  saveSession,
  loadSession,
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
import { setupAgentTools, runToolLoop, type ToolContext } from '../commands/agent.js';
import { createAuditedDangerGate } from '../tools/danger-gate-audit.js';
import { PlanMachine } from '../plan/machine.js';
import { CheckpointManager } from '../checkpoints/index.js';
import {
  listManagedClients,
  getManagedClient,
} from '../tools/mcp-runtime.js';

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
    const response: acp.RequestPermissionResponse | null = await cx.request(
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
  /** 累积预览文本(整帧替换语义,末帧即全量) */
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
  // 重划到卡 id:同一批的累积帧整帧覆盖(同 seq 重放天然幂等)
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

// P1-6 export IhuiAcpAgent(供测试直接实例化,不经过 ACP 协议层调用 MCP 扩展方法)
export class IhuiAcpAgent {
  private readonly opts: AcpServerOptions;
  private readonly sessions = new Map<string, AcpSessionState>();

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

    for (const msg of existing.history) {
      if (msg.role === 'user') {
        await cx.notify(acp.methods.client.session.update, {
          sessionId: existing.id,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: msg.content },
          },
        });
      } else if (msg.role === 'assistant') {
        await cx.notify(acp.methods.client.session.update, {
          sessionId: existing.id,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: msg.content },
          },
        });
      }
    }

    return {};
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
          allowDangerous: this.opts.allowDangerous,
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

    try {
      // tool_call ↔ tool_call_update 配对队列:onToolCall 入队、onToolResult 出队(FIFO,
      // 因 runToolLoop 先对全部 tool 调 onToolCall 再对全部结果调 onToolResult,顺序一致)。
      // 队列为空(异常 desync)时 onToolResult 跳过转发,宁缺勿假。
      const toolCallIdQueue: string[] = [];

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
      // D113:流中断/报错 ⇒ 本端预览账全部作废。**刻意不发 tool_call_update**:
      // 这些卡此刻的真实状态未知(可能已执行、可能根本没跑),写 completed/failed 都是
      // 伪造终态(与本文件"审批终态必须与真实决定一致"同一条禁令)。清的是本端账 ——
      // 迟到/重放的帧不得再把预览刷回一张已经没人负责收尾的卡上。
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
    this.sessions.delete(params.sessionId);
  }

  // ==================== P0-2 ACP 扩展方法实现 ====================

  /**
   * `x.ai/session/repair` — 自愈当前会话历史。
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

  /**
   * `x.ai/rewind/points` — 列出可回退的 prompt 点。纯只读。
   */
  async rewindPoints(params: RewindPointsParams): Promise<{ points: RewindPoint[] }> {
    const state = this.requireSession(params.sessionId);
    const points = listRewindPoints(state.session.history);
    return { points };
  }

  /**
   * `x.ai/rewind/execute` — 回退 history 到指定 prompt 索引。
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

  /**
   * `x.ai/mcp/callTool` — 转发 tool 调用到指定 MCP server。
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

  /** 内部:根据 sessionId 查找 AcpSessionState,不存在则抛错 */
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
 * P0-2 自定义方法参数 parser(纯 cast,不做 zod 校验 — 校验在 agent 方法内进行)。
 * SDK `onRequest(method, params, handler)` 三参数重载要求一个 ParamsParser,
 * 既能传 zod schema 也能传函数。这里用最简函数 cast 避免引入 zod 依赖。
 */
function castParams<T>(): (params: unknown) => T {
  return (params: unknown) => params as T;
}

function createAcpAgent(opts: AcpServerOptions): acp.AgentApp {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  const agent = new IhuiAcpAgent(opts);
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
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params));
}

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);
  return createAcpAgent(opts).connect(stream);
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
  McpServerStatus,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
