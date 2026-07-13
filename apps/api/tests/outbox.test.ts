import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbInsert, mockDbSelect, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}))

vi.mock('@ihui/database', () => ({
  outboxEvents: {
    id: 'id',
    type: 'type',
    payload: 'payload',
    status: 'status',
    attempts: 'attempts',
    createdAt: 'createdAt',
    processedAt: 'processedAt',
    lastError: 'lastError',
    lastAttemptAt: 'lastAttemptAt',
  },
}))

import {
  writeToOutbox,
  processOutbox,
  cleanupProcessedOutbox,
  getOutboxStats,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_BATCH_SIZE,
  type OutboxEventInput,
  type OutboxDispatcher,
} from '../src/utils/outbox.js'

/** 构造 mock outbox 事件 */
function makeEvent(
  overrides: Partial<{
    id: string
    type: string
    payload: unknown
    status: string
    attempts: number
    createdAt: Date
  }> = {},
) {
  return {
    id: 'evt-1',
    type: 'order.created',
    payload: { orderId: 'o1' },
    status: 'pending',
    attempts: 0,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

/** 配置 select→from→where→orderBy→limit 链 */
function mockSelectLimit(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows)
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: limitFn }),
      }),
    }),
  })
}

/** 配置 select→from→groupBy 链 */
function mockSelectGroupBy(rows: unknown[]) {
  const groupByFn = vi.fn().mockResolvedValue(rows)
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({ groupBy: groupByFn }),
  })
}

/** 配置 update→set→where 链 */
function mockUpdateWhere() {
  const whereFn = vi.fn().mockResolvedValue(undefined)
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: whereFn }),
  })
  return whereFn
}

/** 配置 delete→where→returning 链 */
function mockDeleteReturning(rows: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(rows)
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: returningFn }),
  })
}

