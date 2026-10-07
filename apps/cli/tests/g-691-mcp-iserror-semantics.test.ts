// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-691 —— `tools/call` 的 `isError` 是**结果里的错误**,不是传输级错误。
 *
 * 两条被混成一件事的语义(现读 HEAD):
 *  ① `mcpToolToTool().execute()` 只取 content 文本并**恒 `success:true`** ⇒
 *     服务器报"这次工具调用失败"时模型收到一句假成功(方向:该报失败却没报);
 *  ② `ManagedMcpClient.callTool()` 对**任何** throw 都累计 ⇒ 一次业务层/协议层的
 *     "对端好好回了一帧 error"就把一台健在的服务器打死并重启子进程,
 *     而 ①那种"回在结果里的错误"反而被记成成功(方向:该累计的没累计)。
 * 现在两条分开:`isError` / JSON-RPC error 帧 ⇒ 连接健康、不 markDead;
 * **没拿到应答**(超时 / 管道断 / 进程没了)⇒ 才算传输故障并累计。
 *
 * 判据跑在真子进程 + 生产 `connectMcpServer` / `callMcpServer` 上:mock 出来的假
 * EventEmitter 只能证明"我写的假对象符合我写的实现"(AGENTS §22c),证不了协议语义。
 * 不连生产库 / 不占端口(AGENTS §5 测试隔离铁律)。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  connectMcpServer,
  disconnectMcpConnection,
  interpretMcpToolCallResult,
  mcpToolToTool,
  readMcpPeerAnswered,
  ManagedMcpClient,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';

/**
 * 假 stdio MCP server:`tools/call` 按 argv[1] 的档位回
 *  - `ok`        result(无 isError)
 *  - `isError`   result + isError:true(MCP 规范:工具级失败,服务器健在)
 *  - `notFound`  JSON-RPC error 帧(对端**已应答**)
 * 其余未实现的方法(resources/list / prompts/list / ping)一律回 error 帧,
 * 生产侧 connectMcpServer 对 resources/prompts 是 try/catch 静默的。
 */
const FAKE_SOURCE = [
  "'use strict';",
  "var mode = process.argv[1] || 'ok';",
  'function send(o){ process.stdout.write(JSON.stringify(o) + "\\n"); }',
  'function reply(id, r){ send({ jsonrpc: "2.0", id: id, result: r }); }',
  'function fail(id, m){ send({ jsonrpc: "2.0", id: id, error: { code: -32601, message: m } }); }',
  'process.stdin.on("data", function(chunk){',
  '  String(chunk).split("\\n").forEach(function(raw){',
  '    var line = raw.trim(); if (!line) return;',
  '    var msg; try { msg = JSON.parse(line); } catch (e) { return; }',
  '    var id = msg.id; if (id === undefined) return;',
  "    if (msg.method === 'initialize') return reply(id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'ihui-g691', version: '0' } });",
  "    if (msg.method === 'tools/list') return reply(id, { tools: [{ name: 'echo', description: 'echo it', inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } }] });",
  "    if (msg.method === 'ping') return reply(id, {});",
  "    if (msg.method === 'tools/call') {",
  "      if (mode === 'isError') return reply(id, { content: [{ type: 'text', text: '参数缺失:msg' }], isError: true });",
  "      if (mode === 'notFound') return fail(id, 'Method not found');",
  '      return reply(id, { content: [{ type: "text", text: "echo:hi" }, { type: "image", data: "x" }] });',
  '    }',
  '    fail(id, "Method not found");',
  '  });',
  '});',
].join(' ');

function fakeServer(mode: 'ok' | 'isError' | 'notFound'): McpServer {
  return {
    name: `g691-${mode}`,
    transport: 'stdio',
    command: process.execPath,
    args: ['-e', FAKE_SOURCE, mode],
  };
}

/** 起真连接 → 跑断言 → **无论红绿**都回收子进程(不留孤儿进程 / 不留 open handle) */
async function withConn<T>(mode: 'ok' | 'isError' | 'notFound', fn: (conn: McpConnection) => Promise<T>): Promise<T> {
  const conn = await connectMcpServer(fakeServer(mode));
  try {
    return await fn(conn);
  } finally {
    disconnectMcpConnection(conn);
  }
}

function echoTool(conn: McpConnection) {
  const def = conn.tools.find((t) => t.name === 'echo');
  if (!def) throw new Error('夹具没产出 tools/list —— 这是夹具故障,不得读成"判据通过"');
  return mcpToolToTool(conn, def);
}

