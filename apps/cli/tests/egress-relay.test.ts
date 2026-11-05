// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z3 腿①:本地出口 relay(TCP 连接级判定)。端到端 = 真起本地 socket;
 * 核心断言 = 被拒的连接对目的地**一个字节都没发出去**(副作用未发生)+ 正向对照字节往返。
 * 全程 127.0.0.1 + 注入 lookup/dial,零真联网(§用例纪律)。
 */

import { connect, createServer, type Socket } from 'node:net';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';

import { parseRequestHead, startEgressRelay, type RunningRelay } from '../src/sandbox/egress/proxy-relay.js';
import {
  ensureManagedEgressRelay,
  resetManagedEgressRelayForTests,
  runRelayProbe,
} from '../src/sandbox/egress/proxy-relay-host.js';
import { EGRESS_ENV, type EgressPolicy, type EgressRule } from '../src/sandbox/egress/policy.js';
import { buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';
import { findProjectRoot } from '../src/runs/manifest.js';

function policyOf(rows: readonly EgressRule[], over: Partial<EgressPolicy> = {}): EgressPolicy {
  return { rules: rows, defaultDecision: 'deny', addressProof: false, enforcement: 'enforce', source: 'test', ...over };
}
const rule = (domain: string, effect: 'allow' | 'deny'): EgressRule =>
  ({ id: `test:${effect}:${domain}`, domain, effect, enforcement: 'enforce', why: 'test rule' });

function listenEcho(): Promise<{ server: ReturnType<typeof createServer>; port: number; hits: () => number; bytes: () => number }> {
  return new Promise((resolve) => {
    let hits = 0;
    let bytes = 0;
    const server = createServer((sock) => {
      hits += 1;
      sock.on('data', (chunk) => {
        bytes += chunk.length;
        sock.write(chunk); // 回声夹具
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr !== null ? addr.port : 0, hits: () => hits, bytes: () => bytes });
    });
  });
}

function writeThenRead(sock: Socket, payload: string, wantBytes: number, ms = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => reject(new Error('relay-read-timeout')), ms);
    sock.on('data', (chunk) => {
      acc += chunk.toString('latin1');
      if (acc.length >= wantBytes) {
        clearTimeout(timer);
        resolve(acc);
      }
    });
    sock.on('end', () => {
      clearTimeout(timer);
      resolve(acc);
    });
    sock.on('error', reject);
    sock.write(payload);
  });
}

describe('relay 请求头解析 — 认不出=拒绝面,不猜', () => {
  it('① CONNECT/absolute-form/坏形态三档', () => {
    expect(parseRequestHead('CONNECT example.com:8443 HTTP/1.1\r\n\r\n')).toMatchObject({ kind: 'connect', host: 'example.com', port: 8443 });
    expect(parseRequestHead('CONNECT example.com HTTP/1.1\r\n\r\n')).toMatchObject({ port: 443 });
    expect(parseRequestHead('GET http://a.example/p?q=1 HTTP/1.1\r\nHost: a.example\r\n\r\n')).toMatchObject({ kind: 'forward', host: 'a.example', path: '/p?q=1' });
    expect(parseRequestHead('GARBAGE\r\n\r\n')).toBeNull();
    expect(parseRequestHead('CONNECT host:notaport HTTP/1.1\r\n\r\n')).toBeNull();
    expect(parseRequestHead('TRACE http://a.example HTTP/1.1\r\n\r\n')).toBeNull();
  });
});

