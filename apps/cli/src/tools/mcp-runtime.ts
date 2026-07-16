/**
 * MCP Runtime — MCP 服务器连接与工具调用运行时。
 *
 * 灵感来源:grok-build 的 MCP crate(Rust),实现了完整的 MCP server 连接和工具调用。
 * 简化策略(做减法):
 *   - stdio transport:spawn 子进程,通过 stdin/stdout 通信(JSON-RPC 2.0 over stdio)
 *   - http/sse transport:用 fetch 发送 JSON-RPC 请求
 *   - 工具枚举:调用 tools/list,将 MCP 工具转为 Tool 接口
 *   - 工具调用转发:Agent 调用时,转发到 MCP server 的 tools/call
 *   - 不实现 MCP 的 resources/prompts(仅 tools,做减法)
 *
 * JSON-RPC 2.0 消息格式:
 *   请求:{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
 *   响应:{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import type { McpServer } from '../commands/mcp-config.js';
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

async function connectMcpServer(server: McpServer): Promise<McpConnection> {
  const conn: McpConnection = { server, tools: [], connected: false };
  const transport = server.transport ?? 'stdio';

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
      await sendStdioRpc(proc, 'notifications/initialized', {});
    } else if (transport === 'http' || transport === 'sse') {
      if (!server.url) throw new Error(`${transport} transport 需要 url`);
      const headers: Record<string, string> = { ...(server.headers ?? {}) };
      if (server.api_key) headers['Authorization'] = `Bearer ${server.api_key}`;
      if (server.auth?.token) headers['Authorization'] = `Bearer ${server.auth.token}`;

      await sendHttpRpc(server.url, 'initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'ihui-cli', version: '1.0.0' },
        capabilities: {},
      }, headers);
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
  const transport = conn.server.transport ?? 'stdio';
  if (transport === 'stdio') {
    if (!conn.process) throw new Error('stdio 连接未建立');
    return sendStdioRpc(conn.process, method, params);
  } else {
    if (!conn.server.url) throw new Error('URL 未配置');
    const headers: Record<string, string> = { ...(conn.server.headers ?? {}) };
    if (conn.server.api_key) headers['Authorization'] = `Bearer ${conn.server.api_key}`;
    if (conn.server.auth?.token) headers['Authorization'] = `Bearer ${conn.server.auth.token}`;
    return sendHttpRpc(conn.server.url, method, params, headers);
  }
}

function disconnectMcpServer(conn: McpConnection): void {
  if (conn.process) {
    try {
      conn.process.kill();
    } catch {
      // 忽略
    }
    conn.process = undefined;
  }
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
  const configPath = `${process.env.HOME || process.env.USERPROFILE}/.ihui/mcp.json`;
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
