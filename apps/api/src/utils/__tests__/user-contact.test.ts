// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  normalizeUserContact,
  hashUserContact,
  encryptUserContact,
  decryptUserContact,
  contactLookupForSearch,
  contactWritePair,
  decryptPublicContact,
  USER_CONTACT_LOOKUP_LEN,
} from '../user-contact.js'
import { encryptCredential } from '../crypto.js'
import { createHash } from 'node:crypto'

describe('DB-35 user-contact 盲索引/加解密(方案②)', () => {
  describe('normalizeUserContact 归一', () => {
    it('phone 去 +86 前缀 + 去空白/连字符', () => {
      expect(normalizeUserContact('phone', '+86 138-0013-8000')).toBe('13800138000')
      expect(normalizeUserContact('phone', '13800138000')).toBe('13800138000')
    })
    it('email trim + 全小写', () => {
      expect(normalizeUserContact('email', '  Foo@Example.COM ')).toBe('foo@example.com')
    })
    it('空串归一后仍为空串', () => {
      expect(normalizeUserContact('phone', '   ')).toBe('')
      expect(normalizeUserContact('email', '   ')).toBe('')
    })
  })

  describe('hashUserContact 确定性盲索引', () => {
    it('同值归一后 hash 恒等(确定性,供唯一索引)', () => {
      const a = hashUserContact('phone', '+8613800138000')
      const b = hashUserContact('phone', '13800138000')
      expect(a).toBe(b)
      expect(a).toBe(createHash('sha256').update('13800138000', 'utf8').digest('hex'))
    })
    it('email hash 与手算 sha256 一致', () => {
      const h = hashUserContact('email', 'Foo@Example.COM')
      expect(h).toBe(createHash('sha256').update('foo@example.com', 'utf8').digest('hex'))
    })
    it('空值返回空串(不参与唯一性)', () => {
      expect(hashUserContact('phone', '')).toBe('')
      expect(hashUserContact('email', '')).toBe('')
    })
    it('lookup 长度为 sha256 hex = 64', () => {
      expect(USER_CONTACT_LOOKUP_LEN).toBe(64)
      expect(hashUserContact('phone', '13800138000')).toHaveLength(64)
    })
  })

  describe('contactLookupForSearch 搜索 helper', () => {
    it('有效联系方式返回 lookup hash', () => {
      const got = contactLookupForSearch('phone', '13800138000')
      expect(got).toBe(hashUserContact('phone', '13800138000'))
    })
    it('无法归一成有效联系方式返回 null(调用方不应添加该分支,不退回明文 ilike)', () => {
      expect(contactLookupForSearch('phone', '')).toBeNull()
      expect(contactLookupForSearch('email', '')).toBeNull()
    })
  })

  describe('encryptUserContact / decryptUserContact 加解密封装', () => {
    it('明文加密后可解密回原值', () => {
      const enc = encryptUserContact('13800138000')
      expect(enc).toMatch(/^enc:v1:/)
      expect(decryptUserContact(enc)).toBe('13800138000')
    })
    it('随机 IV:同明文两次加密产生不同密文(故必须靠盲索引而非密文等值)', () => {
      const a = encryptUserContact('foo@example.com')
      const b = encryptUserContact('foo@example.com')
      expect(a).not.toBe(b)
      expect(decryptUserContact(a)).toBe(decryptUserContact(b))
    })
    it('空值原样透传', () => {
      expect(encryptUserContact(null)).toBeNull()
      expect(encryptUserContact(undefined)).toBeUndefined()
      expect(encryptUserContact('')).toBe('')
      expect(decryptUserContact(null)).toBeNull()
      expect(decryptUserContact('')).toBe('')
    })
    it('存量明文(无 enc:v1 前缀)解密原样返回(兼容回填过渡期)', () => {
      expect(decryptUserContact('13800138000')).toBe('13800138000')
    })
    it('加密值幂等返回(已加密不二次加密)', () => {
      const enc = encryptUserContact('foo@example.com')
      expect(encryptUserContact(enc)).toBe(enc)
    })
  })

  describe('contactWritePair 写入 helper', () => {
    it('有效值返回 { 密文, lookup }', () => {
      const p = contactWritePair('phone', '13800138000')
      expect(p.value).toMatch(/^enc:v1:/)
      expect(p.lookup).toBe(hashUserContact('phone', '13800138000'))
      expect(decryptUserContact(p.value)).toBe('13800138000')
    })
    it('空值返回 { null, null }(未填写不参与唯一性)', () => {
      expect(contactWritePair('phone', '')).toEqual({ value: null, lookup: null })
      expect(contactWritePair('email', null)).toEqual({ value: null, lookup: null })
    })
    it('加密值与迁移回填用的 encryptCredential 同源(单一真相源)', () => {
      const p = contactWritePair('email', 'foo@example.com')
      // 迁移 SQL 在库侧用 pg 密码,应用层断言:应用侧加密值可被本侧 decrypt 解回
      expect(decryptUserContact(p.value)).toBe('foo@example.com')
      // 且与直接调用底层加密语义一致(明文可解回)
      expect(decryptUserContact(encryptCredential('foo@example.com'))).toBe('foo@example.com')
    })
  })

  describe('decryptPublicContact 展示解密', () => {
    it('默认解密 phone/email 两列,其余列原样保留', () => {
      const row = {
        id: 'u1',
        phone: encryptUserContact('13800138000')!,
        email: encryptUserContact('foo@example.com')!,
        nickname: 'Alice',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }
      const out = decryptPublicContact(row)
      expect(out.phone).toBe('13800138000')
      expect(out.email).toBe('foo@example.com')
      expect(out.id).toBe('u1')
      expect(out.nickname).toBe('Alice')
      expect(out.createdAt).toEqual(row.createdAt)
    })
    it('ownerPhone/ownerEmail 别名投影:显式传 key', () => {
      const row = {
        id: 'p1',
        ownerPhone: encryptUserContact('13900139000')!,
        ownerEmail: encryptUserContact('owner@example.com')!,
        status: 1,
      }
      const out = decryptPublicContact(row, 'ownerPhone', 'ownerEmail')
      expect(out.ownerPhone).toBe('13900139000')
      expect(out.ownerEmail).toBe('owner@example.com')
      expect(out.id).toBe('p1')
    })
    it('未填写(null)列解密后仍为 null', () => {
      const out = decryptPublicContact({ phone: null, email: null, id: 'x' })
      expect(out.phone).toBeNull()
      expect(out.email).toBeNull()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
