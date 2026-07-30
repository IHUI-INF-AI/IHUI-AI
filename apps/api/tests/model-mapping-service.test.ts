/**
 * model-mapping-service 单元测试(2026-07-31 立,P0-4 降本神器)。
 *
 * 重点验证:
 * - resolveModelMapping:无映射返回原 model / 全局映射生效 / 用户级覆盖全局 / Key 级覆盖用户级 / disabled 跳过 / priority 高的优先
 * - createMapping:正常创建 / 重复 source_model 报错(scope unique)
 * - listMappings:全量 / 按 userId 筛选 / enabledOnly 筛选 / 按 apiKeyId 筛选
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockDbInsert },
  dbRead: { select: mockDbSelect },
}))

// mock drizzle-orm 运算符(返回标识对象,不报错)
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  and: (...conds: unknown[]) => ({ op: 'and', conds: conds.filter(Boolean) }),
  or: (...conds: unknown[]) => ({ op: 'or', conds: conds.filter(Boolean) }),
  isNull: (col: unknown) => ({ op: 'isNull', col }),
  desc: (col: unknown) => ({ op: 'desc', col }),
  asc: (col: unknown) => ({ op: 'asc', col }),
}))

vi.mock('@ihui/database', () => ({
  aiModelMappings: {
    id: 'id',
    userId: 'user_id',
    apiKeyId: 'api_key_id',
    sourceModel: 'source_model',
    targetModel: 'target_model',
    priority: 'priority',
    enabled: 'enabled',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))

import {
  resolveModelMapping,
  createMapping,
  listMappings,
} from '../src/services/model-mapping-service.js'
import type { AiModelMapping } from '@ihui/database'

/** 构造测试行(带默认值) */
function makeRow(overrides: Partial<AiModelMapping> = {}, index = 0): AiModelMapping {
  return {
    id: `id-${index}`,
    userId: null,
    apiKeyId: null,
    sourceModel: 'gpt-4o',
    targetModel: 'deepseek-chat',
    priority: 0,
    enabled: true,
    createdAt: new Date(2026, 6, 31, 12, 0, index),
    updatedAt: new Date(2026, 6, 31, 12, 0, index),
    ...overrides,
  } as AiModelMapping
}

/** mock dbRead.select().from().where() 链式 + orderBy 链式 + thenable */
function mockSelectReturning(rows: AiModelMapping[]) {
  const thenable: Record<string, unknown> = {
    where: vi.fn().mockResolvedValue(rows),
  }
  thenable.orderBy = vi.fn().mockReturnValue(thenable)
  thenable.then = (resolve: (v: AiModelMapping[]) => unknown): Promise<unknown> =>
    Promise.resolve(rows).then(resolve)
  mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue(thenable) })
}

/** mock db.insert().values().returning() */
function mockInsertReturning(rows: AiModelMapping[]) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  })
}

/** mock db.insert 抛错(unique constraint violation) */
function mockInsertThrow(err: Error) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue(err),
    }),
  })
}

