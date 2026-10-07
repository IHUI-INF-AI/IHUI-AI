// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP stdio 运行时 + ManagedMcpClient —— G-689 / G-691 / G-692 / G-694 的验收用例。
 *
 * 为什么用**真子进程**跑假 MCP server(而不是 mock 掉 ChildProcess):
 *   这四票判的全是"进程 / 流 / 计时器"层面的形状(spawn 失败、stderr 尾、监听器摘除、
 *   在途去重),mock 出来的假 EventEmitter 只会证明"我写的假对象符合我写的实现",
 *   而那正是 AGENTS §22c 说的"镜像测试只复读实现就是复读机"。
 *   这里让判据跑在被审的那条真实路径上:`spawn(node -e 假 server)` → connectMcpServer → sendStdioRpc。
 *
 * G-690(进程树回收)那一条**刻意不在本文件**:它要把 `killProcessTree` 换成 spy,
 * 而 `vi.mock` 掉那个模块会让本文件其余用例失去真实回收能力(子进程泄漏)。
 *   ⇒ 另立 `mcp-runtime-kill-tree.test.ts`。
 */
import { describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import {
  connectMcpServer,
  mcpToolToTool,
  disconnectMcpConnection,
  sendStdioRpc,
  ManagedMcpClient,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import {
  fakeMcpServer,
  FAKE_SERVER_SOURCE,
  FAKE_SECRET_IN_STDERR,
  FAKE_TOKEN_IN_STDERR,
  type FakeMcpMode,
} from './helpers/fake-mcp-server.js';

/** 起假 server → 拿到 conn → 跑断言 → **无论断言是否红**都回收子进程(不留孤儿 / 不留 open handle) */
async function withConn<T>(mode: FakeMcpMode, fn: (conn: McpConnection) => Promise<T>): Promise<T> {
  const conn = await connectMcpServer(fakeMcpServer(mode));
  try {
    return await fn(conn);
  } finally {
    disconnectMcpConnection(conn);
  }
}

type ManagedClientOptions = NonNullable<ConstructorParameters<typeof ManagedMcpClient>[1]>;

/**
 * 走**生产 connectFn**(= connectMcpServer + 真子进程),这样 peerAnswered 那一档标记
 * 是真由本层打上去的 —— 注入 mock callFn 的话,用例只会证明 mock 的行为,证明不了判据。
 */
async function withClient<T>(
  mode: FakeMcpMode,
  overrides: ManagedClientOptions,
  fn: (client: ManagedMcpClient) => Promise<T>,
): Promise<T> {
  const options: ManagedClientOptions = {
    initialBackoffMs: 0,
    maxBackoffMs: 0,
    pingIntervalMs: 60_000,
    ...overrides,
  };
  const client = new ManagedMcpClient(fakeMcpServer(mode), options);
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

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

function spawnSilentChild(): ChildProcess {
  return spawn(process.execPath, ['-e', FAKE_SERVER_SOURCE, 'silent'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

describe('G-689 stdio 子进程诊断:有界 stderr 尾缓冲 + error/exit 监听', () => {
  it('command 不存在 ⇒ 错误消息点名 spawn 失败与 stderr 尾,且不再由 10s 计时器兜顶', async () => {
    const started = Date.now();
    const err: unknown = await connectMcpServer({
      name: 'missing-bin',
      transport: 'stdio',
      command: 'no-such-bin-xyz',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const elapsed = Date.now() - started;
    const message = (err as Error).message;
    // 旧形状:ENOENT 走**异步** error 事件而无人接 ⇒ 只能等满 initialize 的 10s 计时器报"超时"
    expect(elapsed).toBeLessThan(5_000);
    expect(message).toMatch(/stderr 尾=/);
    expect(message).toMatch(/ENOENT|已终止|不可用/);
    expect(message).not.toMatch(/MCP 请求超时/);
  });

  it('子进程写 stderr 后自行退出 ⇒ 尾部进错误消息(旧实现整块丢失),且**经共享脱敏出口**', async () => {
    const err: unknown = await connectMcpServer(fakeMcpServer('dieWithSecret')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;

    // ① 真凶进来了:对端写在 stderr 里的启动失败正文(旧实现只有一句"MCP 请求超时")
    expect(message).toContain('startup failed');
    // ② 退出码被记进诊断(旧实现连 exit 事件都没监听)
    expect(message).toContain('退出码=3');
    // ③ 脱敏走的是共享层唯一出口:虚构凭据被盖成标记,原文一段都不留
    expect(message).toContain('[REDACTED_SECRET]');
    expect(message).not.toContain(FAKE_SECRET_IN_STDERR.slice(3, 23));
    expect(message).not.toContain(FAKE_TOKEN_IN_STDERR.slice(6));
  });

  it('正常连接后每个子进程只剩**一个** stdout data 监听器(分派器),不是每请求挂一个', async () => {
    await withConn('ok', async (conn) => {
      const stdout = conn.process?.stdout;
      expect(stdout).toBeDefined();
      expect(stdout?.listenerCount('data')).toBe(1);
    });
  });
});

describe('G-691 isError 是结果里的错误,不是传输级错误', () => {
  it('isError:true ⇒ success:false(旧写法恒 success:true,模型收到假成功)', async () => {
    await withConn('isError', async (conn) => {
      const def = conn.tools.find((t) => t.name === 'echo');
      if (!def) throw new Error('夹具没产出 tools/list');
      // ctx 只需 workspacePath(ToolContext 其余字段全是可选);execute 的 MCP 分支不读它
      const res = await mcpToolToTool(conn, def).execute({ msg: 'hi' }, { workspacePath: process.cwd() });
      expect(res.success).toBe(false);
      expect(res.error).toContain('参数缺失');
    });
  });

  it('正向对照:isError 缺省仍是 success:true(判据不得把正常结果也判成失败)', async () => {
    await withConn('ok', async (conn) => {
      const def = conn.tools.find((t) => t.name === 'echo');
      if (!def) throw new Error('夹具没产出 tools/list');
      const res = await mcpToolToTool(conn, def).execute({ msg: 'hi' }, { workspacePath: process.cwd() });
      expect(res.success).toBe(true);
      expect(res.output).toContain('echo');
    });
  });

  it('isError 业务失败 ⇒ 不 markDead、不累计 consecutiveFailures', async () => {
    await withClient('isError', { deadThreshold: 1 }, async (client) => {
      const out = (await client.callTool('echo', { msg: 'hi' })) as { isError?: boolean };
      expect(out.isError).toBe(true);
      expect(client.getStatus().dead).toBe(false);
      expect(client.getStatus().consecutiveFailures).toBe(0);
    });
  });

  it('method-not-found(对端已应答)⇒ 抛错但**不** markDead(旧写法每次业务失败都重启子进程)', async () => {
    await withClient('notFound', { deadThreshold: 1 }, async (client) => {
      await expect(client.callTool('echo', { msg: 'hi' })).rejects.toThrow(/Method not found/);
      expect(client.getStatus().dead).toBe(false);
      expect(client.getStatus().consecutiveFailures).toBe(0);
    });
  });

  it('正向对照:**没拿到应答**的失败仍然累计 dead(判据不得退化成"永不标死")', async () => {
    const callFn = vi.fn(async (): Promise<unknown> => {
      throw new Error('进程没了'); // 未经本层打标 ⇒ 按"没拿到应答"处理
    });
    const client = new ManagedMcpClient({ name: 'transport-level', transport: 'stdio' }, {
      connectFn: async () => makeMockConn('transport-level'),
      callFn,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 1,
    });
    await expect(client.callTool('echo', {})).rejects.toThrow('进程没了');
    expect(client.getStatus().dead).toBe(true);
    await client.disconnect();
  });
});

describe('G-692 重连共享 promise + 代次守卫', () => {
  it('conn=null 时三连 call ⇒ connectFn 恰调 1 次(旧写法各起一个子进程,先起者成孤儿)', async () => {
    const sharedConn = makeMockConn('dedup');
    const connectFn = vi.fn(async (): Promise<McpConnection> => sharedConn);
    const callFn = vi.fn(async (): Promise<unknown> => ({ content: [] }));
    const client = new ManagedMcpClient({ name: 'dedup', transport: 'stdio' }, {
      connectFn,
      callFn,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    const results = await Promise.all([
      client.callTool('a', {}),
      client.callTool('b', {}),
      client.callTool('c', {}),
    ]);

    expect(results).toHaveLength(3);
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(callFn).toHaveBeenCalledTimes(3);
    await client.disconnect();
  });

  it('旧代次迟到的连接回写 ⇒ 不得顶掉新 conn,且它自己必须被当场回收', async () => {
    const connA = makeMockConn('late-a');
    const connB = makeMockConn('late-b');
    let firstResolver: ((c: McpConnection) => void) | undefined;
    const pendingFirst = new Promise<McpConnection>((resolve) => {
      firstResolver = resolve;
    });
    let calls = 0;
    const connectFn = vi.fn((): Promise<McpConnection> => {
      calls += 1;
      return calls === 1 ? pendingFirst : Promise.resolve(connB);
    });
    const client = new ManagedMcpClient({ name: 'late', transport: 'stdio' }, {
      connectFn,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
    });

    const firstAttempt = client.ensureConnected(); // 第 1 代:卡在 connectFn 里
    await new Promise((r) => setTimeout(r, 10)); // 让退避与 connectFn 调用真的发生
    await client.disconnect(); // 推进代次
    const current = await client.ensureConnected(); // 新的一代 → connB
    expect(current).toBe(connB);

    firstResolver?.(connA); // 迟到的成功此刻才落地
    await firstAttempt;

    // 代次守卫:迟到的回写**没有**把 this.conn 换成 connA
    expect(client.getConnection()).toBe(connB);
    // 孤儿守卫:connA 没被"丢弃"而是当场被回收(disconnectMcpConnection 置 connected=false)
    expect(connA.connected).toBe(false);
    await client.disconnect();
  });

  it('迟到的传输级失败不得改当代计数(标死/断开推进代次之后的回写)', async () => {
    const callFn = vi.fn(async (): Promise<unknown> => {
      await new Promise((r) => setTimeout(r, 20));
      throw new Error('迟到的传输级失败');
    });
    const client = new ManagedMcpClient({ name: 'late-fail', transport: 'stdio' }, {
      connectFn: async () => makeMockConn('late-fail'),
      callFn,
      initialBackoffMs: 0,
      maxBackoffMs: 0,
      pingIntervalMs: 60_000,
      deadThreshold: 2,
    });
    await client.ensureConnected();
    const genBefore = client.getGeneration();
    const inflight = client.callTool('slow', {});
    await client.disconnect(); // 代次推进 ⇒ 上面那次调用的失败属于已被取代的连接
    await expect(inflight).rejects.toThrow('迟到的传输级失败');
    expect(client.getGeneration()).toBeGreaterThan(genBefore);
    expect(client.getStatus().consecutiveFailures).toBe(0);
    await client.disconnect();
  });
});

describe('G-694 成对清理:超时路径与成功路径同样摘监听器 / 摘表项', () => {
  it('连续 5 次超时后 proc.stdout 上仍是 1 个 data 监听器(旧写法每超时一次永久 +1)', async () => {
    const proc = spawnSilentChild();
    try {
      const stdout = proc.stdout;
      if (!stdout) throw new Error('夹具没有 stdout');
      await expect(sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 40)).rejects.toThrow(/MCP 请求超时/);
      expect(stdout.listenerCount('data')).toBe(1);
      for (let i = 0; i < 4; i++) {
        await expect(sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 40)).rejects.toThrow(/MCP 请求超时/);
      }
      // 旧实现:每次超时都留下一个永不摘除的 'data' 监听器 ⇒ 此处会是 5
      expect(stdout.listenerCount('data')).toBe(1);
      // 超时消息同样带诊断尾(G-689 与 G-694 是同一条链)
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 40).catch((e: unknown) => e);
      expect((err as Error).message).toMatch(/stderr 尾=/);
      expect((err as Error).message).toMatch(/peerAnswered|超时/);
    } finally {
      proc.kill();
    }
  });

  it('断开后观察点摘线:该子进程上的 data 监听器归零', async () => {
    const proc = spawnSilentChild();
    try {
      await expect(sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 30)).rejects.toThrow(/超时/);
      disconnectMcpConnection({
        server: { name: 'x', transport: 'stdio' },
        tools: [],
        process: proc,
        connected: true,
        transport: 'stdio',
        ssePending: new Map(),
        sseNextId: 1,
      });
      expect(proc.stdout?.listenerCount('data')).toBe(0);
      expect(proc.stderr?.listenerCount('data')).toBe(0);
    } finally {
      proc.kill();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
