// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地出口 relay(goal-b49 Z3 腿①的服务器本体)—— 对侧 WorkBuddy LocalProxy 的连接级判定,
 * 在本仓以"随宿主 CLI 同生同死的脱离式子进程"形态复现(承载/死亡机制在 `./proxy-relay-host.ts`,
 * 不新起常驻 daemon、不动 nssm/计划任务)。
 *
 * 分工纪律(§0.6,一层只做一件事):
 *  - 裁决**零复算**:每条连接的目标一律走 `adjudicateDomain`(policy 规则表 + 内网网段 + 地址证据,
 *    与派生点同一把尺);本文件只做"读请求头 → 解析目标 → 问尺 → 拨号或销毁"。
 *  - relay 是**执法面**:decision 非 allow(deny 与 unjudged 同向)⇒ 在 dial 之前就 destroy 客户端
 *    socket ⇒ 对被拒目的地**一个字节都不发出**(用例用真本地 socket 断言这一副作用未发生 +
 *    正向对照字节往返)。advisory/enforce 档位旋钮管的是派生点拦不拦进程;机主显式开了
 *    `IHUI_EGRESS_PROXY_URL=auto` 就是点名的执法代理,这里不再二次降档。
 *  - 地址证据:relay 是异步面,可以直接 `await` 注入的 `AsyncHostLookup`(默认真 `node:dns`),
 *    拿到结果后以 `() => addresses` 喂回 `adjudicateDomain` —— 解析器语义与同步面适配器同构。
 *  - 留痕:每条裁决 import `audit-ledger` 落同一本台账;台账写失败不断连接(观测件不挡干活的腿)。
 *
 * 可测面:`lookup` / `dial` 都是注入缝;用例全走 127.0.0.1 本地 socket,零真联网。
 */

import { connect, createServer, type Server, type Socket } from 'node:net';

import { appendEgressAuditRows, toAuditRow } from './audit-ledger.js';
import { adjudicateDomain } from './dns-adjudicator.js';
import { nodeDnsLookup, type AsyncHostLookup } from './dns-resolver-adapter.js';
import { normalizeEgressHost, type EgressJudgement, type EgressPolicy } from './policy.js';

const HEAD_CAP_BYTES = 16_384;
const FORWARD_METHODS = new Set(['GET', 'POST', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'PATCH']);

/** 拨号注入缝:测试指回本地夹具服务器;默认走真 net.connect(relay 面才用得到)。 */
type Dial = (host: string, port: number) => Socket;
const defaultDial: Dial = (host, port) => connect({ host, port });

export interface RelayRequestHead {
  readonly kind: 'connect' | 'forward';
  /** 裁决用主机名(normalizeEgressHost 产物,无端口/无 userinfo/无 path)。 */
  readonly host: string;
  /** 拨号用形态(保留 IPv6 方括号,normalize 会把括号剥掉导致 connect 失败)。 */
  readonly dialHost: string;
  readonly port: number;
  readonly method: string;
  readonly path: string;
}

