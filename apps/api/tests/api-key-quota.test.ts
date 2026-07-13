import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  apiKeyQuotas: {
    apiKeyId: 'api_key_id',
    hourlyUsed: 'hourly_used',
    dailyUsed: 'daily_used',
    hourlyLimit: 'hourly_limit',
    dailyLimit: 'daily_limit',
    resetAt: 'reset_at',
    updatedAt: 'updated_at',
    id: 'id',
  },
}))

import {
  ApiKeyQuota,
  DEFAULT_HOURLY_LIMIT,
  DEFAULT_DAILY_LIMIT,
} from '../src/utils/api-key-quota.js'

describe('api-key-quota — API Key 调用配额管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockExistingQuota(
    overrides: Partial<{
      hourlyUsed: number
      dailyUsed: number
      hourlyLimit: number
      dailyLimit: number
      resetAt: Date
    }> = {},
  ) {
    const future = new Date(Date.now() + 3600_000)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'row-1',
              apiKeyId: 'key-1',
              hourlyUsed: 0,
              dailyUsed: 0,
              hourlyLimit: 1000,
              dailyLimit: 10000,
              resetAt: future,
              ...overrides,
            },
          ]),
        }),
      }),
    })
  }

  describe('默认配额常量', () => {
    it('DEFAULT_HOURLY_LIMIT 为 1000', () => {
      expect(DEFAULT_HOURLY_LIMIT).toBe(1000)
    })

    it('DEFAULT_DAILY_LIMIT 为 10000', () => {
      expect(DEFAULT_DAILY_LIMIT).toBe(10_000)
    })
  })

  describe('checkQuota — 配额内允许', () => {
    it('未使用配额返回 allowed=true', async () => {
      mockExistingQuota({ hourlyUsed: 0, dailyUsed: 0 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkQuota('key-1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1000)
    })

    it('部分使用后返回剩余配额', async () => {
      mockExistingQuota({ hourlyUsed: 100, dailyUsed: 500 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkQuota('key-1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(900)
    })
  })

  describe('checkQuota — 超额拒绝', () => {
    it('小时配额用完返回 hourly_exceeded', async () => {
      mockExistingQuota({ hourlyUsed: 1000, dailyUsed: 500 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkQuota('key-1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('hourly_exceeded')
      expect(result.remaining).toBe(0)
    })

    it('天配额用完返回 daily_exceeded', async () => {
      mockExistingQuota({ hourlyUsed: 100, dailyUsed: 10000 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkQuota('key-1')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('daily_exceeded')
    })
  })

  describe('checkQuota — 重置逻辑', () => {
    it('resetAt 已过期时重置 hourlyUsed', async () => {
      const past = new Date(Date.now() - 3600_000)
      mockExistingQuota({ hourlyUsed: 1000, dailyUsed: 500, resetAt: past })
      const quota = new ApiKeyQuota()
      const result = await quota.checkQuota('key-1')
      expect(result.allowed).toBe(true)
    })
  })

  describe('recordUsage', () => {
    it('记录调用消耗', async () => {
      mockExistingQuota({ hourlyUsed: 10, dailyUsed: 20 })
      const mockReturning = vi.fn().mockResolvedValue([])
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      })
      const quota = new ApiKeyQuota()
      await quota.recordUsage('key-1')
      expect(mockDbUpdate).toHaveBeenCalled()
    })

    it('自定义 cost 消耗多次配额', async () => {
      mockExistingQuota({ hourlyUsed: 10, dailyUsed: 20 })
      const mockReturning = vi.fn().mockResolvedValue([])
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: mockReturning,
          }),
        }),
      })
      const quota = new ApiKeyQuota()
      await quota.recordUsage('key-1', 5)
      expect(mockDbUpdate).toHaveBeenCalled()
    })
  })

  describe('自定义配额配置', () => {
    it('使用自定义 hourlyLimit/dailyLimit 初始化新记录', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 'new-row',
          apiKeyId: 'key-new',
          hourlyUsed: 0,
          dailyUsed: 0,
          hourlyLimit: 500,
          dailyLimit: 5000,
          resetAt: new Date(Date.now() + 3600_000),
        },
      ])
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      })
      const quota = new ApiKeyQuota({ hourlyLimit: 500, dailyLimit: 5000 })
      const result = await quota.checkQuota('key-new')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(500)
    })
  })

  describe('checkAndConsume', () => {
    it('配额足够时原子扣减返回 allowed=true', async () => {
      mockExistingQuota({ hourlyUsed: 10, dailyUsed: 20 })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'row-1' }]),
          }),
        }),
      })
      const quota = new ApiKeyQuota()
      const result = await quota.checkAndConsume('key-1', 1)
      expect(result.allowed).toBe(true)
    })

    it('小时配额不足拒绝', async () => {
      mockExistingQuota({ hourlyUsed: 1000, dailyUsed: 500 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkAndConsume('key-1', 1)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('hourly_exceeded')
    })

    it('天配额不足拒绝', async () => {
      mockExistingQuota({ hourlyUsed: 100, dailyUsed: 10000 })
      const quota = new ApiKeyQuota()
      const result = await quota.checkAndConsume('key-1', 1)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('daily_exceeded')
    })
  })
})
