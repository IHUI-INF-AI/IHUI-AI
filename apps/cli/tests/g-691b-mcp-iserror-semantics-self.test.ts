// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-691 —— `tools/call` 的 `isError` 是**结果里的错误**,不是传输级错误。
 *
 * 病灶(改前现读 `apps/cli/src/tools/mcp-runtime.ts`,两半各自独立):
 *① `mcpToolToTool(...).execute()` 只取 `content` 文本、**恒 `success: true`** ——
 *   MCP 协议规定 `tools/call` 成功返回时仍可能带 `isError: true` 表示"传输与协议都通了,
 *   但这条工具业务上失败"(参数不合法 / 远端服务报错 / 前置不满足)。
 *   改前**只读 content**,所以这类失败一律被报成成功 ⇒ **模型收到假成功**,且没有任何一层会重试。
 *② `ManagedMcpClient.callTool` 对**任何** throw 都累计 `consecutiveFailures` ⇒ 达阈值 `markDead`。
 *   而"方法不被支持""参数不合法"这类**对端已应答**的业务失败会照样把子进程重启一遍,
 *   进程内状态(会话、订阅、缓存)全部丢掉。
 *
 * 两条锁成对:① 说"别把失败报成成功",② 说"别把好连接重启掉"。
 * 反向锁同样要钉:`peerAnswered` 标记**读成 false 时才累计**(fail-closed),
 * 读成 true 会在真传输失败上反而不重启,把坏连接留在原地。
 *
 * 不连生产库/ 不占端口(AGENTS §5);`connectFn` 用假实现,不真派生任何进程。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ManagedMcpClient,
  mcpToolResultToToolResult,
  markPeerAnswered,
  readMcpPeerAnswered,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';

function makeMockConn(): McpConnection {
  return {
    server: { name: 'g691', transport: 'stdio' },
    tools: [],
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  };
}

const SERVER: McpServer = { name: 'g691', transport: 'stdio', command: 'echo' };

describe('G-691 ① isError:true 必须读成失败,不得报成功(改前恒 success:true)', () => {
  /**
   * 直接测纯函数 `mcpToolResultToToolResult`,**不 mock `callMcpServer`** ——
   * 第一版夹具试过 `vi.spyOn(mod, 'callMcpServer')`,**对 ESM 具名导出无效**
   * (spy 不生效,用例读到的是真调用抛的 "stdio 连接未建立")。
   * 抽纯函数正是为了让这条判据能被直接对账,而不是被迫穿过整条依赖链。
   */
  it('isError:true 且 content 带错误正文 ⇒ success:false 且把正文带进 error', () => {
    const res = mcpToolResultToToolResult(
      { content: [{ type: 'text', text: '参数 name 缺失' }], isError: true },
      'echo',
    );
    expect(res.success, '远端说了 isError 却报成功 = 假成功').toBe(false);
    expect(res.error).toContain('参数 name 缺失');
    expect(res.output).toContain('参数 name 缺失');
  });

  it('isError:true 但没有任何文本 ⇒ 仍是失败,且 error 不得读成空/成功', () => {
    const res = mcpToolResultToToolResult({ isError: true }, 'echo');
    expect(res.success).toBe(false);
    expect(res.error, '没有正文也必须有一句可读的失败原因').toBeTruthy();
    expect(res.error).toContain('echo');
  });

  it('isError:true + content 为空数组 ⇒ 仍是失败(不得读成"无输出即成功")', () => {
    const res = mcpToolResultToToolResult({ content: [], isError: true }, 'echo');
    expect(res.success, 'content 为空不等于成功 —— isError 是独立信号').toBe(false);
  });

  it('反向锁①:isError 缺省且有 content ⇒ 仍报成功(不得把正常结果误判成失败)', () => {
    const res = mcpToolResultToToolResult({ content: [{ type: 'text', text: 'echo:ok' }] }, 'echo');
    expect(res.success).toBe(true);
    expect(res.output).toBe('echo:ok');
  });

  it('反向锁②:isError:false 显式给出 ⇒ 仍报成功(不得把 false 当 true 判)', () => {
    const res = mcpToolResultToToolResult(
      { content: [{ type: 'text', text: 'ok' }], isError: false },
      'echo',
    );
    expect(res.success).toBe(true);
  });

  it('反向锁③:content 缺失且无 isError ⇒ 沿用改前形态 "(无输出)" 且报成功', () => {
    const res = mcpToolResultToToolResult(null, 'echo');
    expect(res.success).toBe(true);
    expect(res.output).toBe('(无输出)');
  });

  it('反向锁④:非文本块被过滤 ⇒ 不把结构块当正文读成成功(沿用改前语义)', () => {
    const res = mcpToolResultToToolResult(
      { content: [{ type: 'image', data: 'xxx' } as unknown as { type: string; text?: string }] },
      'echo',
    );
    expect(res.success).toBe(true);
    expect(res.output).toBe('(无文本输出)');
  });
});