describe('G-691 解读出口:结果里的错误 vs 成功', () => {
  it('isError:true ⇒ ok:false,错误文本进 error', () => {
    const out = interpretMcpToolCallResult({ content: [{ type: 'text', text: '参数缺失:msg' }], isError: true });
    expect(out.ok).toBe(false);
    expect(out.error).toContain('参数缺失');
  });

  it('正向对照:isError 缺省仍是 ok:true(判据不得把正常结果也判成失败)', () => {
    expect(interpretMcpToolCallResult({ content: [{ type: 'text', text: 'hi' }] })).toEqual({ ok: true, output: 'hi' });
  });

  it('成功档的文案与改前逐字同值(无 content ⇒ "(无输出)";有 content 无 text ⇒ "(无文本输出)")', () => {
    expect(interpretMcpToolCallResult(undefined).output).toBe('(无输出)');
    expect(interpretMcpToolCallResult(null).output).toBe('(无输出)');
    expect(interpretMcpToolCallResult({ content: [] }).output).toBe('(无文本输出)');
    expect(interpretMcpToolCallResult({ content: [{ type: 'image', data: 'x' }] }).output).toBe('(无文本输出)');
    // isError 但一行业务文本都没有 ⇒ 仍报失败,并给一句不依赖文案的兜底原因
    const noText = interpretMcpToolCallResult({ content: [], isError: true });
    expect(noText.ok).toBe(false);
    expect(noText.error).toBeTruthy();
  });
});

describe('G-691 execute():isError 走"工具调用失败但连接健康"', () => {
  it('isError:true ⇒ success:false 且 error 带原文(旧写法恒 success:true,模型收到假成功)', async () => {
    await withConn('isError', async (conn) => {
      const res = await echoTool(conn).execute({ msg: 'hi' }, { workspacePath: process.cwd() });
      expect(res.success).toBe(false);
      expect(res.error).toContain('参数缺失');
      // 刻意不是 network/timeout/rate_limited:那是 `isRetryableErrorType` 的三档,
      // 业务失败被自动重试等于把同一个错再打一遍服务器
      expect(res.errorType).toBe('mcp_tool_error');
    });
  });

  it('正向对照:正常结果仍 success:true 且 output 与改前同值', async () => {
    await withConn('ok', async (conn) => {
      const res = await echoTool(conn).execute({ msg: 'hi' }, { workspacePath: process.cwd() });
      expect(res.success).toBe(true);
      expect(res.output).toContain('echo:hi');
      // 非 text 项仍被过滤掉(与改前的 filter/map 一致)
      expect(res.output).not.toContain('image');
    });
  });
});

describe('G-691 dead 计数:只有"没拿到应答"才算传输故障', () => {
  /** 生产 connectFn + 生产 callFn(真子进程)—— mock 掉任一侧都证不了协议语义 */
  function makeClient(mode: 'ok' | 'isError' | 'notFound'): ManagedMcpClient {
    return new ManagedMcpClient(fakeServer(mode), {
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 1, // 只要错计一次就立刻 markDead ⇒ 这一档让"错判"不可能被掩盖
    });
  }

  it('isError 业务失败 ⇒ 原样返回结果、不 markDead、不累计 consecutiveFailures', async () => {
    const client = makeClient('isError');
    try {
      const out = (await client.callTool('echo', { msg: 'hi' })) as { isError?: boolean };
      expect(out.isError).toBe(true); // 结果不被吞掉:调用方仍然看得见失败原文
      expect(client.getStatus().dead).toBe(false);
      expect(client.getStatus().consecutiveFailures).toBe(0);
    } finally {
      await client.disconnect();
    }
  });

  it('对端回了 JSON-RPC error 帧(method not found)⇒ 抛错但**不**打死服务器(旧写法每次都重启)', async () => {
    const client = makeClient('notFound');
    try {
      await expect(client.callTool('echo', { msg: 'hi' })).rejects.toThrow(/Method not found/);
      expect(client.getStatus().dead).toBe(false);
      expect(client.getStatus().consecutiveFailures).toBe(0);
    } finally {
      await client.disconnect();
    }
  });

  it('正向对照(判据不得退化成"永不标死"):没拿到应答的 throw 仍然累计并 markDead', async () => {
    const client = new ManagedMcpClient({ name: 'transport-level', transport: 'stdio' }, {
      connectFn: async () => ({
        server: { name: 'transport-level', transport: 'stdio' },
        tools: [],
        connected: true,
        transport: 'stdio',
        ssePending: new Map(),
        sseNextId: 1,
      }),
      // 未经本层打标记 ⇒ 按"根本没拿到应答"处理
      callFn: vi.fn(async (): Promise<unknown> => {
        throw new Error('进程没了');
      }),
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 1,
    });
    try {
      await expect(client.callTool('echo', {})).rejects.toThrow('进程没了');
      expect(client.getStatus().dead).toBe(true);
    } finally {
      await client.disconnect();
    }
  });
});

describe('G-691 读数出口 readMcpPeerAnswered', () => {
  it('按属性读数:带标记为 true,裸 Error / 非对象一律 false(不做 instanceof / 文案匹配)', () => {
    const marked = Object.assign(new Error('Method not found'), { mcpPeerAnswered: true as const });
    expect(readMcpPeerAnswered(marked)).toBe(true);
    expect(readMcpPeerAnswered(new Error('MCP 请求超时: tools/call (10000ms)'))).toBe(false);
    expect(readMcpPeerAnswered(undefined)).toBe(false);
    expect(readMcpPeerAnswered('mcpPeerAnswered')).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
