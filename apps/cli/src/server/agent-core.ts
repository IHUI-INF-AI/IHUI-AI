/**
 * Agent 内核 — 封装 setupAgentTools + runToolLoop,提供可被 HTTP/WS server 调用的纯函数式接口。
 *
 * 设计:AgentCore 持有 workspacePath/model/apiUrl 等 agent 配置,管理多个 session 状态,
 * sendMessage(text, onEvent) 流式推送 token/tool_call/tool_result/done 事件。
 * 不依赖任何 IO 层(console/http/ws),纯回调驱动,可被任意 client(HTTP/WS/TUI/ACP)复用。
 */

import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import {
  setupAgentTools,
  runToolLoop,
  type AgentStopReason,
  type ToolContext,
  type TokenUsage,
} from '../commands/agent.js';
import {
  createSession,
  saveSession,
  loadSession,
  listSessions,
  type Session,
} from '../commands/session.js';
import type { PermissionMode } from '../tools/permissions.js';

export interface AgentCoreOptions {
  workspacePath: string;
  model: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations?: number;
  permissionMode?: PermissionMode;
  enableMcp?: boolean;
  allowDangerous?: boolean;
}

export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; output: string }
  | { type: 'iteration'; count: number; max: number }
  | { type: 'error'; message: string }
  | {
      type: 'done';
      stopReason: AgentStopReason;
      iterations: number;
      usage: TokenUsage;
      sessionId: string;
    };

export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

export interface SendMessageResult {
  sessionId: string;
  stopReason: AgentStopReason;
  iterations: number;
  usage: TokenUsage;
}

interface CoreSessionState {
  session: Session;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  abort: AbortController | null;
}

export class AgentCore {
  private readonly opts: AgentCoreOptions;
  private readonly sessions = new Map<string, CoreSessionState>();
  private agentReady = false;
  private sharedSystemPrompt = '';
  private sharedCtx: ToolContext | null = null;

  constructor(opts: AgentCoreOptions) {
    this.opts = opts;
    setBaseUrl(opts.apiUrl);
    if (opts.apiKey) {
      setTokenProvider({ getToken: () => opts.apiKey ?? null });
    }
  }

  private async ensureAgent(): Promise<{ systemPrompt: string; ctx: ToolContext }> {
    if (this.agentReady && this.sharedCtx) {
      return { systemPrompt: this.sharedSystemPrompt, ctx: this.sharedCtx };
    }
    const result = await setupAgentTools({
      workspacePath: this.opts.workspacePath,
      enableMcp: this.opts.enableMcp,
      silent: true,
      permissionMode: this.opts.permissionMode,
      subagentParent: {
        modelId: this.opts.model,
        apiUrl: this.opts.apiUrl,
        apiKey: this.opts.apiKey,
        allowDangerous: this.opts.allowDangerous,
      },
      confirmDangerous: async () => this.opts.allowDangerous === true,
    });
    this.sharedSystemPrompt = result.systemPrompt;
    this.sharedCtx = result.ctx;
    this.agentReady = true;
    return { systemPrompt: result.systemPrompt, ctx: result.ctx };
  }

  listSessions(): Session[] {
    return listSessions();
  }

  async resumeSession(sessionId: string): Promise<Session | null> {
    return loadSession(sessionId);
  }

  async sendMessage(
    text: string,
    onEvent: AgentEventHandler,
    opts?: { sessionId?: string; signal?: AbortSignal },
  ): Promise<SendMessageResult> {
    const { systemPrompt, ctx } = await this.ensureAgent();

    let state = opts?.sessionId ? this.sessions.get(opts.sessionId) : undefined;
    if (!state && opts?.sessionId) {
      const loaded = loadSession(opts.sessionId);
      if (loaded) {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
          ...loaded.history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ];
        state = { session: loaded, messages, abort: null };
        this.sessions.set(loaded.id, state);
      }
    }
    if (!state) {
      const session = createSession(this.opts.workspacePath, this.opts.model);
      state = {
        session,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        abort: null,
      };
      this.sessions.set(session.id, state);
    } else {
      state.messages.push({ role: 'user', content: text });
      state.session.history.push({ role: 'user', content: text });
    }

    const abort = new AbortController();
    state.abort = abort;
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => abort.abort(), { once: true });
    }

    try {
      const result = await runToolLoop({
        modelId: this.opts.model,
        messages: state.messages,
        ctx,
        maxIterations: this.opts.maxIterations ?? 50,
        signal: abort.signal,
        sessionId: state.session.id,
        onDelta: async (delta) => {
          await onEvent({ type: 'token', text: delta });
        },
        onToolCall: async (name, args) => {
          await onEvent({ type: 'tool_call', name, args });
        },
        onToolResult: async (name, success, output) => {
          await onEvent({ type: 'tool_result', name, success, output });
        },
        onIteration: async (count, max) => {
          await onEvent({ type: 'iteration', count, max });
        },
        onError: async (message) => {
          await onEvent({ type: 'error', message });
        },
      });

      if (result.assistantText) {
        state.session.history.push({ role: 'assistant', content: result.assistantText });
      }
      saveSession(state.session);

      await onEvent({
        type: 'done',
        stopReason: result.stopReason,
        iterations: result.iterations,
        usage: result.usage,
        sessionId: state.session.id,
      });

      return {
        sessionId: state.session.id,
        stopReason: result.stopReason,
        iterations: result.iterations,
        usage: result.usage,
      };
    } finally {
      if (state.abort === abort) {
        state.abort = null;
      }
    }
  }

  cancel(sessionId: string): void {
    this.sessions.get(sessionId)?.abort?.abort();
  }
}
