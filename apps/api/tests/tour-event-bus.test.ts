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
  tourEvents: {
    id: 'id',
    type: 'type',
    status: 'status',
    attempts: 'attempts',
    createdAt: 'created_at',
  },
}))

import {
  publish,
  publishBatch,
  processEvents,
  consoleDispatcher,
  getPendingByType,
} from '../src/services/tour/tour-event-bus.js'

describe('tour-event-bus — 事件总线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('publish 发布事件', () => {
    it('调用 db.insert 写入 pending 事件', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      await publish({ type: 'content.published', payload: { x: 1 } })
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('publishBatch 批量发布', () => {
    it('空数组直接返回', async () => {
      await publishBatch([])
      expect(mockDbInsert).not.toHaveBeenCalled()
    })

    it('非空数组调用 db.insert', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })
      await publishBatch([
        { type: 'a', payload: 1 },
        { type: 'b', payload: 2 },
      ])
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('processEvents 处理事件', () => {
    it('无 pending 事件时返回 0', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      const r = await processEvents({ dispatch: vi.fn() })
      expect(r.processed).toBe(0)
      expect(r.failed).toBe(0)
    })

    it('成功分发事件并标记为 processed', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'e1', type: 'x', payload: {}, status: 'pending', attempts: 0 },
                ]),
            }),
          }),
        }),
      })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })
      const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) }
      const r = await processEvents(dispatcher)
      expect(r.processed).toBe(1)
      expect(r.failed).toBe(0)
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1)
    })

    it('分发失败时增加 attempts，未达 maxAttempts 保持 pending', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'e1', type: 'x', payload: {}, status: 'pending', attempts: 0 },
                ]),
            }),
          }),
        }),
      })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })
      const dispatcher = { dispatch: vi.fn().mockRejectedValue(new Error('dispatch fail')) }
      const r = await processEvents(dispatcher, { maxAttempts: 5 })
      expect(r.processed).toBe(0)
      expect(r.failed).toBe(0) // 未达 maxAttempts 不计 failed
    })

    it('分发失败达 maxAttempts 时标记为 failed', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'e1', type: 'x', payload: {}, status: 'pending', attempts: 4 },
                ]),
            }),
          }),
        }),
      })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })
      const dispatcher = { dispatch: vi.fn().mockRejectedValue(new Error('dispatch fail')) }
      const r = await processEvents(dispatcher, { maxAttempts: 5 })
      expect(r.failed).toBe(1)
    })
  })

  describe('consoleDispatcher', () => {
    it('调用 console.info 不抛错', async () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      await consoleDispatcher.dispatch({
        id: 'e1',
        type: 'x',
        payload: { a: 1 },
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      } as never)
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })

  describe('getPendingByType 按 type 查询', () => {
    it('返回 db 查询结果', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]),
            }),
          }),
        }),
      })
      const list = await getPendingByType('content.published', 10)
      expect(list).toHaveLength(2)
    })
  })
})
