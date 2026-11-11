// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 凭据续期:失败档(零真实网络)。与 cli-auth-refresh.test.ts 成对 ——
 * 成功档钉"401 能自愈",本文件钉"自愈不成时必须**看得见**":
 *  ① 续期失败 ⇒ 腿只请求一次(不拿被拒的旧凭据重放),并且抛出明确错误,
 *     绝不返回空数据把失败读成成功;
 *  ② 无 refresh 凭据 ⇒ 连一次续期请求都不发,直接给可见错误;
 *  ③ cloud-run 的降级契约不变:失败仍留痕、分档 auth、不谎报成功;
 *  ④ 红线:refresh token 原值不得进错误文案 / 降级喊话(凭据泄露门同一型)。
 *
 * 单独成文件的理由:`@ihui/api-client` 的 `refreshAccessTokenOnce` 带模块级失败冷却与
 * 在途单飞,成功档与失败档混在一个文件里会互相污染(文件之间 vitest 各自隔离模块实例)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getSettingsPath } from '../src/commands/settings.js';
import {
  fetchWithCliAuthRefresh,
  isUnauthorized,
  registerCliTokenProvider,
  unauthorizedMessage,
} from '../src/lib/auth-refresh.js';
import { createApiRequest } from '../src/commands/http-utils.js';
import { getCloudRunDegradeFacts, resetCloudRunDegradeFacts, startCloudRun } from '../src/cloud-run.js';

/**
 * 假凭据材料的取法:**每条用例一枚**。`tokenRefreshLedger` 的键是
 * (apiUrl + refreshToken) 的哈希,同一份 refreshToken 的失败答案会在 30s 窗口内被
 * 迟到者复用(这是被测行为本身)—— 多条用例共用一枚,后面那条读到的就是前面那条的
 * 归因,测的就不再是它自己那件事了。
 * 任一形态出现在错误文案 / 降级喊话里 = 凭据泄露(凭据泄露门同一型)。
 */
const secretMaterial = (tag: string): string => `rt-SECRET-${tag}-do-not-log-0123456789`;

