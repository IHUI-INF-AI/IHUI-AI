// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 配置验证：三种新授权路径不能只改类型不校验字段。
 * 钉住 discovery 的“端点可省”、EMA 六件套、Client Credentials 两件套。
 */
import { describe, expect, it } from 'vitest';
import { validateMcpConfig } from '../src/commands/mcp-config.js';

function server(extra: Record<string, unknown>) {
  return {
    mcpServers: {
      demo: { url: 'https://mcp.example.com/mcp', transport: 'http', ...extra },
    },
  };
}

describe('MCP auth config validation', () => {
  it('oauth + discovery 允许省略端点与 clientId', () => {
    const result = validateMcpConfig(
      server({
        auth: { type: 'oauth' },
        oauth: {
          redirectUri: 'http://localhost:8765/callback',
          scope: ['read'],
          discovery: { issuer: 'https://auth.example.com' },
        },
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('oauth 无 discovery 且端点缺失 ⇒ 拒绝', () => {
    const result = validateMcpConfig(
      server({
        auth: { type: 'oauth' },
        oauth: { redirectUri: 'http://localhost:8765/callback', scope: [] },
      }),
    );
    expect(result.errors[0]).toMatch(/authorizationEndpoint\/tokenEndpoint\/clientId|discovery/);
  });

  it('enterprise-managed 六件套缺一 ⇒ 拒绝', () => {
    const result = validateMcpConfig(
      server({
        auth: { type: 'enterprise-managed' },
        enterpriseManaged: {
          idpTokenEndpoint: 'https://idp.example.com/token',
          idpClientId: 'idp-client',
          identityAssertion: 'assertion',
          authorizationServerIssuer: 'https://auth.example.com',
        },
      }),
    );
    expect(result.errors[0]).toMatch(/enterpriseManaged/);
  });

  it('enterprise-managed 完整 ⇒ 通过', () => {
    const result = validateMcpConfig(
      server({
        auth: { type: 'enterprise-managed' },
        enterpriseManaged: {
          idpTokenEndpoint: 'https://idp.example.com/token',
          idpClientId: 'idp-client',
          identityAssertion: 'assertion',
          authorizationServerIssuer: 'https://auth.example.com',
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'mcp-client',
        },
      }),
    );
    expect(result.errors).toEqual([]);
  });

  it('oauth-client-credentials 缺 clientId ⇒ 拒绝；完整 ⇒ 通过', () => {
    const bad = validateMcpConfig(
      server({
        auth: { type: 'oauth-client-credentials' },
        oauthClientCredentials: { tokenEndpoint: 'https://auth.example.com/token' },
      }),
    );
    expect(bad.errors[0]).toMatch(/oauthClientCredentials/);

    const good = validateMcpConfig(
      server({
        auth: { type: 'oauth-client-credentials' },
        oauthClientCredentials: {
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'machine-client',
        },
      }),
    );
    expect(good.errors).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
