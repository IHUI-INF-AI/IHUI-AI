/**
 * ACP (Agent Client Protocol) server — 让 IHUI CLI 可被 Zed/VSCode+ACP 扩展/Cursor 等编辑器作为 agent 后端启动。
 *
 * 协议规范:https://agentclientprotocol.com
 * SDK:@agentclientprotocol/sdk
 *
 * 启动方式:ihui acp
 * 编辑器侧配置示例(Zed agents.json):
 *   { "ihui": { "command": "ihui", "args": ["acp"] } }
 *
 * 工具循环集成:session/prompt 调用 runToolLoop,Agent 可自主调用工具读写文件。
 */

import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { createSession, saveSession, loadSession, type Session } from '../commands/session.js';
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
}

interface AcpSessionState {
  session: Session;
  pendingAbort: AbortController | null;
  agentReady: boolean;
  systemPrompt: string | null;
  ctx: ToolContext | null;
  checkpoints: CheckpointManager | null;
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
}

function extractTextFromPrompt(prompt: acp.ContentBlock[] | undefined): string {
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function createAcpAgent(opts: AcpServerOptions): acp.AgentApp {
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
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params));
}

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin);
  const stream = acp.ndJsonStream(input, output);
  return createAcpAgent(opts).connect(stream);
}
