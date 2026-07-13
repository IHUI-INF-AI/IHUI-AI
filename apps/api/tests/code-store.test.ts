import { describe, it, expect, beforeEach } from 'vitest'
import {
  codeStore,
  CODE_TTL_MS,
  CODE_RESEND_INTERVAL_MS,
  generateCode,
  cleanupExpiredCodes,
  verifyCode,
  type CodeEntry,
} from '../src/utils/code-store.js'

describe('code-store — 验证码内存存储与校验', () => {
  beforeEach(() => {
    codeStore.clear()
  })

  describe('常量', () => {
    it('CODE_TTL_MS = 5 分钟', () => {
      expect(CODE_TTL_MS).toBe(5 * 60 * 1000)
    })
    it('CODE_RESEND_INTERVAL_MS = 60 秒', () => {
      expect(CODE_RESEND_INTERVAL_MS).toBe(60 * 1000)
    })
  })

  describe('generateCode', () => {
    it('返回 6 位数字字符串', () => {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
    })
    it('范围在 100000-999999', () => {
      for (let i = 0; i < 100; i++) {
        const n = Number(generateCode())
        expect(n).toBeGreaterThanOrEqual(100000)
        expect(n).toBeLessThanOrEqual(999999)
      }
    })
  })

  describe('verifyCode', () => {
    it('匹配且未过期返回 true 并一次性删除', () => {
      codeStore.set('13800000000', {
        code: '123456',
        expiresAt: Date.now() + 60000,
        sentAt: Date.now(),
      })
      expect(verifyCode('13800000000', '123456')).toBe(true)
      expect(codeStore.has('13800000000')).toBe(false)
    })
    it('验证码不存在返回 false', () => {
      expect(verifyCode('13800000000', '123456')).toBe(false)
    })
    it('验证码不匹配返回 false', () => {
      codeStore.set('13800000000', {
        code: '123456',
        expiresAt: Date.now() + 60000,
        sentAt: Date.now(),
      })
      expect(verifyCode('13800000000', '000000')).toBe(false)
      expect(codeStore.has('13800000000')).toBe(true)
    })
    it('已过期返回 false 并保留（不主动删除）', () => {
      codeStore.set('13800000000', {
        code: '123456',
        expiresAt: Date.now() - 1000,
        sentAt: Date.now() - 2000,
      })
      expect(verifyCode('13800000000', '123456')).toBe(false)
      expect(codeStore.has('13800000000')).toBe(true)
    })
  })

  describe('cleanupExpiredCodes', () => {
    it('清理已过期的验证码', () => {
      const now = Date.now()
      codeStore.set('p1', { code: '1', expiresAt: now - 1000, sentAt: now } as CodeEntry)
      codeStore.set('p2', { code: '2', expiresAt: now - 1, sentAt: now } as CodeEntry)
      codeStore.set('p3', { code: '3', expiresAt: now + 60000, sentAt: now })
      cleanupExpiredCodes()
      expect(codeStore.size).toBe(1)
      expect(codeStore.has('p3')).toBe(true)
    })
    it('无过期验证码时不影响 store', () => {
      const now = Date.now()
      codeStore.set('p1', { code: '1', expiresAt: now + 60000, sentAt: now })
      cleanupExpiredCodes()
      expect(codeStore.size).toBe(1)
    })
    it('空 store 不抛错', () => {
      expect(() => cleanupExpiredCodes()).not.toThrow()
    })
  })
})