/** 请求首行 → 目标(CONNECT authority 与 absolute-form URI);认不出 ⇒ null(relay 直接拒)。 */
export function parseRequestHead(head: string): RelayRequestHead | null {
  const firstLine = head.split('\r\n')[0] ?? '';
  const parts = firstLine.split(' ');
  if (parts.length !== 3) return null;
  const [method, target, version] = parts as [string, string, string];
  if (!version.startsWith('HTTP/1')) return null;
  const upper = method.toUpperCase();
  const isConnect = upper === 'CONNECT';
  if (!isConnect && !FORWARD_METHODS.has(upper)) return null;
  let hostPart = target;
  let port = isConnect ? 443 : 80;
  let path = '/';
  if (target.includes('://')) {
    try {
      const u = new URL(target);
      hostPart = u.hostname; // 拨号形态不含端口(u.host 会带 :port 导致 connect 失败)
      if (u.port !== '') port = Number(u.port);
      path = `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  } else if (isConnect) {
    const cut = target.lastIndexOf(':');
    if (cut > 0) {
      const tail = target.slice(cut + 1);
      if (!/^\d{1,5}$/.test(tail)) return null;
      hostPart = target.slice(0, cut);
      port = Number(tail);
    } // 无端口 CONNECT:按 443 起算(上面默认值),不猜别的
  }
  if (port <= 0 || port > 65_535) return null;
  const host = normalizeEgressHost(hostPart);
  if (host === '') return null;
  return { kind: isConnect ? 'connect' : 'forward', host, dialHost: hostPart, port, method: upper, path };
}

/** 名字裁决先行;策略要求地址证据时才向(注入的)异步解析器要地址,结果喂回同一把尺。 */
async function judgeRelayTarget(
  host: string,
  policy: EgressPolicy,
  lookup: AsyncHostLookup,
): Promise<EgressJudgement> {
  if (policy.addressProof !== true) return adjudicateDomain(host, { policy, resolver: null });
  const addresses = await lookup(host).catch(() => null);
  return adjudicateDomain(host, { policy, resolver: () => addresses });
}

export interface EgressRelayOptions {
  readonly policy: EgressPolicy;
  /** 台账定根起点(与派生面同一 `startDir` 语义,§15)。 */
  readonly startDir: string;
  readonly lookup?: AsyncHostLookup;
  readonly dial?: Dial;
  readonly port?: number;
  readonly bindHost?: string;
}

interface RelayActivity {
  readonly connections: number;
  readonly lastActivityMs: number;
}

export interface RunningRelay {
  readonly port: number;
  readonly url: string;
  activity(): RelayActivity;
  close(): Promise<void>;
}

export async function startEgressRelay(opts: EgressRelayOptions): Promise<RunningRelay> {
  const lookup = opts.lookup ?? nodeDnsLookup;
  const dial = opts.dial ?? defaultDial;
  let connections = 0;
  let lastActivityMs = Date.now();
  const sockets = new Set<Socket>();

  const server: Server = createServer((socket) => {
    connections += 1;
    lastActivityMs = Date.now();
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    void handleConnection(socket, { policy: opts.policy, startDir: opts.startDir, lookup, dial, touch: () => (lastActivityMs = Date.now()) });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, opts.bindHost ?? '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    activity: () => ({ connections, lastActivityMs }),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

interface HandleCtx {
  readonly policy: EgressPolicy;
  readonly startDir: string;
  readonly lookup: AsyncHostLookup;
  readonly dial: Dial;
  touch(): void;
}

function findHeaderEnd(buf: Buffer): number {
  for (let i = 3; i < buf.length; i += 1) {
    if (buf[i] === 0x0a && buf[i - 1] === 0x0d && buf[i - 2] === 0x0a && buf[i - 3] === 0x0d) return i - 3;
  }
  return -1;
}

/** 逐字节读头 → 裁决 → 放行才拨号;被拒路径不写客户端一个字节、更不触目的地。 */
async function handleConnection(socket: Socket, ctx: HandleCtx): Promise<void> {
  socket.on('error', () => undefined);
  let buffer = Buffer.alloc(0);
  let decided = false;
  socket.on('data', (chunk: Buffer) => {
    if (decided) return;
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > HEAD_CAP_BYTES) {
      decided = true;
      socket.destroy(); // 请求头超上限仍读不出 = relay 面拒绝
      return;
    }
    const end = findHeaderEnd(buffer);
    if (end === -1) return;
    decided = true;
    const head = buffer.subarray(0, end + 4).toString('latin1');
    const rest = buffer.subarray(end + 4);
    buffer = Buffer.alloc(0);
    socket.pause(); // 裁决(await)期间冻结客户端字节,放行后由 pipe 续流
    void decideAndDial(head, rest);
  });
  const decideAndDial = async (head: string, rest: Buffer): Promise<void> => {
    const req = parseRequestHead(head);
    if (req === null) {
      socket.destroy(); // 读不出目的地 = 判不了 = 拒绝(§0.3 折向更严一侧)
      return;
    }
    const judgement = await judgeRelayTarget(req.host, ctx.policy, ctx.lookup);
    ctx.touch();
    appendEgressAuditRows(
      [toAuditRow(judgement, () => new Date(), process.pid, judgement.decision !== 'allow')],
      { startDir: ctx.startDir },
    );
    if (judgement.decision !== 'allow') {
      socket.destroy();
      return;
    }
    const upstream = ctx.dial(req.dialHost, req.port);
    upstream.on('error', () => {
      socket.destroy();
      upstream.destroy();
    });
    upstream.once('connect', () => {
      ctx.touch();
      if (req.kind === 'connect') {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      } else {
        const first = head.split('\r\n')[0] ?? '';
        upstream.write(head.replace(first, `${req.method} ${req.path} HTTP/1.1`));
      }
      if (rest.length > 0) upstream.write(rest);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
  };
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
