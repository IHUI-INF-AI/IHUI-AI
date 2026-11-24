// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 线协议（stdio NDJSON + JSON-RPC 2.0）的最小实现。
 *
 * 只覆盖 `ihui acp` 对外公开的帧形状（注册表见 apps/cli/src/acp/server.ts 的
 * `buildAcpAgentApp`）：一行一条 JSON-RPC 报文，无 Content-Length 头。
 *
 * 本文件刻意不 import 服务端实现、也不依赖 @agentclientprotocol/sdk：
 * 服务端内部可以继续演进，本 SDK 只跟着公开线协议走。
 */

/** ACP 提示词内容块。SDK 只强类型化 text，其余变体原样透传。 */
export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** ACP 规范定义的回合终止原因（服务端只会返回这五种）。 */
export type StopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';

export type PermissionOptionKind = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';

/** `session/request_permission` 中供用户选择的审批项。 */
export interface PermissionOption {
  optionId: string;
  name: string;
  kind: PermissionOptionKind;
}

/**
 * `session/update` 通知里的 update 载荷。
 * 不同 sessionUpdate 值携带不同字段，这里按线协议做扁平声明，调用方按
 * `sessionUpdate` 字符串收窄。
 */
export interface SessionUpdate {
  sessionUpdate: string;
  content?: ContentBlock;
  toolCallId?: string;
  title?: string;
  kind?: string;
  status?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
  [key: string]: unknown;
}

export type JsonRpcId = number | string;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export type AgentSdkErrorCode = 'PROTOCOL' | 'RPC' | 'SPAWN' | 'AGENT_EXIT' | 'ABORTED';

export interface AgentSdkErrorOptions {
  cause?: unknown;
  exitCode?: number | null;
  stderr?: string;
  data?: unknown;
}

/** SDK 的统一错误类型：调用方可按 `code` 区分协议错、RPC 错、进程退出与启动失败。 */
export class AgentSdkError extends Error {
  readonly code: AgentSdkErrorCode;
  readonly exitCode: number | null | undefined;
  readonly stderr: string | undefined;
  readonly data: unknown;

  constructor(code: AgentSdkErrorCode, message: string, options: AgentSdkErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AgentSdkError';
    this.code = code;
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;
    this.data = options.data;
  }
}

/** 把一条 JSON-RPC 报文编码成 NDJSON 行（JSON 转义保证不会出现裸换行）。 */
export function encodeMessage(message: JsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export type DecodeResult =
  | { kind: 'message'; message: JsonRpcMessage }
  | { kind: 'error'; lineNumber: number; raw: string; message: string };

/**
 * NDJSON 增量解码器：处理跨 chunk 半行、CRLF、空行。
 *
 * 坏行只产出一条 `error` 结果，**不中断**后续行 —— 单行损坏不应让整个会话失联，
 * 由调用方决定是否把该错误暴露给上层。
 */
export class NdjsonDecoder {
  private buffer = '';
  private lineNumber = 0;

  push(chunk: string): DecodeResult[] {
    this.buffer += chunk;
    const results: DecodeResult[] = [];
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      this.lineNumber += 1;
      if (line.trim() !== '') results.push(this.decodeLine(line));
      newline = this.buffer.indexOf('\n');
    }
    return results;
  }

  /** 流结束时冲刷最后一条没有换行结尾的行。 */
  flush(): DecodeResult[] {
    if (this.buffer.trim() === '') {
      this.buffer = '';
      return [];
    }
    this.lineNumber += 1;
    const line = this.buffer.replace(/\r$/, '');
    this.buffer = '';
    return [this.decodeLine(line)];
  }

  private decodeLine(line: string): DecodeResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { kind: 'error', lineNumber: this.lineNumber, raw: line, message: `invalid JSON: ${detail}` };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { kind: 'error', lineNumber: this.lineNumber, raw: line, message: 'JSON-RPC message is not an object' };
    }
    const record = parsed as Record<string, unknown>;
    if (record.jsonrpc !== '2.0') {
      return { kind: 'error', lineNumber: this.lineNumber, raw: line, message: 'unsupported jsonrpc version' };
    }
    const hasId = Object.prototype.hasOwnProperty.call(record, 'id');
    if (typeof record.method === 'string') {
      return hasId
        ? { kind: 'message', message: record as unknown as JsonRpcRequest }
        : { kind: 'message', message: record as unknown as JsonRpcNotification };
    }
    if (hasId && ('result' in record || 'error' in record)) {
      return { kind: 'message', message: record as unknown as JsonRpcResponse };
    }
    return { kind: 'error', lineNumber: this.lineNumber, raw: line, message: 'unrecognized JSON-RPC message' };
  }
}