describe('model-mapping-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===== resolveModelMapping =====
  describe('resolveModelMapping', () => {
    it('1. 无映射返回原 model', async () => {
      mockSelectReturning([])
      const result = await resolveModelMapping('gpt-4o')
      expect(result.mapped).toBe(false)
      expect(result.resolvedModel).toBe('gpt-4o')
      expect(result.mapping).toBeUndefined()
    })

    it('2. 全局映射生效(userId/apiKeyId 均 null)', async () => {
      const row = makeRow({ userId: null, apiKeyId: null, targetModel: 'deepseek-chat' })
      mockSelectReturning([row])
      const result = await resolveModelMapping('gpt-4o')
      expect(result.mapped).toBe(true)
      expect(result.resolvedModel).toBe('deepseek-chat')
      expect(result.mapping?.id).toBe(row.id)
    })

    it('3. 用户级映射覆盖全局映射', async () => {
      const globalRow = makeRow(
        { userId: null, apiKeyId: null, targetModel: 'deepseek-chat', priority: 0 },
        0,
      )
      const userRow = makeRow(
        { userId: 'user-1', apiKeyId: null, targetModel: 'glm-4-flash', priority: 0 },
        1,
      )
      mockSelectReturning([globalRow, userRow])
      const result = await resolveModelMapping('gpt-4o', 'user-1')
      expect(result.mapped).toBe(true)
      expect(result.resolvedModel).toBe('glm-4-flash') // 用户级优先于全局
    })

    it('4. Key 级映射覆盖用户级映射', async () => {
      const globalRow = makeRow(
        { userId: null, apiKeyId: null, targetModel: 'deepseek-chat' },
        0,
      )
      const userRow = makeRow(
        { userId: 'user-1', apiKeyId: null, targetModel: 'glm-4-flash' },
        1,
      )
      const keyRow = makeRow(
        { userId: 'user-1', apiKeyId: 'key-1', targetModel: 'qwen-max' },
        2,
      )
      mockSelectReturning([globalRow, userRow, keyRow])
      const result = await resolveModelMapping('gpt-4o', 'user-1', 'key-1')
      expect(result.mapped).toBe(true)
      expect(result.resolvedModel).toBe('qwen-max') // Key 级优先于用户级和全局
    })

    it('5. disabled 映射跳过(JS 层过滤)', async () => {
      const disabledRow = makeRow({ enabled: false, targetModel: 'should-not-use' })
      mockSelectReturning([disabledRow])
      const result = await resolveModelMapping('gpt-4o')
      expect(result.mapped).toBe(false)
      expect(result.resolvedModel).toBe('gpt-4o') // disabled 被跳过,返回原 model
    })

    it('6. 同级别 priority 高的优先', async () => {
      const lowPrio = makeRow(
        { userId: null, apiKeyId: null, targetModel: 'deepseek-chat', priority: 5 },
        0,
      )
      const highPrio = makeRow(
        { userId: null, apiKeyId: null, targetModel: 'glm-4-flash', priority: 10 },
        1,
      )
      mockSelectReturning([lowPrio, highPrio])
      const result = await resolveModelMapping('gpt-4o')
      expect(result.mapped).toBe(true)
      expect(result.resolvedModel).toBe('glm-4-flash') // priority 10 > 5
    })
  })

  // ===== createMapping =====
  describe('createMapping', () => {
    it('7. 正常创建返回新行', async () => {
      const newRow = makeRow({ id: 'new-id', sourceModel: 'gpt-4o', targetModel: 'deepseek-chat' })
      mockInsertReturning([newRow])
      const result = await createMapping({
        userId: null,
        apiKeyId: null,
        sourceModel: 'gpt-4o',
        targetModel: 'deepseek-chat',
      })
      expect(result.id).toBe('new-id')
      expect(result.sourceModel).toBe('gpt-4o')
      expect(result.targetModel).toBe('deepseek-chat')
    })

    it('8. 重复 source_model 报错(scope unique)', async () => {
      mockInsertThrow(
        new Error('duplicate key value violates unique constraint "ai_model_mappings_scope_unique"'),
      )
      await expect(
        createMapping({
          userId: null,
          apiKeyId: null,
          sourceModel: 'gpt-4o',
          targetModel: 'deepseek-chat',
        }),
      ).rejects.toThrow(/duplicate key/)
    })

    it('8b. returning 返回空数组时抛错', async () => {
      mockInsertReturning([])
      await expect(
        createMapping({
          sourceModel: 'gpt-4o',
          targetModel: 'deepseek-chat',
        }),
      ).rejects.toThrow('创建模型映射失败')
    })
  })

  // ===== listMappings =====
  describe('listMappings', () => {
    it('9. 全量列表(无筛选)', async () => {
      const rows = [makeRow({ priority: 10 }, 0), makeRow({ priority: 5 }, 1)]
      mockSelectReturning(rows)
      const result = await listMappings({})
      expect(result).toHaveLength(2)
    })

    it('10. 按 userId 筛选', async () => {
      const rows = [makeRow({ userId: 'user-1' })]
      mockSelectReturning(rows)
      const result = await listMappings({ userId: 'user-1' })
      expect(result).toHaveLength(1)
      expect(result[0]?.userId).toBe('user-1')
    })

    it('11. enabledOnly=true 筛选只返回启用的', async () => {
      const rows = [makeRow({ enabled: true })]
      mockSelectReturning(rows)
      const result = await listMappings({ enabledOnly: true })
      expect(result).toHaveLength(1)
      expect(result[0]?.enabled).toBe(true)
    })

    it('12. 按 apiKeyId 筛选', async () => {
      const rows = [makeRow({ apiKeyId: 'key-1', userId: 'user-1' })]
      mockSelectReturning(rows)
      const result = await listMappings({ apiKeyId: 'key-1' })
      expect(result).toHaveLength(1)
      expect(result[0]?.apiKeyId).toBe('key-1')
    })

    it('12b. userId=null 筛选全局映射', async () => {
      const rows = [makeRow({ userId: null, apiKeyId: null })]
      mockSelectReturning(rows)
      const result = await listMappings({ userId: null, apiKeyId: null })
      expect(result).toHaveLength(1)
      expect(result[0]?.userId).toBeNull()
    })
  })
})
