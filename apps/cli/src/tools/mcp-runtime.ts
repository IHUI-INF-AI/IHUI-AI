/**
 * MCP Runtime — MCP 服务器连接与工具调用运行时。
 *
 * 灵感来源:cli 的 MCP crate(Rust),实现了完整的 MCP server 连接和工具调用。
 * 简化策略(做减法):
 *   - stdio transport:spawn 子进程,通过 stdin/stdout 通信(JSON-RPC 2.0 over stdio)
 *   - http transport:用 fetch POST 发送 JSON-RPC,响应即 POST 响应
 *   - sse transport:GET 建立 SSE 长连接,后续 POST 到 endpoint,响应通过 SSE 流推送
 *   - 工具枚举:调用 tools/list,将 MCP 工具转为 Tool 接口
 *   - 工具调用转发:Agent 调用时,转发到 MCP server 的 tools/call
 *   - 不实现 MCP 的 resources/prompts(仅 tools,做减法)
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

async function connectMcpServer(server: McpServer): Promise<McpConnection> {
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
  } catch (err) {
    disconnectMcpServer(conn);
    throw err;
  }

  return conn;
}

async function callMcpServer(
  conn: McpConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const transport = conn.transport;
  if (transport === 'stdio') {
    if (!conn.process) throw new Error('stdio 连接未建立');
    return sendStdioRpc(conn.process, method, params);
  } else if (transport === 'sse') {
    return sendSseRpc(conn, method, params);
  } else {
    // http
    if (!conn.server.url) throw new Error('URL 未配置');
    return sendHttpRpc(conn.server.url, method, params, conn.headers ?? {});
  }
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
