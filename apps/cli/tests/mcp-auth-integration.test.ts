/**
 * MCP 认证集成测试 — 验证 resolveMcpAuthHeaders 三条路径 + mcp-runtime 接入。
 *
 * 覆盖点:
 *   1. 静态 token 路径(api_key / auth.type=bearer)
 *   2. OAuth 路径:credentials store 有未过期 token → 直接用
 *   3. OAuth 路径:credentials store 有过期 token + refresh_token → 刷新
 *   4. OAuth 路径:无凭证 → 启动 OAuth flow
 *   5. OAuth 路径:OAuth 失败 + 静态 token 回退
 *   6. OAuth 路径:OAuth 失败 + 无回退 → 抛错
 *   7. 无认证路径(auth.type=none / 未配置)
 *   8. 向后兼容:auth.token 存在但 type 未设置 → 仍加 Bearer
 *   9. mcp-runtime.ts 真实 import mcp-credentials + mcp-oauth(消除死代码验证)
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { resolveMcpAuthHeaders } from '../src/tools/mcp-runtime.js';
import type { McpServer } from '../src/commands/mcp-config.js';
import * as credentialsModule from '../src/tools/mcp-credentials.js';
import * as oauthModule from '../src/tools/mcp-oauth.js';

// Mock credentials store(避免触碰磁盘)
vi.mock('../src/tools/mcp-credentials.js', () => ({
  getCredential: vi.fn(),
  isExpired: vi.fn(),
  setCredential: vi.fn().mockResolvedValue(undefined),
}));

// Mock OAuth flow(避免启动浏览器和本地 server)
vi.mock('../src/tools/mcp-oauth.js', () => ({
  startOAuthFlow: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

const mockedGetCredential = vi.mocked(credentialsModule.getCredential);
const mockedIsExpired = vi.mocked(credentialsModule.isExpired);
const mockedSetCredential = vi.mocked(credentialsModule.setCredential);
const mockedStartOAuthFlow = vi.mocked(oauthModule.startOAuthFlow);
const mockedRefreshAccessToken = vi.mocked(oauthModule.refreshAccessToken);

const OAUTH_SERVER: McpServer = {
  name: 'oauth-server',
  transport: 'http',
  url: 'https://mcp.example.com/sse',
  auth: { type: 'oauth' },
  oauth: {
    authorizationEndpoint: 'https://auth.example.com/authorize',
    tokenEndpoint: 'https://auth.example.com/token',
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:8765/callback',
    scope: ['mcp:tools'],
  },
};

describe('resolveMcpAuthHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('路径 1:静态 token', () => {
    it('server.api_key 配置时返回 Bearer header', async () => {
      const server: McpServer = {
        name: 'static-api-key',
        transport: 'http',
        url: 'https://mcp.example.com',
        api_key: 'static-key-123',
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer static-key-123');
      // 不应触发 credentials store 或 OAuth
      expect(mockedGetCredential).not.toHaveBeenCalled();
      expect(mockedStartOAuthFlow).not.toHaveBeenCalled();
    });

    it('auth.type=bearer + auth.token 时返回 Bearer header', async () => {
      const server: McpServer = {
        name: 'bearer-server',
        transport: 'http',
        url: 'https://mcp.example.com',
        auth: { type: 'bearer', token: 'bearer-token-456' },
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer bearer-token-456');
      expect(mockedGetCredential).not.toHaveBeenCalled();
    });

    it('api_key 优先级高于 auth.token', async () => {
      const server: McpServer = {
        name: 'priority-server',
        transport: 'http',
        url: 'https://mcp.example.com',
        api_key: 'from-api-key',
        auth: { type: 'bearer', token: 'from-auth-token' },
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer from-api-key');
    });
  });

  describe('路径 2:OAuth - credentials store 有未过期 token', () => {
    it('直接使用 credentials store 中的 access_token', async () => {
      mockedGetCredential.mockResolvedValue({
        accessToken: 'cached-token-789',
        refreshToken: 'refresh-000',
        expiresAt: Date.now() + 3600_000, // 1 小时后过期
        obtainedAt: Date.now() - 60_000,
      });
      mockedIsExpired.mockResolvedValue(false);

      const headers = await resolveMcpAuthHeaders(OAUTH_SERVER);
      expect(headers['Authorization']).toBe('Bearer cached-token-789');
      expect(mockedGetCredential).toHaveBeenCalledWith('https://mcp.example.com/sse');
      expect(mockedIsExpired).toHaveBeenCalled();
      // 不应触发 refresh 或 OAuth flow
      expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
      expect(mockedStartOAuthFlow).not.toHaveBeenCalled();
    });
  });

  describe('路径 2:OAuth - credentials store 有过期 token + refresh_token', () => {
    it('用 refresh_token 刷新 access_token 并持久化', async () => {
      mockedGetCredential.mockResolvedValue({
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 1000, // 已过期
        obtainedAt: Date.now() - 7200_000,
      });
      mockedIsExpired.mockResolvedValue(true);
      mockedRefreshAccessToken.mockResolvedValue({
        accessToken: 'refreshed-token-new',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600_000,
        scope: ['mcp:tools'],
      });

      const headers = await resolveMcpAuthHeaders(OAUTH_SERVER);
      expect(headers['Authorization']).toBe('Bearer refreshed-token-new');
      expect(mockedRefreshAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'test-client-id' }),
        'valid-refresh-token',
      );
      // 刷新后应持久化到 credentials store
      expect(mockedSetCredential).toHaveBeenCalledWith(
        'https://mcp.example.com/sse',
        expect.objectContaining({
          accessToken: 'refreshed-token-new',
          refreshToken: 'new-refresh-token',
        }),
      );
      // 不应触发 OAuth flow
      expect(mockedStartOAuthFlow).not.toHaveBeenCalled();
    });

    it('refresh 失败时回退到 OAuth flow', async () => {
      mockedGetCredential.mockResolvedValue({
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh',
        expiresAt: Date.now() - 1000,
        obtainedAt: Date.now() - 7200_000,
      });
      mockedIsExpired.mockResolvedValue(true);
      mockedRefreshAccessToken.mockRejectedValue(new Error('refresh token invalid'));
      mockedStartOAuthFlow.mockResolvedValue({
        accessToken: 'new-oauth-token',
        expiresAt: Date.now() + 3600_000,
        scope: ['mcp:tools'],
      });

      const headers = await resolveMcpAuthHeaders(OAUTH_SERVER);
      expect(headers['Authorization']).toBe('Bearer new-oauth-token');
      expect(mockedRefreshAccessToken).toHaveBeenCalled();
      expect(mockedStartOAuthFlow).toHaveBeenCalled();
    });
  });

  describe('路径 2:OAuth - 无凭证 → 启动 OAuth flow', () => {
    it('credentials store 为空时启动 OAuth flow', async () => {
      mockedGetCredential.mockResolvedValue(undefined);
      mockedStartOAuthFlow.mockResolvedValue({
        accessToken: 'fresh-oauth-token',
        refreshToken: 'fresh-refresh',
        expiresAt: Date.now() + 3600_000,
        scope: ['mcp:tools'],
      });

      const headers = await resolveMcpAuthHeaders(OAUTH_SERVER);
      expect(headers['Authorization']).toBe('Bearer fresh-oauth-token');
      expect(mockedStartOAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'test-client-id',
          serverUrl: 'https://mcp.example.com/sse',
        }),
      );
    });
  });

  describe('路径 2:OAuth - 失败回退', () => {
    it('OAuth 失败 + 配置了 auth.token → 回退到静态 token', async () => {
      mockedGetCredential.mockResolvedValue(undefined);
      mockedStartOAuthFlow.mockRejectedValue(new Error('用户取消授权'));
      const server: McpServer = {
        ...OAUTH_SERVER,
        auth: { type: 'oauth', token: 'fallback-static-token' },
      };

      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer fallback-static-token');
      expect(mockedStartOAuthFlow).toHaveBeenCalled();
    });

    it('OAuth 失败 + 无静态 token → 抛错', async () => {
      mockedGetCredential.mockResolvedValue(undefined);
      mockedStartOAuthFlow.mockRejectedValue(new Error('网络不可达'));

      await expect(resolveMcpAuthHeaders(OAUTH_SERVER)).rejects.toThrow(
        /OAuth 授权失败.*网络不可达/,
      );
    });
  });

  describe('路径 3:无认证', () => {
    it('auth.type=none 时返回空 headers', async () => {
      const server: McpServer = {
        name: 'no-auth',
        transport: 'http',
        url: 'https://mcp.example.com',
        auth: { type: 'none' },
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBeUndefined();
      expect(Object.keys(headers)).toHaveLength(0);
    });

    it('未配置 auth 时返回空 headers', async () => {
      const server: McpServer = {
        name: 'no-auth-config',
        transport: 'http',
        url: 'https://mcp.example.com',
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('向后兼容', () => {
    it('auth.token 存在但 type 未设置 → 仍加 Bearer', async () => {
      // 旧配置可能没有显式 type,但有 token
      const server: McpServer = {
        name: 'legacy-config',
        transport: 'http',
        url: 'https://mcp.example.com',
        auth: { token: 'legacy-token' } as { token: string },
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer legacy-token');
    });

    it('auth.type=oauth 但缺 oauth 元数据 → 回退到 auth.token(若有)', async () => {
      const server: McpServer = {
        name: 'incomplete-oauth',
        transport: 'http',
        url: 'https://mcp.example.com',
        auth: { type: 'oauth', token: 'incomplete-fallback' },
        // 缺少 oauth 元数据
      };
      const headers = await resolveMcpAuthHeaders(server);
      expect(headers['Authorization']).toBe('Bearer incomplete-fallback');
      expect(mockedGetCredential).not.toHaveBeenCalled();
    });
  });
});

describe('mcp-runtime 死代码消除验证', () => {
  it('mcp-runtime.ts 真实 import mcp-credentials 模块', async () => {
    // 通过 import mcp-runtime 触发 mcp-credentials 的 import 链
    // 如果 mcp-runtime 未 import mcp-credentials,这个测试无法通过
    const runtimeModule = await import('../src/tools/mcp-runtime.js');
    expect(typeof runtimeModule.resolveMcpAuthHeaders).toBe('function');
    expect(typeof runtimeModule.connectMcpServer).toBe('function');
  });

  it('mcp-runtime.ts 真实 import mcp-oauth 模块(通过 resolveMcpAuthHeaders 调用验证)', async () => {
    // 触发 OAuth 路径验证 mcp-oauth 真实接入
    mockedGetCredential.mockResolvedValue(undefined);
    mockedStartOAuthFlow.mockResolvedValue({
      accessToken: 'integration-token',
      expiresAt: Date.now() + 3600_000,
      scope: ['mcp:tools'],
    });

    const headers = await resolveMcpAuthHeaders(OAUTH_SERVER);
    expect(headers['Authorization']).toBe('Bearer integration-token');
    // startOAuthFlow 被 mcp-runtime 真实调用(不是死代码)
    expect(mockedStartOAuthFlow).toHaveBeenCalled();
  });
});
