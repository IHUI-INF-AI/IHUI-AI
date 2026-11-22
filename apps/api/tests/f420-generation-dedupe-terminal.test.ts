// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-420:去重不能把 completed/failed 旧作业当成"窗口内重复"。
 * BullMQ 对已存在的 jobId 会直接返回旧作业,新任务就此被静默丢弃。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const m = vi.hoisted(() => {
  const jobs = new Map<string, Record<string, unknown>>()
  const q = {
    jobs,
    getJob: vi.fn(async (id: string) => jobs.get(id)),
    add: vi.fn(async (_name: string, data: unknown, opts?: { jobId?: string }) => {
      const job: Record<string, unknown> = {
        id: opts?.jobId ?? `auto-${jobs.size}`,
        data,
        timestamp: Date.now(),
        state: 'waiting',
      }
      job.getState = async () => job.state
      job.remove = async () => {
        if (job.removeFails) throw new Error('locked')
        if (opts?.jobId) jobs.delete(opts.jobId)
      }
      if (opts?.jobId) jobs.set(opts.jobId, job)
      return job
    }),
  }
  return q
})

vi.mock('bullmq', () => ({
  Queue: class {
    constructor() {
      Object.assign(this, m)
    }
  },
}))

import { enqueue, type GenerationJobData } from '../src/services/ai/generation-queue-service.js'

const DATA: GenerationJobData = {
  taskId: 'task-1',
  type: 'text',
  userId: 'user-1',
  prompt: 'hello',
  modelId: 'model-1',
  params: {},
}
const WINDOW = 60_000

beforeEach(() => {
  m.jobs.clear()
  m.getJob.mockClear()
  m.add.mockClear()
})

describe('F-420 生成队列去重只命中可消费状态', () => {
  it('waiting 窗口内复用同一作业', async () => {
    const id1 = await enqueue(DATA, 'normal', WINDOW)
    const id2 = await enqueue(DATA, 'normal', WINDOW)
    expect(id2).toBe(id1)
    expect(m.add).toHaveBeenCalledTimes(1)
  })

  it('completed 旧作业不吞新任务', async () => {
    const id1 = await enqueue(DATA, 'normal', WINDOW)
    const old = m.jobs.get(id1)!
    old.state = 'completed'
    const id2 = await enqueue(DATA, 'normal', WINDOW)
    expect(m.add).toHaveBeenCalledTimes(2)
    expect(id2).toBe(id1)
    expect(m.jobs.get(id1)!.state).toBe('waiting')
  })

  it('failed 旧作业不吞新任务', async () => {
    const id1 = await enqueue(DATA, 'normal', WINDOW)
    m.jobs.get(id1)!.state = 'failed'
    await enqueue(DATA, 'normal', WINDOW)
    expect(m.add).toHaveBeenCalledTimes(2)
  })

  it('旧作业移除失败时用时间桶 jobId 兜底,保证本次一定入队', async () => {
    const id1 = await enqueue(DATA, 'normal', WINDOW)
    const old = m.jobs.get(id1)!
    old.state = 'completed'
    old.removeFails = true
    const id2 = await enqueue(DATA, 'normal', WINDOW)
    expect(id2).not.toBe(id1)
    expect(id2.startsWith(`${id1}-`)).toBe(true)
    expect(m.jobs.has(id2)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
