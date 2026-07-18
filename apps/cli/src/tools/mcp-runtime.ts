/**
 * MCP Runtime — MCP 服务器连接与工具调用运行时。
 *
 * 灵感来源:参考行业 Agent 框架的 MCP crate 设计,实现完整的 MCP server 连接和工具调用。
 * 简化策略(做减法):
 *   - stdio transport:spawn 子进程,通过 stdin/stdout 通信(JSON-RPC 2.0 over stdio)
 *   - http transport:用 fetch POST 发送 JSON-RPC,响应即 POST 响应
 *   - sse transport:GET 建立 SSE 长连接,后续 POST 到 endpoint,响应通过 SSE 流推送
 *   - 工具枚举:调用 tools/list,将 MCP 工具转为 Tool 接口
 *   - 工具调用转发:Agent 调用时,转发到 MCP server 的 tools/call
 *   - resources:调用 resources/list / resources/read(预加载可选,不支持时静默)
 *   - prompts:调用 prompts/list / prompts/get(预加载可选,不支持时静默)
 *
 * JSON-RPC 2.0 消息格式:
 *   请求:{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
 *   响应:{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
 *
 * MCP over SSE 协议:
 *   1. GET <url> 拿 SSE 流(header Accept: text/event-stream)
 *   2. 服务器推送 endpoint 事件,告知后续 POST 的目标 URL
 *   3. RPC 请求 POST 到 endpoint,body 是 JSON-RPC 2.0
 *   4. 响应以 message 事件形式通过 SSE 流推送回来
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import { getMcpConfigPath, type McpServer } from '../commands/mcp-config.js';
import type { Tool, ToolResult, ToolContext, ToolParameter } from './index.js';

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface McpPromptResult {
  description?: string;
  messages: McpPromptMessage[];
}

export interface McpConnection {
  server: McpServer;
  tools: McpToolDef[];
  process?: ChildProcess;
  connected: boolean;
  transport: 'stdio' | 'http' | 'sse';
  /** 认证 headers(含 Authorization),http/sse 路径复用 */
  headers?: Record<string, string>;
  /** sse 专用:长连接 abort 控制器 */
  sseAbortController?: AbortController;
  /** sse 专用:POST 目标 URL(endpoint 事件推送) */
  sseEndpoint?: string;
  /** sse 专用:等待响应的 pending Map,id → resolver */
  ssePending: Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  /** sse 专用:下一个 JSON-RPC id */
  sseNextId: number;
  /** resources/list 预加载结果(不支持 resources 的 server 为空数组) */
  resources?: McpResource[];
  /** prompts/list 预加载结果(不支持 prompts 的 server 为空数组) */
  prompts?: McpPrompt[];
}

let _nextId = 1;

function nextId(): number {
  return _nextId++;
}

async function sendStdioRpc(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 10_000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!proc.stdin || !proc.stdout) {
      reject(new Error('子进程 stdin/stdout 不可用'));
      return;
    }
    const stdout = proc.stdout;
    const id = nextId();
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    const timer = setTimeout(() => {
      reject(new Error(`MCP 请求超时: ${method} (${timeoutMs}ms)`));
    }, timeoutMs);

    const onData = (data: Buffer): void => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { id?: number; error?: { message?: string }; result?: unknown };
          if (parsed.id === id) {
            clearTimeout(timer);
            stdout.off('data', onData);
            if (parsed.error) {
              reject(new Error(parsed.error.message || 'MCP 错误'));
            } else {
              resolve(parsed.result);
            }
            return;
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    };

    stdout.on('data', onData);
    proc.stdin.write(msg);
  });
}

/** 发送 JSON-RPC notification(无 id,无需响应),不分配 id 也不等待。 */
function sendStdioNotification(
  proc: ChildProcess,
  method: string,
  params: Record<string, unknown> = {},
): void {
  if (!proc.stdin) {
    throw new Error('子进程 stdin 不可用');
  }
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  proc.stdin.write(msg);
}

