import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockState = vi.hoisted(() => ({
  selectResult: [] as unknown[],
  insertResult: [] as unknown[],
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
    onConflictDoUpdate: () => DbChain
    onConflictDoNothing: () => DbChain
  }
  function createChain(result: unknown[]): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain(mockState.selectResult)),
      insert: vi.fn(() => createChain(mockState.insertResult)),
      update: vi.fn(() => createChain(mockState.insertResult)),
      delete: vi.fn(() => createChain([])),
    },
  }
})

import {
  getNewId,
  getLegacyId,
  createMapping,
  bulkCreateMappings,
  hasBeenMigrated,
} from '../../db/id-mapping-queries.js'
import { db } from '../../db/index.js'

const SAMPLE_MAPPING = {
  id: '00000000-0000-0000-0000-000000000001',
  legacyTable: 'member',
  legacyId: 100,
  newId: 'new-uuid-100',
  migrationBatch: 'batch-20260717',
  createdAt: new Date('2026-07-17T00:00:00Z'),
}

describe('ID 映射查询(id-mapping-queries)', () => {
  beforeEach(() => {
    mockState.selectResult = []
    mockState.insertResult = []
    vi.clearAllMocks()
  })

  describe('createMapping', () => {
    it('正常创建映射,返回新建记录', async () => {
      mockState.insertResult = [SAMPLE_MAPPING]
      const res = await createMapping('member', 100, 'new-uuid-100', 'batch-20260717')
      expect(res).toEqual(SAMPLE_MAPPING)
      expect(res.newId).toBe('new-uuid-100')
      expect(db.insert).toHaveBeenCalledTimes(1)
    })

    it('幂等性:同 legacy_id 重复调用不报错(走 onConflictDoUpdate)', async () => {
      mockState.insertResult = [SAMPLE_MAPPING]
      const r1 = await createMapping('member', 100, 'new-uuid-100', 'batch-1')
      const r2 = await createMapping('member', 100, 'new-uuid-100-updated', 'batch-2')
      expect(r1).toBeDefined()
      expect(r2).toBeDefined()
      expect(db.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('getNewId', () => {
    it('查到映射返回 newId', async () => {
      mockState.selectResult = [{ newId: 'new-uuid-100' }]
      const res = await getNewId('member', 100)
      expect(res).toBe('new-uuid-100')
    })

    it('查不到映射返回 null', async () => {
      mockState.selectResult = []
      const res = await getNewId('member', 999)
      expect(res).toBeNull()
    })
  })

  describe('getLegacyId', () => {
    it('反向查映射返回 legacyId', async () => {
      mockState.selectResult = [{ legacyId: 100 }]
      const res = await getLegacyId('member', 'new-uuid-100')
      expect(res).toBe(100)
    })

    it('反向查不到返回 null', async () => {
      mockState.selectResult = []
      const res = await getLegacyId('member', 'not-exist-uuid')
      expect(res).toBeNull()
    })
  })

  describe('hasBeenMigrated', () => {
    it('已迁移返回 true', async () => {
      mockState.selectResult = [{ id: '00000000-0000-0000-0000-000000000001' }]
      const res = await hasBeenMigrated('member', 100)
      expect(res).toBe(true)
    })

    it('未迁移返回 false', async () => {
      mockState.selectResult = []
      const res = await hasBeenMigrated('member', 999)
      expect(res).toBe(false)
    })
  })

  describe('bulkCreateMappings', () => {
    it('批量创建映射,返回插入结果', async () => {
      mockState.insertResult = [
        { ...SAMPLE_MAPPING, legacyId: 1, newId: 'n1' },
        { ...SAMPLE_MAPPING, legacyId: 2, newId: 'n2' },
      ]
      const res = await bulkCreateMappings([
        { legacyTable: 'member', legacyId: 1, newId: 'n1', migrationBatch: 'b' },
        { legacyTable: 'member', legacyId: 2, newId: 'n2', migrationBatch: 'b' },
      ])
      expect(res).toHaveLength(2)
      expect(res[0]?.newId).toBe('n1')
      expect(res[1]?.newId).toBe('n2')
      expect(db.insert).toHaveBeenCalledTimes(1)
    })

    it('空数组直接返回空,不调用 insert', async () => {
      const res = await bulkCreateMappings([])
      expect(res).toEqual([])
      expect(db.insert).not.toHaveBeenCalled()
    })
  })
})