/**
 * 造一个"连接真的活着"的 client。
 *
 * **关键(第一版夹具就栽在这,两次)**:
 * ① `ensureConnected()` 每次都问 `isAlive()`,而 `isAlive()` 除 `deadMarkedAt` 外
 *    还要求 `Date.now() - lastPingAt < PING_INTERVAL_MS`;`lastPingAt` 初始 0
 *    ⇒ 任何夹具只要没先成功 ping 过,后续每次 `callTool` 都会先重连,
 *    而重连会把 `consecutiveFailures` 清零 ⇒ 计数永远涨不到阈值。
 * ② **`ping()` 不能当第一步**:它开头就 `if (!this.conn) return false`(:1449),
 *    还没连上就直接短路,`lastPingAt` 压根没被写。
 * ⇒ 正确顺序:**先 `ensureConnected()` 建连,再 `ping()` 把 `lastPingAt` 推到"刚刚"**。
 * 之后 `callTool` 才复用同一条连接,计数才会真涨。
 */
async function makeLiveClient(callFn: ReturnType<typeof vi.fn>): Promise<ManagedMcpClient> {
  const conn = makeMockConn();
  // 一个 callFn 统一分派:`ping` 必须成功(它只负责把 lastPingAt 推高),
  // `tools/call` 才走用例自己的失败序列。`callFn` 是 readonly 字段,
  // 不能事后换掉 ⇒ 只能在构造时就把两个分支装进同一个函数。
  const dispatch = vi.fn(async (_c: McpConnection, method: string, _p: Record<string, unknown>) => {
    if (method === 'ping') return {};
    return callFn();
  });
  const client = new ManagedMcpClient(SERVER, {
    connectFn: vi.fn().mockResolvedValue(conn),
    callFn: dispatch,
    initialBackoffMs: 0,
    pingIntervalMs: 60_000,
  });
  await client.ensureConnected(); // ① 先建连
  expect(await client.ping(), 'ping 必须成功,否则 lastPingAt 没被推高').toBe(true); // ② 再 ping
  return client;
}

describe('G-691 ② 对端已应答的业务失败不得累计到 markDead', () => {
  it('带 peerAnswered 标记的失败:连抛 DEAD_THRESHOLD 次也不得markDead', async () => {
    const client = await makeLiveClient(
      vi.fn().mockRejectedValue(markPeerAnswered(new Error('Method not found'))),
    );

    // 阈值是 3;连抛 5 次仍必须活着 —— 改前第 3 次就 markDead
    for (let i = 0; i < 5; i++) {
      await client.callTool('echo', {}).catch(() => undefined);
    }
    // 判据用 getStatus().dead / consecutiveFailures,**不用 isAlive()** ——
    // isAlive() 还叠了一维 ping 时间窗,会让断言测不到本票真正要锁的那件事。
    const st = client.getStatus();
    expect(st.dead, '对端健在,只是不认这条方法 ⇒ 连接不该被判死').toBe(false);
    expect(st.consecutiveFailures, '对端已应答 ⇒ 失败计数必须恒为 0').toBe(0);
  });

  it('反向锁:传输层失败(无标记)仍必须累计并最终 markDead —— 守卫不能变成免死金牌', async () => {
    const client = await makeLiveClient(vi.fn().mockRejectedValue(new Error('MCP 请求超时')));

    // **只发 3 次(恰好到阈值)**:markDead() 会 `this.conn = null`(:1548),
    // 于是第 4 次 `callTool` 先走 ensureConnected → reconnect → 计数被清零。
    // 多发几次只会让断言测到"重连后的新账",而测不到"是否曾判死"这一格。
    for (let i = 0; i < 3; i++) {
      await client.callTool('echo', {}).catch(() => undefined);
    }
    const st = client.getStatus();
    expect(st.dead, '真传输失败必须照旧判死,否则坏连接永远留在原地').toBe(true);
    expect(st.consecutiveFailures, '计数必须照旧累计到阈值').toBeGreaterThanOrEqual(3);
  });

  it('混合序列:对端应答的失败必须把传输失败计数清零,不得让旧账在下一击立刻越过阈值', async () => {
    const client = await makeLiveClient(
      vi
        .fn()
        // 第 1 次:传输失败,计数 = 1
        .mockRejectedValueOnce(new Error('MCP 请求超时'))
        // 第 2 次:传输失败,计数 = 2
        .mockRejectedValueOnce(new Error('MCP 请求超时'))
        // 第 3 次:应答 ⇒ 必须把前两次清零
        .mockRejectedValueOnce(markPeerAnswered(new Error('Method not found')))
        // 第 4 次:从 0 起算 ⇒ 计数 = 1,**不该**越过阈值 3
        .mockRejectedValue(new Error('MCP 请求超时')),
    );

    for (let i = 0; i < 4; i++) {
      await client.callTool('echo', {}).catch(() => undefined);
    }
    const st = client.getStatus();
    // 改前:第 3 次的"对端已应答"也会被累计 ⇒ 计数 3 已达阈值 ⇒ dead=true。
    expect(st.consecutiveFailures, '第 3 次的应答必须把前两次的传输失败清零,故此处应为 1').toBe(1);
    expect(st.dead, '清零后第 4 次传输失败不该恰好越过阈值').toBe(false);
  });

  it('载体反向锁:未标记的 Error 一律读成"未应答"(fail-closed)', () => {
    expect(readMcpPeerAnswered(new Error('裸错误'))).toBe(false);
    expect(readMcpPeerAnswered('不是 Error')).toBe(false);
    expect(readMcpPeerAnswered(markPeerAnswered(new Error('已应答')))).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
