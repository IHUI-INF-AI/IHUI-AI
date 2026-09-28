// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票A — MCP 凭据刷新:跨进程单飞锁 + 代次 CAS + 失败三分。
 *
 * 口径:**全部走生产入口** ——
 *   - 调用侧分流走 `resolveMcpAuthHeaders`(mcp-runtime 的真实分发路径);
 *   - 锁/代次/复用走真实的 `refreshAccessToken`(config.refreshSingleFlight=true);
 *   - 落库走真实的 mcp-credentials(临时 IHUI_HOME 用 scripts/lib/scratch-dir.mjs 的 mkScratch,
 *     不落 os.tmpdir())。
 * 仅两样被替换:
 *   - 全局 fetch(测试必须自己数"grant_type=refresh_token 发了几次");
 *   - startOAuthFlow(交互式授权会开浏览器/本地端口,必须桩掉才能断言"调没调")——
 *     用 importOriginal 展开保留 mcp-oauth 其余全部真实实现,不是内联第二份逻辑。
 * DNS 桩与 mcp-oauth.test.ts 同法:只替换"名字→地址",SSRF 守卫本体照跑。
 *
 * 凭据卫生:所有 token/refresh 值都是本文件自造的哨兵字符串,不落真实凭据;
 * 断言泄漏时只报"命中/未命中"。
 */
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 夹具落点仍唯一取自 scripts/lib/scratch-dir.mjs(§26,不落 os.tmpdir()/裸 mkdtempSync)。
// 但**不能用静态相对 import**:本文件带 vi.mock,测试文件会被 Vite 外化给 Node 运行时,
// '../../scripts/…' 在运行时被拧成 '/scripts/…'(本机复现,同症状见 hooks-trust-atomic-write);
// 按 importer 逐字解析的**三条** '../' 才是真实相对深度(apps/cli/tests → 仓根),
// 再经 import.meta.url 归一为绝对 file: URL 动态导入。
interface ScratchDirModule {
  mkScratch(prefix?: string): string;
  rmScratch(dir: string): void;
}
let mkScratch!: (prefix?: string) => string;
let rmScratch!: (dir: string) => void;

beforeAll(async () => {
  const spec = pathToFileURL(
    fileURLToPath(new URL('../../../scripts/lib/scratch-dir.mjs', import.meta.url)),
  ).href;
  // 经 unknown 中转再收窄:`as` 直接贴在 await import() 上会触发 consistent-type-imports 误判
  const loaded: unknown = await import(spec);
  const mod = loaded as Partial<ScratchDirModule>;
  if (typeof mod.mkScratch !== 'function' || typeof mod.rmScratch !== 'function') {
    throw new Error('scratch-dir.mjs 解析失败 —— 夹具落点不许退到 os.tmpdir()');
  }
  mkScratch = mod.mkScratch;
  rmScratch = mod.rmScratch;
});

const { mockStartOAuthFlow } = vi.hoisted(() => ({ mockStartOAuthFlow: vi.fn() }));

import type * as McpOauthModule from '../src/tools/mcp-oauth.js';

vi.mock('../src/tools/mcp-oauth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof McpOauthModule;
  return {
    ...actual, // 锁/代次/刷新/三分的**真实实现**照常参与本测试
    startOAuthFlow: mockStartOAuthFlow, // 交互式授权会开浏览器与本地 server,只桩这一个出口
  };
});

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

import { resolveMcpAuthHeaders } from '../src/tools/mcp-runtime.js';
import {
  refreshAccessToken,
  getRefreshLockPath,
  readMcpRefreshKind,
  REFRESH_LOCK_WAIT_MS,
  type OAuthConfig,
} from '../src/tools/mcp-oauth.js';
import {
  saveMcpCredentials,
  getCredential,
  getCredentialWithGeneration,
  commitCredentialCas,
  setCredential,
  getCredentialsPath,
} from '../src/tools/mcp-credentials.js';
import type { McpServer } from '../src/commands/mcp-config.js';

const SERVER_URL = 'https://mcp.example.com/sse';

/** 全局 fetch 桩:按调用方给的 responder 分发,并累计"refresh_token 请求"次数 */
let fetchCalls: number;
let refreshGrantCalls: number;
type FetchResponder = (body: string, callIndex: number) => Promise<{
  ok: boolean;
  status?: number;
  json?: () => Promise<Record<string, unknown>>;
  text?: () => Promise<string>;
}>;
let responder: FetchResponder;

const mockFetch = vi.fn(async (input: string | URL, init?: RequestInit): Promise<Response> => {
  const body = typeof init?.body === 'string' ? init.body : '';
  refreshGrantCalls += body.includes('grant_type=refresh_token') ? 1 : 0;
  fetchCalls += 1;
  const result = await responder(body, fetchCalls);
  return result as unknown as Response;
});

