/**
 * ACP (Agent Client Protocol) server — 让 IHUI CLI 可被 Zed/VSCode+ACP 扩展/Cursor 等编辑器作为 agent 后端启动。
 *
 * 协议规范:https://agentclientprotocol.com
 * SDK:@agentclientprotocol/sdk
 *
 * 启动方式:`ihui acp` (默认 stdio NDJSON 传输)
 * 集成方法:
 *
 * **Zed** (`~/.config/zed/settings.json` 或工作区 `.zed/settings.json`):
 * ```json
 * {
 *   "agent_servers": {
 *     "ihui": {
 *       "command": "ihui",
 *       "args": ["acp"]
 *     }
 *   }
 * }
 * ```
 *
 * **VSCode** (需安装支持 ACP 的扩展,如 `agent-client-protocol` 扩展):
 * ```json
 * // settings.json
 * {
 *   "agent.servers": {
 *     "ihui": { "command": "ihui", "args": ["acp"] }
 *   }
 * }
 * ```
 *
 * **Cursor** (实验性 ACP 支持,settings.json):
 * ```json
 * {
 *   "acp.servers": [
 *     { "name": "ihui", "command": "ihui", "args": ["acp"] }
 *   ]
 * }
 * ```
 *
 * 工具循环集成:session/prompt 调用 runToolLoop,Agent 可自主调用工具读写文件。
 * 协议方法实现:initialize / authenticate / session/{new,load,prompt,close} / session/cancel。
 * Token 成本:在 session/prompt 完成后通过 session/update 通知 agent_message_chunk,
 *           Editor 可在状态栏/侧边栏展示。
 *
 * 危险工具(默认拒绝):Editor 内无交互确认通道,需在 `~/.ihui/settings.json` 设置
 * `allowDangerous: true` 或启动时加 `--allow-dangerous` flag(自负风险)。
 *
 * MCP 工具:启动时加 `--mcp` flag 启用,自动从 `~/.ihui/mcp.json` 加载 MCP 服务器工具。
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
}

function extractTextFromPrompt(prompt: acp.ContentBlock[] | undefined): string {
  if (!Array.isArray(prompt)) return '';
  return prompt
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
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
    .onNotification('session/cancel', (ctx) => agent.cancel(ctx.params));
}

export function startAcpServer(opts: AcpServerOptions): acp.AgentConnection {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin);
  const stream = acp.ndJsonStream(input, output);
  return createAcpAgent(opts).connect(stream);
}
