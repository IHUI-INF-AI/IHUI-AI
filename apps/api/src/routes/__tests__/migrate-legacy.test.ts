import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  insertCalls: [] as unknown[],
  throwOnNextInsert: false,
}))

vi.mock('../../db/index.js', () => {
  interface Chain {
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise<unknown>
    from: () => Chain
    where: () => Chain
    orderBy: () => Chain
    limit: () => Chain
    offset: () => Chain
    values: (v: unknown) => Chain
    set: () => Chain
    returning: () => Chain
    onConflictDoUpdate: () => Chain
    onConflictDoNothing: () => Chain
  }
  function createChain(result: unknown[]): Chain {
    const chain: Chain = {
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: (v: unknown) => {
        mockState.insertCalls.push(v)
        return chain
      },
      set: () => chain,
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  function createRejectingChain(error: Error): Chain {
    const chain: Chain = {
      then: (_resolve, reject) =>
        reject ? Promise.reject(error).then(undefined, reject) : Promise.reject(error),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: (v: unknown) => {
        mockState.insertCalls.push(v)
        return chain
      },
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
      select: vi.fn(() => {
        const result = mockState.selectQueue.shift() ?? []
        return createChain(result)
      }),
      insert: vi.fn(() => {
        if (mockState.throwOnNextInsert) {
          mockState.throwOnNextInsert = false
          return createRejectingChain(new Error('DB connection error'))
        }
        const result = mockState.insertQueue.shift() ?? []
        return createChain(result)
      }),
      update: vi.fn(() => createChain([])),
      delete: vi.fn(() => createChain([])),
    },
  }
})

import {
  importUsers,
  importCourses,
  setLegacyFetcher,
  type LegacyMember,
  type LegacyCourse,
} from '../../scripts/migrate-legacy-data.js'
import { db } from '../../db/index.js'

const BATCH = 'batch-test-20260717'

function makeMember(overrides: Partial<LegacyMember> = {}): LegacyMember {
  return {
    id: 1,
    username: 'u1',
    mobile: '13800000001',
    email: '',
    name: 'A',
    avatar: '',
    birthday: null,
    password: 'hash',
    gender: '男',
    status: 'normal',
    create_time: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeCourse(overrides: Partial<LegacyCourse> = {}): LegacyCourse {
  return {
    id: 10,
    name: 'Course A',
    image: '',
    introduction: 'intro',
    phrase: '',
    price: '99.00',
    original_price: '199.00',
    create_user_id: 100,
    status: 'normal',
    create_time: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('历史数据迁移(migrate-legacy-data)', () => {
  beforeEach(() => {
    mockState.selectQueue = []
    mockState.insertQueue = []
    mockState.insertCalls = []
    mockState.throwOnNextInsert = false
    vi.clearAllMocks()
  })

  afterEach(() => {
    setLegacyFetcher(null)
  })

  describe('dry-run 模式', () => {
    it('输出导入计划,不实际写入', async () => {
      const members = [makeMember(), makeMember({ id: 2 })]
      setLegacyFetcher(async () => members as unknown as Record<string, unknown>[])

      const result = await importUsers(BATCH, true)

      expect(result.total).toBe(2)
      expect(result.migrated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.failed).toBe(0)
      expect(db.insert).not.toHaveBeenCalled()
      expect(db.select).not.toHaveBeenCalled()
    })
  })

  describe('importUsers', () => {
    it('正常导入 + 创建映射', async () => {
      const members = [makeMember({ id: 1 }), makeMember({ id: 2 })]
      setLegacyFetcher(async () => members as unknown as Record<string, unknown>[])

      mockState.selectQueue = [[], []]
      mockState.insertQueue = [
        [],
        [{ id: 'map-1', legacyTable: 'member', legacyId: 1, newId: 'uuid-1', migrationBatch: BATCH, createdAt: new Date() }],
        [],
        [{ id: 'map-2', legacyTable: 'member', legacyId: 2, newId: 'uuid-2', migrationBatch: BATCH, createdAt: new Date() }],
      ]

      const result = await importUsers(BATCH, false)

      expect(result.migrated).toBe(2)
      expect(result.skipped).toBe(0)
      expect(result.failed).toBe(0)
      expect(db.insert).toHaveBeenCalledTimes(4)

      const firstInsert = mockState.insertCalls[0] as { phone?: string; username?: string }
      expect(firstInsert.phone).toBe('13800000001')
      expect(firstInsert.username).toBe('u1')
    })
  })

  describe('importCourses', () => {
    it('外键重建: 查 id_mapping 获取 userId 映射', async () => {
      const courses = [makeCourse({ id: 10, create_user_id: 100 })]
      setLegacyFetcher(async () => courses as unknown as Record<string, unknown>[])

      mockState.selectQueue = [
        [],
        [{ newId: 'user-uuid-100' }],
      ]
      mockState.insertQueue = [
        [],
        [{ id: 'map-10', legacyTable: 'course', legacyId: 10, newId: 'course-uuid-10', migrationBatch: BATCH, createdAt: new Date() }],
      ]

      const result = await importCourses(BATCH, false)

      expect(result.migrated).toBe(1)
      expect(result.failed).toBe(0)

      const lessonInsert = mockState.insertCalls[0] as { lecturerId?: string | null; title?: string }
      expect(lessonInsert.lecturerId).toBe('user-uuid-100')
      expect(lessonInsert.title).toBe('Course A')
    })

    it('create_user_id 为 null 时 lecturerId 为 null', async () => {
      const courses = [makeCourse({ id: 11, create_user_id: null })]
      setLegacyFetcher(async () => courses as unknown as Record<string, unknown>[])

      mockState.selectQueue = [[]]
      mockState.insertQueue = [
        [],
        [{ id: 'map-11', legacyTable: 'course', legacyId: 11, newId: 'course-uuid-11', migrationBatch: BATCH, createdAt: new Date() }],
      ]

      const result = await importCourses(BATCH, false)

      expect(result.migrated).toBe(1)
      const lessonInsert = mockState.insertCalls[0] as { lecturerId?: string | null }
      expect(lessonInsert.lecturerId).toBeNull()
    })
  })

  describe('断点续传', () => {
    it('已迁移的跳过', async () => {
      const members = [makeMember({ id: 1 }), makeMember({ id: 2 })]
      setLegacyFetcher(async () => members as unknown as Record<string, unknown>[])

      mockState.selectQueue = [
        [{ id: 'existing-mapping' }],
        [],
      ]
      mockState.insertQueue = [
        [],
        [{ id: 'map-2', legacyTable: 'member', legacyId: 2, newId: 'uuid-2', migrationBatch: BATCH, createdAt: new Date() }],
      ]

      const result = await importUsers(BATCH, false)

      expect(result.migrated).toBe(1)
      expect(result.skipped).toBe(1)
      expect(result.failed).toBe(0)
      expect(db.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('单条失败不阻塞批次', () => {
    it('第一条 insert 失败,后续继续导入', async () => {
      const members = [
        makeMember({ id: 1 }),
        makeMember({ id: 2, mobile: '13800000002' }),
        makeMember({ id: 3, mobile: '13800000003' }),
      ]
      setLegacyFetcher(async () => members as unknown as Record<string, unknown>[])

      mockState.selectQueue = [[], [], []]
      mockState.throwOnNextInsert = true
      mockState.insertQueue = [
        [],
        [{ id: 'map-2', legacyTable: 'member', legacyId: 2, newId: 'uuid-2', migrationBatch: BATCH, createdAt: new Date() }],
        [],
        [{ id: 'map-3', legacyTable: 'member', legacyId: 3, newId: 'uuid-3', migrationBatch: BATCH, createdAt: new Date() }],
      ]

      const result = await importUsers(BATCH, false)

      expect(result.failed).toBe(1)
      expect(result.migrated).toBe(2)
      expect(result.skipped).toBe(0)
    })
  })

  describe('批量导入性能', () => {
    it('100 条 < 5 秒', async () => {
      const members: LegacyMember[] = Array.from({ length: 100 }, (_, i) =>
        makeMember({ id: i + 1, mobile: `1380000${String(i + 1).padStart(4, '0')}` }),
      )
      setLegacyFetcher(async () => members as unknown as Record<string, unknown>[])

      mockState.selectQueue = Array.from({ length: 100 }, () => [])
      mockState.insertQueue = []
      for (let i = 0; i < 100; i++) {
        mockState.insertQueue.push([])
        mockState.insertQueue.push([
          {
            id: `map-${i + 1}`,
            legacyTable: 'member',
            legacyId: i + 1,
            newId: `uuid-${i + 1}`,
            migrationBatch: BATCH,
            createdAt: new Date(),
          },
        ])
      }

      const start = Date.now()
      const result = await importUsers(BATCH, false)
      const elapsed = Date.now() - start

      expect(result.migrated).toBe(100)
      expect(result.failed).toBe(0)
      expect(elapsed).toBeLessThan(5000)
    })
  })
})
