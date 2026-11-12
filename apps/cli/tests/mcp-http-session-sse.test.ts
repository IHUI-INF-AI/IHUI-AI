// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-113 验收:Streamable HTTP transport 的会话头与 SSE 回包。
 *   1) initialize 回包的 Mcp-Session-Id 必须保存,并在后续请求里原样回传;
 *   2) server 以 text/event-stream 回包时,按 data: 行解析出对应的 JSON-RPC 消息
 *      (而不是 json() 抛 SyntaxError)。
 * fetch 用 stub 顶替(MCP 端点固定 127.0.0.1,SSRF 守卫走自配回环信任档,无需真实网络)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectMcpServer } from '../src/tools/mcp-runtime.js';

interface CapturedCall {
  method: string;
  headers: Record<string, string>;
  id: number;
}

/** headers 键大小写不敏感读取(实现里写的是 'Mcp-Session-Id' / 'Accept') */
function readHeader(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function makeServer(): { name: string; transport: 'http'; url: string } {
  return { name: 'http-fake', transport: 'http', url: 'http://127.0.0.1:18763/mcp' };
}

/** 安装 fetch stub:记录每次请求(method / headers / id),按 handler 返回响应 */
function installFetch(handler: (call: CapturedCall) => Response): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string | URL, init?: RequestInit): Promise<Response> => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { id?: number; method?: string };
      const call: CapturedCall = {
        method: String(body.method ?? ''),
        headers: { ...((init?.headers ?? {}) as Record<string, string>) },
        id: Number(body.id),
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

function jsonResult(call: CapturedCall, result: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('F-113 MCP http transport:会话头', () => {
  it('initialize 回包的 Mcp-Session-Id 被保存,并在后续请求中回传', async () => {
    const calls = installFetch((call) => {
      if (call.method === 'initialize') {
        return jsonResult(
          call,
          { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'fake', version: '1.0.0' } },
          { 'mcp-session-id': 'sess-abc' },
        );
      }
      if (call.method === 'tools/list') return jsonResult(call, { tools: [] });
      return new Response('not found', { status: 404 });
    });

    const conn = await connectMcpServer(makeServer());

    const initCall = calls.find((c) => c.method === 'initialize');
    expect(initCall).toBeDefined();
    // 首个请求没有会话可用,不应凭空带一个
    expect(readHeader(initCall!.headers, 'mcp-session-id')).toBeUndefined();

    const listCall = calls.find((c) => c.method === 'tools/list');
    expect(listCall).toBeDefined();
    expect(readHeader(listCall!.headers, 'mcp-session-id')).toBe('sess-abc');
    // 同时必须声明可接受 SSE 回包,否则合规 server 只回 JSON 或直接拒绝
    expect(readHeader(listCall!.headers, 'accept')).toContain('text/event-stream');

    expect(conn.sessionId).toBe('sess-abc');
    expect(conn.connected).toBe(true);
  });
});

describe('F-113 MCP http transport:SSE 回包', () => {
  it('text/event-stream 回包按 data: 行解析出对应的 JSON-RPC 消息', async () => {
    installFetch((call) => {
      if (call.method === 'initialize') {
        return jsonResult(call, { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'fake', version: '1.0.0' } });
      }
      if (call.method === 'tools/list') {
        // 先来一条 id 不匹配的通知帧,再来本次请求的结果帧
        const frames = [
          'event: message',
          'data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info"}}',
          '',
          'event: message',
          `data: {"jsonrpc":"2.0","id":${call.id},"result":{"tools":[{"name":"echo","description":"回显","inputSchema":{"type":"object"}}]}}`,
          '',
          '',
        ].join('\n');
        return new Response(frames, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      return new Response('not found', { status: 404 });
    });

    const conn = await connectMcpServer(makeServer());

    expect(conn.tools.map((t) => t.name)).toEqual(['echo']);
    expect(conn.connected).toBe(true);
  });
});
