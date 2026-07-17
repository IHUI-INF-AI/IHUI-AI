/**
 * ACP (Agent Client Protocol) server — 让 IHUI CLI 可被 Zed/VSCode+ACP 扩展/Cursor 等编辑器作为 agent 后端启动。
 *
 * 协议规范:https://agentclientprotocol.com
 * SDK:@agentclientprotocol/sdk
 *
 * 启动方式:`ihui acp` (默认 stdio NDJSON 传输)
 *
 * P0-2 扩展方法(对齐 cli 的 `x.ai/*` 私有扩展命名空间,使用 SDK 自定义方法三参数重载):
 *   - `x.ai/session/repair`:自愈当前会话历史(清理非法 role / 空消息 / 连续重复 / interjection 残留)
 *   - `x.ai/rewind/points`:列出可回退的 prompt 点(user 消息位置)
 *   - `x.ai/rewind/execute`:回退 history 到指定 prompt 索引(支持 RewindMode + force)
 *
 * 危险工具(默认拒绝):Editor 内无交互确认通道,需在 `~/.ihui/settings.json` 设置
 * `allowDangerous: true` 或启动时加 `--allow-dangerous` flag(自负风险)。
 */

import { Readable, Writable } from 'node:stream';
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
import { CheckpointManager } from '../checkpoints/index.js';

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
}

interface AcpSessionState {
  session: Session;
  pendingAbort: AbortController | null;
  agentReady: boolean;
  systemPrompt: string | null;
  ctx: ToolContext | null;
  checkpoints: CheckpointManager | null;
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

class IhuiAcpAgent {
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
        confirmDangerous: async () => {
          if (this.opts.allowDangerous) return true;
          return false;
        },
      });
      state.systemPrompt = result.systemPrompt;
      state.ctx = result.ctx;
      state.agentReady = true;
    }

    state.pendingAbort?.abort();
    const abort = new AbortController();
    state.pendingAbort = abort;

    const userText = extractTextFromPrompt(params.prompt);
    state.session.history.push({ role: 'user', content: userText });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: state.systemPrompt! },
      ...state.session.history.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    try {
      const result = await runToolLoop({
        modelId: this.opts.modelId,
        messages,
        ctx: state.ctx!,
        maxIterations: this.opts.maxIterations,
        signal: abort.signal,
        onDelta: async (delta) => {
          await cx.notify(acp.methods.client.session.update, {
            sessionId: params.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: delta },
            },
          });
        },
        onError: (err) => {
          throw new Error(typeof err === 'string' ? err : String(err));
        },
      });

      if (result.assistantText) {
        state.session.history.push({ role: 'assistant', content: result.assistantText });
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
      return { stopReason: 'end_turn' };
    } catch (err) {
      if (abort.signal.aborted) {
        const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
        if (lastAssistant) {
          state.session.history.push({ role: 'assistant', content: lastAssistant.content });
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
    // P0-2 ACP 私有扩展方法(x.ai/* 命名空间,对齐 cli)
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
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params));
}

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin);
  const stream = acp.ndJsonStream(input, output);
  return createAcpAgent(opts).connect(stream);
}

// P0-2 类型再导出(供 acp 测试 / 其他模块复用)
export type {
  RepairSessionResponse,
  RewindRequest,
  RewindResponse,
  RewindPoint,
  ChatMessage,
  Session,
};
