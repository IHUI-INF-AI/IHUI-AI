// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 凭据续期单点:形状锁 + 成功路径成对用例(零真实网络)。
 *
 * 钉死四件事(2026-10-26 立票):
 *  ① 注册进 `@ihui/api-client` 的 provider **必须带 `refreshAccessToken`** ——
 *     包内 401 拦截器 `refreshAccessTokenOnce()` 第一行就是
 *     `if (!tokenProvider.refreshAccessToken) return null`,少这一枚就等于
 *     "长会话跑过 access token 的 15 分钟后全体 401 且结构上无法自愈"。
 *     这一条是端到端经**真实包出口**驱动的,不是读字符串:摘掉工厂里的注册即翻红。
 *  ② `getToken` 现读令牌管理器(不是进程启动时的快照)。
 *  ③ 三条自带 fetch 的腿:401 ⇒ 续期一次并重放一次成功(本文件),
 *     续期失败 ⇒ 只请求一次并给出可见错误(见 cli-auth-refresh-failure.test.ts)。
 *  ④ 六个注册点共用同一份工厂,站点不得再各写一份 provider 形状。
 *
 * 用例顺序是刻意的:包内 `refreshAccessTokenOnce` 有模块级失败冷却,成功档先跑完,
 * 失败档全在另一个文件里(vitest 按文件隔离模块实例)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToken, refreshAccessTokenOnce, setTokenProvider } from '@ihui/api-client';

import { getSettingsPath } from '../src/commands/settings.js';
import {
  createCliTokenProvider,
  fetchWithCliAuthRefresh,
  isUnauthorized,
  registerCliTokenProvider,
} from '../src/lib/auth-refresh.js';
import { createApiRequest } from '../src/commands/http-utils.js';
import { getCloudRunDegradeFacts, resetCloudRunDegradeFacts, startCloudRun } from '../src/cloud-run.js';

