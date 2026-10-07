// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-692 —— 重连必须有"在途合并 + 代次守卫"。
 *
 * 病灶(现读 HEAD 的 `reconnect()`):先 `sleep(backoff)` 再 `this.conn = await connectFn()`,
 * 中间没有任何"已经有人在重连了"的判据 —— 两个并发 callTool 各起一个子进程,
 * 后落地的那个把 `this.conn` 顶掉,先起的那份从此**永不可达**:没人持有它 ⇒ 没人摘监听器、
 * 没人 kill ⇒ 子进程孤儿;而状态计数也按后那份算,前一份的成功/失败都在算空。
 *
 * 四条判据各有正反例,缺一条就等于把另一条的失效藏起来:
 *  ① 并发三路 ⇒ connectFn 恰 1 次且**只 spawn 一个真子进程**;
 *  ② 串行两路 ⇒ 每次都**真重连**(合并不得变成"永不重连"的通道);
 *  ③ 旧代次迟到的**成功** ⇒ 不覆盖当代 conn,且它自己当场被回收(不是"丢弃");
 *  ④ 旧代次迟到的**失败** ⇒ 不动当代计数;当代的失败照旧累计(正向对照)。
 *
 * ① 用真 spawn(`process.execPath` 起的静默子进程):mock 的调用计数只能证明"工厂被叫了几次",
 * 证不了"没多起一个进程"。②③④ 用带 kill 记账的桩:那三维断的是**编排**,而真进程在断言窗口里
 * 未必来得及退出 —— 把它当证据只会得到一条 flaky 的假结论(如实登记:孤儿进程的"真的被杀掉了"
 * 那一维由 ① 的真 spawn 侧承担,本文件的 ③ 只断"回收被调用")。
 * 不连生产库 / 不占端口(AGENTS §5 测试隔离铁律)。
 */
import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { ManagedMcpClient, type McpConnection } from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';

type ClientOptions = NonNullable<ConstructorParameters<typeof ManagedMcpClient>[1]>;

/** 永不回话、也不自己退出的子进程:足够让"多起一个"变成可数的真实代价 */
const SILENT_SERVER = "'use strict'; setInterval(function () {}, 1000);";

function fakeStdioServer(name: string): McpServer {
  return { name, transport: 'stdio', command: process.execPath, args: ['-e', SILENT_SERVER] };
}