async function waitUntil(pred: () => boolean, timeoutMs = 5_000, label = 'waitUntil'): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error(`${label} 超时(${timeoutMs}ms)`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

function oauthServerFixture(): McpServer {
  return {
    name: 'sf-server',
    transport: 'http',
    url: SERVER_URL,
    auth: { type: 'oauth' },
    oauth: {
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'cid-static',
      redirectUri: 'http://localhost:0/callback',
      scope: ['mcp:tools'],
    },
  };
}

function directConfig(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    authorizationEndpoint: 'https://auth.example.com/authorize',
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'cid-static',
    redirectUri: 'http://localhost:0/callback',
    scope: ['mcp:tools'],
    serverUrl: SERVER_URL,
    refreshSingleFlight: true,
    ...overrides,
  };
}

/** 预写"别的进程正持有"的刷新锁(锁内含活 PID ⇒ 后来者必须等) */
async function preWriteRefreshLock(): Promise<void> {
  const lockPath = getRefreshLockPath();
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  await fs.writeFile(
    lockPath,
    JSON.stringify({ pid: process.pid, startedAt: Date.now(), serverUrl: SERVER_URL }),
    'utf-8',
  );
}

async function seedExpiredEntry(): Promise<void> {
  await saveMcpCredentials({
    [SERVER_URL]: {
      accessToken: 'stale-access',
      refreshToken: 'rt-original',
      expiresAt: Date.now() - 1_000, // 已过期
      obtainedAt: Date.now() - 7_200_000,
    },
  });
}

