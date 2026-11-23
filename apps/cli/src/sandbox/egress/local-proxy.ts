// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-07 双引擎之二：常驻 TCP LocalProxy。
 *
 * 分工（对照 WorkBuddy 的 `network_policy` 双引擎）：
 *   - DNS hook 只按**域名**裁决，管住 `net.connect/getaddrinfo` 这一类解析入口；
 *   - 本文件只按**连接目标**裁决，管住已经拿到 host:port 的 TCP 连接；
 *   - 两者共用 `checkEgress` 这一个判据源，不各写一份名单匹配。
 *
 * 协议面：
 *   - `CONNECT host:port HTTP/1.1` → 隧道（HTTPS / 任意 TCP）；
 *   - `GET http://host/path HTTP/1.1` → 绝对 URI 的普通 HTTP 代理；
 *   - 其它形态直接 400，不猜目标。
 *
 * 边界：本层不启动子进程、不修改全局 env；env 接线在 `network-boundary.ts`。
 */

import net from 'node:net';
import type { NetworkEgressPolicy } from '@ihui/types';

import { checkEgress } from '../../subagents/egress-guard.js';

export interface LocalProxyOptions {
  readonly policy: NetworkEgressPolicy;
  /** 缺省 127.0.0.1：只给本机子进程用，不对外监听。 */
  readonly host?: string;
  /** 缺省 0：由系统分配空闲端口。 */
  readonly port?: number;
  readonly connectTimeoutMs?: number;
  readonly onDecision?: (decision: {
    target: string;
    allowed: boolean;
    reason: string;
  }) => void;
}

export interface LocalProxyHandle {
  readonly host: string;
  readonly port: number;
  /** `http://host:port`，可直接写进 HTTP_PROXY/HTTPS_PROXY。 */
  readonly url: string;
  close(): Promise<void>;
}

interface ParsedProxyRequest {
  readonly kind: 'connect' | 'http';
  readonly host: string;
  readonly port: number;
  readonly rewrittenHead: string;
}

function bracketHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function judgeTarget(host: string, policy: NetworkEgressPolicy) {
  return checkEgress(policy, `https://${bracketHost(host)}`);
}

function parseProxyHead(head: string): ParsedProxyRequest | null {
  const lines = head.split(/\r?\n/);
  const requestLine = lines[0] ?? '';
  const [method, target, version] = requestLine.split(' ');
  if (!method || !target || !version) return null;

  if (method.toUpperCase() === 'CONNECT') {
    const lastColon = target.lastIndexOf(':');
    if (lastColon <= 0) return null;
    const host = target.slice(0, lastColon);
    const port = Number(target.slice(lastColon + 1));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { kind: 'connect', host, port, rewrittenHead: head };
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname;
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const originForm = `${parsed.pathname || '/'}${parsed.search}`;
  const rewrittenHead = [requestLine.replace(target, originForm), ...lines.slice(1)].join('\r\n');
  return { kind: 'http', host, port, rewrittenHead };
}

function writeStatus(
  socket: net.Socket,
  statusLine: string,
  body: string,
): void {
  socket.end(
    `${statusLine}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
  );
}

/**
 * 起一个常驻 TCP 代理。返回的 `close()` 会先停接新连接，再销毁在建连接。
 */
export function startEgressLocalProxy(options: LocalProxyOptions): Promise<LocalProxyHandle> {
  const policy = options.policy;
  const host = options.host ?? '127.0.0.1';
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.once('error', () => socket.destroy());

    socket.once('data', (chunk) => {
      const text = chunk.toString('utf8');
      const headerEnd = text.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        writeStatus(socket, 'HTTP/1.1 400 Bad Request', 'proxy header incomplete');
        return;
      }
      const head = text.slice(0, headerEnd);
      const rest = text.slice(headerEnd + 4);
      const parsed = parseProxyHead(head);
      if (!parsed) {
        writeStatus(socket, 'HTTP/1.1 400 Bad Request', 'absolute URI or CONNECT required');
        return;
      }

      const verdict = judgeTarget(parsed.host, policy);
      options.onDecision?.({
        target: `${parsed.host}:${parsed.port}`,
        allowed: verdict.allowed,
        reason: verdict.reason,
      });
      if (!verdict.allowed) {
        writeStatus(socket, 'HTTP/1.1 403 Forbidden', `egress denied: ${verdict.reason}`);
        return;
      }

      const upstream = net.connect({ host: parsed.host, port: parsed.port });
      sockets.add(upstream);
      upstream.once('close', () => sockets.delete(upstream));
      // 连接超时只覆盖「建连」阶段;连接建立后必须清掉定时器,否则长连接会被 10s 砍断。
      const connectTimer = setTimeout(() => upstream.destroy(), connectTimeoutMs);
      upstream.once('connect', () => clearTimeout(connectTimer));
      upstream.once('error', (err) => {
        clearTimeout(connectTimer);
        if (!socket.destroyed) {
          writeStatus(socket, 'HTTP/1.1 502 Bad Gateway', `upstream error: ${err.message}`);
        }
      });
      upstream.once('connect', () => {
        if (parsed.kind === 'connect') {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          // 客户端可能与 CONNECT 头同包送来 TLS ClientHello,不能丢。
          if (rest) upstream.write(rest);
        } else {
          upstream.write(`${parsed.rewrittenHead}\r\n\r\n${rest}`);
        }
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
    });
  });

  return new Promise<LocalProxyHandle>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      server.removeListener('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('local proxy 未拿到监听端口'));
        return;
      }
      const port = address.port;
      resolve({
        host,
        port,
        url: `http://${host}:${port}`,
        close: () =>
          new Promise<void>((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
