/**
 * 厂商错误处理单元测试（R4 重构产物）。
 *
 * 验证：所有错误响应统一使用 utils/response.error() 工厂函数，
 * statusCode 与 message 格式与重构前的 ai-vendors.ts 保持一致（不破坏既有调用方期望）。
 */
import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'

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

const { VendorErrorHandler } = await import('../src/services/vendor-error-handler.js')

function makeReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply
}

describe('VendorErrorHandler.handleConfigError', () => {
  it('返回 503 + 包含厂商编码和消息', () => {
    const reply = makeReply()
    VendorErrorHandler.handleConfigError(reply, 'dashscope', '环境变量 DASHSCOPE_API_KEY 未配置')
    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 503,
        message: expect.stringContaining('dashscope') && expect.stringContaining('未配置'),
      }),
    )
  })
})

describe('VendorErrorHandler.handleApiError', () => {
  it('返回 502 + 截断到 500 字符', () => {
    const reply = makeReply()
    const longPayload = { error: 'x'.repeat(1000) }
    VendorErrorHandler.handleApiError(reply, 'Tencent(腾讯混元/ARC)', 401, longPayload)
    expect(reply.status).toHaveBeenCalledWith(502)
    const sentMessage = reply.send.mock.calls[0][0].message
    // 截断到 500 字符内
    expect(sentMessage.length).toBeLessThan(1000)
    expect(sentMessage).toContain('Tencent(腾讯混元/ARC)')
    expect(sentMessage).toContain('401')
  })
})

describe('VendorErrorHandler.handleNetworkError', () => {
  it('AbortError 报"请求超时"', () => {
    const reply = makeReply()
    const err = new Error('aborted')
    err.name = 'AbortError'
    VendorErrorHandler.handleNetworkError(reply, 'Dashscope', err)
    const sentMessage = reply.send.mock.calls[0][0].message
    expect(reply.status).toHaveBeenCalledWith(502)
    expect(sentMessage).toContain('请求超时')
  })

  it('其他错误使用 err.message', () => {
    const reply = makeReply()
    VendorErrorHandler.handleNetworkError(reply, 'Volcengine', new Error('ECONNREFUSED'))
    const sentMessage = reply.send.mock.calls[0][0].message
    expect(sentMessage).toContain('ECONNREFUSED')
    expect(sentMessage).not.toContain('请求超时')
  })
})

describe('VendorErrorHandler.validateCredentials', () => {
  it('key 缺失时返回 false 并 reply 503', () => {
    const reply = makeReply()
    const vendor = { vendorName: 'Dashscope', keyEnvName: 'DASHSCOPE_API_KEY' }
    const result = VendorErrorHandler.validateCredentials(reply, vendor, {})
    expect(result).toBe(false)
    expect(reply.status).toHaveBeenCalledWith(503)
    expect(reply.send.mock.calls[0][0].message).toContain('DASHSCOPE_API_KEY')
  })

  it('secret 缺失时返回 false 并 reply 503', () => {
    const reply = makeReply()
    const vendor = {
      vendorName: 'Tencent',
      keyEnvName: 'TENCENT_SECRET_ID',
      secretKeyEnvName: 'TENCENT_SECRET_KEY',
    }
    const result = VendorErrorHandler.validateCredentials(reply, vendor, { key: 'sid' })
    expect(result).toBe(false)
    expect(reply.send.mock.calls[0][0].message).toContain('TENCENT_SECRET_KEY')
  })

  it('凭据完整时返回 true 不发响应', () => {
    const reply = makeReply()
    const vendor = {
      vendorName: 'Tencent',
      keyEnvName: 'TENCENT_SECRET_ID',
      secretKeyEnvName: 'TENCENT_SECRET_KEY',
    }
    const result = VendorErrorHandler.validateCredentials(reply, vendor, {
      key: 'sid',
      secret: 'sk',
    })
    expect(result).toBe(true)
    expect(reply.status).not.toHaveBeenCalled()
  })

  it('vendor 未声明 secretKeyEnvName 时不校验 secret', () => {
    const reply = makeReply()
    const vendor = { vendorName: 'Dashscope', keyEnvName: 'DASHSCOPE_API_KEY' }
    const result = VendorErrorHandler.validateCredentials(reply, vendor, { key: 'sk' })
    expect(result).toBe(true)
  })
})
