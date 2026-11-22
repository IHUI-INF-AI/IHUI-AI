// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

import {
  encryptJSON,
  decryptJSON,
  isEncryptedPayload,
  encryptField,
  decryptField,
} from '../src/utils/crypto.js'

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

  describe('decryptField — 字段级读路径', () => {
    it('encryptField/decryptField 往返', () => {
      const id = '110101199003072319'
      expect(decryptField(encryptField(id))).toBe(id)
    })

    it('存量明文（非 JSON）原样返回', () => {
      expect(decryptField('张三丰')).toBe('张三丰')
    })

    it('存量明文（纯数字身份证号串，会被 JSON.parse 成 number）原样返回', () => {
      // 身份证是 18 位数字，JSON.parse 成功但结果不是加密荷载形状
      expect(decryptField('110101199003072319')).toBe('110101199003072319')
    })

    it('存量明文（合法 JSON 但不是加密荷载）原样返回', () => {
      expect(decryptField('{"a":1}')).toBe('{"a":1}')
    })

    it('解密失败必须抛出，绝不把密文原值当明文返回', () => {
      // 回归锁：旧实现把 decryptJSON 的抛错和"不是 JSON"混在同一个 catch 里，
      // 于是密钥轮换/数据损坏时返回 stored（整段密文 JSON），并被 auth-identity 当身份证号送进响应。
      const payload = JSON.parse(encryptField('110101199003072319'))
      // 用等长(16 字节)的合法 base64 标签替换：只让 GCM 校验失败，不触发 authTagLength 弃用告警
      const broken = JSON.stringify({ ...payload, tag: Buffer.alloc(16, 7).toString('base64') })
      let returned: string | undefined
      expect(() => {
        returned = decryptField(broken)
      }).toThrow()
      expect(returned).toBeUndefined()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
