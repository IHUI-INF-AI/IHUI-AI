// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 其余出站 fetch 点接入共享 SSRF 守卫的**真链路**取证(2026-09-26)。
 *
 * 口径(与 `tests/ssrf-outbound.test.ts` 同一族,不得桩守卫凑绿):
 *  1. 先证可达 —— 探针是 127.0.0.1 上真起、真监听的 http server,裸请求命中计数 = 1;
 *  2. 再证接入后被拒 —— 同一目标走过接入点,**目标端口命中数 = 0**(不是"连上再丢响应");
 *  3. D-1 的"放"也要有牙 —— 声明了信任且 origin 逐字相等时,连接必须真的发生(计数 ≥ 1),
 *     否则"放行"这条分支根本没被执行过,绿灯只说明它没挡路。
 *
 * 本文件同时钉住 D-1 的反面:localhost 与 127.0.0.1 **不是同一个基准串**,
 * 声明端点不是回环、档位不在枚举内、缺 settingsKey ⇒ 一律仍拒。
 *
 * D-2(校验与连接之间 DNS 可被改 / TOCTOU)本轮按用户决定**不做**,各接入点已在
 * 文件注释里如实登记;本文件不冒充"已钉连接"。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  LOOPBACK_HOST_NAMES,
  SELF_HOSTABLE_LOOPBACK_CIDRS,
  SELF_HOSTED_TRUST_SOURCES,
  assertSafeFetchUrl,
  isLoopbackAddress,
  selfHostedLoopbackMatch,
  type SelfHostedTrust,
} from '@ihui/shared/utils/ssrf-guard';

// 记忆工具读 loadConfig();这里按 memory-owner.test.ts 的既有形态注入,
// 不是桩守卫 —— 守卫一律走真实实现。
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => (globalThis as { __cliConfig?: unknown }).__cliConfig ?? {}),
}));
// tools/index.js 会把全部工具拉进来并回指 memory.ts ⇒ 循环初始化会退化成"0 用例"的静默削 coverage。
vi.mock('../src/tools/index.js', () => ({ registerTools: vi.fn() }));

import { MEMORY_TOOLS } from '../src/tools/memory.js';
import { UnifiedMemoryClient } from '../src/memory/index.js';
import { connectMcpServer } from '../src/tools/mcp-runtime.js';
import { refreshAccessToken } from '../src/tools/mcp-oauth.js';

const b64u = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const fakeJwt = (claims: Record<string, unknown>) =>
  `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims)}.sig_`;

/** 一个真监听、真计数的探针。`hits` 是"目标端口被连上过几次"的唯一读数。 */
interface Probe {
  server: http.Server;
  port: number;
  url: string;
  hits: number;
  bodies: string[];
}

