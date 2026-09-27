// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 内核 — 封装 setupAgentTools + runToolLoop,提供可被 HTTP/WS server 调用的纯函数式接口。
 *
 * 设计:AgentCore 持有 workspacePath/model/apiUrl 等 agent 配置,管理多个 session 状态,
 * sendMessage(text, onEvent) 流式推送 token/tool_call/tool_result/done 事件。
 * 不依赖任何 IO 层(console/http/ws),纯回调驱动,可被任意 client(HTTP/WS/TUI/ACP)复用。
 */

import { randomUUID } from 'node:crypto';
import { setBaseUrl, setTokenProvider, type ToolDeltaEvent } from '@ihui/api-client';
import {
  createToolDeltaBridge,
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
import { createDangerGate } from '../tools/danger-gate.js';

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
  /**
   * D113(2026-09-27)文件写类工具的**流中 diff 预览**帧。载荷字段沿用
   * `@ihui/api-client` 的 `ToolDeltaEvent`(toolCallId / seq / partialText / truncated?),
   * `partialText` 是累积文本(整帧替换渲染)。`name` 是本端补的关联线索 ——
   * `tool_call`/`tool_result` 都不带 toolCallId,HTTP/WS 消费方只能靠工具名归并。
   * 派生算法与预算**不在这里**:唯一出口 `src/tools/file-edit-preview.ts`(与服务端
   * llm.py 同语义),本面只搬运 runToolLoop 本地派生出的帧,不得自拼 JSON.stringify(args)。
   */
  | {
      type: 'tool_delta';
      name: string;
      toolCallId: string;
      seq: number;
      partialText: string;
      truncated?: boolean;
    }
  /**
   * 同一 toolCallId 的预览作废(工具落终态 / 流中断)。清场**先于** tool_result 发出,
   * 消费方撤下预览后才看见最终 diff —— 与 web/RN/小程序"result 到达即清 partialDiff"
   * 同一条纪律,靠更新同一 id 而不是再追加一条预览。
   */
  | { type: 'tool_delta_clear'; name: string; toolCallId: string }
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
      // 会话级旁路事实随 ctx 下发,工具层披露可追溯(L7905 收口)
      allowDangerous: this.opts.allowDangerous,
      subagentParent: {
        modelId: this.opts.model,
        apiUrl: this.opts.apiUrl,
        apiKey: this.opts.apiKey,
        allowDangerous: this.opts.allowDangerous,
      },
      // 策略收口到唯一出口:本端无人可问 ⇒ 无 prompt,flag 未开即 denied(fail-closed,与旧行为逐路径等价)
      confirmDangerous: createDangerGate({
        allowDangerous: this.opts.allowDangerous,
        silent: true,
      }),
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
      state.session.history.push({ id: randomUUID(), role: 'user', content: text });
    }

    const abort = new AbortController();
    state.abort = abort;
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => abort.abort(), { once: true });
    }

    try {
      // D113 三面接线之 agent-core:配对/清场走 commands/agent.ts 的同一份桥
      // (headless 面用它,REPL 用同构的 openPreviews) —— 两处算同一件事必漂移。
      const d113Bridge = createToolDeltaBridge();
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
          d113Bridge.noteToolCall(name);
          await onEvent({ type: 'tool_call', name, args });
        },
        // 本地派生的预览帧逐条转成 AgentEvent(帧序 seq 原样保留,消费方按 toolCallId 覆盖)。
        onToolDeltaFrames: async (events: ToolDeltaEvent[]) => {
          for (const fact of d113Bridge.onFrames(events)) {
            await onEvent({
              type: 'tool_delta',
              name: fact.toolName,
              toolCallId: fact.event.toolCallId,
              seq: fact.event.seq,
              partialText: fact.event.partialText,
              ...(fact.event.truncated === true ? { truncated: true } : {}),
            });
          }
        },
        onToolResult: async (name, success, output) => {
          // 先清预览再落结果(顺序反过来就是"结果与预览同屏")。
          const settled = d113Bridge.settle(name);
          if (settled) {
            await onEvent({ type: 'tool_delta_clear', name: settled.toolName, toolCallId: settled.toolCallId });
          }
          await onEvent({ type: 'tool_result', name, success, output });
        },
        onIteration: async (count, max) => {
          await onEvent({ type: 'iteration', count, max });
        },
        onError: async (message) => {
          // 流中断/报错:尚未落终态的预览全部作废并点名(留在账上的预览会被读成"已写成这样")。
          for (const stale of d113Bridge.abort()) {
            await onEvent({ type: 'tool_delta_clear', name: stale.toolName, toolCallId: stale.toolCallId });
          }
          await onEvent({ type: 'error', message });
        },
      });

      if (result.assistantText) {
        state.session.history.push({
          id: randomUUID(),
          role: 'assistant',
          content: result.assistantText,
        });
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
