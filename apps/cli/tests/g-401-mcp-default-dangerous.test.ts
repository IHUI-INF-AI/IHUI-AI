// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-401 拍板②(2026-10-07)验收钉 —— MCP 适配层缺省翻 dangerous + 只读白名单。
 *
 * 病灶(改前 HEAD):hub 路径 mcp-adapter 把缺省(无显式档)远程 MCP 工具标成 'read'
 * ⇒ mode 矩阵 default 档 'allow'(不问人)、plan 档 'allow'(不拒),且 'read' 档还会被
 * executeWithRetry 当幂等读自动重跑一次;hub 分支对 remote 更是零闸直发。
 *
 * 拍板后的三根钉(每根一组用例):
 *   ① 缺省(无显式档)远程 MCP 工具 ⇒ 适配层标 'dangerous' ⇒ mode 矩阵 default 档
 *      'ask'(要批准)、plan 档 'deny';executeWithRetry 对它 maxRetries=0(不自动重跑);
 *   ② 白名单内显式 'read'(唯一降档通道 MCP_READONLY_TOOL_ALLOWLIST,按 server+tool 登记)
 *      ⇒ default 档 'allow';
 *   ③ hub 分支运行时闸:remote 'dangerous' 无确认回调 fail-closed 拒绝(gate='dangerous-gate'),
 *      有回调批准后放行;白名单 'read' 不进闸直接执行(零确认)。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
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

import { InMemoryRegistry } from '../src/tools/hub/registry.js';
import {
  registerMcpToolsToHub,
  adaptMcpToolToHubTool,
  MCP_READONLY_TOOL_ALLOWLIST,
  isMcpToolReadonlyWhitelisted,
} from '../src/tools/hub/mcp-adapter.js';
import {
  executeToolCall,
  executeWithRetry,
  enableToolHub,
  disableToolHub,
  setHubRemoteRegistry,
  clearTools,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';
import { checkPermission } from '../src/tools/permissions.js';

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
    inputSchema: { type: 'object', properties: {}, required: [] },
  };
}

const CTX: ToolContext = { workspacePath: '.' };

describe('G-401 拍板② · 适配层缺省翻档与白名单', () => {
  beforeEach(() => {
    callMcpServerMock.mockReset();
  });

  it('缺省(无白名单登记)远程 MCP 工具标 dangerous', () => {
    const hub = new InMemoryRegistry();
    registerMcpToolsToHub({ hub, mcpConnection: makeMockConn('srv', [makeToolDef('anything')]), serverName: 'srv' });
    expect(hub.find('mcp__srv__anything')?.describe().dangerLevel).toBe('dangerous');
  });

  it('白名单内 (server, tool) 显式标 read;生产真源当前为空面(诚实登记)', () => {
    expect(MCP_READONLY_TOOL_ALLOWLIST).toEqual({});
    expect(isMcpToolReadonlyWhitelisted('srv', 'x')).toBe(false);

    const handle = adaptMcpToolToHubTool('srv', makeToolDef('x'), makeMockConn('srv', []), { srv: ['x'] });
    expect(handle.describe().dangerLevel).toBe('read');
    const other = adaptMcpToolToHubTool('srv', makeToolDef('y'), makeMockConn('srv', []), { srv: ['x'] });
    expect(other.describe().dangerLevel).toBe('dangerous');
  });
});

describe('G-401 拍板② · mode 矩阵两轴钉(permissions.ts 语义不变,吃新档位)', () => {
  it('缺档(dangerous)远程工具:default 档 ask(要批准)、plan 档 deny', () => {
    expect(checkPermission('mcp__srv__anything', undefined, 'default', 'dangerous')).toBe('ask');
    expect(checkPermission('mcp__srv__anything', undefined, 'plan', 'dangerous')).toBe('deny');
  });

  it('白名单显式 read:default 档 allow', () => {
    expect(checkPermission('mcp__srv__safe', undefined, 'default', 'read')).toBe('allow');
  });
});

