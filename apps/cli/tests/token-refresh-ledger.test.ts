// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A10A-7 落地点 2:token 续期的失败固化台账(零真实网络)。
 *
 * 这四条就是任务书点名的验收:
 *  ① 并发两个等待者 ⇒ 只打一次网络;
 *  ② 第一个失败 ⇒ 迟到者**立刻**拿到同因结果(断言等待时长不依赖 10s 超时);
 *  ③ cancelled 与 failed 的原因码不同(不得把取消折叠成刷新失败);
 *  ④ 成功路径的对外行为一字未变。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getSettingsPath } from '../src/commands/settings.js';
import {
  ensureFreshAccessToken,
  readRefreshFailure,
} from '../src/commands/token-manager.js';
import { InflightLedger, LedgerFailure } from '../src/util/inflight-ledger.js';

/** token-manager 内部的 HTTP 超时(10s)。断言"不依赖超时"时拿它当量尺。 */
const HTTP_TIMEOUT_MS = 10_000;
/** 迟到者"立刻"的判据上限:比 HTTP 超时小两个数量级。 */
const IMMEDIATE_MS = 400;

function makeJwt(expSeconds: number): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj), 'utf-8').toString('base64url');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: '1', exp: expSeconds })}.SIGNATURE`;
}

const API = 'http://127.0.0.1:9';

describe('token 续期:失败固化台账', () => {
  let tmpDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  const writeSettings = (obj: Record<string, unknown>): void => {
    const p = getSettingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  };
  const readSettingsFile = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8')) as Record<string, unknown>;

  /** 每次测试一枚新台账:模块级默认实例跨用例会串,判据就不干净了。 */
  const freshLedger = (): InflightLedger<string> => new InflightLedger<string>();

  const expiredJwt = (): string => makeJwt(Math.floor(Date.now() / 1000) - 60);
  const okResponse = (accessToken: string): Response =>
    new Response(
      JSON.stringify({
        code: 0,
        data: { accessToken, refreshToken: 'rt-new', expiresIn: 900, refreshExpiresIn: 100 },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-ledger-'));
    originalEnv = { ...process.env };
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    process.env.IHUI_API_KEY = '';
    process.env.IHUI_API_SECRET = '';
    process.env.IHUI_CREDENTIAL_KIND = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  // ==================== ④ 成功路径行为不变 ====================

  it('成功续期:返回新 token、落盘、无已固化失败(与改造前一致)', async () => {
    const stale = expiredJwt();
    const fresh = makeJwt(Math.floor(Date.now() / 1000) + 7200);
    writeSettings({ apiKey: stale, refreshToken: 'rt-ok' });
    const fetchMock = vi.fn(async () => okResponse(fresh));
    vi.stubGlobal('fetch', fetchMock);

    const ledger = freshLedger();
    await expect(ensureFreshAccessToken(API, { ledger })).resolves.toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readSettingsFile().apiKey).toBe(fresh);
    expect(readRefreshFailure(API, ledger)).toBeNull();
  });

  it('未过期 / 机器凭据:根本不进台账(台账一次都不该被碰到)', async () => {
    const unexpired = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    writeSettings({ apiKey: unexpired, refreshToken: 'rt-x' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ledger = freshLedger();
    await expect(ensureFreshAccessToken(API, { ledger })).resolves.toBe(unexpired);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ledger.hasPending('any')).toBe(false);
    expect(readRefreshFailure(API, ledger)).toBeNull();
  });

  // ==================== ① 并发去重 ====================

  it('并发两个等待者 ⇒ 只打一次网络,两者拿到同一个新 token', async () => {
    writeSettings({ apiKey: expiredJwt(), refreshToken: 'rt-concurrent' });
    const fresh = makeJwt(Math.floor(Date.now() / 1000) + 7200);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return okResponse(fresh);
    });
    vi.stubGlobal('fetch', fetchMock);

    const ledger = freshLedger();
    const p1 = ensureFreshAccessToken(API, { ledger });
    const p2 = ensureFreshAccessToken(API, { ledger });
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toBe(fresh);
    expect(r2).toBe(fresh);
  });

  // ==================== ② 失败固化:迟到者不挂超时 ====================

  it('第一个失败后,迟到者立刻拿到同因结果,等待时长与 10s HTTP 超时无关', async () => {
    const stale = expiredJwt();
    writeSettings({ apiKey: stale, refreshToken: 'rt-fail-once' });
    // 401 ⇒ 原因码 auth;它**立刻**返回,所以第一次不存在"等超时"
    const fetchMock = vi.fn(async () => new Response('{"code":401}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const ledger = freshLedger();
    const first = await ensureFreshAccessToken(API, { ledger });
    // 对外契约不变:失败仍把原 token 交回去,由上游 API 报 401
    expect(first).toBe(stale);
    expect((readRefreshFailure(API, ledger) as LedgerFailure).code).toBe('auth');

    // 迟到者:此刻若走真实续期,最坏要挂 HTTP_TIMEOUT_MS;台账必须当场给答案
    const start = Date.now();
    const second = await ensureFreshAccessToken(API, { ledger });
    const elapsed = Date.now() - start;
    expect(second).toBe(stale);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 一次都没重跑
    expect(elapsed).toBeLessThan(IMMEDIATE_MS);
    expect(elapsed).toBeLessThan(HTTP_TIMEOUT_MS / 10);
    // 同因:两次读到的是同一份失败对象
    expect(readRefreshFailure(API, ledger)).toBeInstanceOf(LedgerFailure);
  });

  it('取消要改写被等待的事实:fetch 永不 settle 时,迟到者依然立刻拿到 cancelled', async () => {
    const stale = expiredJwt();
    writeSettings({ apiKey: stale, refreshToken: 'rt-cancel' });
    let settledCount = 0;
    const fetchMock = vi.fn(() => {
      // 永不 resolve:任何"拿到了答案"都只能来自台账,不可能来自请求自己完成
      settledCount += 1;
      return new Promise<Response>(() => {
        /* never settles */
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ledger = freshLedger();
    const ac = new AbortController();
    const firstCall = ensureFreshAccessToken(API, { ledger, signal: ac.signal });
    ac.abort(new Error('用户取消'));
    // 被取消的那次仍然按对外契约返回原 token
    await expect(firstCall).resolves.toBe(stale);
    expect(settledCount).toBe(1);

    const start = Date.now();
    const late = await ensureFreshAccessToken(API, { ledger });
    const elapsed = Date.now() - start;
    expect(late).toBe(stale);
    expect(settledCount).toBe(1); // 迟到者没有再发一次请求
    expect(elapsed).toBeLessThan(IMMEDIATE_MS);

    const failure = readRefreshFailure(API, ledger) as LedgerFailure;
    expect(failure).toBeInstanceOf(LedgerFailure);
    expect(failure.code).toBe('cancelled');
  });

  // ==================== ③ 原因码互不折叠 ====================

  it('cancelled 与 auth 与 network 三个码各自独立,互不折叠', async () => {
    const ledgers: Record<string, InflightLedger<string>> = {};
    const runOne = async (name: string, refreshToken: string, response: () => Response): Promise<string> => {
      writeSettings({ apiKey: expiredJwt(), refreshToken });
      vi.stubGlobal('fetch', vi.fn(async () => response()));
      const ledger = new InflightLedger<string>();
      ledgers[name] = ledger;
      await ensureFreshAccessToken(API, { ledger });
      return (readRefreshFailure(API, ledger) as LedgerFailure).code;
    };

    const authCode = await runOne('auth', 'rt-auth', () => new Response('{}', { status: 403 }));
    const networkCode = await runOne('network', 'rt-network', () => new Response('{}', { status: 503 }));

    // 4xx ⇒ auth(该重登);5xx ⇒ network(该重试)。同为"失败"但处置动作相反。
    expect(authCode).toBe('auth');
    expect(networkCode).toBe('network');
    expect(authCode).not.toBe(networkCode);

    // cancelled 走真实取消路径,与两者都不同
    writeSettings({ apiKey: expiredJwt(), refreshToken: 'rt-cancel2' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => { /* never */ })),
    );
    const ledger = new InflightLedger<string>();
    const ac = new AbortController();
    const p = ensureFreshAccessToken(API, { ledger, signal: ac.signal });
    ac.abort();
    await p;
    const cancelCode = (readRefreshFailure(API, ledger) as LedgerFailure).code;
    expect(cancelCode).toBe('cancelled');
    expect(new Set([authCode, networkCode, cancelCode]).size).toBe(3);
  });

  it('响应体不合契约 ⇒ auth(而不是悄悄当成网络问题)', async () => {
    writeSettings({ apiKey: expiredJwt(), refreshToken: 'rt-badbody' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 1, message: 'nope' }), { status: 200 })));
    const ledger = freshLedger();
    await ensureFreshAccessToken(API, { ledger });
    expect((readRefreshFailure(API, ledger) as LedgerFailure).code).toBe('auth');
  });

  // ==================== 键的归属:不得越界改写别件事 ====================

  it('换了 refreshToken 就是另一件事:旧失败不得拦住新凭据的首次续期', async () => {
    const stale = expiredJwt();
    const fresh = makeJwt(Math.floor(Date.now() / 1000) + 7200);
    writeSettings({ apiKey: stale, refreshToken: 'rt-old-bad' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const ledger = freshLedger();
    await ensureFreshAccessToken(API, { ledger });
    expect((readRefreshFailure(API, ledger) as LedgerFailure).code).toBe('auth');

    // 用户重新登录 ⇒ refreshToken 变了。此刻新凭据必须能直接续期成功,
    // 而不是被"上一条 rt-old-bad 的失败"替它做决定。
    // 注意取证的口径:新 mock 的调用数是**从 0 起算**的(旧 mock 那一次调用属于
    // 上一个凭据),所以这里判"新 mock 恰好被打了一次" = 新凭据没有被旧失败拦住。
    const newFetch = vi.fn(async () => okResponse(fresh));
    writeSettings({ apiKey: stale, refreshToken: 'rt-brand-new' });
    vi.stubGlobal('fetch', newFetch);
    await expect(ensureFreshAccessToken(API, { ledger })).resolves.toBe(fresh);
    expect(newFetch).toHaveBeenCalledTimes(1);
    expect(readRefreshFailure(API, ledger)).toBeNull();
  });

  it('readRefreshFailure:没有 refreshToken 时给 null 而不是抛', () => {
    writeSettings({ apiKey: expiredJwt() });
    expect(readRefreshFailure(API, freshLedger())).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
