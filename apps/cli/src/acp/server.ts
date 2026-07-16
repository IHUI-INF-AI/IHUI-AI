/**
 * ACP (Agent Client Protocol) server — 让 IHUI CLI 可被 Zed/VSCode+ACP 扩展/Cursor 等编辑器作为 agent 后端启动。
 *
 * 协议规范:https://agentclientprotocol.com
 * SDK:@agentclientprotocol/sdk
 *
 * 启动方式:ihui acp
 * 编辑器侧配置示例(Zed agents.json):
 *   { "ihui": { "command": "ihui", "args": ["acp"] } }
 */

import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { streamChat, setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { createSession, saveSession, type Session } from '../commands/session.js';

export interface AcpServerOptions {
  apiUrl: string;
  apiKey?: string;
  modelId: string;
  maxIterations: number;
}

interface AcpSessionState {
  session: Session;
  pendingAbort: AbortController | null;
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
        loadSession: false,
      },
    };
  }

  async authenticate(_params: acp.AuthenticateRequest): Promise<acp.AuthenticateResponse> {
    return {};
  }

  async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    const session = createSession(params.cwd, this.opts.modelId);
    const state: AcpSessionState = { session, pendingAbort: null };
    this.sessions.set(session.id, state);
    return { sessionId: session.id };
  }

  async prompt(
    params: acp.PromptRequest,
    cx: acp.AgentContext,
  ): Promise<acp.PromptResponse> {
    const state = this.sessions.get(params.sessionId);
    if (!state) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    state.pendingAbort?.abort();
    const abort = new AbortController();
    state.pendingAbort = abort;

    const userText = extractTextFromPrompt(params.prompt);
    state.session.history.push({ role: 'user', content: userText });

    let assistantText = '';
    try {
      await streamChat({
        model: this.opts.modelId,
        messages: state.session.history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        signal: abort.signal,
        onDelta: async (delta) => {
          assistantText += delta;
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

      if (assistantText) {
        state.session.history.push({ role: 'assistant', content: assistantText });
      }
      saveSession(state.session);
      return { stopReason: 'end_turn' };
    } catch (err) {
      if (abort.signal.aborted) {
        if (assistantText) {
          state.session.history.push({ role: 'assistant', content: assistantText });
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

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin);
  const stream = acp.ndJsonStream(input, output);

  const agent = new IhuiAcpAgent(opts);
  return acp
    .agent({ name: 'ihui-cli' })
    .onRequest('initialize', (ctx) => agent.initialize(ctx.params))
    .onRequest('authenticate', (ctx) => agent.authenticate(ctx.params))
    .onRequest('session/new', (ctx) => agent.newSession(ctx.params))
    .onRequest('session/prompt', (ctx) => agent.prompt(ctx.params, ctx.client))
    .onRequest('session/close', (ctx) => {
      agent.closeSession?.(ctx.params);
      return {};
    })
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params))
    .connect(stream);
}
