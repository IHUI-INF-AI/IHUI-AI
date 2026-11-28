// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 2.0 Client Credentials（MCP 稳定授权扩展）测试。
 *
 * 钉住：grant_type=client_credentials、scope/resource 透传、默认 basic 认证、
 * 不保存 refresh_token。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { startClientCredentialsOAuthFlow } from '../src/tools/mcp-oauth.js';
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

describe('OAuth Client Credentials (MCP auth extension)', () => {
  let home: string;
  let calls: Array<{ url: string; body: URLSearchParams; headers: Record<string, string> }>;
  const originalHome = process.env.IHUI_HOME;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cc-'));
    process.env.IHUI_HOME = home;
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: new URLSearchParams(String(init?.body ?? '')),
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return new Response(JSON.stringify({ access_token: 'cc-token', expires_in: 3600, refresh_token: 'nope' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = originalHome;
    fs.rmSync(home, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('client_credentials 请求体带 grant_type/scope/resource，默认 basic 认证', async () => {
    const result = await startClientCredentialsOAuthFlow({
      serverUrl: 'https://mcp.example.com/mcp',
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'machine-client',
      clientSecret: 'machine-secret',
      scope: ['issues:read'],
      resource: 'https://mcp.example.com/mcp',
    });
    expect(result.accessToken).toBe('cc-token');
    expect(calls[0]!.body.get('grant_type')).toBe('client_credentials');
    expect(calls[0]!.body.get('scope')).toBe('issues:read');
    expect(calls[0]!.body.get('resource')).toBe('https://mcp.example.com/mcp');
    expect(calls[0]!.headers.Authorization).toMatch(/^Basic /);
    expect(calls[0]!.body.get('client_secret')).toBeNull();
  });

  it('没有 secret 时按公开客户端发 client_id，不用 Basic', async () => {
    await startClientCredentialsOAuthFlow({
      serverUrl: 'https://mcp.example.com/mcp',
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'public-machine-client',
      tokenEndpointAuthMethod: 'none',
    });
    expect(calls[0]!.body.get('client_id')).toBe('public-machine-client');
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it('凭证落库不含 refresh_token', async () => {
    await startClientCredentialsOAuthFlow({
      serverUrl: 'https://mcp.example.com/mcp',
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'machine-client',
      clientSecret: 'machine-secret',
    });
    const creds = await loadMcpCredentials();
    expect(creds['https://mcp.example.com/mcp']?.refreshToken).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