async function startProbe(handler?: http.RequestListener): Promise<Probe> {
  const probe = {} as Probe;
  const server = http.createServer((req, res) => {
    if (handler) {
      handler(req, res);
      return;
    }
    probe.hits += 1;
    probe.bodies.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: 0, message: 'ok', data: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  Object.assign(probe, { server, port, url: `http://127.0.0.1:${port}`, hits: 0, bodies: [] });
  return probe;
}

async function stopProbe(probe: Probe): Promise<void> {
  await new Promise<void>((resolve) => probe.server.close(() => resolve()));
}

function trustFor(url: string, source: SelfHostedTrust['source'] = 'user-settings'): SelfHostedTrust {
  return { source, settingsKey: 'settings.apiUrl', configuredEndpoint: url };
}

afterEach(() => {
  (globalThis as { __cliConfig?: unknown }).__cliConfig = {};
});

// ---------------------------------------------------------------------------
// A. 守卫层的 D-1 逐字比对:实链正反两向都有读数
// ---------------------------------------------------------------------------
describe('D-1 自家回环信任声明 · 真链路', () => {
  let probe: Probe;

  beforeEach(async () => {
    probe = await startProbe();
  });
  afterEach(async () => {
    await stopProbe(probe);
  });

  it('对照:裸 fetch 真能打通该端口(否则后面的"拦下"零信息量)', async () => {
    const res = await fetch(`${probe.url}/anything`);
    expect(res.status).toBe(200);
    expect(probe.hits).toBe(1);
  });

  it('对照:同一端口用 localhost 拼法也真能打通(证明后面的计数=0 不是寻址失败)', async () => {
    const res = await fetch(`http://localhost:${probe.port}/anything`);
    expect(res.status).toBe(200);
    expect(probe.hits).toBe(1);
  });

  it('默认档:回环一律拒,且拒到"连接根本没发生"(命中数 0)', async () => {
    const verdict = await assertSafeFetchUrl(`${probe.url}/x`);
    expect(verdict.safe).toBe(false);
    expect(verdict.code).toBe('direct-ip-denied');
    expect(verdict.trustedSelfHosted).toBeUndefined();
    // 只有裁决放行才发连接 —— 计数为 0 即"没连"而不是"连上后丢掉"
    if (verdict.safe) await fetch(`${probe.url}/x`);
    expect(probe.hits).toBe(0);
  });

  it('放行有牙:origin 与声明逐字相等 ⇒ 真发出连接(命中数 ≥1)且裁决带 trustSource', async () => {
    const verdict = await assertSafeFetchUrl(`${probe.url}/api/memory`, {
      selfHosted: trustFor(probe.url),
    });
    expect(verdict.safe).toBe(true);
    expect(verdict.trustedSelfHosted).toBe(true);
    expect(verdict.trustSource).toBe('user-settings');
    if (verdict.safe) {
      const res = await fetch(`${probe.url}/api/memory`);
      expect(res.status).toBe(200);
      expect(probe.hits).toBe(1);
    }
  });

  it('逐字比对生效:`http://localhost:P` 的请求配不上 `http://127.0.0.1:P` 的声明 ⇒ 仍拒且端口零命中', async () => {
    const requestUrl = `http://localhost:${probe.port}/x`;
    const verdict = await assertSafeFetchUrl(requestUrl, {
      selfHosted: trustFor(probe.url), // 声明的是 127.0.0.1 拼法
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.code).toBe('host-denied');
    expect(verdict.selfHostedDenied).toContain('origin');
    expect(probe.hits).toBe(0);
  });

  it('逐字比对生效:同 host 不同端口即不同源 ⇒ 仍拒(不给"就近放行")', async () => {
    const other = probe.port + 1;
    const verdict = await assertSafeFetchUrl(`http://127.0.0.1:${other}/x`, {
      selfHosted: trustFor(probe.url),
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.selfHostedDenied).toContain('≠');
  });

  it('信任只对回环生效:声明 192.168/169.254/10 段一律不放,并且档位/键名缺失也不放', () => {
    const nonLoopback = [
      'http://192.168.1.7:8803',
      'http://169.254.169.254',
      'http://10.0.0.5:8803',
      'http://100.64.0.1:8803',
    ];
    for (const endpoint of nonLoopback) {
      const m = selfHostedLoopbackMatch(endpoint, trustFor(endpoint));
      expect(m.matched, `声明端点 ${endpoint} 不该被认作自家`).toBe(false);
      expect(m.reason).toContain('不是回环地址');
    }
    // 缺出处 / 缺基准 / 档位不在枚举内 ⇒ 三条都算"没声明过"
    expect(
      selfHostedLoopbackMatch('http://127.0.0.1:8803', {
        source: 'user-settings',
        settingsKey: '  ',
        configuredEndpoint: 'http://127.0.0.1:8803',
      }).matched,
    ).toBe(false);
    expect(
      selfHostedLoopbackMatch('http://127.0.0.1:8803', {
        source: 'user-settings' as SelfHostedTrust['source'],
        settingsKey: 'apiUrl',
        configuredEndpoint: '',
      }).matched,
    ).toBe(false);
    expect(
      selfHostedLoopbackMatch('http://127.0.0.1:8803', {
        source: 'model-arg' as SelfHostedTrust['source'],
        settingsKey: 'url',
        configuredEndpoint: 'http://127.0.0.1:8803',
      }).matched,
    ).toBe(false);
    expect(selfHostedLoopbackMatch('http://127.0.0.1:8803', undefined).matched).toBe(false);
  });

  it('名单不是死表:回环网段 / 回环主机名 / 信任档位逐条被当输入用过', () => {
    expect(SELF_HOSTABLE_LOOPBACK_CIDRS.length).toBeGreaterThan(0);
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('127.255.255.254')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('128.0.0.1')).toBe(false);
    expect(isLoopbackAddress('192.168.0.1')).toBe(false);
    for (const cidr of SELF_HOSTABLE_LOOPBACK_CIDRS) {
      const base = cidr.split('/')[0] as string;
      expect(isLoopbackAddress(base), `CIDR ${cidr} 的基址必须是自家`).toBe(true);
    }
    expect(LOOPBACK_HOST_NAMES.length).toBeGreaterThan(0);
    expect(SELF_HOSTED_TRUST_SOURCES).toEqual(['user-settings', 'user-env', 'code-default']);
    for (const source of SELF_HOSTED_TRUST_SOURCES) {
      const m = selfHostedLoopbackMatch('http://127.0.0.1:8803/x', {
        source,
        settingsKey: 'k',
        configuredEndpoint: 'http://127.0.0.1:8803',
      });
      expect(m.matched, `档位 ${source} 必须真被判据认得`).toBe(true);
    }
  });

  it('错误文本不外泄响应体(守门 67 同族)', async () => {
    const verdict = await assertSafeFetchUrl(`${probe.url}/secret`);
    const rejection = verdict.safe ? '' : `${verdict.code} ${verdict.reason ?? ''} ${verdict.selfHostedDenied ?? ''}`;
    expect(rejection).not.toContain('code":0');
    expect(rejection).not.toContain('ok');
    expect(probe.hits).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B1. tools/memory.ts 的两处出站(memoryGet / memorySend)
// ---------------------------------------------------------------------------
describe('tools/memory.ts 接入', () => {
  const saved = { key: process.env.IHUI_API_KEY, kind: process.env.IHUI_CREDENTIAL_KIND };
  let probe: Probe;

  beforeEach(async () => {
    probe = await startProbe();
    delete process.env.IHUI_API_KEY;
    delete process.env.IHUI_CREDENTIAL_KIND;
    process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-ssrf-surface.json');
  });
  afterEach(async () => {
    await stopProbe(probe);
    if (saved.key === undefined) delete process.env.IHUI_API_KEY;
    else process.env.IHUI_API_KEY = saved.key;
    if (saved.kind === undefined) delete process.env.IHUI_CREDENTIAL_KIND;
    else process.env.IHUI_CREDENTIAL_KIND = saved.kind;
  });

  it('settings.apiUrl 就是探针 origin ⇒ 真发出请求并解析响应(D-1 的"放"没被打断)', async () => {
    (globalThis as { __cliConfig?: unknown }).__cliConfig = {
      apiUrl: probe.url,
      apiKey: fakeJwt({ sub: 'owner-1', exp: 9_999_999_999 }),
      credentialKind: 'jwt',
    };
    const recall = MEMORY_TOOLS.find((t) => t.name === 'memory_recall');
    const res = await recall!.execute({ query: 'x' }, { workspacePath: process.cwd() } as never);
    expect(res.success).toBe(true);
    expect(probe.hits).toBe(1);
    expect(res.error ?? '').not.toContain('SSRF');
  });

  it('apiUrl 缺失时落到 code-default 档:基准是 localhost:8803,打不到探针 ⇒ 端口零命中', async () => {
    (globalThis as { __cliConfig?: unknown }).__cliConfig = {
      apiKey: fakeJwt({ sub: 'owner-1', exp: 9_999_999_999 }),
      credentialKind: 'jwt',
    };
    const recall = MEMORY_TOOLS.find((t) => t.name === 'memory_recall');
    const res = await recall!.execute({ query: 'x' }, { workspacePath: process.cwd() } as never);
    // 未配置 ⇒ 走内置默认端点(本机没跑 ai-service 时是网络错/拒),关键是**没连上探针**
    expect(res.success).toBe(false);
    expect(probe.hits).toBe(0);
    expect(probe.bodies).toEqual([]);
  });

  it('POST 通道(memory_save)同样先过守卫:非声明回环 ⇒ 零命中', async () => {
    (globalThis as { __cliConfig?: unknown }).__cliConfig = {
      apiUrl: 'http://127.0.0.1:1', // 声明的基准与探针不同源 ⇒ 即使目标是回环也拒
      apiKey: fakeJwt({ sub: 'owner-1', exp: 9_999_999_999 }),
      credentialKind: 'jwt',
    };
    const save = MEMORY_TOOLS.find((t) => t.name === 'memory_save');
    const res = await save!.execute(
      { content: 'c', layer: 'semantic' },
      { workspacePath: process.cwd() } as never,
    );
    expect(res.success).toBe(false);
    expect(probe.hits).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B2. memory/index.ts 的 UnifiedMemoryClient(两处出站)
// ---------------------------------------------------------------------------
describe('UnifiedMemoryClient 接入', () => {
  let probe: Probe;

  beforeEach(async () => {
    probe = await startProbe();
  });
  afterEach(async () => {
    await stopProbe(probe);
  });

  it('对照:同一 base 裸 fetch 真能打通(下面的 0 才有意义)', async () => {
    const res = await fetch(`${probe.url}/api/memory`);
    expect(res.status).toBe(200);
    expect(probe.hits).toBe(1);
  });

  it('不声明信任 ⇒ 拒绝且目标端口零命中(此前是无条件直连)', async () => {
    const client = new UnifiedMemoryClient(probe.url);
    const entries = await client.getEntries('u-1', 'session');
    expect(entries).toEqual([]);
    expect(probe.hits).toBe(0);
    const added = await client.addEntry('u-1', {
      scope: 'session',
      type: 'fact',
      text: 'x',
      source: 'test',
    } as never);
    expect(added).toBeNull();
    expect(probe.hits).toBe(0);
  });

  it('调用方交出配置基准 ⇒ 真发出连接并解析出条目', async () => {
    const client = new UnifiedMemoryClient(probe.url, trustFor(probe.url));
    const entries = await client.getEntries('u-1', 'session');
    expect(entries).toEqual([]);
    expect(probe.hits).toBe(1);
    expect(probe.bodies[0]).toContain('/api/memory');
  });
});

// ---------------------------------------------------------------------------
// B3. mcp-runtime.ts:SSE 推送来的 endpoint 是最硬的一格
// ---------------------------------------------------------------------------
describe('mcp-runtime 接入 · SSE endpoint 由远端指定', () => {
  const probes: Probe[] = [];
  const openStreams = new Set<http.ServerResponse>();
  const track = (p: Probe): Probe => {
    probes.push(p);
    return p;
  };

  afterEach(async () => {
    for (const res of openStreams) res.end();
    openStreams.clear();
    while (probes.length > 0) await stopProbe(probes.pop() as Probe);
  });

  it('对照:元数据靶端口裸 fetch 真能打通(否则"零命中"是假信号)', async () => {
    const target = track(await startProbe());
    const res = await fetch(`${target.url}/latest/meta-data`);
    expect(res.status).toBe(200);
    expect(target.hits).toBe(1);
  });

  it('server 推一条指向回环的 endpoint ⇒ 该 POST 必被拒,靶端口命中数 0', async () => {
    const metadata = track(await startProbe());
    const mcp = track(
      await startProbe((req, res) => {
        if (req.url?.startsWith('/sse')) {
          res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          });
          openStreams.add(res);
          // 服务端自行指定 POST 目标:这条 URL 不是用户配置的值 ⇒ 不得带任何信任
          res.write(`event: endpoint\ndata: ${metadata.url}/metadata\n\n`);
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end('{}');
      }),
    );
    await expect(
      connectMcpServer({ name: 'evil-sse', transport: 'sse', url: `${mcp.url}/sse` }),
    ).rejects.toThrow(/SSRF 拒绝/);
    // 首跳(配置里的 server.url)允许连上,推来的 endpoint 一次都没连上
    expect(metadata.hits).toBe(0);
    expect(metadata.bodies).toEqual([]);
  });

  it('http transport:配置里逐字相等的回环端点允许出站(自家 MCP server 不被打断)', async () => {
    const mcp = track(
      await startProbe((req, res) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
        req.on('end', () => {
          mcp.hits += 1;
          const id = (JSON.parse(raw || '{}') as { id?: number }).id ?? 1;
          const payload = id === 1 ? { protocolVersion: '2024-11-05', capabilities: {} } : { tools: [] };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: payload }));
        });
      }),
    );
    const conn = await connectMcpServer({ name: 'local-http', transport: 'http', url: mcp.url });
    expect(conn.connected).toBe(true);
    expect(mcp.hits).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// B4. mcp-oauth.ts 的 token endpoint 出站(带 client_secret / refresh_token)
// ---------------------------------------------------------------------------
describe('mcp-oauth token endpoint 接入', () => {
  let probe: Probe;

  const tokenBody = (req: http.IncomingMessage, cb: (raw: string) => void): void => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
    req.on('end', () => cb(raw));
  };

  beforeEach(async () => {
    probe = await startProbe((req, res) => {
      tokenBody(req, () => {
        probe.hits += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'AT', expires_in: 3600 }));
      });
    });
  });
  afterEach(async () => {
    await stopProbe(probe);
  });

  it('对照:token endpoint 裸 POST 真能打通', async () => {
    const res = await fetch(probe.url, { method: 'POST', body: 'grant_type=x' });
    expect(res.status).toBe(200);
    expect(probe.hits).toBe(1);
  });

  it('不声明信任 ⇒ 拒,端口零命中(此前配置写什么就连什么)', async () => {
    await expect(
      refreshAccessToken(
        {
          authorizationEndpoint: `${probe.url}/authorize`,
          tokenEndpoint: `${probe.url}/token`,
          clientId: 'c',
          redirectUri: 'http://localhost:1/callback',
          scope: ['mcp'],
          serverUrl: probe.url,
        },
        'rt-value',
      ),
    ).rejects.toThrow(/SSRF 拒绝/);
    expect(probe.hits).toBe(0);
  });

  it('调用方按 D-1 交出配置基准 ⇒ 真发出 token 请求', async () => {
    const result = await refreshAccessToken(
      {
        authorizationEndpoint: `${probe.url}/authorize`,
        tokenEndpoint: `${probe.url}/token`,
        clientId: 'c',
        redirectUri: 'http://localhost:1/callback',
        scope: ['mcp'],
        serverUrl: probe.url,
        tokenEndpointTrust: trustFor(`${probe.url}/token`, 'user-settings'),
      },
      'rt-value',
    );
    expect(result.accessToken).toBe('AT');
    expect(probe.hits).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// C. 装车对账:判据必须在真正会跑的那条分支上,且不得被注释冒充
// ---------------------------------------------------------------------------
describe('接入存续性(摘线即红)', () => {
  const CLI_SRC = path.resolve(__dirname, '../src');
  const WIRED = [
    'tools/memory.ts',
    'memory/index.ts',
    'tools/mcp-runtime.ts',
    'tools/mcp-oauth.ts',
    'tools/web-search.ts',
    'tools/github-pr.ts',
    'tools/fetch-url.ts',
  ];

  it.each(WIRED)('%s 里 assertSafeFetchUrl 既被 import 也被调用,且调用先于 fetch', (rel) => {
    const text = fs.readFileSync(path.join(CLI_SRC, rel), 'utf8');
    const codeLines = text
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    const code = codeLines.join('\n');
    expect(code, `${rel} 未 import 共享守卫`).toContain('assertSafeFetchUrl');
    const fetchIdx = code.search(/await fetch\(|[^t]fetch\(/);
    const guardIdx = code.search(/assertSafeFetchUrl\s*\(/);
    expect(guardIdx, `${rel} 没有真调用守卫`).toBeGreaterThanOrEqual(0);
    expect(fetchIdx, `${rel} 里找不到出站 fetch`).toBeGreaterThanOrEqual(0);
    expect(guardIdx, `${rel} 的裁决没有排在出站之前`).toBeLessThan(fetchIdx);
  });

  it('D-1 的每个信任声明点都带得出处的行内标注(不得让"声明"变成无出处的自证)', () => {
    const files = WIRED.map(
      (rel) => [rel, fs.readFileSync(path.join(CLI_SRC, rel), 'utf8')] as const,
    );
    const withTrust = files.filter(([rel, text]) => {
      void rel;
      // 只看代码面:注释里出现的 selfHosted 只是文档示例,不算声明点
      const code = text
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n');
      return /selfHosted:|tokenEndpointTrust/.test(code) || /selfHosted:|tokenEndpointTrust/.test(
        text,
      );
    });
    expect(withTrust.length).toBeGreaterThanOrEqual(4);
    for (const [rel, text] of withTrust) {
      expect(text, `${rel} 有信任声明却没有 ssrf-trust-source 出处标注`).toContain(
        'ssrf-trust-source:',
      );
      // 标注必须真说出"值从哪来"(配置键名 / 代码常量名),不得写成一句空话
      const marker = text.split('ssrf-trust-source:')[1] ?? '';
      expect(marker.slice(0, 120)).toMatch(
        /(settings\.apiUrl|mcpServers\[\]|apiUrl|DEFAULT_AI_SERVICE_BASE)/,
      );
    }
  });

  it('web_search / gh API 两处 host 是代码常量 ⇒ 刻意不带信任声明(带了就是给错配置留后门)', async () => {
    const ws = fs.readFileSync(path.join(CLI_SRC, 'tools/web-search.ts'), 'utf8');
    const gh = fs.readFileSync(path.join(CLI_SRC, 'tools/github-pr.ts'), 'utf8');
    expect(ws).not.toContain('selfHosted:');
    expect(gh).not.toContain('selfHosted:');
    // 站点自己那个常量 URL 真被裁决过:放行只能因为"公网可解析",绝不许走信任档;
    // 本机无网络时判据是 dns-failed(fail-closed),两种都算"守卫真跑过",
    // 但**任何** trustedSelfHosted 都是错的 —— 那两处没有资格声明自家端点。
    for (const url of [
      'https://html.duckduckgo.com/html/?q=ihui',
      'https://api.github.com/repos/owner/repo/pulls',
    ]) {
      const verdict = await assertSafeFetchUrl(url);
      expect(verdict.trustedSelfHosted).toBeUndefined();
      expect(verdict.trustSource).toBeUndefined();
      expect(
        verdict.safe === true || verdict.code === 'dns-failed',
        `${url} 的裁决既不是公网放行也不是 fail-closed:${JSON.stringify(verdict.code)}`,
      ).toBe(true);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