function silentChild(): ChildProcess {
  return spawn(process.execPath, ['-e', SILENT_SERVER], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

/** 带 kill 记账的连接桩:`disconnectMcpConnection` 走的就是 `conn.process.kill()` */
function mockConn(name: string, kills: string[]): McpConnection {
  return {
    server: { name, transport: 'stdio' },
    tools: [],
    process: {
      kill: () => {
        kills.push(name);
        return true;
      },
    } as unknown as ChildProcess,
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  };
}

const BASE: ClientOptions = { initialBackoffMs: 0, maxBackoffMs: 0, pingIntervalMs: 60_000 };

describe('G-692 在途合并:同一时刻至多一次重连', () => {
  it('并发三路 ensureConnected ⇒ connectFn 恰 1 次且**只 spawn 一个子进程**(旧写法各起一个,先起者成孤儿)', async () => {
    const spawned: ChildProcess[] = [];
    let connectCalls = 0;
    const client = new ManagedMcpClient(fakeStdioServer('dedup'), {
      ...BASE,
      connectFn: async (): Promise<McpConnection> => {
        connectCalls++;
        // 真 spawn:这样"起了几个进程"是量出来的,而不是从注入次数推出来的
        const proc = silentChild();
        spawned.push(proc);
        return {
          server: fakeStdioServer('dedup'),
          tools: [],
          process: proc,
          connected: true,
          transport: 'stdio',
          ssePending: new Map(),
          sseNextId: 1,
        };
      },
    });
    try {
      const conns = await Promise.all([client.ensureConnected(), client.ensureConnected(), client.ensureConnected()]);
      expect(connectCalls).toBe(1);
      expect(spawned).toHaveLength(1);
      // 三路拿到的是**同一条**连接,不是三个各自独立的对象
      expect(conns[1]).toBe(conns[0]);
      expect(conns[2]).toBe(conns[0]);
      // 代次也只推进了一次(三次调用 = 一代)
      expect(client.getGeneration()).toBe(1);
    } finally {
      await client.disconnect();
      for (const p of spawned) p.kill();
    }
  });

  it('正向对照:串行两路 ⇒ 每次都真重连(connectFn 恰 2 次)—— 合并不得变成"永不重连"的通道', async () => {
    const kills: string[] = [];
    let calls = 0;
    const client = new ManagedMcpClient(fakeStdioServer('serial'), {
      ...BASE,
      connectFn: async (): Promise<McpConnection> => {
        calls++;
        if (calls === 1) throw new Error('第一次连接失败'); // 失败侧也要清空在途指针
        return mockConn(`serial-${calls}`, kills);
      },
    });
    try {
      await client.ensureConnected();
      expect(client.getConnection()).toBeNull(); // 第一次失败 ⇒ 没有连接
      await client.ensureConnected(); // 第二次:必须真的再连一次,而不是 join 那次已失败的尝试
      expect(calls).toBe(2);
      expect(client.getConnection()).not.toBeNull();
      expect(client.getGeneration()).toBe(2);
    } finally {
      await client.disconnect();
    }
  });

  it('两次**成功**之间也不得复用同一次尝试 ⇒ 第二条连接是新代次的产物,旧的被当场回收', async () => {
    const kills: string[] = [];
    const made: McpConnection[] = [];
    const client = new ManagedMcpClient(fakeStdioServer('twice'), {
      ...BASE,
      pingIntervalMs: 0, // 每次 ensureConnected 都判"不存活" ⇒ 恒走重连路径
      connectFn: async (): Promise<McpConnection> => {
        const c = mockConn(`c${made.length}`, kills);
        made.push(c);
        return c;
      },
    });
    try {
      const first = await client.ensureConnected();
      const second = await client.ensureConnected();
      expect(made).toHaveLength(2);
      expect(second).not.toBe(first);
      expect(client.getGeneration()).toBe(2);
      // 被取代的第一条不是"被丢弃",而是走了回收(kill 记账可见)
      expect(kills).toContain('c0');
    } finally {
      await client.disconnect();
    }
  });
});

describe('G-692 代次守卫:只有当代的连接/失败才允许改状态', () => {
  it('旧代次迟到的**成功** ⇒ 不覆盖当代 conn,且它自己当场被回收', async () => {
    const kills: string[] = [];
    let releaseFirst: ((c: McpConnection) => void) | undefined;
    const firstPending = new Promise<McpConnection>((resolve) => {
      releaseFirst = resolve;
    });
    const connB = mockConn('conn-B', kills);
    let calls = 0;
    const client = new ManagedMcpClient(fakeStdioServer('late'), {
      ...BASE,
      connectFn: () => {
        calls += 1;
        return calls === 1 ? firstPending : Promise.resolve(connB);
      },
    });
    try {
      const firstAttempt = client.ensureConnected(); // 第 1 代:卡在 connectFn 里
      await new Promise((r) => setTimeout(r, 20)); // 让退避与本次 connectFn 真的发生
      const genBefore = client.getGeneration();
      await client.disconnect(); // 用户显式断开 ⇒ 推进代次并作废在途指针
      const current = await client.ensureConnected(); // 当代 ⇒ connB
      expect(current).toBe(connB);
      expect(client.getGeneration()).toBeGreaterThan(genBefore);

      releaseFirst?.(mockConn('conn-A', kills)); // 迟到的成功此刻才落地
      await firstAttempt;

      expect(client.getConnection()).toBe(connB); // 没被旧代顶掉
      expect(kills).toContain('conn-A'); // 且当场回收 ⇒ 不留孤儿
      expect(connB.connected).toBe(true);
    } finally {
      await client.disconnect();
    }
  });

  it('旧代次迟到的**失败** ⇒ 不动当代计数(否则刚接上的新连接会被上一代的报错判死)', async () => {
    const client = new ManagedMcpClient(fakeStdioServer('late-fail'), {
      ...BASE,
      deadThreshold: 2,
      connectFn: async (): Promise<McpConnection> => mockConn('current', []),
      callFn: async () => {
        await new Promise((r) => setTimeout(r, 30));
        throw new Error('迟到的传输级失败'); // 没拿到应答 ⇒ 本属传输档,但已被取代的一代不记账
      },
    });
    try {
      await client.ensureConnected();
      const genBefore = client.getGeneration();
      const inflight = client.callTool('slow', {});
      await client.disconnect(); // 代次推进 ⇒ 上面那次调用属"已被取代的连接"
      await expect(inflight).rejects.toThrow('迟到的传输级失败'); // 错误仍原样上抛(不静默)
      expect(client.getGeneration()).toBeGreaterThan(genBefore);
      expect(client.getStatus().consecutiveFailures).toBe(0);
      expect(client.getStatus().dead).toBe(false);
    } finally {
      await client.disconnect();
    }
  });

  it('正向对照:当代的传输级失败照旧累计并 markDead(守卫不得把真故障也挡掉)', async () => {
    const client = new ManagedMcpClient(fakeStdioServer('current-fail'), {
      ...BASE,
      deadThreshold: 1,
      connectFn: async (): Promise<McpConnection> => mockConn('current', []),
      callFn: async (): Promise<unknown> => {
        throw new Error('当下的传输级失败');
      },
    });
    try {
      await expect(client.callTool('boom', {})).rejects.toThrow('当下的传输级失败');
      expect(client.getStatus().consecutiveFailures).toBe(1);
      expect(client.getStatus().dead).toBe(true);
    } finally {
      await client.disconnect();
    }
  });

  it('markDead 不推进代次 ⇒ 一条在途/后续的重连仍可落地并翻回 alive(顶掉它只会多 spawn 一次)', async () => {
    let calls = 0;
    const client = new ManagedMcpClient(fakeStdioServer('revive'), {
      ...BASE,
      deadThreshold: 1,
      connectFn: async (): Promise<McpConnection> => mockConn('revive', []),
      callFn: async (): Promise<unknown> => {
        calls += 1;
        if (calls === 1) throw new Error('传输级失败'); // 第一次:没拿到应答 ⇒ 传输档 ⇒ 标死
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    });
    try {
      await expect(client.callTool('boom', {})).rejects.toThrow('传输级失败');
      expect(client.getStatus().dead).toBe(true);
      // 死过一次之后仍要能靠下一次重连回来(旧写法也能,这一条是"改动没把它改坏"的对照)
      const conn = await client.ensureConnected();
      expect(conn).not.toBeNull();
      expect(client.getStatus().dead).toBe(false);
      expect(client.getStatus().consecutiveFailures).toBe(0);
      await expect(client.callTool('boom', {})).resolves.toBeTruthy();
    } finally {
      await client.disconnect();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
