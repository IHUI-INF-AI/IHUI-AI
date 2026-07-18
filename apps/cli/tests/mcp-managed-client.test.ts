/**
 * ManagedMcpClient 测试 — 覆盖 ensureConnected / callTool / ping / 重连退避 / dead 检测。
 *
 * 覆盖点:
 *   1. ensureConnected:首次调用触发 connectFn,后续存活时跳过
 *   2. callTool:成功转发,失败累计 consecutiveFailures
 *   3. ping:30s 内不重复,超时后重新 ping
 *   4. 重连指数退避:1s → 2s → 4s → 8s(用小 backoff 加速测试)
 *   5. dead 检测:连续 3 次失败 markDead,isAlive 返回 false
 *   6. reconnect 成功后重置 backoff 和 consecutiveFailures
 *   7. createHttpMcpClientWithBackoff:失败重试 + 退避 + 最终成功/抛错
 *   8. 全局注册表:registerManagedClient / getManagedClient / listManagedClients
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  ManagedMcpClient,
  createHttpMcpClientWithBackoff,
  registerManagedClient,
  unregisterManagedClient,
  getManagedClient,
  listManagedClients,
  clearManagedClients,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';

// 构造 mock McpConnection(不真正连接)
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

describe('ManagedMcpClient ensureConnected', () => {
  it('首次调用触发 connectFn,返回 conn', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      initialBackoffMs: 0, // 加速测试
      pingIntervalMs: 60_000, // 避免被 isAlive 判定为过期
    });

    const conn = await client.ensureConnected();
    expect(conn).toBe(mockConn);
    expect(connectFn).toHaveBeenCalledOnce();
  });

  it('存活时跳过 connectFn(不重复连接)', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    await client.ensureConnected();
    await client.ensureConnected();
    await client.ensureConnected();
    expect(connectFn).toHaveBeenCalledOnce();
  });

  it('ping 过期后 ensureConnected 触发重连', async () => {
    const mockConn1 = makeMockConn('test');
    const mockConn2 = makeMockConn('test');
    const connectFn = vi.fn()
      .mockResolvedValueOnce(mockConn1)
      .mockResolvedValueOnce(mockConn2);
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      initialBackoffMs: 0,
      pingIntervalMs: 0, // 立即过期,触发重连
    });

    // 第一次连接
    const conn1 = await client.ensureConnected();
    expect(conn1).toBe(mockConn1);

    // ping 过期 → isAlive false → 重连
    const conn2 = await client.ensureConnected();
    expect(conn2).toBe(mockConn2);
    expect(connectFn).toHaveBeenCalledTimes(2);
  });
});

describe('ManagedMcpClient callTool', () => {
  it('成功转发 tool 调用,返回结果', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'result' }],
    });
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    const result = await client.callTool('echo', { msg: 'hi' });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'result' }],
    });
    expect(callFn).toHaveBeenCalledWith(mockConn, 'tools/call', {
      name: 'echo',
      arguments: { msg: 'hi' },
    });
  });

  it('成功后 consecutiveFailures 重置为 0', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ content: [] });
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 5, // 避免触发 markDead
    });

    // 第一次失败
    await expect(client.callTool('t', {})).rejects.toThrow('fail');
    expect(client.getStatus().consecutiveFailures).toBe(1);

    // 第二次成功 → 重置
    await client.callTool('t', {});
    expect(client.getStatus().consecutiveFailures).toBe(0);
  });

  it('失败累计达 DEAD_THRESHOLD → markDead,isAlive 返回 false', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn().mockRejectedValue(new Error('boom'));
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 3,
    });

    // 第一次连接 + 第一次失败
    await expect(client.callTool('t', {})).rejects.toThrow('boom');
    expect(client.getStatus().dead).toBe(false);
    expect(client.getStatus().consecutiveFailures).toBe(1);

    // 第二次失败
    await expect(client.callTool('t', {})).rejects.toThrow('boom');
    expect(client.getStatus().dead).toBe(false);
    expect(client.getStatus().consecutiveFailures).toBe(2);

    // 第三次失败 → markDead
    await expect(client.callTool('t', {})).rejects.toThrow('boom');
    expect(client.getStatus().dead).toBe(true);
    expect(client.getStatus().alive).toBe(false);
    expect(client.getStatus().consecutiveFailures).toBe(3);
  });
});

describe('ManagedMcpClient ping', () => {
  it('ensureConnected 后 ping 返回 true(连接新鲜,跳过 callFn)', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn().mockResolvedValue({});
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    // 先连接(reconnect 成功时设置 lastPingAt = Date.now())
    await client.ensureConnected();
    // ping:连接新鲜(lastPingAt 在 ensureConnected 中设置),跳过 callFn
    const ok = await client.ping();
    expect(ok).toBe(true);
    expect(callFn).not.toHaveBeenCalled();
  });

  it('pingIntervalMs 过期后 ping 调用 callFn', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn().mockResolvedValue({});
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 10, // 10ms 过期
    });

    await client.ensureConnected();
    // 等待 pingIntervalMs 过期
    await new Promise((r) => setTimeout(r, 20));
    const ok = await client.ping();
    expect(ok).toBe(true);
    expect(callFn).toHaveBeenCalledWith(mockConn, 'ping', {});
  });

  it('连续 ping 只调用一次 callFn(后续被 PING_INTERVAL_MS 拦截)', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn().mockResolvedValue({});
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 10, // 短间隔
    });

    await client.ensureConnected();
    // 等待 pingIntervalMs 过期,让第一次 ping 真正调用 callFn
    await new Promise((r) => setTimeout(r, 20));

    await client.ping(); // 第一次:调用 callFn
    await client.ping(); // 第二次:被 PING_INTERVAL_MS 拦截
    await client.ping(); // 第三次:被 PING_INTERVAL_MS 拦截
    // ping 只调用一次(后续被 PING_INTERVAL_MS 拦截)
    expect(callFn).toHaveBeenCalledOnce();
  });

  it('ping 失败累计达阈值 → markDead', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const callFn = vi.fn()
      .mockRejectedValueOnce(new Error('ping fail'))
      .mockRejectedValueOnce(new Error('ping fail'))
      .mockRejectedValueOnce(new Error('ping fail'));
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      pingIntervalMs: 0, // 每次都重新 ping
      deadThreshold: 3,
    });

    await client.ensureConnected();

    // 三次 ping 失败 → markDead
    expect(await client.ping()).toBe(false);
    expect(await client.ping()).toBe(false);
    expect(await client.ping()).toBe(false);
    expect(client.getStatus().dead).toBe(true);
  });

  it('无连接时 ping 返回 false', async () => {
    const connectFn = vi.fn();
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      initialBackoffMs: 0,
      pingIntervalMs: 0,
    });

    // 未连接,未 markDead,但 conn 为 null
    const ok = await client.ping();
    expect(ok).toBe(false);
    expect(connectFn).not.toHaveBeenCalled();
  });
});

describe('ManagedMcpClient 重连指数退避', () => {
  // callFn mock:conn 为 null 时抛错(模拟真实 callMcpServer 行为),否则返回成功
  function makeCallFn() {
    return vi.fn((conn: McpConnection | null) => {
      if (!conn) throw new Error('no connection');
      return { content: [] };
    });
  }

  it('connectFn 失败时 backoff 翻倍(1s → 2s → 4s)', async () => {
    const connectFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce(makeMockConn('test'));
    // 注入 callFn mock,避免 callTool 调用真实 callMcpServer(因 mockConn 无 process)
    const callFn = makeCallFn();
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 10, // 小 backoff 加速测试
      maxBackoffMs: 100,
      pingIntervalMs: 60_000,
      deadThreshold: 10, // 避免触发 markDead
    });

    // 初始 backoff = 10
    expect(client.getCurrentBackoffMs()).toBe(10);

    // 第一次 callTool:ensureConnected → reconnect(等 10ms)→ connect fail → conn null → callFn(null) throw
    await expect(client.callTool('t', {})).rejects.toThrow();
    expect(client.getCurrentBackoffMs()).toBe(20);

    // 第二次:等 20ms → connect → fail → backoff 翻倍到 40
    await expect(client.callTool('t', {})).rejects.toThrow();
    expect(client.getCurrentBackoffMs()).toBe(40);

    // 第三次:等 40ms → connect → success → backoff 重置到 10
    await client.callTool('t', {});
    expect(client.getCurrentBackoffMs()).toBe(10); // 重置
  });

  it('backoff 不超过 MAX_BACKOFF_MS', async () => {
    const connectFn = vi.fn().mockRejectedValue(new Error('always fail'));
    const callFn = makeCallFn();
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 10,
      maxBackoffMs: 50, // 小上限加速测试
      pingIntervalMs: 60_000,
      deadThreshold: 100, // 避免触发 markDead
    });

    // 多次失败,backoff 应停在 50
    for (let i = 0; i < 10; i++) {
      await expect(client.callTool('t', {})).rejects.toThrow();
    }
    expect(client.getCurrentBackoffMs()).toBe(50);
  });

  it('reconnect 成功后 backoff 重置为 initialBackoffMs', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(mockConn);
    const callFn = makeCallFn();
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      callFn,
      initialBackoffMs: 10,
      maxBackoffMs: 100,
      pingIntervalMs: 60_000,
      deadThreshold: 10,
    });

    // 第一次失败 → backoff = 20
    await expect(client.callTool('t', {})).rejects.toThrow();
    expect(client.getCurrentBackoffMs()).toBe(20);

    // 第二次成功 → backoff 重置
    await client.callTool('t', {});
    expect(client.getCurrentBackoffMs()).toBe(10);
    expect(client.getStatus().consecutiveFailures).toBe(0);
    expect(client.getStatus().connected).toBe(true);
  });
});

describe('ManagedMcpClient disconnect', () => {
  it('disconnect 清理连接,状态重置', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const client = new ManagedMcpClient(makeServer('test'), {
      connectFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    await client.ensureConnected();
    expect(client.getStatus().connected).toBe(true);

    await client.disconnect();
    expect(client.getStatus().connected).toBe(false);
    expect(client.getConnection()).toBeNull();
  });
});

describe('createHttpMcpClientWithBackoff', () => {
  it('首次成功 → 直接返回 conn,不重试', async () => {
    const mockConn = makeMockConn('test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);

    const result = await createHttpMcpClientWithBackoff(makeServer('test'), {
      maxRetries: 2,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      connectFn,
    });

    expect(result).toBe(mockConn);
    expect(connectFn).toHaveBeenCalledOnce();
  });

  it('达到 maxRetries 仍失败 → 抛最后一次错误', async () => {
    const lastErr = new Error('connect boom');
    const connectFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockRejectedValueOnce(lastErr);

    const start = Date.now();
    await expect(
      createHttpMcpClientWithBackoff(makeServer('test'), {
        maxRetries: 2,
        initialBackoffMs: 10,
        maxBackoffMs: 50,
        connectFn,
      }),
    ).rejects.toThrow('connect boom');
    const elapsed = Date.now() - start;
    // 2 次退避:10ms + 20ms = 30ms(上限 50ms)
    expect(elapsed).toBeGreaterThanOrEqual(25);
    expect(connectFn).toHaveBeenCalledTimes(3); // 初次 + 2 次重试
  });

  it('中途成功 → 不再重试,返回 conn', async () => {
    const mockConn = makeMockConn('mid');
    const connectFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockResolvedValueOnce(mockConn);

    const result = await createHttpMcpClientWithBackoff(makeServer('test'), {
      maxRetries: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      connectFn,
    });

    expect(result).toBe(mockConn);
    expect(connectFn).toHaveBeenCalledTimes(2); // 失败 1 次 + 成功 1 次
  });
});

describe('ManagedMcpClient 全局注册表', () => {
  beforeEach(() => {
    clearManagedClients();
  });

  afterEach(() => {
    clearManagedClients();
  });

  it('registerManagedClient + getManagedClient', async () => {
    const mockConn = makeMockConn('reg-test');
    const connectFn = vi.fn().mockResolvedValue(mockConn);
    const client = new ManagedMcpClient(makeServer('reg-test'), {
      connectFn,
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    registerManagedClient(client);
    const found = getManagedClient('reg-test');
    expect(found).toBe(client);
  });

  it('getManagedClient 不存在时返回 undefined', () => {
    expect(getManagedClient('not-registered')).toBeUndefined();
  });

  it('listManagedClients 返回所有已注册 client 状态', async () => {
    const c1 = new ManagedMcpClient(makeServer('s1'), {
      connectFn: vi.fn().mockResolvedValue(makeMockConn('s1')),
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });
    const c2 = new ManagedMcpClient(makeServer('s2'), {
      connectFn: vi.fn().mockResolvedValue(makeMockConn('s2')),
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    registerManagedClient(c1);
    registerManagedClient(c2);

    const list = listManagedClients();
    expect(list).toHaveLength(2);
    const names = list.map((s) => s.serverName).sort();
    expect(names).toEqual(['s1', 's2']);
  });

  it('unregisterManagedClient 删除指定 client', async () => {
    const client = new ManagedMcpClient(makeServer('to-remove'), {
      connectFn: vi.fn().mockResolvedValue(makeMockConn('to-remove')),
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });
    registerManagedClient(client);
    expect(getManagedClient('to-remove')).toBeDefined();

    unregisterManagedClient('to-remove');
    expect(getManagedClient('to-remove')).toBeUndefined();
  });

  it('clearManagedClients 清空所有', async () => {
    const c1 = new ManagedMcpClient(makeServer('c1'), {
      connectFn: vi.fn().mockResolvedValue(makeMockConn('c1')),
      initialBackoffMs: 0,
      pingIntervalMs: 60_000,
    });
    registerManagedClient(c1);
    expect(listManagedClients()).toHaveLength(1);

    clearManagedClients();
    expect(listManagedClients()).toHaveLength(0);
  });
});
