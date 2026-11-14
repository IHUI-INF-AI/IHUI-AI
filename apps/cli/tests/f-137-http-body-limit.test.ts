// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-137 回归:本地 HTTP `/message` 请求体必须有大小上限。
 *
 * 持 agent token 的客户端(或 token 泄漏后)一条巨型 POST 即可把 `ihui serve` 内存打满。
 * 判据:声明 Content-Length 超限与 chunked 流累计超限都必须被拒(413 或直接断开),
 * 且正常体积的请求行为不变。
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as http from 'node:http';
import {
  MAX_JSON_BODY_BYTES,
  startAgentServer,
  type AgentServerHandle,
} from '../src/server/http-server.js';
import type { AgentCore } from '../src/server/index.js';

const stubCore = {
  listSessions: () => [],
  resumeSession: async () => null,
  sendMessage: async () => ({ sessionId: 's', stopReason: 'end_turn', iterations: 1, usage: {} }),
} as unknown as AgentCore;

type Outcome = { status?: number; body?: string; error?: string };

/** 无鉴权配置时服务端将一律 401,故显式带一个测试 token。 */
const TOKEN = 'f-137-test-token';
const AUTH = { authorization: `Bearer ${TOKEN}` };

let handle: AgentServerHandle | null = null;

afterEach(async () => {
  if (handle) {
    await handle.close().catch(() => undefined);
    handle = null;
  }
});

function postMessage(port: number, body: Buffer, declared = true): Promise<Outcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (o: Outcome): void => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      ...AUTH,
    };
    if (declared) headers['Content-Length'] = body.length;
    const req = http.request(
      { host: '127.0.0.1', port, path: '/message', method: 'POST', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c instanceof Buffer ? c : Buffer.from(c)));
        res.on('end', () => done({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
        res.on('error', (e) => done({ error: e.message }));
      },
    );
    req.on('error', (e) => done({ error: e.message }));
    // 超限时服务端会 destroy,写侧可能提前报 EPIPE/ECONNRESET —— 一律视为"被拒"
    req.on('close', () => done({ error: 'connection closed' }));
    req.end(body);
  });
}

/** chunked 发送:不声明 Content-Length,逐块写出,验证"累计字节闸"而非只看声明头。 */
function postChunkedMessage(port: number, chunk: Buffer, count: number): Promise<Outcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (o: Outcome): void => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/message',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked', ...AUTH },
      },
      (res) => {
        res.resume();
        res.on('end', () => done({ status: res.statusCode }));
        res.on('error', (e) => done({ error: e.message }));
      },
    );
    req.on('error', (e) => done({ error: e.message }));
    req.on('close', () => done({ error: 'connection closed' }));
    let sent = 0;
    const pump = (): void => {
      if (settled || sent >= count) {
        req.end();
        return;
      }
      sent += 1;
      // 每块 64 KB,累计超过阈值后服务端应主动断开
      if (!req.write(chunk)) req.once('drain', pump);
      else setImmediate(pump);
    };
    pump();
  });
}

/** "被拒"的两种合法形态:显式 413,或连接被提前断开。 */
function expectRejected(o: Outcome): void {
  const rejected = o.status === 413 || typeof o.error === 'string';
  expect(rejected, JSON.stringify(o)).toBe(true);
}

describe('F-137 /message 请求体上限', () => {
  it('上限常量是 1 MB 且已导出', () => {
    expect(MAX_JSON_BODY_BYTES).toBe(1024 * 1024);
  });

  it('声明 Content-Length 超限 ⇒ 413 或断开,不进入 SSE', async () => {
    handle = await startAgentServer(stubCore, { port: 0, token: TOKEN });
    const body = Buffer.alloc(MAX_JSON_BODY_BYTES + 1024, 0x61);

    const outcome = await postMessage(handle.port, body);

    expectRejected(outcome);
    expect(outcome.status).not.toBe(200);
  });

  it('chunked 累计超限 ⇒ 413 或断开(不依赖声明头)', async () => {
    handle = await startAgentServer(stubCore, { port: 0, token: TOKEN });
    const chunk = Buffer.alloc(64 * 1024, 0x61);

    const outcome = await postChunkedMessage(handle.port, chunk, 40);

    expectRejected(outcome);
    expect(outcome.status).not.toBe(200);
  });

  it('正常体积的 JSON 行为不变:200 SSE 且收到 result', async () => {
    handle = await startAgentServer(stubCore, { port: 0, token: TOKEN });
    const body = Buffer.from(JSON.stringify({ text: 'hi' }), 'utf-8');

    const outcome = await postMessage(handle.port, body);

    expect(outcome.error).toBeUndefined();
    expect(outcome.status).toBe(200);
    expect(outcome.body).toContain('event: result');
  });

  it('服务端设置了 headersTimeout(防慢速请求头长期占用)', async () => {
    handle = await startAgentServer(stubCore, { port: 0, token: TOKEN });

    expect(handle.server.headersTimeout).toBeGreaterThan(0);
    expect(handle.server.headersTimeout).toBeLessThanOrEqual(handle.server.requestTimeout);
  });
});