describe('G-401 拍板② · 失败不自动重跑轴(maxRetries=0)', () => {
  it('dangerLevel 缺省(undefined,同 mcpToolToTool 产物形状)不重试:恰好执行 1 次', async () => {
    const calls = vi.fn(async () => ({ success: false, output: '', error: 'boom', errorType: 'timeout' }));
    const tool: Tool = {
      name: 'mcp__srv__flaky',
      description: 'remote tool (no explicit dangerLevel)',
      parameters: {},
      required: [],
      execute: calls,
    };
    const result = await executeWithRetry(tool, {}, CTX);
    expect(result.success).toBe(false);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('对照:显式 read 档维持既有重试语义(1 次重试,共 2 次执行)', async () => {
    const calls = vi.fn(async () => ({ success: false, output: '', error: 'boom', errorType: 'timeout' }));
    const tool: Tool = {
      name: 'mcp__srv__flaky_read',
      description: 'whitelisted read remote tool',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: calls,
    };
    await executeWithRetry(tool, {}, CTX);
    expect(calls).toHaveBeenCalledTimes(2);
  });
});

describe('G-401 拍板② · hub 分支 remote 批准闸(运行时)', () => {
  beforeEach(() => {
    callMcpServerMock.mockReset();
    clearTools();
  });

  afterEach(() => {
    disableToolHub();
    clearTools();
  });

  function setupHub(allowlist?: Record<string, readonly string[]>): void {
    const remote = new InMemoryRegistry();
    registerMcpToolsToHub({
      hub: remote,
      mcpConnection: makeMockConn('srv', [makeToolDef('rm_tool'), makeToolDef('safe_tool')]),
      serverName: 'srv',
      ...(allowlist ? { readonlyAllowlist: allowlist } : {}),
    });
    enableToolHub();
    setHubRemoteRegistry(remote);
  }

  it('remote dangerous + 无确认回调 ⇒ fail-closed 拒绝,服务器不被调用', async () => {
    setupHub();
    callMcpServerMock.mockResolvedValue({ content: [{ type: 'text', text: 'should not happen' }] });

    const result = await executeToolCall({ name: 'mcp__srv__rm_tool', arguments: {} }, CTX);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('permission_denied');
    expect(result.denial?.gate).toBe('dangerous-gate');
    expect(result.denial?.decider).toBe('no-confirmation-channel');
    expect(callMcpServerMock).not.toHaveBeenCalled();
  });

  it('remote dangerous + 确认回调批准 ⇒ 放行执行;回调拒绝 ⇒ user-declined 拒绝', async () => {
    setupHub();
    callMcpServerMock.mockResolvedValue({ content: [{ type: 'text', text: 'ran once' }] });

    const approved = await executeToolCall(
      { name: 'mcp__srv__rm_tool', arguments: {} },
      { workspacePath: '.', confirmDangerous: async () => true },
    );
    expect(approved.success).toBe(true);
    expect(approved.output).toBe('ran once');
    expect(callMcpServerMock).toHaveBeenCalledTimes(1);

    const declined = await executeToolCall(
      { name: 'mcp__srv__rm_tool', arguments: {} },
      { workspacePath: '.', confirmDangerous: async () => false },
    );
    expect(declined.success).toBe(false);
    expect(declined.denial?.decider).toBe('user-declined');
    expect(callMcpServerMock).toHaveBeenCalledTimes(1);
  });

  it('白名单内显式 read ⇒ 不进闸直接执行(零确认),与 mode 矩阵 allow 对齐', async () => {
    setupHub({ srv: ['safe_tool'] });
    callMcpServerMock.mockResolvedValue({ content: [{ type: 'text', text: 'quiet ok' }] });

    const result = await executeToolCall({ name: 'mcp__srv__safe_tool', arguments: {} }, CTX);

    expect(result.success).toBe(true);
    expect(result.output).toBe('quiet ok');
    expect(callMcpServerMock).toHaveBeenCalledTimes(1);
  });
});
