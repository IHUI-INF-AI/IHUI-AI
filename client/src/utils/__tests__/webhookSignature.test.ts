/**
 * P7-5 Webhook 签名工具单测
 */

import { describe, it, expect } from 'vitest'
import {
  signWebhookPayload,
  verifyWebhookSignature,
  generateWebhookMessageId,
  hmacSha256Hex,
  parseRetryAfterSeconds,
} from '../webhookSignature'

describe('P7-5 Webhook 签名工具', () => {
  describe('hmacSha256Hex', () => {
    it('应该生成稳定的 64 字符 hex 签名', async () => {
      const sig = await hmacSha256Hex('my-secret', 'hello')
      expect(sig).toMatch(/^[a-f0-9]{64}$/)
    })

    it('相同输入产出相同签名', async () => {
      const s1 = await hmacSha256Hex('k', 'msg')
      const s2 = await hmacSha256Hex('k', 'msg')
      expect(s1).toBe(s2)
    })

    it('不同密钥产出不同签名', async () => {
      const s1 = await hmacSha256Hex('k1', 'msg')
      const s2 = await hmacSha256Hex('k2', 'msg')
      expect(s1).not.toBe(s2)
    })

    it('不同消息产出不同签名', async () => {
      const s1 = await hmacSha256Hex('k', 'msg1')
      const s2 = await hmacSha256Hex('k', 'msg2')
      expect(s1).not.toBe(s2)
    })

    it('与 Node crypto 一致', async () => {
      // 已知测试向量：secret="key", message="The quick brown fox jumps over the lazy dog"
      // 期望: f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
      const sig = await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog')
      expect(sig).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
    })
  })

  describe('generateWebhookMessageId', () => {
    it('应该返回 UUID v4 格式', () => {
      const id = generateWebhookMessageId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('应该每次都不同', () => {
      const a = generateWebhookMessageId()
      const b = generateWebhookMessageId()
      expect(a).not.toBe(b)
    })
  })

  describe('signWebhookPayload', () => {
    it('应该返回 4 个必要 header', async () => {
      const headers = await signWebhookPayload({
        secret: 's',
        body: '{}',
        messageId: 'm-1',
        timestamp: 1700000000000,
      })
      expect(headers['X-Webhook-Id']).toBe('m-1')
      expect(headers['X-Webhook-Timestamp']).toBe('1700000000000')
      expect(headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/)
      expect(headers['X-Webhook-Signature-Algorithm']).toBe('HMAC-SHA256')
    })

    it('缺省 messageId 应该自动生成', async () => {
      const h1 = await signWebhookPayload({ secret: 's', body: '{}' })
      const h2 = await signWebhookPayload({ secret: 's', body: '{}' })
      expect(h1['X-Webhook-Id']).not.toBe(h2['X-Webhook-Id'])
    })

    it('缺省 timestamp 应该用当前时间', async () => {
      const before = Date.now()
      const headers = await signWebhookPayload({ secret: 's', body: '{}' })
      const after = Date.now()
      const ts = Number(headers['X-Webhook-Timestamp'])
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })
  })

  describe('verifyWebhookSignature', () => {
    const secret = 'shared-secret'
    const body = '{"event":"model.created","id":"m-1"}'
    let signed: Awaited<ReturnType<typeof signWebhookPayload>>

    it('合法签名应该通过校验', async () => {
      signed = await signWebhookPayload({ secret, body, messageId: 'm-1', timestamp: Date.now() })
      const result = await verifyWebhookSignature({
        secret,
        body,
        messageId: signed['X-Webhook-Id'],
        timestamp: signed['X-Webhook-Timestamp'],
        signature: signed['X-Webhook-Signature'],
      })
      expect(result.valid, JSON.stringify(result)).toBe(true)
    })

    it('篡改 body 应该校验失败', async () => {
      signed = await signWebhookPayload({ secret, body, messageId: 'm-1', timestamp: Date.now() })
      const result = await verifyWebhookSignature({
        secret,
        body: body + '!',
        messageId: signed['X-Webhook-Id'],
        timestamp: signed['X-Webhook-Timestamp'],
        signature: signed['X-Webhook-Signature'],
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_signature')
    })

    it('错误密钥应该校验失败', async () => {
      signed = await signWebhookPayload({ secret, body, messageId: 'm-1', timestamp: Date.now() })
      const result = await verifyWebhookSignature({
        secret: 'wrong-secret',
        body,
        messageId: signed['X-Webhook-Id'],
        timestamp: signed['X-Webhook-Timestamp'],
        signature: signed['X-Webhook-Signature'],
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_signature')
    })

    it('过期时间戳（> 5 分钟）应该拒绝', async () => {
      const oldTs = Date.now() - 6 * 60 * 1000
      signed = await signWebhookPayload({ secret, body, messageId: 'm-1', timestamp: oldTs })
      const result = await verifyWebhookSignature({
        secret,
        body,
        messageId: signed['X-Webhook-Id'],
        timestamp: signed['X-Webhook-Timestamp'],
        signature: signed['X-Webhook-Signature'],
        toleranceMs: 5 * 60 * 1000,
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('5 分钟内的时钟漂移应容忍', async () => {
      const nearTs = Date.now() - 4 * 60 * 1000
      signed = await signWebhookPayload({ secret, body, messageId: 'm-1', timestamp: nearTs })
      const result = await verifyWebhookSignature({
        secret,
        body,
        messageId: signed['X-Webhook-Id'],
        timestamp: signed['X-Webhook-Timestamp'],
        signature: signed['X-Webhook-Signature'],
      })
      expect(result.valid).toBe(true)
    })

    it('非数字时间戳应该拒绝', async () => {
      const result = await verifyWebhookSignature({
        secret,
        body,
        messageId: 'm-1',
        timestamp: 'not-a-number',
        signature: 'abc',
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('invalid_format')
    })
  })

  describe('parseRetryAfterSeconds', () => {
    it('数字字符串应该直接解析', () => {
      expect(parseRetryAfterSeconds('30')).toBe(30)
    })

    it('空值应该返回 null', () => {
      expect(parseRetryAfterSeconds(null)).toBeNull()
      expect(parseRetryAfterSeconds(undefined)).toBeNull()
      expect(parseRetryAfterSeconds('')).toBeNull()
    })

    it('非法值应该返回 null', () => {
      expect(parseRetryAfterSeconds('abc')).toBeNull()
    })

    it('HTTP-date 格式应该解析为秒数', () => {
      const future = new Date(Date.now() + 60_000)
      const result = parseRetryAfterSeconds(future.toUTCString())
      expect(result).not.toBeNull()
      expect(result!).toBeGreaterThan(50)
      expect(result!).toBeLessThanOrEqual(60)
    })

    it('过去的时间应该返回 0', () => {
      const past = new Date(Date.now() - 60_000)
      const result = parseRetryAfterSeconds(past.toUTCString())
      expect(result).toBe(0)
    })
  })

  describe('安全性', () => {
    it('签名包含 timestamp（防重放）', async () => {
      const headers = await signWebhookPayload({ secret: 's', body: '{}', timestamp: 1000 })
      expect(headers['X-Webhook-Timestamp']).toBe('1000')
    })

    it('签名包含 messageId（幂等去重）', async () => {
      const headers = await signWebhookPayload({ secret: 's', body: '{}', messageId: 'msg-123' })
      expect(headers['X-Webhook-Id']).toBe('msg-123')
    })

    it('相同 body 不同时间戳产出不同签名', async () => {
      const h1 = await signWebhookPayload({ secret: 's', body: '{}', timestamp: 1 })
      const h2 = await signWebhookPayload({ secret: 's', body: '{}', timestamp: 2 })
      expect(h1['X-Webhook-Signature']).not.toBe(h2['X-Webhook-Signature'])
    })
  })
})