async function sendHttpRpc(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  timeoutMs = 10_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = (await resp.json()) as { error?: { message?: string }; result?: unknown };
    if (json.error) throw new Error(json.error.message || 'MCP 错误');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 解析 SSE 流(text/event-stream),每个完整事件回调一次。
 * 事件由空行分隔;event: 行指定事件名(默认 message);data: 行累积为数据(多行用 \n 连接)。
 * 兼容 LF 与 CRLF 行尾;以 : 开头的行视为注释忽略。
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let dataLines: string[] = [];

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith(':')) continue; // 注释行
        if (line === '') {
          // 空行 = 事件结束
          if (dataLines.length > 0) {
            onEvent(currentEvent, dataLines.join('\n'));
          }
          currentEvent = 'message';
          dataLines = [];
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 轮询 predicate,在超时前满足返回 true,超时返回 false。 */
function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      if (predicate()) resolve(true);
      else if (Date.now() - start >= timeoutMs) resolve(false);
      else setTimeout(check, 50);
    };
    check();
  });
}

/**
 * 通过 SSE 通道发送 JSON-RPC:POST 到 sseEndpoint,响应通过 SSE 流异步推送回来。
 * 内部用 pending Map 关联请求 id 与 Promise;POST 失败或超时则 reject。
 * 采用 fire-and-forget POST(响应不依赖 POST 返回值,而依赖 SSE message 事件)。
 */
function sendSseRpc(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 10_000,
): Promise<unknown> {
  if (!conn.sseEndpoint) return Promise.reject(new Error('SSE endpoint 未就绪'));
  const endpoint = conn.sseEndpoint;
  const id = conn.sseNextId++;

  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.ssePending.delete(id);
      reject(new Error(`SSE RPC 超时: ${method}`));
    }, timeoutMs);

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.ssePending.delete(id);
      fn();
    };

    conn.ssePending.set(id, {
      resolve: (v: unknown) => settle(() => resolve(v)),
      reject: (e: Error) => settle(() => reject(e)),
    });

    // POST 到 endpoint(响应经由 SSE 流返回);非 2xx 或网络错误时 reject pending
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(conn.headers ?? {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: conn.sseAbortController?.signal,
    }).then(
      (resp) => {
        if (resp.ok) return; // 成功提交,等待 SSE 流推送响应
        settle(() => reject(new Error(`SSE POST 失败: ${resp.status} ${resp.statusText}`)));
      },
      (err: unknown) => {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
      },
    );
  });
}

/**
 * 连接单个 MCP server:按 transport 完成 initialize + tools/list + resources/prompts 预加载。
 * 失败时调用 disconnectMcpServer 清理资源并抛错。
 *
 * P1-6 export 给 ManagedMcpClient 在 reconnect 时复用。
 */
