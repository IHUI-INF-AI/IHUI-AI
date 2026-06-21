import { describe, it, expect, beforeEach, vi } from 'vitest'
import { requestSignatureService, initRequestSignature, getRequestSignatureHeaders } from '../requestSignature'

describe('requestSignatureService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('init', () => {
    it('应该正确初始化配置', () => {
      initRequestSignature({
        secretKey: 'test-secret-key',
        appId: 'test-app',
        expireSeconds: 300,
      })

      expect(requestSignatureService.isEnabled()).toBe(true)
    })
  })

  describe('generateNonce', () => {
    it('应该生成32位十六进制字符串', () => {
      const nonce = requestSignatureService.generateNonce()
      expect(nonce).toHaveLength(32)
      expect(/^[0-9a-f]+$/.test(nonce)).toBe(true)
    })

    it('应该生成不同的nonce', () => {
      const nonce1 = requestSignatureService.generateNonce()
      const nonce2 = requestSignatureService.generateNonce()
      expect(nonce1).not.toBe(nonce2)
    })
  })

  describe('generateSignature', () => {
    beforeEach(() => {
      initRequestSignature({
        secretKey: 'test-secret-key',
        appId: 'test-app',
      })
    })

    it('应该生成有效的签名数据', () => {
      const signature = requestSignatureService.generateSignature('GET', '/api/test')

      expect(signature).not.toBeNull()
      expect(signature?.timestamp).toBeGreaterThan(0)
      expect(signature?.nonce).toHaveLength(32)
      expect(signature?.signature).toHaveLength(64)
      expect(signature?.appId).toBe('test-app')
    })

    it('应该对相同输入生成相同的签名（相同nonce）', () => {
      const timestamp = Date.now()
      const nonce = requestSignatureService.generateNonce()
      const sig1 = requestSignatureService.generateSignature('GET', '/api/test', undefined, timestamp)
      const sig2 = requestSignatureService.generateSignature('GET', '/api/test', undefined, timestamp)

      expect(sig1?.timestamp).toBe(sig2?.timestamp)
      expect(sig1?.signature).toBeDefined()
      expect(sig2?.signature).toBeDefined()
    })

    it('应该对不同方法生成不同签名', () => {
      const timestamp = Date.now()
      const sig1 = requestSignatureService.generateSignature('GET', '/api/test', undefined, timestamp)
      const sig2 = requestSignatureService.generateSignature('POST', '/api/test', undefined, timestamp)

      expect(sig1?.signature).not.toBe(sig2?.signature)
    })

    it('应该对有body的请求生成不同签名', () => {
      const timestamp = Date.now()
      const sig1 = requestSignatureService.generateSignature('POST', '/api/test', { data: 'test' }, timestamp)
      const sig2 = requestSignatureService.generateSignature('POST', '/api/test', undefined, timestamp)

      expect(sig1?.signature).not.toBe(sig2?.signature)
    })
  })

  describe('getHeaders', () => {
    beforeEach(() => {
      initRequestSignature({
        secretKey: 'test-secret-key',
        appId: 'test-app',
      })
    })

    it('应该返回正确的请求头', () => {
      const headers = requestSignatureService.getHeaders('GET', '/api/test')

      expect(headers['X-Signature-Timestamp']).toBeDefined()
      expect(headers['X-Signature-Nonce']).toBeDefined()
      expect(headers['X-Signature']).toBeDefined()
      expect(headers['X-App-Id']).toBe('test-app')
    })
  })

  describe('verifySignature', () => {
    beforeEach(() => {
      initRequestSignature({
        secretKey: 'test-secret-key',
        expireSeconds: 300,
      })
    })

    it('应该验证有效的签名', () => {
      const signature = requestSignatureService.generateSignature('GET', '/api/test')
      if (!signature) {
        expect.fail('签名生成失败')
        return
      }

      const result = requestSignatureService.verifySignature(
        'GET',
        '/api/test',
        signature.timestamp,
        signature.nonce,
        signature.signature
      )

      expect(result.valid).toBe(true)
    })

    it('应该拒绝过期的签名', () => {
      const oldTimestamp = Date.now() - 600000
      const signature = requestSignatureService.generateSignature('GET', '/api/test', undefined, oldTimestamp)
      if (!signature) {
        expect.fail('签名生成失败')
        return
      }

      const result = requestSignatureService.verifySignature(
        'GET',
        '/api/test',
        signature.timestamp,
        signature.nonce,
        signature.signature
      )

      expect(result.valid).toBe(false)
      expect(result.error).toContain('过期')
    })

    it('应该拒绝重复的nonce', () => {
      const signature = requestSignatureService.generateSignature('GET', '/api/test')
      if (!signature) {
        expect.fail('签名生成失败')
        return
      }

      requestSignatureService.verifySignature(
        'GET',
        '/api/test',
        signature.timestamp,
        signature.nonce,
        signature.signature
      )

      const result = requestSignatureService.verifySignature(
        'GET',
        '/api/test',
        signature.timestamp,
        signature.nonce,
        signature.signature
      )

      expect(result.valid).toBe(false)
      expect(result.error).toContain('重复')
    })

    it('应该拒绝错误的签名', () => {
      const signature = requestSignatureService.generateSignature('GET', '/api/test')
      if (!signature) {
        expect.fail('签名生成失败')
        return
      }

      const result = requestSignatureService.verifySignature(
        'GET',
        '/api/test',
        signature.timestamp,
        signature.nonce,
        'invalid-signature'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toContain('失败')
    })
  })

  describe('isEnabled', () => {
    it('未初始化时应该返回false', () => {
      const service = new (requestSignatureService.constructor as new () => typeof requestSignatureService)()
      expect(service.isEnabled()).toBe(false)
    })

    it('初始化后应该返回true', () => {
      initRequestSignature({ secretKey: 'test-key' })
      expect(requestSignatureService.isEnabled()).toBe(true)
    })
  })

  describe('getRequestSignatureHeaders', () => {
    it('应该返回与getHeaders相同的结果', () => {
      initRequestSignature({ secretKey: 'test-key' })
      const headers = getRequestSignatureHeaders('GET', '/api/test')
      expect(headers['X-Signature-Timestamp']).toBeDefined()
      expect(headers['X-Signature-Nonce']).toBeDefined()
      expect(headers['X-Signature']).toBeDefined()
    })
  })
})
