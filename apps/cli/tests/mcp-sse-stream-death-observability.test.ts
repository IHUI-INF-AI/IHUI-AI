// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账「mcp-runtime SSE 后台循环 `.catch(() => {})` 吞错」—— 最小可观测修复的常驻尺子。
 *
 * 病灶(改前 HEAD):connectMcpServer 的 sse 分支把 `readSseStream` 的 reject 整块
 * `.catch(() => {})` 吞掉(原 mcp-runtime.ts:997-999),流自身死亡(网络断/对端重置)
 * 零观测;取消路径(abort)静默合理,pending 请求由 10s 超时兜底 —— "有界但不主动观测"。
 *
 * 修复:catch 改为 `classifySseStreamExit` 分档 ——
 *   - 'aborted'(取消路径):静默,留注释;
 *   - 'error'(异常路径):`console.warn` 告警(照抄本文件既有 `[mcp-runtime] server=…` 形态)
 *     + `conn.connected = false`(复用既有状态字段,状态上报可见)。
 *   刻意**不加 Retry、不做自动重连** —— 重连是设计取向,登记待拍板;禁为吞错加 Retry 藏红。
 *
 * 判据成对(正反缺一不可,否则判据恒真):
 *  ① 正:流异常死亡(对端半途 RST)⇒ 恰一条带 server 名的告警 + connected 翻 false;
 *  ② 正:取消路径(disconnect abort)⇒ **零**告警(静默仍合理,不误伤);
 *  ③ 反:分档函数不恒真 —— 网络型错误 → 'error';AbortError / 信号已 aborted → 'aborted'。
 *
 * 为什么用**真 SSE 服务器**:这票判的是"流死亡在真 fetch/undici 栈上怎么表现",
 * mock 的 ReadableStream 证明不了对端 RST 会被 undici 变成哪一种 reject(同 G-689 的纪律)。
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  classifySseStreamExit,
  connectMcpServer,
  disconnectMcpConnection,
  type McpConnection,
} from '../src/tools/mcp-runtime.js';

// 手术式 mock:本文件只测「流死亡的可观测性」,不测 SSRF 守卫 —— SSE endpoint 的 POST
// 按设计**不带**信任(远端推来的 URL 不得因用户配置放行),回环假服务器必然撞
// direct-ip-denied,而真流行为(undici 栈上的 reject 形状)正是本票要判的东西。
// SSRF 守卫本身由 ssrf-outbound-surface.test.ts 单独钉住,这里只把它换成常 safe。
vi.mock('@ihui/shared/utils/ssrf-guard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@ihui/shared/utils/ssrf-guard')>();
  return {
    ...actual,
    assertSafeFetchUrl: async () => ({ safe: true }) as import('@ihui/shared/utils/ssrf-guard').SsrfDecision,
  };
});

interface FakeSseMcp {
  baseUrl: string;
  /** 冲刷已排队的 SSE 帧,然后对半途 destroy(对端 RST ⇒ 客户端流 reject,不是干净 done) */
  killStream: () => Promise<void>;
  close: () => Promise<void>;
}

/** 真 SSE MCP server:GET /sse 推 endpoint 事件;POST /rpc 的应答经 SSE message 事件回推。 */
async function startFakeSseMcp(): Promise<FakeSseMcp> {
  let sseRes: http.ServerResponse | undefined;
  let base = '';
  const server = http.createServer();
  server.on('request', (req, res) => {
    if (req.method === 'GET' && req.url === '/sse') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      sseRes = res;
      res.write(`event: endpoint\ndata: ${base}/rpc\n\n`);
      return;
    }
    // POST /rpc:fire-and-forget,真正应答经 SSE 流推送(与生产 sendSseRpc 的契约一致)
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
    req.on('end', () => {
      const id = (JSON.parse(raw || '{}') as { id?: number }).id ?? 0;
      const result =
        id === 1
          ? { protocolVersion: '2024-11-05', capabilities: {} } // initialize
          : id === 2
            ? { tools: [] } // tools/list
            : {}; // resources/list / prompts/list(空集即合法)
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
      sseRes?.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id, result })}\n\n`);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    baseUrl: base,
    killStream: () =>
      new Promise<void>((resolve) => {
        const r = sseRes;
        if (!r) return resolve();
        r.write('', () => {
          r.destroy();
          resolve();
        });
      }),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start >= timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
  return true;
}

describe('SSE 后台循环吞错的最小可观测修复', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正例① 流异常死亡(非取消路径)⇒ 恰一条带 server 名的告警 + connected 翻 false', async () => {
    const fake = await startFakeSseMcp();
    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
    let conn: McpConnection | undefined;
    try {
      conn = await connectMcpServer({ name: 'fake-sse', transport: 'sse', url: `${fake.baseUrl}/sse` });
      expect(conn.connected).toBe(true);
      // 反向半边:流死之前,这条告警一次都不该有(防"告警恒在"蒙过判据)
      expect(spy.mock.calls.filter((c) => String(c[0]).includes('SSE 流异常终止'))).toHaveLength(0);

      await fake.killStream();
      // 后台循环 reject → catch → 降档,是异步的;轮询至 connected 翻 false
      const flipped = await waitFor(() => conn !== undefined && conn.connected === false, 5000);
      expect(flipped).toBe(true);

      const hits = warns.filter((w) => w.includes('SSE 流异常终止'));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toContain('[mcp-runtime]');
      expect(hits[0]).toContain('server=fake-sse');
    } finally {
      if (conn) disconnectMcpConnection(conn);
      await fake.close();
    }
  });

  it('正例② 取消路径(disconnect abort)⇒ 静默仍合理:零告警,不误伤', async () => {
    const fake = await startFakeSseMcp();
    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
    try {
      const conn = await connectMcpServer({
        name: 'fake-sse-abort',
        transport: 'sse',
        url: `${fake.baseUrl}/sse`,
      });
      expect(conn.connected).toBe(true);
      disconnectMcpConnection(conn); // 触发 abort ⇒ 后台循环按取消路径退出
      // 给后台 catch 一拍机会:若被误分类成异常路径,告警必现
      await new Promise((r) => setTimeout(r, 300));
      expect(spy.mock.calls.filter((c) => String(c[0]).includes('SSE 流异常终止'))).toHaveLength(0);
    } finally {
      await fake.close();
    }
  });

  it('反例③ 分档函数不恒真:网络型错误→error;AbortError/信号已 aborted→aborted', () => {
    const ctrl = new AbortController();
    // 未取消 + 普通网络错误 ⇒ 必须走异常路径(向可观测倾斜)
    expect(classifySseStreamExit(new Error('read ECONNRESET'), ctrl.signal)).toBe('error');
    expect(classifySseStreamExit('terminated', undefined)).toBe('error');
    // 信号未置位但错误名恰为 AbortError(旁路中止)⇒ 取消档
    const abortErr = new Error('This operation was aborted');
    abortErr.name = 'AbortError';
    expect(classifySseStreamExit(abortErr, undefined)).toBe('aborted');
    // 信号已置位 ⇒ 取消档(即使错误形状再怪)
    ctrl.abort();
    expect(classifySseStreamExit(new Error('anything'), ctrl.signal)).toBe('aborted');
  });
});