export async function connectMcpServer(server: McpServer): Promise<McpConnection> {
  const transport = server.transport ?? 'stdio';
  const conn: McpConnection = {
    server,
    tools: [],
    connected: false,
    transport,
    ssePending: new Map(),
    sseNextId: 1,
  };

  try {
    if (transport === 'stdio') {
      if (!server.command) throw new Error('stdio transport 需要 command');
      const proc = spawn(server.command, server.args ?? [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.env },
        windowsHide: true,
      });
      proc.stderr?.on('data', () => { /* 忽略 stderr */ });
      conn.process = proc;

      await sendStdioRpc(proc, 'initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      });
      sendStdioNotification(proc, 'notifications/initialized', {});
    } else if (transport === 'http') {
      if (!server.url) throw new Error('http transport 需要 url');
      const headers: Record<string, string> = { ...(server.headers ?? {}) };
      if (server.api_key) headers['Authorization'] = `Bearer ${server.api_key}`;
      if (server.auth?.token) headers['Authorization'] = `Bearer ${server.auth.token}`;
      conn.headers = headers;

      await sendHttpRpc(server.url, 'initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      }, headers);
    } else if (transport === 'sse') {
      if (!server.url) throw new Error('sse transport 需要 url');
      const headers: Record<string, string> = { ...(server.headers ?? {}) };
      if (server.api_key) headers['Authorization'] = `Bearer ${server.api_key}`;
      if (server.auth?.token) headers['Authorization'] = `Bearer ${server.auth.token}`;
      conn.headers = headers;
      conn.sseAbortController = new AbortController();

      // 1. 建立 SSE 长连接(GET,text/event-stream)
      const sseResponse = await fetch(server.url, {
        headers: { Accept: 'text/event-stream', ...headers },
        signal: conn.sseAbortController.signal,
      });
      if (!sseResponse.ok || !sseResponse.body) {
        throw new Error(`SSE 连接失败: ${sseResponse.status} ${sseResponse.statusText}`);
      }

      // 2. 启动后台 reader 解析 SSE 事件
      const sseBody = sseResponse.body;
      readSseStream(
        sseBody,
        (event, data) => {
          if (event === 'endpoint') {
            // 服务器告知后续 POST 的目标 URL(可能是相对路径,基于 server.url 解析)
            conn.sseEndpoint = new URL(data.trim(), server.url).toString();
          } else if (event === 'message') {
            try {
              const msg = JSON.parse(data) as {
                id?: string | number;
                error?: { message?: string };
                result?: unknown;
              };
              const pendingId = msg.id;
              if (pendingId === undefined) return;
              const pending = conn.ssePending.get(pendingId);
              if (pending) {
                conn.ssePending.delete(pendingId);
                if (msg.error) {
                  pending.reject(new Error(msg.error.message ?? 'SSE RPC error'));
                } else {
                  pending.resolve(msg.result);
                }
              }
            } catch {
              // 忽略非 JSON 消息
            }
          }
        },
        conn.sseAbortController.signal,
      ).catch(() => {
        // 流关闭或被 abort,静默处理(pending 请求由超时或 disconnect 清理)
      });

      // 3. 等待 endpoint 事件(5s 超时)
      const endpointReady = await waitFor(() => !!conn.sseEndpoint, 5000);
      if (!endpointReady) throw new Error('SSE 未在 5s 内推送 endpoint 事件');

      // 4. 发送 initialize(POST 到 endpoint,等 SSE 流响应)
      await sendSseRpc(conn, 'initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      });
    }

    const toolsResult = await callMcpServer(conn, 'tools/list', {}) as { tools?: McpToolDef[] } | null;
    conn.tools = toolsResult?.tools ?? [];
    conn.connected = true;

    // 可选预加载 resources/prompts:不支持这两个方法的 server 会返回错误,静默忽略
    try {
      await listMcpResources(conn);
    } catch {
      // server 不支持 resources(method not found 等),静默
    }
    try {
      await listMcpPrompts(conn);
    } catch {
      // server 不支持 prompts(method not found 等),静默
    }
  } catch (err) {
    disconnectMcpServer(conn);
    throw err;
  }

  return conn;
}

/**
 * 统一 RPC 入口:按 transport 路由到 stdio/sse/http,返回 { result } 形式的响应。
 * 出错时直接抛出(由调用方决定是否 try/catch)。callMcpServer 与 resources/prompts 函数均复用此函数。
 */
async function sendRpc(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<{ result?: unknown }> {
  const transport = conn.transport;
  if (transport === 'stdio') {
    if (!conn.process) throw new Error('stdio 连接未建立');
    const result = await sendStdioRpc(conn.process, method, params);
    return { result };
  } else if (transport === 'sse') {
    const result = await sendSseRpc(conn, method, params);
    return { result };
  } else {
    if (!conn.server.url) throw new Error('URL 未配置');
    const result = await sendHttpRpc(conn.server.url, method, params, conn.headers ?? {});
    return { result };
  }
}

// P1-5 hub mcp-adapter:导出供 adapter 转发 tools/call 调用(零行为变更,仅加 export)
export async function callMcpServer(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const resp = await sendRpc(conn, method, params);
  return resp.result;
}

export function parseMcpResourcesResponse(resp: unknown): McpResource[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const resources = (result as { resources?: unknown }).resources;
  if (!Array.isArray(resources)) return [];
  return resources.filter(
    (r): r is McpResource =>
      r !== null && typeof r === 'object' && typeof (r as { uri?: unknown }).uri === 'string',
  );
}

export function parseMcpResourceContents(resp: unknown): McpResourceContent[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const contents = (result as { contents?: unknown }).contents;
  if (!Array.isArray(contents)) return [];
  return contents.filter(
    (c): c is McpResourceContent =>
      c !== null && typeof c === 'object' && typeof (c as { uri?: unknown }).uri === 'string',
  );
}

export function parseMcpPromptsResponse(resp: unknown): McpPrompt[] {
  if (!resp || typeof resp !== 'object') return [];
  const result = (resp as { result?: unknown }).result;
  if (!result || typeof result !== 'object') return [];
  const prompts = (result as { prompts?: unknown }).prompts;
  if (!Array.isArray(prompts)) return [];
  return prompts.filter(
    (p): p is McpPrompt =>
      p !== null && typeof p === 'object' && typeof (p as { name?: unknown }).name === 'string',
  );
}

export async function listMcpResources(conn: McpConnection): Promise<McpResource[]> {
  const resp = await sendRpc(conn, 'resources/list', {});
  const resources = parseMcpResourcesResponse(resp);
  conn.resources = resources;
  return resources;
}

export async function readMcpResource(
  conn: McpConnection,
  uri: string,
): Promise<McpResourceContent[]> {
  const resp = await sendRpc(conn, 'resources/read', { uri });
  return parseMcpResourceContents(resp);
}

export async function listMcpPrompts(conn: McpConnection): Promise<McpPrompt[]> {
  const resp = await sendRpc(conn, 'prompts/list', {});
  const prompts = parseMcpPromptsResponse(resp);
  conn.prompts = prompts;
  return prompts;
}

export async function getMcpPrompt(
  conn: McpConnection,
  name: string,
  args?: Record<string, string>,
): Promise<McpPromptResult> {
  const resp = await sendRpc(conn, 'prompts/get', { name, arguments: args ?? {} });
  const result = resp.result as McpPromptResult | undefined;
  if (!result || !Array.isArray(result.messages)) {
    return { messages: [] };
  }
  return result;
}

function disconnectMcpServer(conn: McpConnection): void {
  // 中断 SSE 长连接
  if (conn.transport === 'sse' && conn.sseAbortController) {
    conn.sseAbortController.abort();
  }
  if (conn.process) {
    try {
      conn.process.kill();
    } catch {
      // 忽略
    }
    conn.process = undefined;
  }
  // 清理 SSE pending 请求,避免调用方永久挂起
  for (const [, { reject }] of conn.ssePending) {
    reject(new Error('连接已断开'));
  }
  conn.ssePending.clear();
  conn.connected = false;
}

/** P1-6 export 给 ManagedMcpClient 在 markDead 时清理连接 */
export function disconnectMcpConnection(conn: McpConnection): void {
  disconnectMcpServer(conn);
}

function convertSchema(schema: unknown): Record<string, ToolParameter> {
  if (!schema || typeof schema !== 'object') return {};
  const props = (schema as { properties?: Record<string, unknown> }).properties;
  if (!props || typeof props !== 'object') return {};
  const result: Record<string, ToolParameter> = {};
  for (const [name, val] of Object.entries(props)) {
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      result[name] = {
        type: (v.type as ToolParameter['type']) ?? 'string',
        description: (v.description as string) ?? '',
        enum: v.enum as string[] | undefined,
      };
    }
  }
  return result;
}

function mcpToolToTool(conn: McpConnection, mcpTool: McpToolDef): Tool {
  const params = convertSchema(mcpTool.inputSchema);
  const required = mcpTool.inputSchema.required ?? [];
  const serverName = conn.server.name;

  return {
    name: mcpTool.name,
    description: mcpTool.description ?? `MCP 工具 (${serverName})`,
    parameters: params,
    required,
    async execute(args): Promise<ToolResult> {
      try {
        const raw = await callMcpServer(conn, 'tools/call', {
          name: mcpTool.name,
          arguments: args,
        });
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
    },
  };
}

export async function loadMcpTools(_ctx: ToolContext): Promise<Tool[]> {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return [];

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { servers: McpServer[] };
    const allTools: Tool[] = [];

    for (const server of config.servers ?? []) {
      try {
        const conn = await connectMcpServer(server);
        for (const mcpTool of conn.tools) {
          allTools.push(mcpToolToTool(conn, mcpTool));
        }
      } catch {
        // 单个 server 连接失败不阻塞其他
      }
    }

    return allTools;
  } catch {
    return [];
  }
}

/**
 * 加载所有已配置的 MCP server 并返回 McpConnection 列表(不做 mcpToolToTool 转换)。
 * 供 hub mcp-adapter 路径使用:adapter 直接基于 McpConnection 注册 ToolHandle 到 hub。
 * 单个 server 连接失败不阻塞其他(只 log warn 由调用方决定)。
 */
export async function loadMcpConnections(_ctx: ToolContext): Promise<McpConnection[]> {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return [];

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { servers: McpServer[] };
    const conns: McpConnection[] = [];

    for (const server of config.servers ?? []) {
      try {
        const conn = await connectMcpServer(server);
        conns.push(conn);
      } catch {
        // 单个 server 连接失败不阻塞其他
      }
    }

    return conns;
  } catch {
    return [];
  }
}

// ==================== P1-6 MCP 深化:ManagedMcpClient + HTTP backoff ====================
// feature flag(settings.mcp.advanced.enabled)默认关闭,关闭时完全等同原行为(零回归)。
// 启用后:ManagedMcpClient 提供 liveness ping + 自动重连 + dead 检测;
//       createHttpMcpClientWithBackoff 提供 SSE 重连指数退避。

/**
 * 带指数退避重连的 HTTP MCP 客户端创建器(对齐 cli mcp_http_client.rs 思路)。
 *
 * 包装 StreamableHttpClientTransport 行为(此处用现有 sendHttpRpc 复用):
 *   - 初次连接失败 → 等待 backoff(1s)重试
 *   - 后续失败 → 退避翻倍(1s → 2s → 4s → 8s → 16s → 30s 上限)
 *   - 成功 → 重置 backoff
 *   - 达到 maxRetries 仍失败 → 抛最后一次错误
 *
 * 与 ManagedMcpClient 的关系:createHttpMcpClientWithBackoff 负责单次连接的退避重试;
 * ManagedMcpClient 负责"已建立连接后"的 liveness 维护与重连。
 *
 * options.connectFn 支持注入连接工厂(测试用,生产默认用 connectMcpServer)。
 */
export async function createHttpMcpClientWithBackoff(
  server: McpServer,
  options: {
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
    /** 连接工厂(测试用,生产默认用 connectMcpServer) */
    connectFn?: (server: McpServer) => Promise<McpConnection>;
  } = {},
): Promise<McpConnection> {
  const maxRetries = options.maxRetries ?? 5;
  const initialBackoffMs = options.initialBackoffMs ?? 1000;
  const maxBackoffMs = options.maxBackoffMs ?? 30_000;
  const connectFn = options.connectFn ?? ((s) => connectMcpServer(s));

  let lastErr: unknown = null;
  let backoff = initialBackoffMs;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const conn = await connectFn(server);
      return conn;
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      // 等待退避后重试
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'createHttpMcpClientWithBackoff 失败'));
}

