// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-07 网络边界双引擎契约。
 *
 * ① LocalProxy 的 CONNECT 隧道与普通 HTTP 代理都真转发；
 * ② 黑名单目标在**连接前**被 403，不产生上游连接；
 * ③ DNS hook 在解析前拒绝黑名单域名，且 uninstall 恢复原函数；
 * ④ 装配层把代理地址写进 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY，并原样还原。
 */

import dns from 'node:dns';
import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { installDnsEgressHook } from '../src/sandbox/egress/dns-hook.js';
import { startEgressLocalProxy } from '../src/sandbox/egress/local-proxy.js';
import {
  installNetworkBoundary,
  NETWORK_BOUNDARY_PROXY_ENV,
} from '../src/sandbox/egress/network-boundary.js';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

function startUpstream(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`upstream:${req.method}:${req.url}`);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('no upstream port');
      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function sendRaw(port: number, text: string, untilClose = false): Promise<string> {
  return new Promise((resolve, reject) => {
    let received = '';
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(text);
    });
    socket.setTimeout(5_000, () => {
      socket.destroy();
      reject(new Error('proxy 响应超时'));
    });
    socket.on('data', (chunk) => {
      received += chunk.toString('utf8');
      if (!untilClose && received.includes('\r\n\r\n')) {
        socket.destroy();
        resolve(received);
      }
    });
    socket.once('close', () => resolve(received));
    socket.once('error', reject);
  });
}

describe('A LocalProxy', () => {
  it('普通 HTTP 绝对 URI 真转发到上游', async () => {
    const upstream = await startUpstream();
    cleanups.push(upstream.close);
    const proxy = await startEgressLocalProxy({ policy: { mode: 'open' } });
    cleanups.push(() => proxy.close());

    const response = await sendRaw(
      proxy.port,
      `GET http://127.0.0.1:${upstream.port}/hello?x=1 HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`,
    );
    expect(response).toContain('HTTP/1.1 200 OK');
    expect(response).toContain('upstream:GET:/hello?x=1');
  });

  it('CONNECT 隧道建立后按原样转发', async () => {
    const upstream = await startUpstream();
    cleanups.push(upstream.close);
    const proxy = await startEgressLocalProxy({ policy: { mode: 'open' } });
    cleanups.push(() => proxy.close());

    const raw = await new Promise<string>((resolve, reject) => {
      let received = '';
      const socket = net.connect(proxy.port, '127.0.0.1', () => {
        socket.write(`CONNECT 127.0.0.1:${upstream.port} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n`);
      });
      socket.on('data', (chunk) => {
        received += chunk.toString('utf8');
        if (received.includes('200 Connection Established')) {
          socket.write('GET /tunnel HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
        }
        if (received.includes('upstream:GET:/tunnel')) {
          socket.destroy();
          resolve(received);
        }
      });
      socket.once('error', reject);
    });
    expect(raw).toContain('200 Connection Established');
    expect(raw).toContain('upstream:GET:/tunnel');
  });

  it('黑名单目标在连接前被 403', async () => {
    const proxy = await startEgressLocalProxy({
      policy: { mode: 'blocklist', domains: ['blocked.test'] },
    });
    cleanups.push(() => proxy.close());

    const response = await sendRaw(
      proxy.port,
      'CONNECT blocked.test:443 HTTP/1.1\r\nHost: blocked.test\r\n\r\n',
    );
    expect(response).toContain('403 Forbidden');
    expect(response).toContain('blocked.test');
  });

  it('畸形请求不猜目标，直接 400', async () => {
    const proxy = await startEgressLocalProxy({ policy: { mode: 'open' } });
    cleanups.push(() => proxy.close());
    const response = await sendRaw(proxy.port, 'GET /relative HTTP/1.1\r\nHost: x\r\n\r\n');
    expect(response).toContain('400 Bad Request');
  });
});

describe('B DNS hook', () => {
  it('黑名单域名在解析前被拒，uninstall 恢复', async () => {
    const before = dns.promises.lookup;
    const uninstall = installDnsEgressHook({
      mode: 'blocklist',
      domains: ['blocked.test'],
    });
    cleanups.push(uninstall);

    await expect(dns.promises.lookup('blocked.test')).rejects.toMatchObject({
      code: 'EHOSTUNREACH',
    });
    await expect(dns.promises.lookup('127.0.0.1')).resolves.toBeDefined();
    uninstall();
    cleanups.pop();
    expect(dns.promises.lookup).toBe(before);
  });

  it('callback 形态同样在解析前拒绝', async () => {
    const uninstall = installDnsEgressHook({
      mode: 'blocklist',
      domains: ['blocked.test'],
    });
    cleanups.push(uninstall);

    const err = await new Promise<Error>((resolve) => {
      dns.lookup('blocked.test', (error) => resolve(error as Error));
    });
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { code?: string }).code).toBe('EHOSTUNREACH');
  });
});

describe('C 装配层', () => {
  it('allowlist 档启动代理并写入三条代理 env，拆除后还原', async () => {
    const previous = {
      http: process.env[NETWORK_BOUNDARY_PROXY_ENV.http],
      https: process.env[NETWORK_BOUNDARY_PROXY_ENV.https],
      all: process.env[NETWORK_BOUNDARY_PROXY_ENV.all],
      no: process.env[NETWORK_BOUNDARY_PROXY_ENV.no],
    };
    const boundary = await installNetworkBoundary({
      mode: 'allowlist',
      domains: ['allowed.test'],
    });
    cleanups.push(() => boundary.uninstall());

    expect(boundary.proxyUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.http]).toBe(boundary.proxyUrl);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.https]).toBe(boundary.proxyUrl);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.all]).toBe(boundary.proxyUrl);

    await boundary.uninstall();
    cleanups.pop();
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.http]).toBe(previous.http);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.https]).toBe(previous.https);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.all]).toBe(previous.all);
    expect(process.env[NETWORK_BOUNDARY_PROXY_ENV.no]).toBe(previous.no);
  });

  it('open 档不启动代理', async () => {
    const boundary = await installNetworkBoundary({ mode: 'open' });
    expect(boundary.proxyUrl).toBeNull();
    await boundary.uninstall();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
