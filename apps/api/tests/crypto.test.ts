import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

import { encryptJSON, decryptJSON, isEncryptedPayload } from '../src/utils/crypto.js'

describe('crypto — AES-256-GCM 加密/解密', () => {
  describe('encryptJSON + decryptJSON 往返', () => {
    it('字符串往返', () => {
      const payload = encryptJSON('hello world')
      expect(decryptJSON(payload)).toBe('hello world')
    })

    it('数字往返', () => {
      const payload = encryptJSON(42)
      expect(decryptJSON(payload)).toBe(42)
    })

    it('布尔值往返', () => {
      const payload = encryptJSON(true)
      expect(decryptJSON(payload)).toBe(true)
    })

    it('null 往返', () => {
      const payload = encryptJSON(null)
      expect(decryptJSON(payload)).toBeNull()
    })

    it('简单对象往返', () => {
      const data = { name: 'Alice', age: 30, active: true }
      const payload = encryptJSON(data)
      expect(decryptJSON(payload)).toEqual(data)
    })

    it('嵌套对象往返', () => {
      const data = { user: { name: 'Bob', roles: ['admin', 'user'] }, meta: { count: 0 } }
      const payload = encryptJSON(data)
      expect(decryptJSON(payload)).toEqual(data)
    })

    it('数组往返', () => {
      const data = [1, 'two', { three: 3 }, [4, 5]]
      const payload = encryptJSON(data)
      expect(decryptJSON(payload)).toEqual(data)
    })

    it('空对象往返', () => {
      const payload = encryptJSON({})
      expect(decryptJSON(payload)).toEqual({})
    })

    it('空数组往返', () => {
      const payload = encryptJSON([])
      expect(decryptJSON(payload)).toEqual([])
    })
  })

  describe('encryptJSON 输出结构', () => {
    it('返回包含 iv/ciphertext/tag 三字段的 base64 字符串', () => {
      const payload = encryptJSON('test')
      expect(payload).toHaveProperty('iv')
      expect(payload).toHaveProperty('ciphertext')
      expect(payload).toHaveProperty('tag')
      expect(typeof payload.iv).toBe('string')
      expect(typeof payload.ciphertext).toBe('string')
      expect(typeof payload.tag).toBe('string')
    })

    it('每次加密生成不同 IV（相同明文不同密文）', () => {
      const p1 = encryptJSON('same data')
      const p2 = encryptJSON('same data')
      expect(p1.iv).not.toBe(p2.iv)
      expect(p1.ciphertext).not.toBe(p2.ciphertext)
    })

    it('iv 为 12 字节（GCM 推荐）', () => {
      const payload = encryptJSON('test')
      const ivBytes = Buffer.from(payload.iv, 'base64')
      expect(ivBytes.length).toBe(12)
    })
  })

  describe('decryptJSON 完整性校验', () => {
    it('篡改 ciphertext 解密失败（抛错）', () => {
      const payload = encryptJSON('secret')
      const tampered = { ...payload, ciphertext: Buffer.from('tampered').toString('base64') }
      expect(() => decryptJSON(tampered)).toThrow()
    })

    it('篡改 tag 解密失败（抛错）', () => {
      const payload = encryptJSON('secret')
      const tampered = { ...payload, tag: Buffer.from('fake-tag').toString('base64') }
      expect(() => decryptJSON(tampered)).toThrow()
    })
  })

  describe('isEncryptedPayload', () => {
    it('合法 payload 返回 true', () => {
      const payload = encryptJSON('test')
      expect(isEncryptedPayload(payload)).toBe(true)
    })

    it('null 返回 false', () => {
      expect(isEncryptedPayload(null)).toBe(false)
    })

    it('undefined 返回 false', () => {
      expect(isEncryptedPayload(undefined)).toBe(false)
    })

    it('字符串返回 false', () => {
      expect(isEncryptedPayload('not a payload')).toBe(false)
    })

    it('缺少 tag 字段返回 false', () => {
      expect(isEncryptedPayload({ iv: 'x', ciphertext: 'y' })).toBe(false)
    })

    it('缺少 iv 字段返回 false', () => {
      expect(isEncryptedPayload({ ciphertext: 'y', tag: 'z' })).toBe(false)
    })

    it('字段类型错误返回 false', () => {
      expect(isEncryptedPayload({ iv: 123, ciphertext: 'y', tag: 'z' })).toBe(false)
    })

    it('空对象返回 false', () => {
      expect(isEncryptedPayload({})).toBe(false)
    })
  })
})
