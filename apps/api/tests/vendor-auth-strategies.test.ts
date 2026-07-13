/**
 * 鉴权策略单元测试（R4 重构产物）。
 *
 * 重点验证：
 * - BearerAuthStrategy: 标准 Authorization / x-goog-api-key / X-N8N-API-KEY 三种 header 变体
 * - TencentTc3AuthStrategy: TC3-HMAC-SHA256 签名符合腾讯云规范（不变量：headers 包含 X-TC-Action/Timestamp/Region/Version/Authorization）
 * - VolcengineV4AuthStrategy: V4 签名包含 X-Date/X-Content-Sha256/Authorization
 * - AuthStrategyFactory: register/get/has 行为
 *
 * 不变量测试优先于字节级测试 — 完整 RFC 合规性由后续集成测试覆盖，
 * 单元测试确保签名在代码变更后不会意外引入空 header 或缺失字段。
 */
import { describe, it, expect, vi } from 'vitest'
import type { AuthStrategy } from '../src/services/vendor-auth-strategies.js'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

const {
  BearerAuthStrategy,
  TencentTc3AuthStrategy,
  VolcengineV4AuthStrategy,
  AuthStrategyFactory,
  authStrategyFactory,
} = await import('../src/services/vendor-auth-strategies.js')

describe('BearerAuthStrategy', () => {
  const strategy = new BearerAuthStrategy()

  it('使用标准 Authorization Bearer header', () => {
    const result = strategy.buildHeaders({ key: 'sk-test' }, { method: 'POST', url: '/v1/chat' })
    expect(result.headers.Authorization).toBe('Bearer sk-test')
  })

  it('Gemini 使用 x-goog-api-key header', () => {
    const result = strategy.buildHeaders(
      { key: 'gemini-key' },
      { method: 'POST', url: '/v1beta/models', config: { headerName: 'x-goog-api-key' } },
    )
    expect(result.headers['x-goog-api-key']).toBe('gemini-key')
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('N8N 使用 X-N8N-API-KEY header', () => {
    const result = strategy.buildHeaders(
      { key: 'n8n-key' },
      { method: 'POST', url: '/workflow', config: { headerName: 'X-N8N-API-KEY' } },
    )
    expect(result.headers['X-N8N-API-KEY']).toBe('n8n-key')
  })

  it('凭据缺失时抛错', () => {
    expect(() => strategy.buildHeaders({}, { method: 'POST', url: '/v1/chat' })).toThrow(
      'API Key is required',
    )
  })

  it('validateCredentials 仅检查 key', () => {
    expect(strategy.validateCredentials({ key: 'k' })).toBe(true)
    expect(strategy.validateCredentials({ key: 'k', secret: 's' })).toBe(true)
    expect(strategy.validateCredentials({})).toBe(false)
  })

  it('authType 为 bearer', () => {
    expect(strategy.authType).toBe('bearer')
  })
})

describe('TencentTc3AuthStrategy', () => {
  const strategy = new TencentTc3AuthStrategy()

  it('凭据不完整时抛错', () => {
    expect(() =>
      strategy.buildHeaders({ key: 'sid' }, { method: 'POST', url: '/ai3d', body: {} }),
    ).toThrow('Secret ID and Secret Key are required')
  })

  it('生成完整 TC3 签名 headers（含五个必备字段）', () => {
    const result = strategy.buildHeaders(
      { key: 'AKIDTest', secret: 'TestSecretKey' },
      {
        method: 'POST',
        url: '/ai3d',
        body: { Prompt: 'a cat' },
        config: { action: 'Submit3DJob' },
      },
    )
    expect(result.headers).toHaveProperty('X-TC-Action', 'Submit3DJob')
    expect(result.headers).toHaveProperty('X-TC-Version', '2025-05-13')
    expect(result.headers).toHaveProperty('X-TC-Region', 'ap-guangzhou')
    expect(result.headers).toHaveProperty('X-TC-Timestamp')
    expect(result.headers).toHaveProperty('Authorization')
    expect(result.headers.Authorization).toMatch(/^TC3-HMAC-SHA256 Credential=AKIDTest\//)
    expect(result.headers.Authorization).toMatch(/SignedHeaders=content-type;host;x-tc-action/)
    expect(result.headers.Authorization).toMatch(/Signature=[a-f0-9]{64}$/)
    expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')
  })

  it('从 URL 末段推断 action（无显式 config）', () => {
    const result = strategy.buildHeaders(
      { key: 'AKID', secret: 'SECRET' },
      { method: 'POST', url: '/Query3DJob', body: {} },
    )
    expect(result.headers['X-TC-Action']).toBe('QUERY3DJOB')
  })

  it('config.region 覆盖默认 region', () => {
    const result = strategy.buildHeaders(
      { key: 'AKID', secret: 'SECRET' },
      { method: 'POST', url: '/ai3d', body: {}, config: { region: 'ap-shanghai' } },
    )
    expect(result.headers['X-TC-Region']).toBe('ap-shanghai')
  })

  it('validateCredentials 同时检查 key 和 secret', () => {
    expect(strategy.validateCredentials({ key: 'k', secret: 's' })).toBe(true)
    expect(strategy.validateCredentials({ key: 'k' })).toBe(false)
    expect(strategy.validateCredentials({ secret: 's' })).toBe(false)
  })

  it('authType 为 tencent_tc3', () => {
    expect(strategy.authType).toBe('tencent_tc3')
  })
})

describe('VolcengineV4AuthStrategy', () => {
  const strategy = new VolcengineV4AuthStrategy()

  it('凭据不完整时抛错', () => {
    expect(() =>
      strategy.buildHeaders({ key: 'ak' }, { method: 'POST', url: '/', body: {} }),
    ).toThrow('Access Key and Secret Key are required')
  })

  it('生成完整 V4 签名 headers 和 url', () => {
    const result = strategy.buildHeaders(
      { key: 'AKTest', secret: 'SKTest' },
      {
        method: 'POST',
        url: '/',
        body: { req_key: 'test' },
        queryParams: { Action: 'CVProcess', Version: '2022-08-31' },
      },
    )
    expect(result.headers).toHaveProperty('X-Date')
    expect(result.headers).toHaveProperty('X-Content-Sha256')
    expect(result.headers).toHaveProperty('Authorization')
    expect(result.headers.Authorization).toMatch(/^HMAC-SHA256 Credential=AKTest\//)
    expect(result.headers.Authorization).toMatch(
      /SignedHeaders=content-type;host;x-content-sha256;x-date/,
    )
    expect(result.headers.Authorization).toMatch(/Signature=[a-f0-9]{64}$/)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.url).toContain('Action=CVProcess')
    expect(result.url).toContain('Version=2022-08-31')
  })

  it('queryParams 按字典序排序', () => {
    const result = strategy.buildHeaders(
      { key: 'AK', secret: 'SK' },
      { method: 'POST', url: '/', body: {}, queryParams: { Zebra: 'z', Alpha: 'a' } },
    )
    // Alpha 必须在 Zebra 之前
    expect(result.url).toMatch(/Alpha=a.*Zebra=z/)
  })

  it('config.region 覆盖默认 cn-north-1', () => {
    const result = strategy.buildHeaders(
      { key: 'AK', secret: 'SK' },
      { method: 'POST', url: '/', body: {}, config: { region: 'ap-southeast-1' } },
    )
    expect(result.headers.Authorization).toContain('ap-southeast-1')
  })

  it('validateCredentials 同时检查 key 和 secret', () => {
    expect(strategy.validateCredentials({ key: 'k', secret: 's' })).toBe(true)
    expect(strategy.validateCredentials({ key: 'k' })).toBe(false)
  })

  it('authType 为 volcengine_v4', () => {
    expect(strategy.authType).toBe('volcengine_v4')
  })
})

describe('AuthStrategyFactory', () => {
  it('默认注册三种策略', () => {
    const factory = new AuthStrategyFactory()
    expect(factory.hasStrategy('bearer')).toBe(true)
    expect(factory.hasStrategy('tencent_tc3')).toBe(true)
    expect(factory.hasStrategy('volcengine_v4')).toBe(true)
  })

  it('getStrategy 返回正确实例', () => {
    const factory = new AuthStrategyFactory()
    expect(factory.getStrategy('bearer').authType).toBe('bearer')
    expect(factory.getStrategy('tencent_tc3').authType).toBe('tencent_tc3')
  })

  it('未知 authType 抛错', () => {
    const factory = new AuthStrategyFactory()
    expect(() => factory.getStrategy('unknown')).toThrow('Unsupported auth type')
  })

  it('支持自定义注册', () => {
    const factory = new AuthStrategyFactory()
    const custom: AuthStrategy = {
      authType: 'custom',
      buildHeaders: () => ({ headers: {} }),
      validateCredentials: () => true,
    }
    factory.registerStrategy(custom)
    expect(factory.getStrategy('custom').authType).toBe('custom')
  })

  it('全局单例 authStrategyFactory 已预注册', () => {
    expect(authStrategyFactory.hasStrategy('bearer')).toBe(true)
    expect(authStrategyFactory.hasStrategy('tencent_tc3')).toBe(true)
    expect(authStrategyFactory.hasStrategy('volcengine_v4')).toBe(true)
  })
})
