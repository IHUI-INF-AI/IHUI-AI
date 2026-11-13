// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-218 回归锁(2026-11-13)。
 *
 * 病灶:getKey() 用 `key.length`(UTF-16 字符数)判断长度,再 `key.slice(0, 32)` 按字符
 * 截断交给 createCipheriv —— 字节长度从未校验:
 *   - 少于 32 字节的密钥被静默当 256 位密钥使用(实际熵不足);
 *   - 32 个中文字符是 96 字节,createCipheriv 抛 ERR_CRYPTO_INVALID_KEYLEN,
 *     错误信息不指向配置项,读写直接 500。
 *
 * 本文件锁:
 *   ① 合法 32 字节密钥:encryptJSON/decryptJSON、encryptField/decryptField 往返成功;
 *   ② 非法密钥一律按 **字节** 判定并抛明确错误:短密钥、多字节字符密钥、32 字节边界
 *     落在多字节字符中间的密钥;错误信息只含字节数,不含密钥内容;
 *   ③ 派生结果与历史实现(`key.slice(0, 32)` 的 UTF-8 字节)完全一致,长 ASCII 密钥
 *     仍沿用前 32 字节(存量密文可解),不换 KDF、不加版本前缀;
 *   ④ 历史密文(由旧派生路径生成的固定 fixture)在新实现下仍能解出原文。
 */
import { describe, it, expect, vi } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const mockState = vi.hoisted(() => ({ key: 'a'.repeat(32) }))

vi.mock('../src/config/index.js', () => ({
  config: {
    get CREDENTIALS_ENCRYPTION_KEY() {
      return mockState.key
    },
  },
}))

import { encryptJSON, decryptJSON, encryptField, decryptField } from '../src/utils/crypto.js'

const VALID_KEY = 'a'.repeat(32)

/** 49 字节纯 ASCII 密钥(多份既有测试/环境沿用),历史派生结果 = 前 32 字节。 */
const LONG_ASCII_KEY = 'unit-test-credentials-encryption-key-0123456789ab'

/**
 * 历史密文 fixture:用旧实现(派生 `Buffer.from(key.slice(0, 32))`)加密
 * '110101199003072319' 得到的真实 payload,与当前实现无关。
 */
const LEGACY_PAYLOAD = {
  iv: 'yGktDHDx2bJdKxXg',
  ciphertext: '0eEkLSnU7F1zRlo9pmxoVql9CpY=',
  tag: '2BIRTSi4phLdoRS/gculOQ==',
}

/** 旧实现的派生方式,仅用于在测试里独立复算「派生结果是否漂移」。 */
function legacyDeriveKey(raw: string): Buffer {
  return Buffer.from(raw.slice(0, 32))
}

describe('F-218 CREDENTIALS_ENCRYPTION_KEY 按字节校验', () => {
  describe('① 合法 32 字节密钥正常工作', () => {
    it('encryptJSON/decryptJSON 往返', () => {
      mockState.key = VALID_KEY
      const payload = encryptJSON({ name: '张三', idCard: '110101199003072319' })
      expect(decryptJSON(payload)).toEqual({ name: '张三', idCard: '110101199003072319' })
    })

    it('encryptField/decryptField 往返', () => {
      mockState.key = VALID_KEY
      expect(decryptField(encryptField('110101199003072319'))).toBe('110101199003072319')
    })
  })

  describe('② 非法密钥按字节判定并抛错(不静默降级)', () => {
    it('短密钥(31 字节)加密抛错', () => {
      mockState.key = 'a'.repeat(31)
      expect(() => encryptJSON('x')).toThrow(/字节/)
    })

    it('短密钥解密同样抛错', () => {
      mockState.key = 'a'.repeat(31)
      expect(() => decryptJSON(LEGACY_PAYLOAD)).toThrow(/字节/)
    })

    it('32 个中文字符(96 字节)密钥抛错,而不是让 createCipheriv 报 keylen', () => {
      mockState.key = '密'.repeat(32)
      expect(() => encryptJSON('x')).toThrow(/完整字符边界/)
    })

    it('emoji 密钥落在 32 字节边界中间时抛错', () => {
      mockState.key = '🔑' + '密'.repeat(11) // 4 + 33 = 37 字节,32 边界切在第二个字符中间
      expect(() => encryptJSON('x')).toThrow(/完整字符边界/)
    })

    it('错误信息不含密钥内容', () => {
      const secret = 'Small-Secret-Key'
      mockState.key = secret
      let message = ''
      try {
        encryptJSON('x')
      } catch (e) {
        message = (e as Error).message
      }
      expect(message).toContain('字节')
      expect(message).not.toContain(secret)
      expect(message).not.toContain('Small')
    })

    it('多字节密钥的错误信息也不含密钥内容', () => {
      const secret = '密钥材料'.repeat(6) // 每字 3 字节,32 字节边界切在第 3 字中间
      mockState.key = secret
      let message = ''
      try {
        encryptJSON('x')
      } catch (e) {
        message = (e as Error).message
      }
      expect(message).toContain('完整字符边界')
      expect(message).not.toContain(secret)
      expect(message).not.toContain('密钥材料')
    })
  })

  describe('③ 派生结果稳定(存量兼容,不换 KDF)', () => {
    it('长 ASCII 密钥仍取前 32 字节,与旧实现派生一致', () => {
      mockState.key = LONG_ASCII_KEY
      const payload = encryptJSON('legacy-compatible')
      const decipher = createDecipheriv(
        'aes-256-gcm',
        legacyDeriveKey(LONG_ASCII_KEY),
        Buffer.from(payload.iv, 'base64'),
      )
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
      const plain = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, 'base64')),
        decipher.final(),
      ])
      expect(JSON.parse(plain.toString('utf8'))).toBe('legacy-compatible')
    })

    it('同一合法密钥可解开旧派生方式生成的新密文', () => {
      mockState.key = VALID_KEY
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', legacyDeriveKey(VALID_KEY), iv)
      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from('"stable"', 'utf8')),
        cipher.final(),
      ])
      const payload = {
        iv: iv.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
      }
      expect(decryptJSON(payload)).toBe('stable')
    })
  })

  describe('④ 既有解密路径对历史密文仍成功', () => {
    it('decryptJSON 解开历史 fixture', () => {
      mockState.key = LONG_ASCII_KEY
      expect(decryptJSON(LEGACY_PAYLOAD)).toBe('110101199003072319')
    })

    it('decryptField 解开历史 fixture(JSON 字符串密文)', () => {
      mockState.key = LONG_ASCII_KEY
      expect(decryptField(JSON.stringify(LEGACY_PAYLOAD))).toBe('110101199003072319')
    })
  })
})
