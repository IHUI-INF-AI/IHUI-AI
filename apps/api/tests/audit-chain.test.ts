import { describe, it, expect, beforeEach, vi } from 'vitest'

// 必须先 mock db 与 @ihui/database，否则 audit-chain.ts 顶层 import db
// 会触发 config/index.ts 校验 env 失败并 process.exit(1)
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('@ihui/database', () => ({
  auditChainEntries: {
    id: 'id',
    previousHash: 'previousHash',
    hash: 'hash',
    data: 'data',
    createdAt: 'createdAt',
  },
}))

import {
  AuditChain,
  computeHash,
  GENESIS_HASH,
  type AuditChainStorage,
  type ChainRecord,
  type AuditEntry,
} from '../src/utils/audit-chain.js'

/** 内存存储实现，用于测试（绕过 DB） */
class InMemoryStorage implements AuditChainStorage {
  records: ChainRecord[] = []
  getLatest(): Promise<ChainRecord | null> {
    if (this.records.length === 0) return Promise.resolve(null)
    return Promise.resolve(this.records[this.records.length - 1]!)
  }
  getAll(): Promise<ChainRecord[]> {
    return Promise.resolve([...this.records])
  }
  insert(record: { previousHash: string; hash: string; data: AuditEntry }): Promise<ChainRecord> {
    const r: ChainRecord = {
      id: `id-${this.records.length + 1}`,
      previousHash: record.previousHash,
      hash: record.hash,
      data: record.data,
      createdAt: new Date(),
    }
    this.records.push(r)
    return Promise.resolve(r)
  }
}