/**
 * ManagedMcpClient — 封装 McpConnection + 自动重连 + liveness ping + dead 检测。
 *
 * 行为:
 *   - ensureConnected():无连接或被 markDead → reconnect;存活则直接返回
 *   - callTool(name, args):ensureConnected 后转发,成功重置 consecutiveFailures;
 *     失败累计 ≥ DEAD_THRESHOLD → markDead(后续 ensureConnected 触发重连)
 *   - ping():发送 MCP ping,30s 内已 ping 过则跳过(避免高频)
 *   - reconnect():指数退避(1s → 2s → 4s → 8s → 16s → 30s 上限)
 *   - markDead():置 deadMarkedAt,清理 client,下次 ensureConnected 必重连
 *
 * 状态查询:
 *   - isAlive():alive 窗口内(30s)且未 markDead
 *   - getStatus():返回 liveness 快照(alive/dead/reconnecting + consecutiveFailures + lastPingAt)
 *
 * 构造参数 options 支持覆盖 backoff / ping 间隔 / dead 阈值(测试用,生产用默认值)。
 */
export class ManagedMcpClient {
  private conn: McpConnection | null = null;
  private lastPingAt = 0;
  private consecutiveFailures = 0;
  private deadMarkedAt = 0;
  private reconnectBackoffMs: number;
  private readonly initialBackoffMs: number;
  private readonly MAX_BACKOFF_MS: number;
  private readonly PING_INTERVAL_MS: number;
  private readonly DEAD_THRESHOLD: number;
  private readonly connectFn: (server: McpServer) => Promise<McpConnection>;