describe('票A: MCP 刷新单飞锁 + 代次 CAS + 失败三分', () => {
  let scratchHome: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    scratchHome = mkScratch('mcp-refresh-sf-');
    originalEnv = { ...process.env };
    process.env.IHUI_HOME = scratchHome;
    fetchCalls = 0;
    refreshGrantCalls = 0;
    mockStartOAuthFlow.mockReset();
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
    responder = async () => ({ ok: true, json: async () => ({}) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = originalEnv;
    rmScratch(scratchHome);
  });

  // -------------------------------------------------------------------------
  // 锁卫生:锁文件路径必须与被保护的 credentials 路径不同(同路径 ⇒ 自重入死锁)
  // -------------------------------------------------------------------------
  it('刷新锁路径 ≠ credentials 路径,且锁只包刷新不包落库点自身', async () => {
    const lockPath = getRefreshLockPath();
    const credsPath = getCredentialsPath();
    expect(path.basename(lockPath)).toBe('mcp-refresh.lock');
    expect(lockPath).not.toBe(credsPath);
    expect(path.dirname(lockPath)).toBe(path.dirname(credsPath));
  });

  // -------------------------------------------------------------------------
  // A1. 两个并发只发一次 grant_type=refresh_token(生产入口:resolveMcpAuthHeaders)
  // -------------------------------------------------------------------------
  it('并发两个刷新调用:grant_type=refresh_token 恰好发一次,后来者复用 winner 落库结果', async () => {
    await seedExpiredEntry();

    let releaseFirst!: () => void;
    const firstFetchGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    responder = async (body, callIndex) => {
      expect(body).toContain('grant_type=refresh_token');
      if (callIndex === 1) {
        // holder 卡在"一次 discovery + 一次 token 请求"的网络往返里,等待方必须排到锁后
        await firstFetchGate;
      }
      return {
        ok: true,
        json: async () => ({
          access_token: 'winner-access',
          refresh_token: 'rt-rotated',
          expires_in: 3_600,
        }),
      };
    };

    const p1 = resolveMcpAuthHeaders(oauthServerFixture());
    // holder 已持锁且在 fetch 里(锁文件存在 + 第一次 refresh 请求已发出)
    await waitUntil(
      () => existsSync(getRefreshLockPath()) && refreshGrantCalls === 1,
      2_000,
      'holder 持锁',
    );
    const p2 = resolveMcpAuthHeaders(oauthServerFixture());
    await new Promise((r) => setTimeout(r, 50)); // 让 p2 进入等锁轮询
    // p2 在锁外排队的这一拍,凭据盘面还没被任何写方动过(锁 ≠ 落库同路径,自重入死锁的反证)
    const midCred = await getCredential(SERVER_URL);
    expect(midCred?.accessToken).toBe('stale-access');
    releaseFirst();

    const [h1, h2] = await Promise.all([p1, p2]);
    expect(h1['Authorization']).toBe('Bearer winner-access');
    // 关键断言:第二个调用没有再发一次 refresh(整个 token family 被撤销的成因正是这里)
    expect(refreshGrantCalls).toBe(1);
    expect(h2['Authorization']).toBe('Bearer winner-access');
    // winner 的结果已落库(代次推进)
    const after = await getCredentialWithGeneration(SERVER_URL);
    expect(after.entry?.accessToken).toBe('winner-access');
    expect(after.generation).toBeGreaterThan(0);
    // 锁已释放(holder 走完 finally;等待方也各自释放的是同一路径,末次写后必被 unlink)
    await waitUntil(() => !existsSync(getRefreshLockPath()), 2_000, '锁释放');
    expect(mockStartOAuthFlow).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // A2. 锁内发现已换代 ⇒ 零二次请求,直接复用 winner 落库结果
  // -------------------------------------------------------------------------
  it('等锁期间别的进程已换代并落了可用 token ⇒ 出锁后零请求复用,不再发 refresh', async () => {
    await seedExpiredEntry();
    await preWriteRefreshLock();

    const inflight = refreshAccessToken(directConfig({ refreshLockWaitMs: 5_000 }), 'rt-original');
    // 模拟 winner:在等待方还在排锁时,换代落库
    await new Promise((r) => setTimeout(r, 50));
    await commitCredentialCas(
      SERVER_URL,
      {
        accessToken: 'other-winner-access',
        refreshToken: 'other-winner-rt',
        expiresAt: Date.now() + 3_600_000,
        scope: ['mcp:tools'],
        obtainedAt: Date.now(),
      },
      0,
    );
    await fs.unlink(getRefreshLockPath()); // winner 释放

    const result = await inflight;
    expect(result.accessToken).toBe('other-winner-access');
    expect(refreshGrantCalls).toBe(0); // 一条网络请求都没发
  });

  // -------------------------------------------------------------------------
  // A2b. 换代但 winner 没留可用 token ⇒ 未判定,绝不读成"没有凭据"
  // -------------------------------------------------------------------------
  it('换代后 entry 无 accessToken ⇒ 判 undetermined,不发 refresh 也不起交互式授权', async () => {
    await seedExpiredEntry();
    await preWriteRefreshLock();

    const inflight = refreshAccessToken(directConfig({ refreshLockWaitMs: 5_000 }), 'rt-original');
    await new Promise((r) => setTimeout(r, 50));
    // winner 只推进了代次(例如清掉了旧 accessToken),没留下可用 token
    await saveMcpCredentials({
      [SERVER_URL]: { obtainedAt: Date.now(), refreshToken: 'rt-unknown', generation: 1 },
    });
    await fs.unlink(getRefreshLockPath());

    const err = await inflight.catch((e: unknown) => e);
    expect(readMcpRefreshKind(err)).toBe('undetermined');
    expect(refreshGrantCalls).toBe(0);
    // "未判定"不是"没有凭据":不得被调用侧折成"去重新授权"
    expect(mockStartOAuthFlow).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // A3. 等锁超时 ≠ 刷新失败
  // -------------------------------------------------------------------------
  it('等锁超时后先重读:代次已换且有可用 token ⇒ 直接用,不误报失败', async () => {
    await seedExpiredEntry();
    await preWriteRefreshLock(); // 锁一直不释放,等待方必然走到超时分支

    const inflight = refreshAccessToken(directConfig({ refreshLockWaitMs: 300 }), 'rt-original');
    await new Promise((r) => setTimeout(r, 50));
    await commitCredentialCas(
      SERVER_URL,
      {
        accessToken: 'timeout-winner-access',
        refreshToken: 'timeout-winner-rt',
        expiresAt: Date.now() + 3_600_000,
        obtainedAt: Date.now(),
      },
      0,
    );

    const result = await inflight;
    expect(result.accessToken).toBe('timeout-winner-access');
    expect(refreshGrantCalls).toBe(0);
  });

  it('等锁超时且未观察到换代 ⇒ 判 temporary(可重试),不判刷新失败、不起交互', async () => {
    await seedExpiredEntry();
    await preWriteRefreshLock();

    const err = await refreshAccessToken(directConfig({ refreshLockWaitMs: 300 }), 'rt-original').catch(
      (e: unknown) => e,
    );
    const kind = readMcpRefreshKind(err);
    expect(kind).toBe('temporary');
    expect(refreshGrantCalls).toBe(0);
    expect(mockStartOAuthFlow).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // A4. 预算现测:锁等待预算必须覆盖"一次 discovery + 一次 token 请求"的往返上界
  // -------------------------------------------------------------------------
  it('现测 holder 往返与 REFRESH_LOCK_WAIT_MS 的覆盖关系(预算 ≥ 2× token 内部超时)', async () => {
    await seedExpiredEntry();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    responder = async () => {
      setTimeout(releaseFirst, 400); // 模拟一次"慢 discovery + token 请求"
      await gate;
      return {
        ok: true,
        json: async () => ({ access_token: 'slow-winner', refresh_token: 'rt-2', expires_in: 3_600 }),
      };
    };
    const startedAt = Date.now();
    const r = await refreshAccessToken(directConfig(), 'rt-original');
    const holderRttMs = Date.now() - startedAt;
    expect(r.accessToken).toBe('slow-winner');
    // 预算必须显著大于现测常态往返,且覆盖 token 端 15s 内部超时的两倍(见常量注释的推导)
    expect(REFRESH_LOCK_WAIT_MS).toBeGreaterThan(holderRttMs);
    expect(REFRESH_LOCK_WAIT_MS).toBeGreaterThanOrEqual(2 * 15_000);
  });

  // -------------------------------------------------------------------------
  // A5. 失败三分(生产入口 resolveMcpAuthHeaders 的分流,三条各一对)
  // -------------------------------------------------------------------------
  it('temporary(网络失败):错误原样上抛且可重试判定成立,绝不调 startOAuthFlow', async () => {
    await seedExpiredEntry();
    responder = async () => {
      throw new TypeError('fetch failed (simulated network blip)');
    };

    const err = await resolveMcpAuthHeaders(oauthServerFixture()).catch((e: unknown) => e);
    expect(readMcpRefreshKind(err)).toBe('temporary');
    expect(mockStartOAuthFlow).not.toHaveBeenCalled();
    // 刷新没成功时不得把凭据写坏(可重试的前提:盘面还是原样)
    const cred = await getCredential(SERVER_URL);
    expect(cred?.accessToken).toBe('stale-access');
    expect(cred?.refreshToken).toBe('rt-original');
  });

  it('invalid_grant(确定性失效):调 startOAuthFlow 重新授权', async () => {
    await seedExpiredEntry();
    responder = async () => ({
      ok: true,
      json: async () => ({ error: 'invalid_grant', error_description: 'refresh token revoked' }),
    });
    mockStartOAuthFlow.mockResolvedValueOnce({
      accessToken: 'interactive-access',
      refreshToken: 'interactive-rt',
      expiresAt: Date.now() + 3_600_000,
      scope: ['mcp:tools'],
    });

    const headers = await resolveMcpAuthHeaders(oauthServerFixture());
    expect(headers['Authorization']).toBe('Bearer interactive-access');
    expect(mockStartOAuthFlow).toHaveBeenCalledTimes(1);
  });

  it('invalid_client + 静态 clientId:判配置错并上抛,不起交互(起环必然再撞同一 client)', async () => {
    await seedExpiredEntry();
    responder = async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid_client',
    });

    const err = await resolveMcpAuthHeaders(oauthServerFixture()).catch((e: unknown) => e);
    expect(readMcpRefreshKind(err)).toBe('invalid_client');
    expect(mockStartOAuthFlow).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(Error);
  });

  // -------------------------------------------------------------------------
  // A6. 代次 CAS 语义(存储层成对判据)
  // -------------------------------------------------------------------------
  it('commitCredentialCas:期望代次相符才落盘;不符原样带回 current 且不覆盖', async () => {
    await seedExpiredEntry();
    // 正向对照:expected=0(缺省代次)⇒ 提交成功并推进
    const ok = await commitCredentialCas(
      SERVER_URL,
      { accessToken: 'cas-ok-access', obtainedAt: Date.now() },
      0,
    );
    expect(ok.committed).toBe(true);
    expect(ok.generation).toBe(1);
    // 反向对照:再拿过期 expected=0 提交 ⇒ 拒绝且不动 winner 的结果
    const lost = await commitCredentialCas(
      SERVER_URL,
      { accessToken: 'late-writer-access', obtainedAt: Date.now() },
      0,
    );
    expect(lost.committed).toBe(false);
    expect(lost.current?.accessToken).toBe('cas-ok-access');
    const after = await getCredential(SERVER_URL);
    expect(after?.accessToken).toBe('cas-ok-access'); // 迟到写方没覆盖任何东西
  });

  it('setCredential 推进代次(兼容写也要让并发的锁内复核看得见换代)', async () => {
    await seedExpiredEntry();
    const beforeGen = (await getCredentialWithGeneration(SERVER_URL)).generation;
    await setCredential(SERVER_URL, {
      accessToken: 'interactive-new',
      obtainedAt: Date.now(),
    });
    const after = await getCredentialWithGeneration(SERVER_URL);
    expect(after.generation).toBeGreaterThan(beforeGen);
    expect(after.entry?.accessToken).toBe('interactive-new');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
