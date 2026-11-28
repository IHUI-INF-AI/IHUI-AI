// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * Enterprise-Managed Authorization（SEP-990 / EMA）客户端测试。
 *
 * 钉住四件事：
 *   1. RFC 8693 token exchange 请求体：requested_token_type=id-jag、audience 必填、resource/scope 透传；
 *   2. RFC 7523 jwt-bearer 请求体：assertion 是 ID-JAG、grant_type 精确；
 *   3. issued_token_type 不是 id-jag ⇒ 立即拒绝，绝不再拿它换 access token；
 *   4. EMA 不保存 refresh_token（撤销权留在 IdP）。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { startEnterpriseManagedOAuthFlow } from '../src/tools/mcp-oauth.js';
import { loadMcpCredentials } from '../src/tools/mcp-credentials.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const cpMocks = vi.hoisted(() => ({
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
  execFile: vi.fn(
    (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      queueMicrotask(() => cb(new Error('mock: no DPAPI'), '', 'mock-no-engine'));
      return { stdin: { end: vi.fn() }, kill: vi.fn() };
    },
  ),
}));
vi.mock('node:child_process', () => ({
  spawn: cpMocks.spawn,
  execFile: cpMocks.execFile,
}));

describe('Enterprise-Managed Authorization (EMA / ID-JAG)', () => {
  let home: string;
  let calls: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }>;
  const originalHome = process.env.IHUI_HOME;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-ema-'));
    process.env.IHUI_HOME = home;
    calls = [];
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = originalHome;
    fs.rmSync(home, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function stubFetch(responses: Array<Record<string, unknown>>): void {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body ?? ''));
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(url), body, headers });
      const payload = responses[calls.length - 1];
      if (!payload) throw new Error(`unexpected fetch #${calls.length}: ${String(url)}`);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  }

  const baseConfig = {
    serverUrl: 'https://mcp.example.com/mcp',
    idpTokenEndpoint: 'https://idp.example.com/oauth2/token',
    idpClientId: 'idp-client',
    idpClientSecret: 'idp-secret',
    identityAssertion: 'sso-id-token',
    subjectTokenType: 'urn:ietf:params:oauth:token-type:id_token' as const,
    authorizationServerIssuer: 'https://auth.example.com',
    resource: 'https://mcp.example.com/mcp',
    scope: ['issues:read', 'issues:write'],
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'mcp-client',
    clientSecret: 'mcp-secret',
  };

  it('先换 ID-JAG 再换 access token，两个请求体都符合 RFC', async () => {
    stubFetch([
      {
        access_token: 'id-jag-token',
        issued_token_type: 'urn:ietf:params:oauth:token-type:id-jag',
        token_type: 'N_A',
      },
      { access_token: 'mcp-access-token', expires_in: 3600, scope: 'issues:read' },
    ]);

    const result = await startEnterpriseManagedOAuthFlow(baseConfig);
    expect(result.accessToken).toBe('mcp-access-token');
    expect(calls).toHaveLength(2);

    const idp = calls[0]!;
    expect(idp.url).toBe('https://idp.example.com/oauth2/token');
    expect(idp.body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
    expect(idp.body.get('requested_token_type')).toBe('urn:ietf:params:oauth:token-type:id-jag');
    expect(idp.body.get('subject_token')).toBe('sso-id-token');
    expect(idp.body.get('subject_token_type')).toBe('urn:ietf:params:oauth:token-type:id_token');
    expect(idp.body.get('audience')).toBe('https://auth.example.com');
    expect(idp.body.get('resource')).toBe('https://mcp.example.com/mcp');
    expect(idp.body.get('scope')).toBe('issues:read issues:write');
    expect(idp.body.get('client_id')).toBe('idp-client');

    const as = calls[1]!;
    expect(as.url).toBe('https://auth.example.com/token');
    expect(as.body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(as.body.get('assertion')).toBe('id-jag-token');
    expect(as.body.get('client_id')).toBe('mcp-client');
  });

  it('issued_token_type 不是 ID-JAG ⇒ 拒绝，且不发起第二个请求', async () => {
    stubFetch([{ access_token: 'wrong-token', issued_token_type: 'Bearer' }]);
    await expect(startEnterpriseManagedOAuthFlow(baseConfig)).rejects.toThrow(/不是 ID-JAG/);
    expect(calls).toHaveLength(1);
  });

  it('企业 IdP 没给 ID-JAG ⇒ 拒绝', async () => {
    stubFetch([{ issued_token_type: 'urn:ietf:params:oauth:token-type:id-jag' }]);
    await expect(startEnterpriseManagedOAuthFlow(baseConfig)).rejects.toThrow(/缺少 ID-JAG/);
    expect(calls).toHaveLength(1);
  });

  it('token_endpoint_auth_method=client_secret_basic 时用 Basic 头，不把 secret 放进 body', async () => {
    stubFetch([
      { access_token: 'id-jag-token', issued_token_type: 'urn:ietf:params:oauth:token-type:id-jag' },
      { access_token: 'mcp-access-token' },
    ]);
    await startEnterpriseManagedOAuthFlow({
      ...baseConfig,
      tokenEndpointAuthMethod: 'client_secret_basic',
    });
    const as = calls[1]!;
    expect(as.headers.Authorization).toMatch(/^Basic /);
    expect(as.body.get('client_secret')).toBeNull();
  });

  it('凭证落库不含 refresh_token（EMA 过期后重新向 IdP 要 ID-JAG）', async () => {
    stubFetch([
      { access_token: 'id-jag-token', issued_token_type: 'urn:ietf:params:oauth:token-type:id-jag' },
      { access_token: 'mcp-access-token', refresh_token: 'should-be-ignored', expires_in: 60 },
    ]);
    await startEnterpriseManagedOAuthFlow(baseConfig);
    const creds = await loadMcpCredentials();
    const entry = creds['https://mcp.example.com/mcp'];
    expect(entry?.accessToken).toBe('mcp-access-token');
    expect(entry?.refreshToken).toBeUndefined();
  });
});
