// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * MCP 2026 OAuth 发现与客户端注册测试。
 *
 * 钉住四件事：
 *   1. RFC 8414 metadata 解析 + issuer 精确匹配（不做归一化，防 mix-up）；
 *   2. CIMD URL 形状（https、非根路径、无 query/fragment/userinfo/点段；localhost 例外）；
 *   3. 客户端身份优先级：预注册 > CIMD > DCR；
 *   4. DCR 请求带 application_type=native（localhost 回调）且不把 CIMD URL 硬当 client_id。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  discoverAuthorizationServer,
  resolveClientRegistration,
  validateClientMetadataDocumentUrl,
} from '../src/tools/mcp-auth-discovery.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const metadata = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  registration_endpoint: 'https://auth.example.com/register',
  client_id_metadata_document_supported: true,
};

describe('MCP 2026 OAuth discovery', () => {
  it('解析 RFC 8414 metadata，且 issuer 必须精确一致', async () => {
    const fetched: string[] = [];
    const result = await discoverAuthorizationServer('https://auth.example.com', {
      fetchImpl: (async (url: string) => {
        fetched.push(String(url));
        return jsonResponse(metadata);
      }) as unknown as typeof fetch,
    });
    expect(result.token_endpoint).toBe('https://auth.example.com/token');
    expect(result.client_id_metadata_document_supported).toBe(true);
    expect(fetched[0]).toBe('https://auth.example.com/.well-known/oauth-authorization-server');
  });

  it('metadata issuer 不匹配 ⇒ 拒绝（尾斜杠也不放过）', async () => {
    await expect(
      discoverAuthorizationServer('https://auth.example.com', {
        fetchImpl: (async () =>
          jsonResponse({ ...metadata, issuer: 'https://auth.example.com/' })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/issuer 不匹配/);
  });

  it('issuer 带路径时 well-known 段插在 host 与路径之间', async () => {
    const urls: string[] = [];
    await discoverAuthorizationServer('https://auth.example.com/tenant/a', {
      fetchImpl: (async (url: string) => {
        urls.push(String(url));
        return jsonResponse({ ...metadata, issuer: 'https://auth.example.com/tenant/a' });
      }) as unknown as typeof fetch,
    });
    expect(urls[0]).toBe('https://auth.example.com/.well-known/oauth-authorization-server/tenant/a');
  });
});

describe('CIMD URL 校验', () => {
  it('接受 https 非根路径', () => {
    expect(validateClientMetadataDocumentUrl('https://client.example.com/oauth/client.json')).toBe(
      'https://client.example.com/oauth/client.json',
    );
  });

  it.each([
    ['http://client.example.com/client.json', /必须是 https/],
    ['https://client.example.com', /非根路径/],
    ['https://client.example.com/client.json?x=1', /不得包含 query/],
    ['https://client.example.com/client.json#frag', /不得包含 fragment/],
    ['https://user:pass@client.example.com/client.json', /不得包含 userinfo/],
    ['https://client.example.com/a/../client.json', /不得包含 \. 或 \.\./],
  ])('拒绝非法形状: %s', (url, pattern) => {
    expect(() => validateClientMetadataDocumentUrl(url)).toThrow(pattern);
  });

  it('本机 localhost 的 http 仅作为开发例外', () => {
    expect(validateClientMetadataDocumentUrl('http://localhost:8787/client.json')).toBe(
      'http://localhost:8787/client.json',
    );
  });
});

describe('客户端身份选择顺序', () => {
  it('预注册 client_id 优先于 CIMD 与 DCR', async () => {
    const result = await resolveClientRegistration({
      metadata,
      redirectUri: 'http://localhost:8765/callback',
      preRegisteredClientId: 'pre-registered',
      clientMetadataDocumentUrl: 'https://client.example.com/oauth/client.json',
    });
    expect(result.method).toBe('pre-registered');
    expect(result.clientId).toBe('pre-registered');
  });

  it('授权服务器声明 CIMD 支持时用文档 URL 作 client_id，且不发注册请求', async () => {
    const fetchImpl = vi.fn();
    const result = await resolveClientRegistration({
      metadata,
      redirectUri: 'http://localhost:8765/callback',
      clientMetadataDocumentUrl: 'https://client.example.com/oauth/client.json',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({
      method: 'cimd',
      clientId: 'https://client.example.com/oauth/client.json',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('没有预注册/CIMD 时走 DCR，application_type=native', async () => {
    let body: Record<string, unknown> | undefined;
    const result = await resolveClientRegistration({
      metadata,
      redirectUri: 'http://localhost:8765/callback',
      clientName: 'IHUI Test',
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ client_id: 'dcr-client', client_secret: 'dcr-secret' });
      }) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ method: 'dcr', clientId: 'dcr-client', clientSecret: 'dcr-secret' });
    expect(body).toMatchObject({
      client_name: 'IHUI Test',
      redirect_uris: ['http://localhost:8765/callback'],
      application_type: 'native',
      token_endpoint_auth_method: 'none',
    });
  });

  it('既没有 clientId/CIMD 也没有 registration_endpoint ⇒ 明确报错，不硬造 client_id', async () => {
    await expect(
      resolveClientRegistration({
        metadata: { ...metadata, registration_endpoint: undefined },
        redirectUri: 'http://localhost:8765/callback',
      }),
    ).rejects.toThrow(/没有可用的客户端身份/);
  });
});