describe('outbox — 可靠消息模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('常量', () => {
    it('DEFAULT_MAX_ATTEMPTS = 5', () => {
      expect(DEFAULT_MAX_ATTEMPTS).toBe(5)
    })
    it('DEFAULT_BATCH_SIZE = 100', () => {
      expect(DEFAULT_BATCH_SIZE).toBe(100)
    })
  })

  describe('writeToOutbox', () => {
    it('写入 pending 状态事件', async () => {
      const valuesFn = vi.fn().mockResolvedValue(undefined)
      mockDbInsert.mockReturnValue({ values: valuesFn })

      const input: OutboxEventInput = { type: 'order.created', payload: { id: 'o1' } }
      await writeToOutbox(input)

      expect(valuesFn).toHaveBeenCalledTimes(1)
      const written = valuesFn.mock.calls[0]![0]
      expect(written.type).toBe('order.created')
      expect(written.payload).toEqual({ id: 'o1' })
      expect(written.status).toBe('pending')
      expect(written.attempts).toBe(0)
    })

    it('支持自定义 tx', async () => {
      const txInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
      const tx = { insert: txInsert }

      await writeToOutbox({ type: 'test', payload: 1 }, tx)

      expect(txInsert).toHaveBeenCalledTimes(1)
      expect(mockDbInsert).not.toHaveBeenCalled()
    })
  })

  describe('processOutbox', () => {
    it('成功发送标记 processed', async () => {
      const event = makeEvent()
      mockSelectLimit([event])
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) }
      const result = await processOutbox(dispatcher)

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(0)
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1)
    })

    it('发送失败但未达阈值不标记 failed', async () => {
      const event = makeEvent({ attempts: 2 })
      mockSelectLimit([event])
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = {
        dispatch: vi.fn().mockRejectedValue(new Error('send fail')),
      }
      const result = await processOutbox(dispatcher, { maxAttempts: 5 })

      expect(result.processed).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('达到 maxAttempts 标记 failed', async () => {
      const event = makeEvent({ attempts: 4 })
      mockSelectLimit([event])
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = {
        dispatch: vi.fn().mockRejectedValue(new Error('send fail')),
      }
      const result = await processOutbox(dispatcher, { maxAttempts: 5 })

      expect(result.failed).toBe(1)
      expect(result.processed).toBe(0)
    })

    it('无 pending 事件返回 0/0', async () => {
      mockSelectLimit([])
      const dispatcher: OutboxDispatcher = { dispatch: vi.fn() }
      const result = await processOutbox(dispatcher)

      expect(result.processed).toBe(0)
      expect(result.failed).toBe(0)
      expect(dispatcher.dispatch).not.toHaveBeenCalled()
    })

    it('批量处理多条事件', async () => {
      const events = [makeEvent({ id: 'e1' }), makeEvent({ id: 'e2' }), makeEvent({ id: 'e3' })]
      mockSelectLimit(events)
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) }
      const result = await processOutbox(dispatcher)

      expect(result.processed).toBe(3)
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(3)
    })

    it('部分成功部分失败', async () => {
      const events = [
        makeEvent({ id: 'e1' }),
        makeEvent({ id: 'e2' }),
        makeEvent({ id: 'e3', attempts: 4 }),
      ]
      mockSelectLimit(events)
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = {
        dispatch: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('fail'))
          .mockRejectedValueOnce(new Error('fail')),
      }
      const result = await processOutbox(dispatcher, { maxAttempts: 5 })

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
    })

    it('错误消息截断为 1000 字符', async () => {
      const event = makeEvent({ attempts: 4 })
      mockSelectLimit([event])
      mockUpdateWhere()

      const longMsg = 'x'.repeat(2000)
      const dispatcher: OutboxDispatcher = {
        dispatch: vi.fn().mockRejectedValue(new Error(longMsg)),
      }
      await processOutbox(dispatcher, { maxAttempts: 5 })

      const setFn = mockDbUpdate.mock.results[0]!.value.set
      const setArgs = setFn.mock.calls[0]![0]
      expect(setArgs.lastError.length).toBe(1000)
    })

    it('非 Error 异常转为字符串', async () => {
      const event = makeEvent({ attempts: 4 })
      mockSelectLimit([event])
      mockUpdateWhere()

      const dispatcher: OutboxDispatcher = { dispatch: vi.fn().mockRejectedValue('string error') }
      const result = await processOutbox(dispatcher, { maxAttempts: 5 })

      expect(result.failed).toBe(1)
    })
  })

  describe('cleanupProcessedOutbox', () => {
    it('返回删除的记录数', async () => {
      mockDeleteReturning([{ id: '1' }, { id: '2' }, { id: '3' }])

      const count = await cleanupProcessedOutbox(new Date('2025-01-01T00:00:00Z'))
      expect(count).toBe(3)
    })

    it('无记录返回 0', async () => {
      mockDeleteReturning([])
      const count = await cleanupProcessedOutbox(new Date())
      expect(count).toBe(0)
    })
  })

  describe('getOutboxStats', () => {
    it('返回各状态计数', async () => {
      mockSelectGroupBy([
        { status: 'pending', count: 5 },
        { status: 'processed', count: 10 },
        { status: 'failed', count: 2 },
      ])

      const stats = await getOutboxStats()
      expect(stats.pending).toBe(5)
      expect(stats.processed).toBe(10)
      expect(stats.failed).toBe(2)
    })

    it('无记录返回全 0', async () => {
      mockSelectGroupBy([])
      const stats = await getOutboxStats()
      expect(stats.pending).toBe(0)
      expect(stats.processed).toBe(0)
      expect(stats.failed).toBe(0)
    })

    it('未知状态忽略', async () => {
      mockSelectGroupBy([
        { status: 'pending', count: 3 },
        { status: 'unknown', count: 99 },
      ])
      const stats = await getOutboxStats()
      expect(stats.pending).toBe(3)
      expect(stats.processed).toBe(0)
      expect(stats.failed).toBe(0)
    })
  })
})
