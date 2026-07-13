import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { generateKeyPairSync, createSign } from 'node:crypto'

vi.stubEnv('ALIPAY_APP_ID', '')
vi.stubEnv('ALIPAY_PRIVATE_KEY', '')
vi.stubEnv('ALIPAY_PUBLIC_KEY', '')
vi.stubEnv('ALIPAY_GATEWAY', 'https://openapi.alipay.com/gateway.do')
vi.stubEnv('NODE_ENV', 'test')

import { isAlipayConfigured, verifyNotify, buildSignedUrl } from '../src/services/alipay.js'

describe('alipay — 支付宝支付服务', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('ALIPAY_APP_ID', '')
    vi.stubEnv('ALIPAY_PRIVATE_KEY', '')
    vi.stubEnv('ALIPAY_PUBLIC_KEY', '')
    vi.stubEnv('NODE_ENV', 'test')
  })

  describe('isAlipayConfigured', () => {
    it('无任何配置返回 false', () => {
      expect(isAlipayConfigured()).toBe(false)
    })

    it('有 APP_ID 但无私钥返回 false', () => {
      vi.stubEnv('ALIPAY_APP_ID', '2021000')
      expect(isAlipayConfigured()).toBe(false)
    })

    it('有 APP_ID + 私钥返回 true', () => {
      vi.stubEnv('ALIPAY_APP_ID', '2021000')
      vi.stubEnv('ALIPAY_PRIVATE_KEY', 'mock-private-key')
      expect(isAlipayConfigured()).toBe(true)
    })

    it('有 APP_ID + 私钥路径返回 true', () => {
      vi.stubEnv('ALIPAY_APP_ID', '2021000')
      vi.stubEnv('ALIPAY_PRIVATE_KEY', '')
      vi.stubEnv('ALIPAY_PRIVATE_KEY_PATH', '/path/to/key.pem')
      expect(isAlipayConfigured()).toBe(true)
    })
  })

  describe('verifyNotify', () => {
    it('DEV 环境无公钥跳过验签返回 true', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(verifyNotify({ trade_no: '123' })).toBe(true)
    })

    it('test 环境无公钥跳过验签返回 true', () => {
      vi.stubEnv('NODE_ENV', 'test')
      expect(verifyNotify({ trade_no: '123' })).toBe(true)
    })

    it('生产环境无公钥返回 false', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(verifyNotify({ trade_no: '123' })).toBe(false)
    })

    it('有公钥但无 sign 字段返回 false', () => {
      vi.stubEnv('ALIPAY_PUBLIC_KEY', 'mock-pub')
      expect(verifyNotify({ trade_no: '123' })).toBe(false)
    })

    it('有公钥但 sign_type 非 RSA2 返回 false', () => {
      vi.stubEnv('ALIPAY_PUBLIC_KEY', 'mock-pub')
      expect(verifyNotify({ trade_no: '123', sign: 'abc', sign_type: 'RSA' })).toBe(false)
    })

    it('有公钥 + RSA2 + 有效签名返回 true', () => {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      })
      vi.stubEnv('ALIPAY_PUBLIC_KEY', publicKey.export({ type: 'spki', format: 'pem' }) as string)
      vi.stubEnv(
        'ALIPAY_PRIVATE_KEY',
        privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      )
      vi.stubEnv('ALIPAY_APP_ID', '2021000')

      const params: Record<string, string> = {
        trade_no: '202412340001',
        out_trade_no: 'ORD123',
        total_amount: '9.99',
        sign_type: 'RSA2',
      }
      // verifyNotify 验签时移除 sign/sign_type，签名内容只含剩余参数
      const { sign: _s, sign_type: _st, ...rest } = params
      const signContent = Object.keys(rest)
        .filter((k) => rest[k] !== '' && rest[k] !== undefined)
        .sort()
        .map((k) => `${k}=${rest[k]}`)
        .join('&')
      const sign = createSign('RSA-SHA256')
      sign.update(signContent, 'utf-8')
      params.sign = sign.sign(
        privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
        'base64',
      )

      expect(verifyNotify(params)).toBe(true)
    })

    it('有公钥 + RSA2 + 错误签名返回 false', () => {
      const { publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      })
      vi.stubEnv('ALIPAY_PUBLIC_KEY', publicKey.export({ type: 'spki', format: 'pem' }) as string)

      expect(
        verifyNotify({
          trade_no: '123',
          sign: 'invalid-base64-signature',
          sign_type: 'RSA2',
        }),
      ).toBe(false)
    })
  })

  describe('buildSignedUrl', () => {
    let rsaKey: string

    beforeEach(() => {
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
      rsaKey = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
      vi.stubEnv('ALIPAY_APP_ID', '2021000')
      vi.stubEnv('ALIPAY_PRIVATE_KEY', rsaKey)
    })

    it('返回包含 gateway 前缀的 URL', () => {
      const url = buildSignedUrl({ out_trade_no: 'ORD123', total_amount: '9.99' })
      expect(url).toContain('https://openapi.alipay.com/gateway.do')
    })

    it('URL 包含必要参数', () => {
      const url = buildSignedUrl({ out_trade_no: 'ORD123' })
      expect(url).toContain('app_id=2021000')
      expect(url).toContain('charset=utf-8')
      expect(url).toContain('sign_type=RSA2')
      expect(url).toContain('biz_content=')
    })

    it('默认 method 为 alipay.trade.page.pay', () => {
      const url = buildSignedUrl({})
      expect(url).toContain('method=alipay.trade.page.pay')
    })

    it('自定义 method', () => {
      const url = buildSignedUrl({}, 'alipay.trade.app.pay')
      expect(url).toContain('method=alipay.trade.app.pay')
    })
  })
})