function makeJwt(expSeconds: number): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64url');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', exp: expSeconds })}.SIGNATURE`;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);
const expiredJwt = (): string => makeJwt(nowSec() - 60);
const API = 'http://127.0.0.1:9';
const isRefreshUrl = (u: string): boolean => u.endsWith('/api/auth/refresh');

interface Call {
  url: string;
}

function stubFetch(handlers: Array<{ match: (url: string) => boolean; respond: (n: number) => Response }>): Call[] {
  const calls: Call[] = [];
  const hits: Record<string, number> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const u = String(url);
      calls.push({ url: u });
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

const always401 = (): Response => json({ code: 401, message: 'Authentication required' }, 401);

describe('CLI 凭据续期:失败档', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let warn: ReturnType<typeof vi.spyOn>;

  const writeSettings = (obj: Record<string, unknown>): void => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-auth-fail-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.IHUI_API_KEY = '';
    process.env.IHUI_API_SECRET = '';
    process.env.IHUI_CREDENTIAL_KIND = '';
    resetCloudRunDegradeFacts();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('① 续期被服务端拒绝 ⇒ 腿只请求一次,并抛出"该重登"的可见错误', async () => {
    const stale = expiredJwt();
    const secret = secretMaterial('rejected');
    writeSettings({ apiKey: stale, refreshToken: secret });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([
      { match: isRefreshUrl, respond: () => always401() },
      { match: (u) => u.endsWith('/api/things'), respond: () => always401() },
    ]);

    const apiRequest = createApiRequest('', 5000);
    const err = (await apiRequest(API, '/api/things', { apiKey: stale }).catch((e: unknown) => e)) as Error & {
      status?: number;
    };
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    // 可见错误来自既有文案出口(token-manager 按原因码分档),不是空数据、不是 undefined
    expect(err.message).toContain('ihui login');
    // 旧凭据刚被拒过 ⇒ 不许再拿它重放一次
    expect(calls.filter((c) => c.url.endsWith('/api/things'))).toHaveLength(1);
    expect(calls.filter((c) => isRefreshUrl(c.url))).toHaveLength(1);
    expect(err.message).not.toContain(secret);
  });

  it('② 无 refresh 凭据 ⇒ 一次续期请求都不发,直接给可见错误(不静默、不空数据)', async () => {
    const stale = expiredJwt();
    writeSettings({ apiKey: stale });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([{ match: (u) => u.endsWith('/api/things'), respond: () => always401() }]);
    const apiRequest = createApiRequest('', 5000);
    const err = (await apiRequest(API, '/api/things', { apiKey: stale }).catch((e: unknown) => e)) as Error;
    expect(err.message).toContain('ihui login');
    expect(calls.filter((c) => isRefreshUrl(c.url))).toHaveLength(0);
    expect(calls.filter((c) => c.url.endsWith('/api/things'))).toHaveLength(1);
  });

  it('②b 续期网络失败 ⇒ 归因是"稍后重试",不是误导人去重新登录', async () => {
    const stale = expiredJwt();
    const secret = secretMaterial('network');
    writeSettings({ apiKey: stale, refreshToken: secret });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });
    stubFetch([
      // 连不上(抛错)⇒ 台账原因码 network
      { match: isRefreshUrl, respond: () => { throw new TypeError('fetch failed'); } },
      { match: (u) => u.endsWith('/api/things'), respond: () => always401() },
    ]);

    const apiRequest = createApiRequest('', 5000);
    const err = (await apiRequest(API, '/api/things', { apiKey: stale }).catch((e: unknown) => e)) as Error;
    expect(err.message).toContain('稍后重试');
    expect(err.message).not.toContain('ihui login');
    expect(err.message).not.toContain(secret);
  });

  it('③ cloud-run:续期没成 ⇒ 返回 null + 留痕分档 auth(不把失败读成成功)', async () => {
    const stale = expiredJwt();
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
    const secret = secretMaterial('cloud');
    writeSettings({ apiKey: stale, refreshToken: secret });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });

    const calls = stubFetch([
      { match: isRefreshUrl, respond: () => always401() },
      { match: (u) => u.includes('/api/cloud-runs/run'), respond: () => always401() },
    ]);

    expect(await startCloudRun({ task: 't', apiKey: stale })).toBeNull();
    const facts = getCloudRunDegradeFacts();
    expect(facts.start.failures).toBe(1);
    expect(facts.start.lastFailure?.code).toBe('auth');
    expect(calls.filter((c) => c.url.includes('/api/cloud-runs/run'))).toHaveLength(1);
    // 喊话是 ASCII 诊断文本(本文件既有设计),且不含凭据材料
    const shouted = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(shouted).toContain('auth');
    expect(shouted).not.toContain(secret);
  });

  it('④ fetchWithCliAuthRefresh 失败时交回**原 401 响应**,响应体没被消费掉', async () => {
    const stale = expiredJwt();
    writeSettings({ apiKey: stale });
    registerCliTokenProvider({ baseUrl: API, startupToken: stale });
    stubFetch([{ match: () => true, respond: () => always401() }]);

    const resp = await fetchWithCliAuthRefresh(`${API}/api/things`, {}, { accessToken: stale });
    expect(isUnauthorized(resp)).toBe(true);
    await expect(resp.json()).resolves.toEqual({ code: 401, message: 'Authentication required' });
  });

  it('④b 文案出口只出既有那一句,不含凭据材料', () => {
    const secret = secretMaterial('hint');
    writeSettings({ apiKey: expiredJwt(), refreshToken: secret });
    registerCliTokenProvider({ baseUrl: API, startupToken: expiredJwt() });
    const msg = unauthorizedMessage(API);
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toContain(secret);
    // 剥掉前导符号是给 Error 用的,不是把文案换成另一套
    expect(msg).not.toMatch(/^✗/);
  });

  it('不可重放的 body ⇒ 不续期不重放(避免"重发空 body 的假成功")', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"a":1}'));
        controller.close();
      },
    });
    const calls = stubFetch([{ match: () => true, respond: () => always401() }]);
    const resp = await fetchWithCliAuthRefresh(
      `${API}/api/things`,
      { method: 'POST', body: stream as unknown as BodyInit },
      { accessToken: 'some.jwt' },
    );
    expect(isUnauthorized(resp)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('调用方自己写了 Authorization ⇒ 不覆盖、不续期、不重放(那一格的凭据不归本出口管)', async () => {
    const calls = stubFetch([
      {
        match: (u) => !isRefreshUrl(u),
        respond: () => json({ code: 1 }, 401),
      },
      { match: isRefreshUrl, respond: () => json({ code: 0, data: {} }) },
    ]);
    const resp = await fetchWithCliAuthRefresh(
      `${API}/api/things`,
      { headers: { authorization: 'Bearer caller-owned-token' } },
      { accessToken: null },
    );
    expect(isUnauthorized(resp)).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