const APP_CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeJwt(expSeconds: number): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64url');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', exp: expSeconds })}.SIGNATURE`;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);
const expiredJwt = (): string => makeJwt(nowSec() - 60);
const freshJwt = (): string => makeJwt(nowSec() + 7200);

const API = 'http://127.0.0.1:9';

/** 按 URL 分派的 fetch 桩:记录每次调用(含当时带的 Authorization),返回可控响应。 */
interface Call {
  url: string;
  authorization?: string;
}

function stubFetch(handlers: Array<{ match: (url: string) => boolean; respond: (n: number) => Response }>): Call[] {
  const calls: Call[] = [];
  const hits: Record<string, number> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: u, authorization: headers.Authorization });
      for (const [i, h] of handlers.entries()) {
        if (h.match(u)) {
          const n = (hits[String(i)] ?? 0) + 1;
          hits[String(i)] = n;
          return h.respond(n);
        }
      }
      throw new Error(`stubFetch: 未登记的出站 URL ${u}`);
    }),
  );
  return calls;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refreshOk = (accessToken: string): Response =>
  json({
    code: 0,
    data: { accessToken, refreshToken: 'rt-rotated-material', expiresIn: 900, refreshExpiresIn: 100 },
  });

const isRefreshUrl = (u: string): boolean => u.endsWith('/api/auth/refresh');

describe('CLI 凭据续期单点', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  const writeSettings = (obj: Record<string, unknown>): void => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-auth-refresh-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.IHUI_API_KEY = '';
    process.env.IHUI_API_SECRET = '';
    process.env.IHUI_CREDENTIAL_KIND = '';
    resetCloudRunDegradeFacts();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setTokenProvider({ getToken: () => null });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  // ==================== ① provider 形状(经真实包出口驱动) ====================

  it('注册后包内 401 拦截器真的能续期:refreshAccessTokenOnce() 拿到新 token', async () => {
    const stale = expiredJwt();
    const next = freshJwt();
    writeSettings({ apiKey: stale, refreshToken: 'rt-first' });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });
    stubFetch([{ match: isRefreshUrl, respond: () => refreshOk(next) }]);

    // 这一条就是"摘掉新注册即翻红"的证据:工厂里删掉 refreshAccessToken ⇒
    // 包内第一行 return null ⇒ 这里拿到 null。
    await expect(refreshAccessTokenOnce()).resolves.toBe(next);
    // 续期后的新凭据必须立刻可从 provider 取到(否则每个后续请求还在用被拒的那枚)
    expect(getToken()).toBe(next);
  });

  it('形状锁:工厂产出的 provider 两枚方法齐备', () => {
    writeSettings({ apiKey: expiredJwt(), refreshToken: 'rt-shape' });
    const provider = createCliTokenProvider({ baseUrl: API, startupToken: undefined });
    expect(typeof provider.getToken).toBe('function');
    expect(typeof provider.refreshAccessToken).toBe('function');
  });

  // ==================== ② getToken 现读,不是启动快照 ====================

  it('getToken 现读令牌管理器:登记之后再登录/续期,取到的是当前凭据', () => {
    const staleAtStartup = expiredJwt();
    writeSettings({ apiKey: staleAtStartup, refreshToken: 'rt-live' });
    registerCliTokenProvider({ baseUrl: API, startupToken: staleAtStartup });
    expect(getToken()).toBe(staleAtStartup);

    // 另一次 `ihui login`(或续期落盘)把文件里的凭据换掉了 —— 快照式 getToken 会继续
    // 发旧的那枚,于是每一个请求都吃 401 且续期也救不回来。
    const loggedInLater = freshJwt();
    writeSettings({ apiKey: loggedInLater, refreshToken: 'rt-live' });
    expect(getToken()).toBe(loggedInLater);
  });

  it('覆盖源(--api-key 与文件不同值)⇒ 粘住快照,不拿文件里那枚换身份', async () => {
    const fileToken = expiredJwt();
    const flagToken = freshJwt();
    writeSettings({ apiKey: fileToken, refreshToken: 'rt-pin' });
    registerCliTokenProvider({ baseUrl: API, startupToken: flagToken });
    expect(getToken()).toBe(flagToken);

    // 覆盖源的凭据不归令牌管理器管:续期它等于拿文件里另一枚身份去顶,拒掉。
    stubFetch([{ match: isRefreshUrl, respond: () => refreshOk(freshJwt()) }]);
    await expect(refreshAccessTokenOnce()).resolves.toBeNull();
    expect(getToken()).toBe(flagToken);
  });

  it('机器凭据(ihui_ 前缀):原样出站、不参与续期(与 token-manager O12 同判据)', async () => {
    const machine = 'ihui_server_side_api_key_123';
    writeSettings({ apiKey: machine, credentialKind: 'api_key', refreshToken: 'rt-machine' });
    registerCliTokenProvider({ baseUrl: API, startupToken: machine });
    expect(getToken()).toBe(machine);
    stubFetch([{ match: isRefreshUrl, respond: () => refreshOk(freshJwt()) }]);
    await expect(refreshAccessTokenOnce()).resolves.toBeNull();
  });

  // ==================== ③ 成对用例之一:401 ⇒ 续期一次 + 重放一次成功 ====================

  it('http-utils 腿:401 ⇒ 续期一次、带新 token 重放一次、拿到数据', async () => {
    const stale = expiredJwt();
    const next = freshJwt();
    writeSettings({ apiKey: stale, refreshToken: 'rt-leg-ok' });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([
      { match: isRefreshUrl, respond: () => refreshOk(next) },
      {
        match: (u) => u.endsWith('/api/things'),
        respond: (n) => (n === 1 ? json({ code: 401, message: 'Authentication required' }, 401) : json({ code: 0, data: { ok: true } })),
      },
    ]);

    const apiRequest = createApiRequest('', 5000);
    const out = await apiRequest(API, '/api/things', { apiKey: stale });

    expect(out).toEqual({ code: 0, data: { ok: true } });
    const legCalls = calls.filter((c) => c.url.endsWith('/api/things'));
    expect(legCalls).toHaveLength(2);
    expect(legCalls[0].authorization).toBe(`Bearer ${stale}`);
    // 重放用的是续期回来的那一枚,不是调用方带来的旧值
    expect(legCalls[1].authorization).toBe(`Bearer ${next}`);
    expect(calls.filter((c) => isRefreshUrl(c.url))).toHaveLength(1);
  });

  it('cloud-run 腿:401 ⇒ 续期后重放成功 ⇒ 不留降级痕迹(不把失败读成没事)', async () => {
    const stale = expiredJwt();
    const next = freshJwt();
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
    writeSettings({ apiKey: stale, refreshToken: 'rt-cloud-ok' });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([
      { match: isRefreshUrl, respond: () => refreshOk(next) },
      {
        match: (u) => u.includes('/api/cloud-runs/run'),
        respond: (n) => (n === 1 ? json({ code: 401 }, 401) : json({ code: 0, data: {} })),
      },
    ]);

    const runId = await startCloudRun({ task: 't', apiKey: stale });
    expect(typeof runId).toBe('string');
    expect(getCloudRunDegradeFacts().start.failures).toBe(0);
    const legCalls = calls.filter((c) => c.url.includes('/api/cloud-runs/run'));
    expect(legCalls).toHaveLength(2);
    expect(legCalls[1].authorization).toBe(`Bearer ${next}`);
  });

  it('重放恰好一次:续期后仍被 401 ⇒ 不再续期、不再重放(绝不循环)', async () => {
    const stale = expiredJwt();
    writeSettings({ apiKey: stale, refreshToken: 'rt-loop' });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([
      { match: isRefreshUrl, respond: () => refreshOk(freshJwt()) },
      { match: (u) => u.endsWith('/api/things'), respond: () => json({ code: 401 }, 401) },
    ]);

    const apiRequest = createApiRequest('', 5000);
    await expect(apiRequest(API, '/api/things', { apiKey: stale })).rejects.toThrow();
    expect(calls.filter((c) => c.url.endsWith('/api/things'))).toHaveLength(2);
    expect(calls.filter((c) => isRefreshUrl(c.url))).toHaveLength(1);
  });

  it('非 401 一律不碰:403 不续期不重放,响应体留给调用方自己读', async () => {
    const calls = stubFetch([{ match: () => true, respond: () => json({ code: 1, message: 'forbidden' }, 403) }]);
    const resp = await fetchWithCliAuthRefresh(`${API}/api/things`, { method: 'GET' }, { accessToken: 'some.jwt' });
    expect(resp.status).toBe(403);
    expect(isUnauthorized(resp)).toBe(false);
    expect(calls).toHaveLength(1);
    await expect(resp.json()).resolves.toEqual({ code: 1, message: 'forbidden' });
  });

  it('无 token ⇒ 一个 Authorization 头都不加(不塞空 Bearer)', async () => {
    const calls = stubFetch([{ match: () => true, respond: () => json({ code: 0, data: 1 }) }]);
    await fetchWithCliAuthRefresh(`${API}/api/things`, {}, { accessToken: null });
    expect(calls[0].authorization).toBeUndefined();
  });

  // ==================== ④ 判据只有一份:六个注册点都走同一枚工厂 ====================

  it('登记面:六个注册点全部调用 registerCliTokenProvider,站点内零裸 setTokenProvider', () => {
    const sites = [
      'src/index.ts',
      'src/commands/agent.ts',
      'src/commands/chat-subcommands.ts',
      'src/acp/server.ts',
      'src/server/agent-core.ts',
      'src/tools/subagent.ts',
    ];
    for (const rel of sites) {
      const text = fs.readFileSync(path.join(APP_CLI_ROOT, rel), 'utf-8');
      expect(text, `${rel} 必须经单点工厂注册 provider`).toContain('registerCliTokenProvider(');
      expect(text, `${rel} 不得再各写一份 provider 形状`).not.toContain('setTokenProvider(');
    }
  });

  it('判据面:provider 的 refreshAccessToken 实现在整个 src 里只有一份', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf-8');
          if (/refreshAccessToken\s*\(\s*\)\s*:/.test(text)) hits.push(path.relative(APP_CLI_ROOT, full));
        }
      }
    };
    walk(path.join(APP_CLI_ROOT, 'src'));
    expect(hits).toEqual([path.join('src', 'lib', 'auth-refresh.ts')]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
