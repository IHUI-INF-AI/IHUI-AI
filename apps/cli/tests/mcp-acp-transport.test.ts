/**
 * ACP MCP 扩展方法测试 — 覆盖 3 个 x.ai/mcp/* 扩展方法的返回值。
 *
 * 覆盖点:
 *   1. x.ai/mcp/listServers:无注册 client → 空数组;有注册 → 返回状态快照
 *   2. x.ai/mcp/serverStatus:未注册 → server=null;已注册 → 返回 liveness
 *   3. x.ai/mcp/callTool:未注册 → success=false;已注册 → 转发调用 + 解析 content
 *   4. feature flag 关闭时(listServers 空,callTool 返回未注册)
 *
 * 测试策略:直接实例化 IhuiAcpAgent(不经过 ACP 协议层),
 * 调用其 listMcpServers/mcpServerStatus/mcpCallTool 方法,
 * 验证返回值结构。mock ManagedMcpClient 通过 registerManagedClient 注入。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  IhuiAcpAgent,
  type McpListServersResponse,
  type McpServerStatusResponse,
  type McpCallToolResponse,
} from '../src/acp/server.js';
import {
  ManagedMcpClient,
  registerManagedClient,
  clearManagedClients,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';

// 构造 mock McpConnection
function makeMockConn(serverName: string): McpConnection {
  return {
    server: { name: serverName, transport: 'stdio' },
    tools: [],
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  };
}

function makeServer(name: string): McpServer {
  return { name, transport: 'stdio', command: 'echo' };
}

/** 构造已连接的 ManagedMcpClient(mock connectFn + callFn) */
function makeConnectedClient(
  serverName: string,
  callFn: ReturnType<typeof vi.fn>,
): ManagedMcpClient {
  const client = new ManagedMcpClient(makeServer(serverName), {
    connectFn: vi.fn().mockResolvedValue(makeMockConn(serverName)),
    callFn,
    initialBackoffMs: 0,
    pingIntervalMs: 60_000,
  });
  return client;
}

describe('ACP x.ai/mcp/listServers', () => {
  let agent: IhuiAcpAgent;

  beforeEach(() => {
    clearManagedClients();
    agent = new IhuiAcpAgent({
      apiUrl: 'http://localhost:8803',
      modelId: 'test',
      maxIterations: 10,
    });
  });

  afterEach(() => {
    clearManagedClients();
  });

  it('无注册 client 时返回空数组', async () => {
    const resp: McpListServersResponse = await agent.listMcpServers({});
    expect(resp.servers).toEqual([]);
  });

  it('有注册 client 时返回状态快照', async () => {
    const c1 = makeConnectedClient('srv1', vi.fn().mockResolvedValue({}));
    const c2 = makeConnectedClient('srv2', vi.fn().mockResolvedValue({}));
    registerManagedClient(c1);
    registerManagedClient(c2);

    // 触发连接(填充 lastPingAt)
    await c1.ensureConnected();
    await c2.ensureConnected();

    const resp = await agent.listMcpServers({});
    expect(resp.servers).toHaveLength(2);
    const names = resp.servers.map((s) => s.serverName).sort();
    expect(names).toEqual(['srv1', 'srv2']);
  });

  it('状态快照含 alive/dead/consecutiveFailures 字段', async () => {
    const c1 = makeConnectedClient('srv1', vi.fn().mockResolvedValue({}));
    registerManagedClient(c1);
    await c1.ensureConnected();

    const resp = await agent.listMcpServers({});
    expect(resp.servers).toHaveLength(1);
    const status = resp.servers[0]!;
    expect(status.serverName).toBe('srv1');
    expect(typeof status.alive).toBe('boolean');
    expect(typeof status.dead).toBe('boolean');
    expect(typeof status.consecutiveFailures).toBe('number');
    expect(typeof status.lastPingAt).toBe('number');
    expect(typeof status.connected).toBe('boolean');
  });
});

describe('ACP x.ai/mcp/serverStatus', () => {
  let agent: IhuiAcpAgent;

  beforeEach(() => {
    clearManagedClients();
    agent = new IhuiAcpAgent({
      apiUrl: 'http://localhost:8803',
      modelId: 'test',
      maxIterations: 10,
    });
  });

  afterEach(() => {
    clearManagedClients();
  });

  it('未注册 server → server=null', async () => {
    const resp: McpServerStatusResponse = await agent.mcpServerStatus({
      serverName: 'not-exist',
    });
    expect(resp.server).toBeNull();
  });

  it('已注册 server → 返回 liveness 状态', async () => {
    const client = makeConnectedClient('srv1', vi.fn().mockResolvedValue({}));
    registerManagedClient(client);
    await client.ensureConnected();

    const resp = await agent.mcpServerStatus({ serverName: 'srv1' });
    expect(resp.server).not.toBeNull();
    expect(resp.server!.serverName).toBe('srv1');
    expect(resp.server!.connected).toBe(true);
    expect(resp.server!.dead).toBe(false);
  });

  it('dead server 状态正确返回', async () => {
    const callFn = vi.fn().mockRejectedValue(new Error('boom'));
    const client = new ManagedMcpClient(makeServer('dead-srv'), {
      connectFn: vi.fn().mockResolvedValue(makeMockConn('dead-srv')),
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 3,
    });
    registerManagedClient(client);
    await client.ensureConnected();

    // 3 次失败 → markDead
    await expect(client.callTool('t', {})).rejects.toThrow('boom');
    await expect(client.callTool('t', {})).rejects.toThrow('boom');
    await expect(client.callTool('t', {})).rejects.toThrow('boom');

    const resp = await agent.mcpServerStatus({ serverName: 'dead-srv' });
    expect(resp.server).not.toBeNull();
    expect(resp.server!.dead).toBe(true);
    expect(resp.server!.alive).toBe(false);
    expect(resp.server!.consecutiveFailures).toBe(3);
  });
});

