import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 微信支付服务配置 + 验签函数单元测试。
 *
 * 覆盖:
 * - isWechatPayConfigured() 三态(true/false + 路径 vs 内容)
 * - isPlatformCertConfigured() PEM 内容 vs 文件路径
 * - isCallbackSignatureVerificationReady() 生产环境硬约束
 * - verifyCallbackSignature() DEV 降级 + 生产失败
 * - generateOutTradeNo() 格式 + 唯一性
 */

vi.stubEnv('WX_SHOP_ID', '')
vi.stubEnv('WX_PAY_V3_KEY', '')
vi.stubEnv('WX_PAY_PRIVATE_KEY', '')
vi.stubEnv('WX_PAY_PRIVATE_KEY_PATH', '')
vi.stubEnv('WX_PAY_PLATFORM_CERT', '')
vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', '')
vi.stubEnv('NODE_ENV', 'test')

import {
  isWechatPayConfigured,
  isPlatformCertConfigured,
  isCallbackSignatureVerificationReady,
  verifyCallbackSignature,
  generateOutTradeNo,
} from '../src/services/wechat-pay.js'

describe('wechat-pay — 微信支付服务', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wxpay-test-'))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('WX_SHOP_ID', '')
    vi.stubEnv('WX_PAY_V3_KEY', '')
    vi.stubEnv('WX_PAY_PRIVATE_KEY', '')
    vi.stubEnv('WX_PAY_PRIVATE_KEY_PATH', '')
    vi.stubEnv('WX_PAY_PLATFORM_CERT', '')
    vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', '')
    vi.stubEnv('NODE_ENV', 'test')
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  describe('isWechatPayConfigured', () => {
    it('无任何配置返回 false', () => {
      expect(isWechatPayConfigured()).toBe(false)
    })

    it('有 SHOP_ID 但缺 V3_KEY 返回 false', () => {
      vi.stubEnv('WX_SHOP_ID', '1234567890')
      expect(isWechatPayConfigured()).toBe(false)
    })

    it('有 SHOP_ID + V3_KEY + 私钥内容返回 true', () => {
      vi.stubEnv('WX_SHOP_ID', '1234567890')
      vi.stubEnv('WX_PAY_V3_KEY', 'a'.repeat(32))
      vi.stubEnv('WX_PAY_PRIVATE_KEY', 'mock-pem-content')
      expect(isWechatPayConfigured()).toBe(true)
    })

    it('有 SHOP_ID + V3_KEY + 私钥文件路径返回 true', () => {
      const keyPath = join(tmpDir, 'apiclient_key.pem')
      writeFileSync(keyPath, 'mock-pem-content')
      vi.stubEnv('WX_SHOP_ID', '1234567890')
      vi.stubEnv('WX_PAY_V3_KEY', 'a'.repeat(32))
      vi.stubEnv('WX_PAY_PRIVATE_KEY_PATH', keyPath)
      expect(isWechatPayConfigured()).toBe(true)
    })

    it('私钥路径不存在时返回 false', () => {
      vi.stubEnv('WX_SHOP_ID', '1234567890')
      vi.stubEnv('WX_PAY_V3_KEY', 'a'.repeat(32))
      vi.stubEnv('WX_PAY_PRIVATE_KEY_PATH', join(tmpDir, 'non-existent-key.pem'))
      expect(isWechatPayConfigured()).toBe(false)
    })
  })

  describe('isPlatformCertConfigured', () => {
    it('无任何配置返回 false', () => {
      expect(isPlatformCertConfigured()).toBe(false)
    })

    it('有 PEM 内容(非空字符串)返回 true', () => {
      vi.stubEnv(
        'WX_PAY_PLATFORM_CERT',
        '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
      )
      expect(isPlatformCertConfigured()).toBe(true)
    })

    it('PEM 内容只有空白字符返回 false', () => {
      vi.stubEnv('WX_PAY_PLATFORM_CERT', '   \n\t  ')
      expect(isPlatformCertConfigured()).toBe(false)
    })

    it('有文件路径且文件存在返回 true', () => {
      const certPath = join(tmpDir, 'platform_cert.pem')
      writeFileSync(certPath, 'mock-cert-content')
      vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', certPath)
      expect(isPlatformCertConfigured()).toBe(true)
    })

    it('有文件路径但文件不存在返回 false', () => {
      vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', join(tmpDir, 'non-existent.pem'))
      expect(isPlatformCertConfigured()).toBe(false)
    })

    it('PEM 内容 + 路径都配置时优先使用内容', () => {
      const certPath = join(tmpDir, 'platform_cert.pem')
      writeFileSync(certPath, 'mock-cert-content')
      vi.stubEnv('WX_PAY_PLATFORM_CERT', 'content-takes-precedence')
      vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', certPath)
      // 函数本身只看是否存在,无法验证优先级(优先级在 getPlatformCert() 内部)
      expect(isPlatformCertConfigured()).toBe(true)
    })
  })

  describe('isCallbackSignatureVerificationReady', () => {
    it('有平台证书时直接返回 true(不依赖环境)', () => {
      vi.stubEnv('WX_PAY_PLATFORM_CERT', 'mock-cert')
      vi.stubEnv('NODE_ENV', 'production')
      expect(isCallbackSignatureVerificationReady()).toBe(true)
    })

    it('无平台证书 + test 环境返回 true(降级跳过验签)', () => {
      vi.stubEnv('NODE_ENV', 'test')
      expect(isCallbackSignatureVerificationReady()).toBe(true)
    })

    it('无平台证书 + development 环境返回 true(降级跳过验签)', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(isCallbackSignatureVerificationReady()).toBe(true)
    })

    it('无平台证书 + production 环境返回 false(生产环境硬约束)', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(isCallbackSignatureVerificationReady()).toBe(false)
    })

    it('有平台证书路径 + production 环境返回 true', () => {
      const certPath = join(tmpDir, 'platform_cert.pem')
      writeFileSync(certPath, 'mock-cert')
      vi.stubEnv('WX_PAY_PLATFORM_CERT_PATH', certPath)
      vi.stubEnv('NODE_ENV', 'production')
      expect(isCallbackSignatureVerificationReady()).toBe(true)
    })
  })

  describe('verifyCallbackSignature', () => {
    it('无平台证书 + test 环境跳过验签返回 true', () => {
      vi.stubEnv('NODE_ENV', 'test')
      expect(verifyCallbackSignature('1700000000', 'nonce', '{"a":1}', 'sig')).toBe(true)
    })

    it('无平台证书 + development 环境跳过验签返回 true', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(verifyCallbackSignature('1700000000', 'nonce', '{"a":1}', 'sig')).toBe(true)
    })

    it('无平台证书 + production 环境返回 false', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(verifyCallbackSignature('1700000000', 'nonce', '{"a":1}', 'sig')).toBe(false)
    })
  })

  describe('generateOutTradeNo', () => {
    it('默认前缀 WX', () => {
      const no = generateOutTradeNo()
      expect(no.startsWith('WX')).toBe(true)
    })

    it('自定义前缀', () => {
      const no = generateOutTradeNo('ALI')
      expect(no.startsWith('ALI')).toBe(true)
    })

    it('生成唯一订单号(连续 100 次)', () => {
      const set = new Set<string>()
      for (let i = 0; i < 100; i++) set.add(generateOutTradeNo())
      expect(set.size).toBe(100)
    })

    it('订单号总长度大于 20 字符(含前缀 + 随机 + 时间戳)', () => {
      const no = generateOutTradeNo()
      expect(no.length).toBeGreaterThan(20)
    })
  })
})
