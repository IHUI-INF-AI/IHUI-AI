import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { MemoryService, getMemoryService } from '../src/services/clawdbot/memory.js'

describe('clawdbot MemoryService 记忆服务', () => {
  let svc: MemoryService

  beforeEach(() => {
    svc = new MemoryService()
  })

  describe('store 存储', () => {
    it('存储记忆并生成 id/createdAt/lastAccessedAt/accessCount', () => {
      const m = svc.store({ type: 'long_term', content: 'hello', importance: 0.5 })
      expect(m.id).toMatch(/^mem_[a-z0-9]+$/)
      expect(m.createdAt).toBeGreaterThan(0)
      expect(m.lastAccessedAt).toBeGreaterThan(0)
      expect(m.accessCount).toBe(0)
      expect(m.content).toBe('hello')
      expect(m.importance).toBe(0.5)
    })

    it('short_term 自动设置 expiresAt', () => {
      const m = svc.store({ type: 'short_term', content: 'x', importance: 0.1 })
      expect(m.expiresAt).toBeGreaterThan(Date.now())
    })

    it('long_term 不自动设置 expiresAt', () => {
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.1 })
      expect(m.expiresAt).toBeUndefined()
    })

    it('保留外部传入的 expiresAt', () => {
      const exp = Date.now() + 9999
      const m = svc.store({ type: 'short_term', content: 'x', importance: 0.1, expiresAt: exp })
      expect(m.expiresAt).toBe(exp)
    })

    it('触发 stored 事件', () => {
      const handler = vi.fn()
      svc.on('stored', handler)
      svc.store({ type: 'long_term', content: 'x', importance: 0.1 })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('short_term 超过 100 条触发 evictShortTerm', () => {
      for (let i = 0; i < 105; i++) {
        svc.store({ type: 'short_term', content: `c${i}`, importance: 0.1 })
      }
      const stats = svc.getStats()
      expect(stats.byType.short_term).toBeLessThanOrEqual(100)
      expect(stats.total).toBeLessThanOrEqual(100)
    })
  })

  describe('retrieve 检索', () => {
    it('检索存在的记忆并更新访问信息', () => {
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.5 })
      const before = m.lastAccessedAt
      const got = svc.retrieve(m.id)
      expect(got).not.toBeNull()
      expect(got!.accessCount).toBe(1)
      expect(got!.lastAccessedAt).toBeGreaterThanOrEqual(before)
    })

    it('检索不存在的记忆返回 null', () => {
      expect(svc.retrieve('not_exist')).toBeNull()
    })

    it('过期 short_term 记忆被删除并返回 null', () => {
      const m = svc.store({
        type: 'short_term',
        content: 'x',
        importance: 0.1,
        expiresAt: Date.now() - 1000,
      })
      expect(svc.retrieve(m.id)).toBeNull()
      expect(svc.retrieve(m.id)).toBeNull()
    })
  })

  describe('search 搜索', () => {
    beforeEach(() => {
      svc.store({ type: 'long_term', content: 'apple red', importance: 0.9, tags: ['fruit'] })
      svc.store({ type: 'long_term', content: 'banana yellow', importance: 0.5, tags: ['fruit'] })
      svc.store({ type: 'working', content: 'car fast', importance: 0.7, tags: ['vehicle'] })
    })

    it('按 type 过滤', () => {
      const r = svc.search({ type: 'working' })
      expect(r).toHaveLength(1)
      expect(r[0]!.content).toContain('car')
    })

    it('按 tags 过滤', () => {
      const r = svc.search({ tags: ['fruit'] })
      expect(r).toHaveLength(2)
    })

    it('按 keyword 过滤', () => {
      const r = svc.search({ keyword: 'red' })
      expect(r).toHaveLength(1)
      expect(r[0]!.content).toContain('apple')
    })

    it('按 minImportance 过滤', () => {
      const r = svc.search({ minImportance: 0.8 })
      expect(r).toHaveLength(1)
      expect(r[0]!.content).toContain('apple')
    })

    it('按重要性降序排序', () => {
      const r = svc.search({})
      expect(r[0]!.importance).toBeGreaterThanOrEqual(r[1]!.importance!)
    })

    it('limit 限制返回数量', () => {
      const r = svc.search({ limit: 1 })
      expect(r).toHaveLength(1)
    })

    it('默认 limit 为 10', () => {
      for (let i = 0; i < 15; i++)
        svc.store({ type: 'long_term', content: `n${i}`, importance: 0.1 })
      const r = svc.search({})
      expect(r).toHaveLength(10)
    })
  })

  describe('update 更新', () => {
    it('更新存在的记忆', () => {
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.5 })
      const ok = svc.update(m.id, { content: 'updated' })
      expect(ok).toBe(true)
      expect(svc.retrieve(m.id)!.content).toBe('updated')
    })

    it('更新不存在返回 false', () => {
      expect(svc.update('not_exist', { content: 'x' })).toBe(false)
    })

    it('触发 updated 事件', () => {
      const handler = vi.fn()
      svc.on('updated', handler)
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.5 })
      svc.update(m.id, { content: 'y' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('forget 遗忘', () => {
    it('删除存在记忆返回 true', () => {
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.5 })
      expect(svc.forget(m.id)).toBe(true)
      expect(svc.retrieve(m.id)).toBeNull()
    })

    it('删除不存在返回 false', () => {
      expect(svc.forget('not_exist')).toBe(false)
    })

    it('触发 forgotten 事件', () => {
      const handler = vi.fn()
      svc.on('forgotten', handler)
      const m = svc.store({ type: 'long_term', content: 'x', importance: 0.5 })
      svc.forget(m.id)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('consolidate 整合', () => {
    it('将 24 小时前的高重要性 short_term 升级为 long_term', () => {
      const m = svc.store({ type: 'short_term', content: 'x', importance: 0.8 })
      // 手动改 createdAt
      const internal = svc as unknown as {
        memories: Map<string, { createdAt: number; type: string; expiresAt?: number }>
      }
      internal.memories.get(m.id)!.createdAt = Date.now() - 1000 * 60 * 60 * 25
      const n = svc.consolidate()
      expect(n).toBe(1)
      const got = svc.retrieve(m.id)
      expect(got!.type).toBe('long_term')
      expect(got!.expiresAt).toBeUndefined()
    })

    it('低重要性 short_term 不升级', () => {
      const m = svc.store({ type: 'short_term', content: 'x', importance: 0.3 })
      const internal = svc as unknown as {
        memories: Map<string, { createdAt: number; type: string }>
      }
      internal.memories.get(m.id)!.createdAt = Date.now() - 1000 * 60 * 60 * 25
      const n = svc.consolidate()
      expect(n).toBe(0)
    })

    it('触发 consolidated 事件', () => {
      const handler = vi.fn()
      svc.on('consolidated', handler)
      const m = svc.store({ type: 'short_term', content: 'x', importance: 0.8 })
      const internal = svc as unknown as { memories: Map<string, { createdAt: number }> }
      internal.memories.get(m.id)!.createdAt = Date.now() - 1000 * 60 * 60 * 25
      svc.consolidate()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStats 统计', () => {
    it('返回总数与按类型分类', () => {
      svc.store({ type: 'short_term', content: 'a', importance: 0.1 })
      svc.store({ type: 'long_term', content: 'b', importance: 0.1 })
      svc.store({ type: 'working', content: 'c', importance: 0.1 })
      svc.store({ type: 'episodic', content: 'd', importance: 0.1 })
      const s = svc.getStats()
      expect(s.total).toBe(4)
      expect(s.byType.short_term).toBe(1)
      expect(s.byType.long_term).toBe(1)
      expect(s.byType.working).toBe(1)
      expect(s.byType.episodic).toBe(1)
    })
  })

  describe('单例', () => {
    it('getMemoryService 返回同一实例', () => {
      expect(getMemoryService()).toBe(getMemoryService())
    })
  })
})