  constructor(
    private readonly server: McpServer,
    options: {
      initialBackoffMs?: number;
      maxBackoffMs?: number;
      pingIntervalMs?: number;
      deadThreshold?: number;
      /**
       * 连接工厂(测试用,生产默认用 connectMcpServer)。
       * 注入 mock 可控制连接成功/失败,无需真实 MCP server。
       */
      connectFn?: (server: McpServer) => Promise<McpConnection>;
      /**
       * RPC 调用工厂(测试用,生产默认用 callMcpServer)。
       * 注入 mock 可控制 tool 调用 / ping 的成功/失败。
       */
      callFn?: (conn: McpConnection, method: string, params: Record<string, unknown>) => Promise<unknown>;
    } = {},
  ) {
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.reconnectBackoffMs = this.initialBackoffMs;
    this.MAX_BACKOFF_MS = options.maxBackoffMs ?? 30_000;
    this.PING_INTERVAL_MS = options.pingIntervalMs ?? 30_000;
    this.DEAD_THRESHOLD = options.deadThreshold ?? 3;
    this.connectFn = options.connectFn ?? ((s) => connectMcpServer(s));
    this.callFn = options.callFn ?? ((c, m, p) => callMcpServer(c, m, p));
  }

  private readonly callFn: (conn: McpConnection, method: string, params: Record<string, unknown>) => Promise<unknown>;

