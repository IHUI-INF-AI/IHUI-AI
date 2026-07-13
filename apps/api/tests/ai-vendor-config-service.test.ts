/**
 * 厂商配置服务单元测试（R4 重构产物）。
 *
 * 重点验证：
 * - FALLBACK_VENDORS 包含全部 11 个原 VENDORS 中的厂商
 * - getVendorCredentials 严格按环境变量名读取
 * - 缺失环境变量时返回 undefined 而非抛错（由 caller service 走 503 流程）
 * - 特殊厂商（JIMENG4/N8N/TENCENT/VOLCENGINE）的双凭据或特殊字段正确解析
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// mock config 必须在 import service 之前（service 链式加载 config → db → 校验环境变量）
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

const { FALLBACK_VENDORS, getVendorCredentials } =
  await import('../src/services/ai-vendor-config-service.js')

describe('FALLBACK_VENDORS', () => {
  it('包含 11 个原 ai-vendors.ts 中的厂商', () => {
    const expected = [
      'dashscope',
      'doubao',
      'gemini',
      'suno',
      'sora2',
      'coze',
      'bailian',
      'jimeng4',
      'n8n',
      'tencent',
      'volcengine',
    ]
    for (const code of expected) {
      expect(FALLBACK_VENDORS[code]).toBeDefined()
      expect(FALLBACK_VENDORS[code].vendorCode).toBe(code)
    }
  })

  it('所有 fallback 厂商默认启用', () => {
    for (const v of Object.values(FALLBACK_VENDORS)) {
      expect(v.isEnabled).toBe(true)
    }
  })

  it('鉴权类型与厂商对应正确', () => {
    expect(FALLBACK_VENDORS.dashscope.authType).toBe('bearer')
    expect(FALLBACK_VENDORS.tencent.authType).toBe('tencent_tc3')
    expect(FALLBACK_VENDORS.volcengine.authType).toBe('volcengine_v4')
    expect(FALLBACK_VENDORS.jimeng4.authType).toBe('volcengine_v4')
  })

  it('双凭据厂商包含 secretKeyEnvName', () => {
    expect(FALLBACK_VENDORS.tencent.secretKeyEnvName).toBe('TENCENT_SECRET_KEY')
    expect(FALLBACK_VENDORS.volcengine.secretKeyEnvName).toBe('VOLCENGINE_SECRET_KEY')
    expect(FALLBACK_VENDORS.jimeng4.secretKeyEnvName).toBe('JIMENG4_SECRET_KEY')
  })

  it('单凭据厂商无 secretKeyEnvName', () => {
    expect(FALLBACK_VENDORS.dashscope.secretKeyEnvName).toBeUndefined()
    expect(FALLBACK_VENDORS.gemini.secretKeyEnvName).toBeUndefined()
  })
})

describe('getVendorCredentials', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // 清理本次测试关心的环境变量
    delete process.env.TEST_KEY
    delete process.env.TEST_SECRET
  })

  afterEach(() => {
    // 恢复
    process.env = { ...originalEnv }
  })

  it('key 存在时返回 { key }', () => {
    process.env.TEST_KEY = 'sk-test-123'
    const result = getVendorCredentials({ keyEnvName: 'TEST_KEY' })
    expect(result).toEqual({ key: 'sk-test-123' })
  })

  it('key 缺失时 key 字段为 undefined（不抛错）', () => {
    const result = getVendorCredentials({ keyEnvName: 'TEST_KEY' })
    expect(result).toEqual({})
    expect(result.key).toBeUndefined()
  })

  it('key + secret 同时存在时返回完整凭据', () => {
    process.env.TEST_KEY = 'ak'
    process.env.TEST_SECRET = 'sk'
    const result = getVendorCredentials({
      keyEnvName: 'TEST_KEY',
      secretKeyEnvName: 'TEST_SECRET',
    })
    expect(result).toEqual({ key: 'ak', secret: 'sk' })
  })

  it('vendor 未声明 keyEnvName 时返回空对象', () => {
    const result = getVendorCredentials({})
    expect(result).toEqual({})
  })

  it('只声明 secretKeyEnvName 时不读取 key，但会读取 secret（业务规则：secret 可独立）', () => {
    process.env.TEST_SECRET = 'sk'
    const result = getVendorCredentials({ secretKeyEnvName: 'TEST_SECRET' })
    // key 字段不存在（keyEnvName 未声明，不读取）
    expect(result.key).toBeUndefined()
    // secret 字段存在（secretKeyEnvName 已声明，正常读取）
    expect(result.secret).toBe('sk')
  })
})