describe('ACP x.ai/mcp/callTool', () => {
  let agent: IhuiAcpAgent;

  beforeEach(() => {
    clearManagedClients();
    agent = new IhuiAcpAgent({
      apiUrl: 'http://localhost:8803',
      modelId: 'test',
      maxIterations: 10,
    });
  });

  afterEach(() => {
    clearManagedClients();
  });

  it('未注册 server → success=false + error', async () => {
    const resp: McpCallToolResponse = await agent.mcpCallTool({
      serverName: 'not-exist',
      toolName: 'echo',
      arguments: { msg: 'hi' },
    });
    expect(resp.success).toBe(false);
    expect(resp.output).toBe('');
    expect(resp.error).toContain('未注册');
  });

  it('已注册 server → 转发调用,返回 content text', async () => {
    const callFn = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ],
    });
    const client = makeConnectedClient('srv1', callFn);
    registerManagedClient(client);

    const resp = await agent.mcpCallTool({
      serverName: 'srv1',
      toolName: 'echo',
      arguments: { msg: 'hi' },
    });
    expect(resp.success).toBe(true);
    expect(resp.output).toBe('hello\nworld');
    expect(callFn).toHaveBeenCalledWith(
      expect.any(Object),
      'tools/call',
      { name: 'echo', arguments: { msg: 'hi' } },
    );
  });

  it('content 为空时 output 为 "(无输出)"', async () => {
    const callFn = vi.fn().mockResolvedValue({});
    const client = makeConnectedClient('srv1', callFn);
    registerManagedClient(client);

    const resp = await agent.mcpCallTool({
      serverName: 'srv1',
      toolName: 'noop',
    });
    expect(resp.success).toBe(true);
    expect(resp.output).toBe('(无输出)');
  });

  it('content 只有非 text 项时 output 为 "(无文本输出)"', async () => {
    const callFn = vi.fn().mockResolvedValue({
      content: [{ type: 'image', data: 'base64...' }],
    });
    const client = makeConnectedClient('srv1', callFn);
    registerManagedClient(client);

    const resp = await agent.mcpCallTool({
      serverName: 'srv1',
      toolName: 'img',
    });
    expect(resp.success).toBe(true);
    expect(resp.output).toBe('(无文本输出)');
  });

  it('callTool 抛错 → success=false + error(不抛异常)', async () => {
    const callFn = vi.fn().mockRejectedValue(new Error('tool boom'));
    const client = makeConnectedClient('srv1', callFn);
    registerManagedClient(client);

    const resp = await agent.mcpCallTool({
      serverName: 'srv1',
      toolName: 'fail',
    });
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('tool boom');
  });

  it('arguments 缺省时传空对象', async () => {
    const callFn = vi.fn().mockResolvedValue({ content: [] });
    const client = makeConnectedClient('srv1', callFn);
    registerManagedClient(client);

    await agent.mcpCallTool({
      serverName: 'srv1',
      toolName: 'noargs',
    });
    expect(callFn).toHaveBeenCalledWith(
      expect.any(Object),
      'tools/call',
      { name: 'noargs', arguments: {} },
    );
  });
});

describe('ACP MCP 扩展方法 feature flag 关闭行为', () => {
  let agent: IhuiAcpAgent;

  beforeEach(() => {
    // feature flag 关闭时 managedClients 为空(未调用 registerManagedClient)
    clearManagedClients();
    agent = new IhuiAcpAgent({
      apiUrl: 'http://localhost:8803',
      modelId: 'test',
      maxIterations: 10,
    });
  });

  afterEach(() => {
    clearManagedClients();
  });

  it('listServers 返回空数组(flag 关闭,无 client 注册)', async () => {
    const resp = await agent.listMcpServers({});
    expect(resp.servers).toEqual([]);
  });

  it('serverStatus 返回 null(flag 关闭)', async () => {
    const resp = await agent.mcpServerStatus({ serverName: 'any' });
    expect(resp.server).toBeNull();
  });

  it('callTool 返回 success=false + 未注册提示(flag 关闭)', async () => {
    const resp = await agent.mcpCallTool({
      serverName: 'any',
      toolName: 'any',
    });
    expect(resp.success).toBe(false);
    expect(resp.error).toContain('未注册');
  });
});