export type JsonRpcRequestHandler = (params: unknown) => unknown | Promise<unknown>;
export type JsonRpcNotificationHandler = (params: unknown) => void;

export interface JsonRpcPeerOptions {
  /** 把一整行（含换行符）交给传输层；抛错视为发送失败。 */
  sendLine: (line: string) => void;
  /** 通知处理器同步抛错时的观测点（不改变协议流）。 */
  onHandlerError?: (message: string, error: unknown) => void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * JSON-RPC 2.0 对端：请求/响应按 id 关联，入站 request 交给注册的处理器。
 *
 * - `close()` 会把所有 pending 一次性 reject，避免子进程退出后调用方永久挂起；
 * - 入站请求的 handler 抛错回 `-32603`，未知方法回 `-32601`。
 */
export class JsonRpcPeer {
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly requestHandlers = new Map<string, JsonRpcRequestHandler>();
  private readonly notificationHandlers = new Map<string, JsonRpcNotificationHandler>();
  private closed: AgentSdkError | null = null;

  constructor(private readonly options: JsonRpcPeerOptions) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) return Promise.reject(this.closed);
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        method,
        resolve: (value) => resolve(value as T),
        reject,
      });
      try {
        this.options.sendLine(encodeMessage({ jsonrpc: '2.0', id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method: string, params?: unknown): void {
    this.options.sendLine(encodeMessage({ jsonrpc: '2.0', method, params }));
  }

  onRequest(method: string, handler: JsonRpcRequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  onNotification(method: string, handler: JsonRpcNotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  /** 结算一条已解码的入站报文。 */
  handleMessage(message: JsonRpcMessage): void {
    if ('method' in message) {
      if ('id' in message && message.id !== undefined && message.id !== null) {
        void this.dispatchRequest(message.id, message.method, message.params);
        return;
      }
      const handler = this.notificationHandlers.get(message.method);
      if (!handler) return;
      try {
        handler(message.params);
      } catch (error) {
        this.options.onHandlerError?.(`notification handler failed: ${message.method}`, error);
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if ('error' in message) {
      pending.reject(
        new AgentSdkError('RPC', `JSON-RPC ${pending.method} failed: ${message.error.message}`, {
          data: message.error.data,
        }),
      );
      return;
    }
    pending.resolve(message.result);
  }

  /** 终止对端：所有未结算请求立即 reject，之后的请求同步 reject。 */
  close(reason = 'JSON-RPC peer closed'): void {
    if (this.closed) return;
    this.closed = new AgentSdkError('PROTOCOL', reason);
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(this.closed);
    }
  }

  private async dispatchRequest(id: JsonRpcId, method: string, params: unknown): Promise<void> {
    const handler = this.requestHandlers.get(method);
    if (!handler) {
      this.respondError(id, -32601, `Method not found: ${method}`);
      return;
    }
    try {
      const result = await handler(params);
      this.sendSafely({ jsonrpc: '2.0', id, result: result ?? null });
    } catch (error) {
      this.respondError(id, -32603, error instanceof Error ? error.message : String(error));
    }
  }

  private respondError(id: JsonRpcId, code: number, message: string): void {
    this.sendSafely({ jsonrpc: '2.0', id, error: { code, message } });
  }

  private sendSafely(message: JsonRpcMessage): void {
    try {
      this.options.sendLine(encodeMessage(message));
    } catch (error) {
      this.options.onHandlerError?.('failed to send JSON-RPC response', error);
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
