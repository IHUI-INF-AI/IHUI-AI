/**
 * Hub MCP Adapter 测试 — 覆盖 registerMcpToolsToHub / adaptMcpToolToHubTool 行为。
 *
 * 覆盖点:
 *   1. 注册 3 个 MCP tools,hub.size === 3,工具 id 格式 mcp__<serverName>__<toolName>
 *   2. describe() 返回正确的 ToolDescription(description / parameters / required / dangerLevel)
 *   3. execute(ctx, args) 转发到 callMcpServer(conn, 'tools/call', { name, arguments })
 *   4. callMcpServer 返回 content 数组时,text 项拼接为 output
 *   5. callMcpServer 抛错时,execute 返回 success=false,不抛异常
 *   6. conn.tools 为空数组时返回 0,不抛错
 *   7. hub.register 抛错时,其他 tool 仍能注册(只 log warn,不抛异常)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { InMemoryRegistry } from '../src/tools/hub/registry.js';
import type * as McpRuntime from '../src/tools/mcp-runtime.js';
import type { McpConnection, McpToolDef } from '../src/tools/mcp-runtime.js';

// ---- mock mcp-runtime 的 callMcpServer(避免真实 RPC)----
const { callMcpServerMock } = vi.hoisted(() => ({
  callMcpServerMock: vi.fn(),
}));

vi.mock('../src/tools/mcp-runtime.js', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof McpRuntime;
  return {
    ...actual,
    callMcpServer: callMcpServerMock,
  };
});

import {
  registerMcpToolsToHub,
  adaptMcpToolToHubTool,
} from '../src/tools/hub/mcp-adapter.js';
import type { ToolContext } from '../src/tools/index.js';

// ---- 辅助:构造 mock McpConnection ----
function makeMockConn(serverName: string, tools: McpToolDef[]): McpConnection {
  return {
    server: { name: serverName, transport: 'stdio' },
    tools,
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  };
}

function makeToolDef(name: string, description?: string): McpToolDef {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        arg1: { type: 'string', description: 'first arg' },
      },
      required: ['arg1'],
    },
  };
}

const CTX: ToolContext = { workspacePath: '.' };

describe('registerMcpToolsToHub', () => {
  beforeEach(() => {
    callMcpServerMock.mockReset();
  });

  it('注册 3 个 MCP tools,hub.size === 3,工具 id 格式正确', () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('demo', [
      makeToolDef('tool_a', 'Tool A'),
      makeToolDef('tool_b', 'Tool B'),
      makeToolDef('tool_c', 'Tool C'),
    ]);

    const count = registerMcpToolsToHub({
      hub,
      mcpConnection: conn,
      serverName: 'demo',
    });

    expect(count).toBe(3);
    expect(hub.size()).toBe(3);
    const ids = hub.list().map((d) => d.id).sort();
    expect(ids).toEqual([
      'mcp__demo__tool_a',
      'mcp__demo__tool_b',
      'mcp__demo__tool_c',
    ]);
  });

  it('describe() 返回正确的 ToolDescription', () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('read_file', 'Read a file')]);

    registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    const desc = hub.find('mcp__srv__read_file')?.describe();
    expect(desc).toBeDefined();
    expect(desc!.id).toBe('mcp__srv__read_file');
    expect(desc!.description).toBe('Read a file');
    expect(desc!.required).toEqual(['arg1']);
    expect(desc!.dangerLevel).toBe('read');
    // parameters 透传 inputSchema
    expect((desc!.parameters as { type: string }).type).toBe('object');
  });

  it('schema.description 缺失时,describe() 回退到 `MCP tool: <name>`', () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('no_desc')]);

    registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    const desc = hub.find('mcp__srv__no_desc')?.describe();
    expect(desc!.description).toBe('MCP tool: no_desc');
  });

  it('execute(ctx, args) 转发到 callMcpServer,返回 text 内容', async () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('echo')]);
    registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    callMcpServerMock.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ],
    });

    const handle = hub.find('mcp__srv__echo');
    const result = await handle!.execute(CTX, { arg1: 'value' });

    expect(callMcpServerMock).toHaveBeenCalledWith(conn, 'tools/call', {
      name: 'echo',
      arguments: { arg1: 'value' },
    });
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello\nworld');
  });

  it('callMcpServer 返回无 content 时,output 为 "(无输出)"', async () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('empty')]);
    registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    callMcpServerMock.mockResolvedValueOnce({});

    const handle = hub.find('mcp__srv__empty');
    const result = await handle!.execute(CTX, {});
    expect(result.success).toBe(true);
    expect(result.output).toBe('(无输出)');
  });

  it('callMcpServer 抛错时,execute 返回 success=false,不抛异常', async () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('boom')]);
    registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    callMcpServerMock.mockRejectedValueOnce(new Error('RPC timeout'));

    const handle = hub.find('mcp__srv__boom');
    const result = await handle!.execute(CTX, {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('RPC timeout');
  });

  it('conn.tools 为空数组时返回 0,不抛错', () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', []);

    const count = registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    expect(count).toBe(0);
    expect(hub.size()).toBe(0);
  });

  it('hub.register 抛错时,其他 tool 仍能注册(只 log warn,不抛异常)', () => {
    const hub = new InMemoryRegistry();
    // 让 register 在第二次调用时抛错
    let callCount = 0;
    const originalRegister = hub.register.bind(hub);
    hub.register = (t) => {
      callCount++;
      if (callCount === 2) throw new Error('register boom');
      originalRegister(t);
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const conn = makeMockConn('srv', [
      makeToolDef('t1'),
      makeToolDef('t2'),
      makeToolDef('t3'),
    ]);

    const count = registerMcpToolsToHub({ hub, mcpConnection: conn, serverName: 'srv' });

    expect(count).toBe(2); // t2 失败,t1 + t3 成功
    expect(hub.size()).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[hub-mcp-adapter] 注册 MCP tool 失败: srv/t2'),
    );
    warnSpy.mockRestore();
  });

  it('enableDangerous=true 时,dangerLevel 标记为 dangerous', () => {
    const hub = new InMemoryRegistry();
    const conn = makeMockConn('srv', [makeToolDef('danger')]);

    registerMcpToolsToHub({
      hub,
      mcpConnection: conn,
      serverName: 'srv',
      enableDangerous: true,
    });

    const desc = hub.find('mcp__srv__danger')?.describe();
    expect(desc!.dangerLevel).toBe('dangerous');
  });
});

describe('adaptMcpToolToHubTool', () => {
  beforeEach(() => {
    callMcpServerMock.mockReset();
  });

  it('返回 ToolHandle,id 与 describe() 一致', () => {
    const conn = makeMockConn('srv', []);
    const handle = adaptMcpToolToHubTool('srv', makeToolDef('foo', 'Foo tool'), conn);

    expect(handle.id).toBe('mcp__srv__foo');
    const desc = handle.describe();
    expect(desc.id).toBe('mcp__srv__foo');
    expect(desc.description).toBe('Foo tool');
  });

  it('execute 转发 args 到 callMcpServer', async () => {
    const conn = makeMockConn('srv', []);
    const handle = adaptMcpToolToHubTool('srv', makeToolDef('bar'), conn);

    callMcpServerMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'bar result' }],
    });

    const result = await handle.execute(CTX, { x: 1 });
    expect(callMcpServerMock).toHaveBeenCalledWith(conn, 'tools/call', {
      name: 'bar',
      arguments: { x: 1 },
    });
    expect(result.output).toBe('bar result');
  });
});
