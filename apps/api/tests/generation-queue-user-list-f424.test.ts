// © 2026 IHUI AI (智汇AI) · 版权所有:李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-424 夹具:按用户任务列表不能"先全局截断再过滤"。
 *
 * 改前(红):
 * - listByUser 取全局 [0, limit-1] 前 50 条再 filter(userId);
 *   队列前 50 条全是他人任务时,自己的列表返回 [] 且 total=0。
 *
 * 改后(绿):
 * - 分页扫描直到队列尾,先按 userId 归属判定再截断本页输出;
 * - 返回 { jobs, total },total 是该用户真实总数(不是本页长度)。
 *
 * 零真实 Redis:mock bullmq Queue,按 [start,end] 切片返回。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

interface FakeJob {
  id: string
  data: { taskId: string; type: string; userId: string; prompt: string; modelId: string; params: Record<string, unknown> }
  progress: number
  returnvalue: unknown
  failedReason?: string
}

const h = vi.hoisted(() => ({
  jobs: [] as FakeJob[],
  calls: [] as Array<{ states: unknown; start: number; end: number }>,
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:6379' },
}))

vi.mock('../src/services/relay-queue-name.js', () => ({
  queueNameWithDbIdentity: (base: string) => base,
}))

vi.mock('bullmq', () => {
  class FakeQueue {
    async getJobs(states: unknown, start: number, end: number) {
      h.calls.push({ states, start, end })
      return h.jobs.slice(start, end + 1)
    }
    async getJob() {
      return undefined
    }
    async close() {}
  }
  return { Queue: FakeQueue }
})

import { listByUser } from '../src/services/ai/generation-queue-service.js'

function job(id: string, userId: string): FakeJob {
  return {
    id,
    data: { taskId: id, type: 'text', userId, prompt: 'p', modelId: 'm', params: {} },
    progress: 0,
    returnvalue: null,
  }
}

beforeEach(() => {
  h.jobs = []
  h.calls = []
})

describe('F-424 用户任务列表分页扫描', () => {
  it('队列前 50 条全是他人任务 → 自己的 3 条仍能返回,total=3', async () => {
    h.jobs = [
      ...Array.from({ length: 50 }, (_, i) => job(`other-${i}`, 'user-other')),
      job('mine-0', 'user-me'),
      job('mine-1', 'user-me'),
      job('mine-2', 'user-me'),
    ]
    const result = await listByUser('user-me', undefined, 50)
    expect(result.jobs.map((j) => j.id)).toEqual(['mine-0', 'mine-1', 'mine-2'])
    expect(result.total).toBe(3)
    // 扫描窗口必须越过前 50 条(本次第一页 [0,99] 已覆盖 53 条,而非停在 limit=50)
    expect(h.calls[0]?.end).toBeGreaterThanOrEqual(53)
  })

  it('他人任务占满前几页且自己任务分散 → 按 limit 截断,但 total 是真实总数', async () => {
    h.jobs = [
      ...Array.from({ length: 120 }, (_, i) => job(`other-${i}`, 'user-other')),
      ...Array.from({ length: 20 }, (_, i) => job(`mine-${i}`, 'user-me')),
    ]
    const result = await listByUser('user-me', undefined, 10)
    expect(result.jobs).toHaveLength(10)
    expect(result.jobs[0]?.id).toBe('mine-0')
    expect(result.total).toBe(20)
  })

  it('status 过滤透传给 BullMQ,分页仍按用户归属判定', async () => {
    h.jobs = [job('a', 'other'), job('b', 'me')]
    const result = await listByUser('me', 'completed', 5)
    expect(result.jobs.map((j) => j.id)).toEqual(['b'])
    expect(result.total).toBe(1)
    expect(h.calls[0]?.states).toEqual(['completed'])
  })
})
