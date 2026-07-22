/**
 * 远程适配器 — 统一 local/remote 连接抽象。
 *
 * local 模式:直接实例化 AgentCore,在进程内调用 sendMessage。
 * remote 模式:实例化 TuiClient 连接远程 server,通过 WebSocket 收发。
 */

import {
  AgentCore,
  type AgentCoreOptions,
  type AgentEvent,
  type SendMessageResult,
} from '../server/agent-core.js';
import { connectToServer, type TuiClient } from './tui-client.js';

export type AgentMode = 'local' | 'remote';

export interface CreateAgentOptions {
  mode: AgentMode;
  /** remote 模式必填 */
  url?: string;
  token?: string;
  /** local 模式必填 */
  workspacePath?: string;
  model?: string;
  apiUrl?: string;
  apiKey?: string;
  maxIterations?: number;
  permissionMode?: AgentCoreOptions['permissionMode'];
  enableMcp?: boolean;
  allowDangerous?: boolean;
}

export type AgentHandle =
  | { mode: 'local'; core: AgentCore }
  | { mode: 'remote'; client: TuiClient };

export async function createAgent(opts: CreateAgentOptions): Promise<AgentHandle> {
  if (opts.mode === 'remote') {
    if (!opts.url) throw new Error('remote 模式需要 url');
    const client = await connectToServer({ url: opts.url, token: opts.token });
    return { mode: 'remote', client };
  }

  if (!opts.workspacePath) throw new Error('local 模式需要 workspacePath');
  if (!opts.model) throw new Error('local 模式需要 model');
  if (!opts.apiUrl) throw new Error('local 模式需要 apiUrl');

  const core = new AgentCore({
    workspacePath: opts.workspacePath,
    model: opts.model,
    apiUrl: opts.apiUrl,
    apiKey: opts.apiKey,
    maxIterations: opts.maxIterations,
    permissionMode: opts.permissionMode,
    enableMcp: opts.enableMcp,
    allowDangerous: opts.allowDangerous,
  });
  return { mode: 'local', core };
}

/** 统一发送消息接口:无论 local/remote,都返回流式事件回调注册器 + 完成 Promise */
export interface UnifiedAgent {
  send(
    text: string,
    onEvent: (event: AgentEvent) => void,
    opts?: { sessionId?: string },
  ): Promise<SendMessageResult>;
  close(): void;
}

export async function sendUnified(
  handle: AgentHandle,
  text: string,
  onEvent: (event: AgentEvent) => void,
  opts?: { sessionId?: string },
): Promise<SendMessageResult> {
  if (handle.mode === 'local') {
    return handle.core.sendMessage(text, onEvent, opts);
  }
  // remote 模式:WebSocket client
  handle.client.on('event', onEvent);
  await handle.client.send(text);
  // remote 模式无法同步返回 SendMessageResult(client 通过 done event 传递),
  // 这里返回一个占位结果,实际结果通过 onEvent 的 done 事件获取
  return {
    sessionId: opts?.sessionId ?? '',
    stopReason: 'end_turn',
    iterations: 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
  };
}