describe('audit-chain — SHA256 hash 链审计', () => {
  let storage: InMemoryStorage
  let chain: AuditChain

  beforeEach(() => {
    storage = new InMemoryStorage()
    chain = new AuditChain(storage)
  })

  describe('GENESIS_HASH', () => {
    it('为 64 个 0', () => {
      expect(GENESIS_HASH).toBe('0'.repeat(64))
      expect(GENESIS_HASH).toHaveLength(64)
    })
  })

  describe('computeHash', () => {
    it('对相同输入产生相同 hash', () => {
      const e: AuditEntry = { action: 'POST', userId: 'u1' }
      const h1 = computeHash(GENESIS_HASH, e)
      const h2 = computeHash(GENESIS_HASH, e)
      expect(h1).toBe(h2)
      expect(h1).toHaveLength(64)
    })
    it('不同 previousHash 产生不同 hash', () => {
      const e: AuditEntry = { action: 'POST' }
      const h1 = computeHash(GENESIS_HASH, e)
      const h2 = computeHash('a'.repeat(64), e)
      expect(h1).not.toBe(h2)
    })
    it('不同 data 产生不同 hash', () => {
      const h1 = computeHash(GENESIS_HASH, { action: 'POST' })
      const h2 = computeHash(GENESIS_HASH, { action: 'PATCH' })
      expect(h1).not.toBe(h2)
    })
  })

  describe('append', () => {
    it('首次 append 使用 GENESIS_HASH 作为 previousHash', async () => {
      const h = await chain.append({ action: 'POST', userId: 'u1' })
      expect(h).toHaveLength(64)
      const records = await storage.getAll()
      expect(records).toHaveLength(1)
      expect(records[0]!.previousHash).toBe(GENESIS_HASH)
      expect(records[0]!.hash).toBe(h)
    })
    it('后续 append 使用前一条 hash 作为 previousHash', async () => {
      const h1 = await chain.append({ action: 'POST' })
      const h2 = await chain.append({ action: 'PATCH' })
      const records = await storage.getAll()
      expect(records[1]!.previousHash).toBe(h1)
      expect(records[1]!.hash).toBe(h2)
    })
    it('occurredAt 默认为当前时间', async () => {
      const before = new Date(Date.now() - 1)
      await chain.append({ action: 'POST' })
      const after = new Date(Date.now() + 1)
      const records = await storage.getAll()
      const ts = records[0]!.data.occurredAt!
      expect(ts >= before).toBe(true)
      expect(ts <= after).toBe(true)
    })
    it('透传 occurredAt', async () => {
      const ts = new Date('2025-01-01T00:00:00Z')
      await chain.append({ action: 'POST', occurredAt: ts })
      const records = await storage.getAll()
      expect(records[0]!.data.occurredAt).toEqual(ts)
    })
    it('透传 resourceType / resourceId / ip / details', async () => {
      await chain.append({
        action: 'POST',
        resourceType: 'order',
        resourceId: 'o1',
        userId: 'u1',
        details: { amount: 100 },
        ip: '127.0.0.1',
      })
      const records = await storage.getAll()
      const d = records[0]!.data
      expect(d.resourceType).toBe('order')
      expect(d.resourceId).toBe('o1')
      expect(d.userId).toBe('u1')
      expect(d.details).toEqual({ amount: 100 })
      expect(d.ip).toBe('127.0.0.1')
    })
  })

  describe('verify', () => {
    it('空链返回 valid=true', async () => {
      const r = await chain.verify()
      expect(r.valid).toBe(true)
      expect(r.brokenAt).toBeUndefined()
    })
    it('单条记录链 valid=true', async () => {
      await chain.append({ action: 'POST' })
      const r = await chain.verify()
      expect(r.valid).toBe(true)
    })
    it('多条记录链 valid=true', async () => {
      await chain.append({ action: 'POST' })
      await chain.append({ action: 'PATCH' })
      await chain.append({ action: 'DELETE' })
      const r = await chain.verify()
      expect(r.valid).toBe(true)
    })
    it('previousHash 断裂返回 valid=false', async () => {
      await chain.append({ action: 'POST' })
      // 直接插入一条 previousHash 错误的记录
      await storage.insert({
        previousHash: 'wrong',
        hash: computeHash('wrong', { action: 'PATCH' }),
        data: { action: 'PATCH' },
      })
      const r = await chain.verify()
      expect(r.valid).toBe(false)
      expect(r.brokenAt).toBe(2)
      expect(r.expectedHash).toBeDefined()
      expect(r.actualHash).toBe('wrong')
    })
    it('hash 重算不一致返回 valid=false', async () => {
      await chain.append({ action: 'POST' })
      // 直接插入一条 hash 错误的记录
      await storage.insert({
        previousHash: storage.records[0]!.hash,
        hash: 'tampered',
        data: { action: 'PATCH' },
      })
      const r = await chain.verify()
      expect(r.valid).toBe(false)
      expect(r.brokenAt).toBe(2)
      expect(r.actualHash).toBe('tampered')
    })
  })

  describe('默认构造（DbAuditChainStorage）', () => {
    it('无参构造不抛错（DbAuditChainStorage 惰性使用 db）', () => {
      expect(() => new AuditChain()).not.toThrow()
    })
  })

  describe('storage 异常处理', () => {
    it('getLatest 抛错时 append 应抛出', async () => {
      const failStorage: AuditChainStorage = {
        getLatest: () => Promise.reject(new Error('db down')),
        getAll: () => Promise.resolve([]),
        insert: () => Promise.reject(new Error('never')),
      }
      const c = new AuditChain(failStorage)
      await expect(c.append({ action: 'POST' })).rejects.toThrow('db down')
    })
    it('insert 抛错时 append 应抛出', async () => {
      const failStorage: AuditChainStorage = {
        getLatest: () => Promise.resolve(null),
        getAll: () => Promise.resolve([]),
        insert: () => Promise.reject(new Error('insert failed')),
      }
      const c = new AuditChain(failStorage)
      await expect(c.append({ action: 'POST' })).rejects.toThrow('insert failed')
    })
    it('getAll 抛错时 verify 应抛出', async () => {
      const failStorage: AuditChainStorage = {
        getLatest: () => Promise.resolve(null),
        getAll: () => Promise.reject(new Error('getAll failed')),
        insert: () => Promise.reject(new Error('never')),
      }
      const c = new AuditChain(failStorage)
      await expect(c.verify()).rejects.toThrow('getAll failed')
    })
  })

  describe('完整链验证场景', () => {
    it('追加 100 条后仍 valid', async () => {
      for (let i = 0; i < 100; i++) {
        await chain.append({ action: 'POST', resourceId: `r${i}` })
      }
      const r = await chain.verify()
      expect(r.valid).toBe(true)
      expect(storage.records).toHaveLength(100)
    })
    it('中间篡改任一条 data 后 verify 失败', async () => {
      await chain.append({ action: 'POST' })
      await chain.append({ action: 'PATCH' })
      await chain.append({ action: 'DELETE' })
      // 篡改第 2 条的 data
      storage.records[1]!.data = { action: 'TAMPERED' }
      const r = await chain.verify()
      expect(r.valid).toBe(false)
      expect(r.brokenAt).toBe(2)
    })
  })

  describe('vi.mock 验证（不实际使用 db）', () => {
    it('InMemoryStorage 直接调用 insert', async () => {
      const spy = vi.spyOn(storage, 'insert')
      await chain.append({ action: 'POST' })
      expect(spy).toHaveBeenCalledOnce()
    })
  })
})