  /** 确保已连接且存活;否则触发重连 */
  async ensureConnected(): Promise<McpConnection> {
    if (this.conn && this.isAlive()) {
      return this.conn;
    }
    await this.reconnect();
    return this.conn!;
  }

  /** 调用 MCP tool(经 ensureConnected);失败累计达阈值则 markDead */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const conn = await this.ensureConnected();
    try {
      const result = await this.callFn(conn, 'tools/call', { name, arguments: args });
      this.consecutiveFailures = 0;
      return result;
    } catch (err) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
        this.markDead();
      }
      throw err;
    }
  }

  /** 发送 MCP ping 检测存活;30s 内已 ping 过则跳过(返回 true) */
  async ping(): Promise<boolean> {
    if (Date.now() - this.lastPingAt < this.PING_INTERVAL_MS) {
      return true;
    }
    if (!this.conn || this.deadMarkedAt > 0) {
      return false;
    }
    try {
      // MCP ping 方法无 params,无 result;成功即存活
      await this.callFn(this.conn, 'ping', {});
      this.lastPingAt = Date.now();
      return true;
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
        this.markDead();
      }
      return false;
    }
  }

  /** 显式断开,清理资源(进程 kill / SSE abort) */
  async disconnect(): Promise<void> {
    if (this.conn) {
      disconnectMcpConnection(this.conn);
      this.conn = null;
    }
    this.deadMarkedAt = 0;
    this.consecutiveFailures = 0;
    this.lastPingAt = 0;
  }

  /** 当前是否 alive:未 markDead 且 30s 内有 ping 或刚连接 */
  isAlive(): boolean {
    if (this.deadMarkedAt > 0) return false;
    if (!this.conn) return false;
    return Date.now() - this.lastPingAt < this.PING_INTERVAL_MS;
  }

  /** 获取 liveness 快照(供 ACP x.ai/mcp/serverStatus 返回) */
  getStatus(): {
    serverName: string;
    alive: boolean;
    dead: boolean;
    consecutiveFailures: number;
    lastPingAt: number;
    connected: boolean;
  } {
    return {
      serverName: this.server.name,
      alive: this.isAlive(),
      dead: this.deadMarkedAt > 0,
      consecutiveFailures: this.consecutiveFailures,
      lastPingAt: this.lastPingAt,
      connected: !!this.conn?.connected,
    };
  }

  /** 获取已缓存的 tools 列表(reconnect 后填充) */
  getTools(): McpToolDef[] {
    return this.conn?.tools ?? [];
  }

  /** 获取底层 McpConnection(reconnect 后才有值) */
  getConnection(): McpConnection | null {
    return this.conn;
  }

  /** 获取当前退避值(测试用,验证指数退避) */
  getCurrentBackoffMs(): number {
    return this.reconnectBackoffMs;
  }

  /**
   * 重连:指数退避 → connectMcpServer → 重置状态。
   * 失败时继续翻倍 backoff,但不抛错(下次 ensureConnected 会再试)。
   *
   * 注意:此处不抛错是为了让 ManagedMcpClient 的调用方在多个 server 中
   * 一个连接失败时不影响其他 server。状态由 isAlive/getStatus 暴露。
   */
  private async reconnect(): Promise<void> {
    // 等待退避(首次 1s,后续翻倍)
    await new Promise((r) => setTimeout(r, this.reconnectBackoffMs));
    this.reconnectBackoffMs = Math.min(this.reconnectBackoffMs * 2, this.MAX_BACKOFF_MS);

    // 清理旧连接
    if (this.conn) {
      try {
        disconnectMcpConnection(this.conn);
      } catch {
        // 忽略
      }
      this.conn = null;
    }

    try {
      this.conn = await this.connectFn(this.server);
      this.deadMarkedAt = 0;
      this.consecutiveFailures = 0;
      this.lastPingAt = Date.now();
      // 成功后重置 backoff(下次失败从头开始)
      this.reconnectBackoffMs = this.initialBackoffMs;
    } catch {
      // 连接失败:保持 deadMarkedAt = 0 让下次 ensureConnected 再试
      // consecutiveFailures 不重置,以便累计达 DEAD_THRESHOLD 后 markDead
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.DEAD_THRESHOLD) {
        this.markDead();
      }
    }
  }

  /** 标记为 dead:置 deadMarkedAt,清理 client */
  private markDead(): void {
    this.deadMarkedAt = Date.now();
    if (this.conn) {
      try {
        disconnectMcpConnection(this.conn);
      } catch {
        // 忽略
      }
      this.conn = null;
    }
  }
}

/**
 * P1-6 全局 ManagedMcpClient 注册表(单进程)。
 * feature flag 启用时,由 setupAgentTools 调用 registerManagedClient;
 * ACP x.ai/mcp/* 扩展方法通过此注册表查询 server 状态 / 转发 tool 调用。
 */
const managedClients = new Map<string, ManagedMcpClient>();

/** 注册 ManagedMcpClient(按 server.name 索引) */
export function registerManagedClient(client: ManagedMcpClient): void {
  managedClients.set(client.getStatus().serverName, client);
}

/** 注销 ManagedMcpClient */
export function unregisterManagedClient(serverName: string): void {
  managedClients.delete(serverName);
}

/** 获取单个 ManagedMcpClient(不存在返回 undefined) */
export function getManagedClient(serverName: string): ManagedMcpClient | undefined {
  return managedClients.get(serverName);
}

/** 列出所有 ManagedMcpClient 状态快照 */
export function listManagedClients(): Array<ReturnType<ManagedMcpClient['getStatus']>> {
  return Array.from(managedClients.values()).map((c) => c.getStatus());
}

/** 清空所有 ManagedMcpClient(测试用) */
export function clearManagedClients(): void {
  managedClients.clear();
}
