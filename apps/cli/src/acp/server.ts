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
import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
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
import { createDangerGate } from '../tools/danger-gate.js';
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
      const result = await setupAgentTools({
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
        // 策略收口到唯一出口 createDangerGate:silent 保持本端零额外输出,
        // 编辑器不支持/取消 → prompt 非 true → denied(安全默认与旧行为逐路径等价)
        confirmDangerous: createDangerGate({
          allowDangerous: this.opts.allowDangerous,
          silent: true,
          prompt: async (tool, args) => {
            const selected = await requestPermissionFromEditor(cx, params.sessionId, {
              toolCallId: `dangerous-${tool.name}-${Date.now()}`,
              kind: 'execute',
              title: `危险操作审批:${tool.name}`,
              contentText: JSON.stringify(args).slice(0, 2000),
              options: [
                { optionId: 'allow', name: '允许本次执行', kind: 'allow_once' },
                { optionId: 'deny', name: '拒绝', kind: 'reject_once' },
              ],
            });
            return selected === 'allow';
          },
        }),
      });
      state.systemPrompt = result.systemPrompt;
      state.ctx = result.ctx;
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
          const selected = await requestPermissionFromEditor(cx, params.sessionId, {
            toolCallId: `plan-approval-${Date.now()}`,
            kind: 'other',
            title: 'Plan 审批(Plan Mode)',
            contentText: plan.trim(),
            options: [
              { optionId: 'approve', name: '批准 Plan 并执行', kind: 'allow_once' },
              { optionId: 'reject', name: '拒绝并重新规划', kind: 'reject_once' },
            ],
          });
          const approved = selected === 'approve';
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
        // 工具结果:从队列取 toolCallId 配对,发 tool_call_update(completed/failed),
        // 结果文本安全截断(≤8000 字符)。toolCallId 缺失/空串或队列排空时跳过转发。
        onToolResult: async (name, success, output) => {
          try {
            const toolCallId = toolCallIdQueue.shift();
            if (!toolCallId) return;
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
