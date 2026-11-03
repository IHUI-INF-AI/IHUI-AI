// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { mockProcessOutbox, mockCleanup } = vi.hoisted(() => ({
  mockProcessOutbox: vi.fn(),
  mockCleanup: vi.fn(),
}))

// mock 掉真实 drizzle 链路:本套件验证的是 scheduler 侧接线,不碰真库
vi.mock('../src/utils/outbox.js', () => ({
  processOutbox: mockProcessOutbox,
  cleanupProcessedOutbox: mockCleanup,
}))

import {
  SCHEDULED_JOBS,
  createOutboxLogDispatcher,
  runOutboxDrain,
  runOutboxStartupScan,
} from '../src/plugins/scheduler.js'

/** 构造最小 log 桩(与 pino 结构兼容)。 */
function makeLog() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}

describe('outbox 排空接入既有轮询 + 启动扫描（b76-12e G-998160）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认:本轮 prune 无行可删(节流行为本身在下方 describe 里单测)
    mockCleanup.mockResolvedValue(0)
  })

  describe('任务表登记（验收①）', () => {
    it('SCHEDULED_JOBS 登记 outbox-drain-every-30s,every=30_000,无 pattern', () => {
      const job = SCHEDULED_JOBS.find((j) => j.name === 'outbox-drain-every-30s')
      expect(job).toBeDefined()
      expect(job!.every).toBe(30_000)
      expect(job!.pattern).toBeUndefined()
      expect(job!.description).toContain('Outbox')
    })
  })

  describe('不新增计时器（验收③判据固化）', () => {
    it('scheduler.ts 与 outbox.ts 源码均不含 setInterval(排空挂 BullMQ 轮询,非新计时器)', () => {
      const schedulerSrc = readFileSync(
        fileURLToPath(new URL('../src/plugins/scheduler.ts', import.meta.url)),
        'utf8',
      )
      const outboxSrc = readFileSync(
        fileURLToPath(new URL('../src/utils/outbox.ts', import.meta.url)),
        'utf8',
      )
      expect(schedulerSrc).not.toMatch(/setInterval\s*\(/)
      expect(outboxSrc).not.toMatch(/setInterval\s*\(/)
    })

    it('outbox.ts 注释明文驱动方式:poll 周期捎带补报 + host 启动扫描', () => {
      const outboxSrc = readFileSync(
        fileURLToPath(new URL('../src/utils/outbox.ts', import.meta.url)),
        'utf8',
      )
      expect(outboxSrc).toContain('poll 周期捎带补报 + host 启动扫描')
      expect(outboxSrc).toContain('不新增 setInterval')
    })
  })

  describe('createOutboxLogDispatcher', () => {
    it('dispatch 以结构化字段送达日志 sink', async () => {
      const log = makeLog()
      const dispatcher = createOutboxLogDispatcher(log)
      await dispatcher.dispatch({ id: 'evt-1', type: 'order.paid' })
      expect(log.info).toHaveBeenCalledTimes(1)
      const [fields, msg] = log.info.mock.calls[0]!
      expect(fields).toMatchObject({ outboxEventId: 'evt-1', outboxEventType: 'order.paid' })
      expect(msg).toContain('outbox event dispatched')
    })
  })

  describe('runOutboxDrain', () => {
    it('调用 processOutbox(以 log dispatcher)并透传结果', async () => {
      const log = makeLog()
      mockProcessOutbox.mockResolvedValue({ processed: 2, failed: 0 })

      const result = await runOutboxDrain({ log })

      expect(result).toEqual({ processed: 2, failed: 0, pruned: 0 })
      expect(mockProcessOutbox).toHaveBeenCalledTimes(1)
      // 传入的是 createOutboxLogDispatcher 的产物:具备 dispatch 能力
      const arg = mockProcessOutbox.mock.calls[0]![0]
      expect(typeof arg.dispatch).toBe('function')
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({ processed: 2, failed: 0 }),
        'outbox drain done',
      )
    })

    it('processOutbox 抛错时原样上抛(由调用方决定上报方式)', async () => {
      mockProcessOutbox.mockRejectedValue(new Error('db down'))
      await expect(runOutboxDrain({ log: makeLog() })).rejects.toThrow('db down')
    })
  })

  describe('runOutboxStartupScan（启动扫描,不阻断启动）', () => {
    it('成功:排空一轮并透传结果', async () => {
      const log = makeLog()
      mockProcessOutbox.mockResolvedValue({ processed: 1, failed: 0 })

      const result = await runOutboxStartupScan({ log })

      expect(result).toEqual({ processed: 1, failed: 0, pruned: 0 })
      expect(mockProcessOutbox).toHaveBeenCalledTimes(1)
    })

    it('失败:只记 error 返回 0/0,不抛出(启动不被阻断)', async () => {
      const log = makeLog()
      mockProcessOutbox.mockRejectedValue(new Error('db down'))

      const result = await runOutboxStartupScan({ log })

      expect(result).toEqual({ processed: 0, failed: 0 })
      expect(log.error).toHaveBeenCalledTimes(1)
      expect(log.error.mock.calls[0]![1]).toContain('non-fatal')
    })
  })

  // 门 121 接线(2026-11-01):cleanupProcessedOutbox 此前无人执行。挂同一枚 30s 排空轮,
  // 但必须自带时间戳节流 —— 否则 30 秒轮会放大成每天 2880 次 DELETE。
  describe('processed 行的保留 prune 挂同一轮 + 6 小时节流', () => {
    /** 独立模块实例:节流时刻是模块作用域状态,须与其它用例隔离。 */
    async function freshDrain() {
      vi.resetModules()
      const mod = await import('../src/plugins/scheduler.js')
      return mod.runOutboxDrain
    }

    it('首轮排空即 prune(界点 = now − 7 天);6 小时内第二轮跳过;满 6 小时再 prune', async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-11-01T00:00:00.000Z'))
        const drain = await freshDrain()
        mockProcessOutbox.mockResolvedValue({ processed: 0, failed: 0 })
        mockCleanup.mockResolvedValue(7)

        const first = await drain({ log: makeLog() })
        expect(first).toEqual({ processed: 0, failed: 0, pruned: 7 })
        expect(mockCleanup).toHaveBeenCalledTimes(1)
        expect(mockCleanup.mock.calls[0]![0]).toEqual(new Date('2026-10-25T00:00:00.000Z'))

        vi.setSystemTime(new Date('2026-11-01T05:59:00.000Z'))
        const second = await drain({ log: makeLog() })
        expect(second).toEqual({ processed: 0, failed: 0, pruned: 0 })
        expect(mockCleanup).toHaveBeenCalledTimes(1)

        vi.setSystemTime(new Date('2026-11-01T06:00:01.000Z'))
        const third = await drain({ log: makeLog() })
        expect(third).toEqual({ processed: 0, failed: 0, pruned: 7 })
        expect(mockCleanup).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('prune 失败只记 error、不上抛:排空的 processed/failed 归因不被清理动作污染', async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-12-01T00:00:00.000Z'))
        const drain = await freshDrain()
        mockProcessOutbox.mockResolvedValue({ processed: 4, failed: 1 })
        mockCleanup.mockRejectedValue(new Error('delete boom'))
        const log = makeLog()

        await expect(drain({ log })).resolves.toEqual({ processed: 4, failed: 1, pruned: 0 })

        const errCall = log.error.mock.calls.find((c) => String(c[1]).includes('prune failed'))
        expect(errCall?.[1]).toContain('non-fatal')
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