describe('relay 端到端 — 真本地 socket,断言副作用未发生', () => {
  const ledgers: string[] = [];
  afterEach(() => {
    for (const f of ledgers.splice(0)) {
      if (existsSync(f)) unlinkSync(f);
    }
  });

  async function withRelay(policy: EgressPolicy, run: (relay: RunningRelay, dest: Awaited<ReturnType<typeof listenEcho>>) => Promise<void>, lookup?: (host: string) => Promise<readonly string[] | null>): Promise<void> {
    const dest = await listenEcho();
    const root = findProjectRoot(process.cwd());
    expect(root).not.toBeNull();
    const ledger = join(root as string, '.ihui-agent', 'tmp', 'egress-relay-test', `led-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
    ledgers.push(ledger);
    process.env[EGRESS_ENV.ledger] = ledger;
    const relay = await startEgressRelay({ policy, startDir: process.cwd(), lookup: lookup ?? (async () => null) });
    try {
      await run(relay, dest);
    } finally {
      delete process.env[EGRESS_ENV.ledger];
      await relay.close();
      dest.server.close();
    }
  }

  it('② deny:对目的地一个字节都没发出(连接根本没建立),客户端 0 字节收讫', async () => {
    await withRelay(policyOf([rule('blocked.relay.test', 'deny')]), async (relay, dest) => {
      const client = connect({ host: '127.0.0.1', port: relay.port });
      const received = await writeThenRead(client, `CONNECT blocked.relay.test:${dest.port} HTTP/1.1\r\n\r\n`, 0, 1200).catch(() => '');
      await new Promise((r) => setTimeout(r, 120));
      expect(dest.hits()).toBe(0); // 副作用未发生:目的地从未被拨号
      expect(dest.bytes()).toBe(0);
      expect(received).toBe(''); // relay 也没回 200(不是"先答应再掐")
      client.destroy();
      const lines = readFileSync(ledgers[ledgers.length - 1] as string, 'utf8').trim().split('\n');
      expect(lines.some((l) => l.includes('blocked.relay.test') && '"decision":"deny"' && '"enforced":true')).toBe(true);
    });
  }, 15_000);

  it('②b unjudged 独立成态:地址证据取不到 ⇒ 同样销毁,不折成 allow(§0.3)', async () => {
    const policy = policyOf([rule('127.0.0.1', 'allow')], { addressProof: true });
    await withRelay(policy, async (relay, dest) => {
      const client = connect({ host: '127.0.0.1', port: relay.port });
      await writeThenRead(client, `CONNECT 127.0.0.1:${dest.port} HTTP/1.1\r\n\r\n`, 0, 1200).catch(() => '');
      await new Promise((r) => setTimeout(r, 120));
      expect(dest.hits()).toBe(0); // 名字规则本可放行,但地址证据缺 ⇒ relay 面拒绝
      client.destroy();
    }, async () => null);
  }, 15_000);

  it('③ 正向对照:allow 档 CONNECT 字节经 relay 往返目的地', async () => {
    await withRelay(policyOf([rule('127.0.0.1', 'allow')]), async (relay, dest) => {
      const client = connect({ host: '127.0.0.1', port: relay.port });
      const got = await writeThenRead(client, `CONNECT 127.0.0.1:${dest.port} HTTP/1.1\r\n\r\n`, 33);
      expect(got.startsWith('HTTP/1.1 200 Connection Established')).toBe(true);
      const echo = await writeThenRead(client, 'ping-relay', 10);
      expect(echo).toBe('ping-relay');
      expect(dest.hits()).toBe(1);
      expect(dest.bytes()).toBe('ping-relay'.length);
      client.destroy();
    });
  }, 15_000);

  it('④ absolute-form GET 以 origin-form 转发(path/query 保真,不进台账)', async () => {
    await withRelay(policyOf([rule('127.0.0.1', 'allow')]), async (relay, dest) => {
      const client = connect({ host: '127.0.0.1', port: relay.port });
      const got = await writeThenRead(client, `GET http://127.0.0.1:${dest.port}/health?token=sec HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n`, 5);
      expect(got.startsWith('GET /')).toBe(true); // 回声夹具把请求行原样送回:首行已是 origin-form
      expect(got.startsWith('GET http://')).toBe(false);
      const ledgerText = readFileSync(ledgers[ledgers.length - 1] as string, 'utf8');
      expect(ledgerText).not.toContain('token=');
      expect(ledgerText).not.toContain('//');
      client.destroy();
    });
  }, 15_000);

  it('⑤ 宿主腿端到端:ensureManagedEgressRelay 真派生+探针就绪+memo 复用;env-inject auto 档真的点腿', async () => {
    resetManagedEgressRelayForTests();
    const env = { [EGRESS_ENV.proxyUrl]: 'auto', [EGRESS_ENV.ledger]: 'off' };
    const first = ensureManagedEgressRelay(env, process.cwd());
    expect(first.url, first.warnings.join('\n')).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const second = ensureManagedEgressRelay(env, process.cwd());
    expect(second.url).toBe(first.url); // memo:进程内不双启
    const exit = buildEgressEnvExit({ commandLine: 'curl https://anything.example/x', cwd: process.cwd(), env, policy: policyOf([rule('anything.example', 'allow')]), append: () => null });
    expect(exit.env.HTTP_PROXY).toBe(first.url);
    expect(exit.env.NO_PROXY).toContain('anything.example');
    const root = findProjectRoot(process.cwd());
    const readyFile = join(root as string, '.ihui-agent', 'state', 'egress-relay.ready.json');
    try {
      const ready = JSON.parse(readFileSync(readyFile, 'utf8')) as { pid?: number };
      if (typeof ready.pid === 'number') process.kill(ready.pid); // 收尾:随测试退场
    } finally {
      if (existsSync(readyFile)) unlinkSync(readyFile);
      resetManagedEgressRelayForTests();
    }
  }, 30_000);

  it('⑤b 探针超时路径:ready 永不出现 ⇒ runRelayProbe null(不无限等)', async () => {
    const missing = join(findProjectRoot(process.cwd()) as string, '.ihui-agent', 'tmp', 'egress-relay-test', `ghost-${Date.now()}.json`);
    expect(await runRelayProbe(missing, 400)).toBeNull();
  }, 10_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
