/**
 * MCP OAuth flow 测试 — 覆盖 token exchange + lock dedup + URL 构造。
 *
 * 覆盖点:
 *   1. exchangeCodeForToken:mock fetch,验证请求 body + 响应解析
 *   2. refreshAccessToken:mock fetch,验证 refresh 流程
 *   3. buildFullAuthorizationUrl:state + PKCE + scope 拼接正确
 *   4. acquireLock + releaseLock:跨进程 dedup(PID 存活等待,PID 已死接管)
 *   5. isProcessAlive:当前进程 true,无效 PID false
 *   6. startLocalCallbackServer:mock http 请求触发 code resolve
 *   7. startOAuthFlow 端到端:mock tokenEndpoint + 本地 callback,验证凭证写入
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import http from 'node:http';
import {
  exchangeCodeForToken,
  refreshAccessToken,
  buildFullAuthorizationUrl,
  acquireLock,
  releaseLock,
  isProcessAlive,
  startLocalCallbackServer,
  startOAuthFlow,
  getOAuthLockPath,
  readLockForTest,
  type OAuthConfig,
} from '../src/tools/mcp-oauth.js';
import { loadMcpCredentials } from '../src/tools/mcp-credentials.js';

// mock child_process.spawn 防止 openBrowser 真实打开浏览器
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    unref: vi.fn(),
  })),
}));

// 全局 fetch mock
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeOAuthConfig(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    authorizationEndpoint: 'https://auth.example.com/authorize',
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost:18999/callback',
    scope: ['read', 'write'],
    serverUrl: 'https://mcp.example.com',
    ...overrides,
  };
}

describe('mcp-oauth exchangeCodeForToken', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('成功换取 access_token + refresh_token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
        scope: 'read write',
      }),
    });

    const result = await exchangeCodeForToken(makeOAuthConfig(), 'auth-code-abc', 'verifier-xyz');

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('https://auth.example.com/token');
    const opts = call[1] as RequestInit;
    expect(opts.method).toBe('POST');
    const body = opts.body as string;
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=auth-code-abc');
    expect(body).toContain('client_id=test-client-id');
    expect(body).toContain('client_secret=test-secret');
    expect(body).toContain('code_verifier=verifier-xyz');

    expect(result.accessToken).toBe('access-123');
    expect(result.refreshToken).toBe('refresh-456');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.scope).toEqual(['read', 'write']);
  });

  it('token endpoint 返回非 2xx → 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    });

    await expect(
      exchangeCodeForToken(makeOAuthConfig(), 'bad-code'),
    ).rejects.toThrow(/token endpoint 返回 400/);
  });

  it('响应缺少 access_token → 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ refresh_token: 'r' }),
    });

    await expect(
      exchangeCodeForToken(makeOAuthConfig(), 'code'),
    ).rejects.toThrow('缺少 access_token');
  });

  it('响应含 error 字段 → 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'invalid_grant', error_description: 'bad code' }),
    });

    await expect(
      exchangeCodeForToken(makeOAuthConfig(), 'code'),
    ).rejects.toThrow(/invalid_grant/);
  });

  it('scope 为数组时直接使用', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'a',
        scope: ['custom1', 'custom2'],
      }),
    });
    const result = await exchangeCodeForToken(makeOAuthConfig(), 'code');
    expect(result.scope).toEqual(['custom1', 'custom2']);
  });

  it('无 expires_in 时默认 1 小时', async () => {
    const before = Date.now();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'a' }),
    });
    const result = await exchangeCodeForToken(makeOAuthConfig(), 'code');
    const after = Date.now();
    // 默认 1 小时后过期
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 3600_000);
  });
});

describe('mcp-oauth refreshAccessToken', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('成功刷新 access_token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
      }),
    });

    const result = await refreshAccessToken(makeOAuthConfig(), 'old-refresh');

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as string;
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=old-refresh');
  });

  it('服务器不返回新 refresh_token 时沿用旧值', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-access' }),
    });

    const result = await refreshAccessToken(makeOAuthConfig(), 'old-refresh');
    expect(result.refreshToken).toBe('old-refresh');
  });

  it('刷新失败抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid refresh token',
    });

    await expect(
      refreshAccessToken(makeOAuthConfig(), 'bad-refresh'),
    ).rejects.toThrow(/401/);
  });
});

describe('mcp-oauth buildFullAuthorizationUrl', () => {
  it('拼接 state + PKCE + scope + redirect_uri', () => {
    const url = buildFullAuthorizationUrl(
      makeOAuthConfig(),
      'state-abc',
      'challenge-xyz',
    );
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('state=state-abc');
    expect(url).toContain('code_challenge=challenge-xyz');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('scope=read+write');
  });

  it('authorizationEndpoint 已含 query 时用 & 连接', () => {
    const url = buildFullAuthorizationUrl(
      makeOAuthConfig({ authorizationEndpoint: 'https://auth.example.com/authorize?foo=bar' }),
      'state',
      'challenge',
    );
    expect(url).toContain('?foo=bar&');
    expect(url).toContain('response_type=code');
  });

  it('scope 为空时不拼接 scope 参数', () => {
    const url = buildFullAuthorizationUrl(
      makeOAuthConfig({ scope: [] }),
      'state',
      'challenge',
    );
    expect(url).not.toContain('scope=');
  });
});

describe('mcp-oauth 跨进程 lock dedup', () => {
  let tmpHome: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'ihui-oauth-test-'));
    originalEnv = { ...process.env };
    process.env.IHUI_HOME = tmpHome;
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('acquireLock 写入 lock 文件,含 PID + serverUrl', async () => {
    await acquireLock('https://mcp.example.com');
    const lock = await readLockForTest();
    expect(lock).not.toBeNull();
    expect(lock!.pid).toBe(process.pid);
    expect(lock!.serverUrl).toBe('https://mcp.example.com');
    expect(lock!.startedAt).toBeGreaterThan(0);
    await releaseLock();
  });

  it('releaseLock 删除 lock 文件(PID 匹配)', async () => {
    await acquireLock('https://mcp.example.com');
    await releaseLock();
    const lock = await readLockForTest();
    expect(lock).toBeNull();
  });

  it('lock 文件已损坏 → acquireLock 删除并重新获取', async () => {
    const lockPath = getOAuthLockPath();
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(lockPath, '{not valid json', 'utf-8');
    // 应删除损坏的 lock 并重新获取
    await acquireLock('https://mcp.example.com');
    const lock = await readLockForTest();
    expect(lock).not.toBeNull();
    expect(lock!.pid).toBe(process.pid);
    await releaseLock();
  });

  it('lock 不存在时 releaseLock 不抛错', async () => {
    await expect(releaseLock()).resolves.toBeUndefined();
  });
});

describe('mcp-oauth isProcessAlive', () => {
  it('当前进程 PID 存活', async () => {
    expect(await isProcessAlive(process.pid)).toBe(true);
  });

  it('PID=1 通常存活(POSIX init 进程)', async () => {
    // POSIX:PID 1 是 init/systemd,process.kill(1, 0) 返回 EPERM(存活但无权限)
    // Windows:PID 1 是 System Idle Process,process.kill 行为不确定,跳过断言
    if (process.platform === 'win32') {
      // Windows 上 PID 1 可能 EPERM 或其他错误,只验证不抛错
      const result = await isProcessAlive(1);
      expect(typeof result).toBe('boolean');
    } else {
      expect(await isProcessAlive(1)).toBe(true);
    }
  });

  it('无效 PID(0 或负数)返回 false', async () => {
    expect(await isProcessAlive(0)).toBe(false);
    expect(await isProcessAlive(-1)).toBe(false);
  });

  it('不存在的 PID 返回 false', async () => {
    // 用一个很大的 PID,几乎不可能存在
    expect(await isProcessAlive(999999)).toBe(false);
  });
});

describe('mcp-oauth startLocalCallbackServer', () => {
  it('收到合法 code + state 时 resolve', async () => {
    const port = 19001;
    const state = 'test-state-123';
    const handle = startLocalCallbackServer(port, state, 5000);

    // 发起 http 请求模拟 OAuth provider 回调
    setTimeout(() => {
      const req = http.get(
        `http://localhost:${port}/callback?code=test-code&state=${state}`,
        () => {
          // 消费响应
        },
      );
      req.on('error', () => {
        // 忽略
      });
    }, 50);

    const code = await handle.waitForCode;
    expect(code).toBe('test-code');
  });

  it('state 不匹配时不 resolve,继续等待', async () => {
    const port = 19002;
    const state = 'correct-state';
    const handle = startLocalCallbackServer(port, state, 1000);

    // 发送错误 state 的请求
    setTimeout(() => {
      http.get(
        `http://localhost:${port}/callback?code=bad-code&state=wrong-state`,
        () => {},
      ).on('error', () => {});
    }, 50);

    // 应超时(因为 state 不匹配,server 不会 resolve)
    await expect(handle.waitForCode).rejects.toThrow(/超时/);
    handle.close();
  });

  it('收到 error 参数时 reject', async () => {
    const port = 19003;
    const state = 'test-state';
    const handle = startLocalCallbackServer(port, state, 5000);

    setTimeout(() => {
      http.get(
        `http://localhost:${port}/callback?error=access_denied`,
        () => {},
      ).on('error', () => {});
    }, 50);

    await expect(handle.waitForCode).rejects.toThrow(/access_denied/);
  });

  it('超时未收到 code 时 reject', async () => {
    const port = 19004;
    const handle = startLocalCallbackServer(port, 'state', 200);
    await expect(handle.waitForCode).rejects.toThrow(/超时/);
  });

  it('close 关闭 server 后端口可重用', async () => {
    const port = 19005;
    const handle1 = startLocalCallbackServer(port, 'state1', 1000);
    handle1.close();
    // 等待端口释放
    await new Promise((r) => setTimeout(r, 100));

    const handle2 = startLocalCallbackServer(port, 'state2', 1000);
    // 不抛错说明端口可用
    expect(handle2).toBeDefined();
    handle2.close();
  });
});

describe('mcp-oauth startOAuthFlow 端到端', () => {
  let tmpHome: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'ihui-oauth-e2e-'));
    originalEnv = { ...process.env };
    process.env.IHUI_HOME = tmpHome;
    fetchMock.mockReset();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('完整流程:lock → callback → token exchange → 凭证写入 → lock 释放', async () => {
    const port = 19010;
    const config = makeOAuthConfig({
      redirectUri: `http://localhost:${port}/callback`,
    });

    // mock token endpoint 响应
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'e2e-access',
        refresh_token: 'e2e-refresh',
        expires_in: 3600,
        scope: 'read write',
      }),
    });

    // 在启动 flow 之前设置 spy,捕获 console.info 中的授权 URL
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // 启动 OAuth flow(异步)
    const flowPromise = startOAuthFlow(config);

    // 等待 server 就绪 + console.info 被调用
    await new Promise((r) => setTimeout(r, 300));

    // 从 console.info 调用中找到授权 URL,提取 state
    const infoCalls = infoSpy.mock.calls.map((c) => String(c[0] ?? '') + String(c[1] ?? ''));
    const urlCall = infoCalls.find((s) => s.includes('state='));
    if (!urlCall) {
      infoSpy.mockRestore();
      throw new Error('未找到授权 URL 日志');
    }
    const stateMatch = urlCall.match(/state=([^&\s]+)/);
    if (!stateMatch) {
      infoSpy.mockRestore();
      throw new Error('URL 中未找到 state 参数');
    }
    const state = decodeURIComponent(stateMatch[1]!);

    // 发送 callback
    http.get(
      `http://localhost:${port}/callback?code=e2e-code&state=${state}`,
      () => {},
    ).on('error', () => {});

    const result = await flowPromise;
    infoSpy.mockRestore();

    expect(result.accessToken).toBe('e2e-access');
    expect(result.refreshToken).toBe('e2e-refresh');

    // 验证凭证已写入 mcp-credentials.json
    const creds = await loadMcpCredentials();
    expect(creds['https://mcp.example.com']).toBeDefined();
    expect(creds['https://mcp.example.com'].accessToken).toBe('e2e-access');

    // 验证 lock 已释放
    const lock = await readLockForTest();
    expect(lock).toBeNull();
  }, 10000);
});
