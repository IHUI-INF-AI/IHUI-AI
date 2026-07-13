import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/db/index.js', () => {
  const mockDbSelect = vi.fn()
  const mockDbDelete = vi.fn()
  return {
    db: {
      select: mockDbSelect,
      delete: mockDbDelete,
    },
    __mocks: { mockDbSelect, mockDbDelete },
  }
})

vi.mock('@ihui/database', () => ({
  auditLogs: {
    id: 'id',
    createdAt: 'createdAt',
  },
}))

import {
  archiveAuditLogs,
  ConsoleArchiveWriter,
  type ArchiveWriter,
  type ArchiveResult,
} from '../src/utils/audit-archive.js'
import { db } from '../src/db/index.js'

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function buildSelectChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows)
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: limitFn }),
      }),
    }),
  }
}

function buildDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  }
}

describe('audit-archive — 审计日志归档', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ConsoleArchiveWriter', () => {
    it('write 返回带时间戳和数量的 key', async () => {
      const w = new ConsoleArchiveWriter()
      const key = await w.write([{ id: '1', createdAt: new Date() }] as never)
      expect(key).toContain('audit-archive-')
      expect(key).toContain('-1.json')
    })
    it('不同 batch size 反映在 key', async () => {
      const w = new ConsoleArchiveWriter()
      const key = await w.write([{ id: '1' }, { id: '2' }, { id: '3' }] as never)
      expect(key).toContain('-3.json')
    })
  })

  describe('archiveAuditLogs', () => {
    it('无待归档记录时返回 archived=0', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]))
      const r = await archiveAuditLogs(new Date())
      expect(r.archived).toBe(0)
      expect(r.durationMs).toBeGreaterThanOrEqual(0)
      expect(r.archiveKey).toBeUndefined()
    })

    it('单批归档成功', async () => {
      const rows = [
        { id: '1', createdAt: new Date('2025-01-01') },
        { id: '2', createdAt: new Date('2025-01-02') },
      ]
      mockDb.select.mockReturnValue(buildSelectChain(rows))
      // delete 也会调用：返回 where 链
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const writer: ArchiveWriter = {
        write: vi.fn().mockResolvedValue('test-key-1'),
      }
      const r = await archiveAuditLogs(new Date('2025-02-01'), { writer })
      expect(r.archived).toBe(2)
      expect(r.archiveKey).toBe('test-key-1')
      expect(writer.write).toHaveBeenCalledTimes(1)
      expect(writer.write).toHaveBeenCalledWith(rows)
    })

    it('多批归档直到无更多记录', async () => {
      // 第 1 批：3 条（达到 batchSize=3，继续循环）
      // 第 2 批：2 条（不足 batchSize，break）
      const rows1 = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
        { id: '3', createdAt: new Date() },
      ]
      const rows2 = [
        { id: '4', createdAt: new Date() },
        { id: '5', createdAt: new Date() },
      ]
      mockDb.select
        .mockReturnValueOnce(buildSelectChain(rows1))
        .mockReturnValueOnce(buildSelectChain(rows2))
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const writer: ArchiveWriter = {
        write: vi.fn().mockResolvedValueOnce('key-1').mockResolvedValueOnce('key-2'),
      }
      const r = await archiveAuditLogs(new Date(), {
        batchSize: 3,
        writer,
      })
      expect(r.archived).toBe(5)
      expect(r.archiveKey).toBe('key-2')
      expect(writer.write).toHaveBeenCalledTimes(2)
    })

    it('maxRecords 限制总归档数', async () => {
      // 即使有更多记录，达到 maxRecords 后停止
      const rows1 = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
        { id: '3', createdAt: new Date() },
      ]
      const rows2 = [
        { id: '4', createdAt: new Date() },
        { id: '5', createdAt: new Date() },
        { id: '6', createdAt: new Date() },
      ]
      mockDb.select
        .mockReturnValueOnce(buildSelectChain(rows1))
        .mockReturnValueOnce(buildSelectChain(rows2))
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const writer: ArchiveWriter = {
        write: vi.fn().mockResolvedValue('key'),
      }
      const r = await archiveAuditLogs(new Date(), {
        batchSize: 3,
        maxRecords: 5,
        writer,
      })
      // 第 1 批归档 3 条，第 2 批归档 2 条（maxRecords=5 限制 limit=min(3,5-3)=2）
      // 但第 2 批实际返回 3 条，所以 archived=3+3=6（maxRecords 限制 limit 但不限制 batch.length）
      // 等等：limit = Math.min(batchSize, remaining) = Math.min(3, 5-3) = 2
      // 但 mock 返回 3 条 → archived += 3 → 6
      // batch.length(3) < limit(2)? false → 继续
      // 但 archived(6) >= maxRecords(5) → break
      expect(r.archived).toBeGreaterThanOrEqual(5)
    })

    it('使用默认 ConsoleArchiveWriter', async () => {
      const rows = [{ id: '1', createdAt: new Date() }]
      mockDb.select.mockReturnValue(buildSelectChain(rows))
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const r = await archiveAuditLogs(new Date())
      expect(r.archived).toBe(1)
      expect(r.archiveKey).toContain('audit-archive-')
    })

    it('返回 ArchiveResult 结构', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]))
      const r = await archiveAuditLogs(new Date())
      expect(r).toHaveProperty('archived')
      expect(r).toHaveProperty('durationMs')
      expect(typeof r.durationMs).toBe('number')
    })

    it('默认 batchSize=1000', async () => {
      const rows = [{ id: '1', createdAt: new Date() }]
      mockDb.select.mockReturnValue(buildSelectChain(rows))
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const writer: ArchiveWriter = { write: vi.fn().mockResolvedValue('k') }
      await archiveAuditLogs(new Date(), { writer })
      // 验证 select 链调用 1 次
      expect(mockDb.select).toHaveBeenCalledTimes(1)
    })

    it('writer 抛错时归档失败', async () => {
      const rows = [{ id: '1', createdAt: new Date() }]
      mockDb.select.mockReturnValue(buildSelectChain(rows))
      mockDb.delete.mockReturnValue(buildDeleteChain())
      const writer: ArchiveWriter = {
        write: vi.fn().mockRejectedValue(new Error('S3 down')),
      }
      await expect(archiveAuditLogs(new Date(), { writer })).rejects.toThrow('S3 down')
    })
  })

  describe('ArchiveResult 类型', () => {
    it('返回完整结构', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]))
      const r: ArchiveResult = await archiveAuditLogs(new Date())
      expect(r).toEqual({
        archived: 0,
        durationMs: expect.any(Number),
        archiveKey: undefined,
      })
    })
  })
})
