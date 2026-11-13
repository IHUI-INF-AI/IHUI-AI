// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-44 / F-45 回归:模块级 Map 只增不删导致的内存泄漏。
 *
 * F-44:ai-vendors 的 taskStore / tencentActiveJobs 无删除路径,列表请求遍历全表。
 *      修复后:任务进入终态即从 Map 删除;写入时顺带 TTL 清扫孤儿任务与过期作业。
 * F-45:n1-detector 的 requestQueryCounts 对 hijack 的 SSE/WS 请求永久残留。
 *      修复后:连接 close 时按请求回收;写入时顺带 TTL 清扫。
 *
 * 全部为纯内存用例,不建立真实连接。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  createTask,
  taskStore,
  tencentActiveJobs,
  __taskStoreTest,
} from '../src/routes/ai-vendors/_shared.js'
import { n1Detector, __n1DetectorTest } from '../src/plugins/n1-detector.js'

type Hook = (arg: FakeRequest) => Promise<void> | void

interface FakeRequest {
  id: string
  requestId?: string
  method: string
  url: string
  raw: EventEmitter
}

interface N1Api {
  recordQuery(requestId: string): void
  getQueryCount(requestId: string): number
}

interface Booted {
  hooks: Record<string, Hook[]>
  decorated: Record<string, unknown>
  warn: ReturnType<typeof vi.fn>
}

let booted: Booted | null = null

async function bootN1Detector(): Promise<Booted> {
  const hooks: Record<string, Hook[]> = {}
  const decorated: Record<string, unknown> = {}
  const warn = vi.fn()
  const server = {
    addHook(name: string, fn: Hook) {
      ;(hooks[name] ??= []).push(fn)
    },
    decorate(name: string, value: unknown) {
      decorated[name] = value
    },
    log: { warn },
  }
  const register = n1Detector as unknown as (s: unknown, o: unknown) => Promise<void>
  await register(server, {})
  booted = { hooks, decorated, warn }
  return booted
}

function n1Api(state: Booted): N1Api {
  return state.decorated.n1Detector as N1Api
}

function fakeRequest(requestId: string): FakeRequest {
  return {
    id: `id-${requestId}`,
    requestId,
    method: 'GET',
    url: '/api/sse',
    raw: new EventEmitter(),
  }
}

afterEach(async () => {
  if (booted) {
    const close = booted.hooks.onClose?.[0]
    if (close) await close({} as FakeRequest)
  }
  booted = null
  __n1DetectorTest.reset()
  __taskStoreTest.reset()
})

describe('F-44 taskStore / tencentActiveJobs 终态即删 + 兜底 TTL', () => {
  it('任务进入终态后从 taskStore 删除,Map 不再增长', () => {
    const task = createTask('user-1', 'suno', 'music', { id: 'up-1' })
    expect(taskStore.size).toBe(1)
    expect(taskStore.get(task.taskId)).toBe(task)

    task.status = 'succeeded'
    expect(taskStore.has(task.taskId)).toBe(false)
    expect(taskStore.size).toBe(0)

    const failed = createTask('user-1', 'sora2', 'video')
    failed.status = 'failed'
    expect(taskStore.has(failed.taskId)).toBe(false)
    expect(taskStore.size).toBe(0)
  })

  it('列表遍历只含活跃项', () => {
    const active = createTask('user-1', 'agnes', 'video')
    const done = createTask('user-1', 'suno', 'music')
    const cancelled = createTask('user-1', 'luyala', 'video')

    done.status = 'succeeded'
    cancelled.status = 'cancelled'

    const listed = [...taskStore.values()].map((t) => t.taskId)
    expect(listed).toEqual([active.taskId])
  })

  it('无终态回写的孤儿任务由写入时 TTL 清扫', () => {
    const stale = createTask('user-2', 'suno', 'music')
    stale.updatedAt = Date.now() - __taskStoreTest.TASK_STORE_TTL_MS - 1_000

    const fresh = createTask('user-2', 'suno', 'music')

    expect(taskStore.has(stale.taskId)).toBe(false)
    expect(taskStore.has(fresh.taskId)).toBe(true)
    expect(taskStore.size).toBe(1)
  })

  it('腾讯 3D active jobs 按提交时间兜底回收', () => {
    tencentActiveJobs.set('job-old', {
      submitTime: Date.now() - __taskStoreTest.TENCENT_ACTIVE_JOB_TTL_MS - 1_000,
    })
    tencentActiveJobs.set('job-new', { submitTime: Date.now() })

    expect(tencentActiveJobs.has('job-old')).toBe(false)
    expect(tencentActiveJobs.has('job-new')).toBe(true)
  })
})

describe('F-45 requestQueryCounts 对 hijack 长连接的回收', () => {
  it('SSE 断开后计数归零', async () => {
    const state = await bootN1Detector()
    const request = fakeRequest('req-sse')

    await state.hooks.onRequest[0]!(request)
    n1Api(state).recordQuery('req-sse')
    n1Api(state).recordQuery('req-sse')
    expect(n1Api(state).getQueryCount('req-sse')).toBe(2)

    // hijack 后 onResponse 不执行,连接关闭是唯一回收点
    request.raw.emit('close')
    expect(n1Api(state).getQueryCount('req-sse')).toBe(0)
    expect(__n1DetectorTest.size()).toBe(0)
  })

  it('普通请求仍由 onResponse 回收,关闭事件重复清理无副作用', async () => {
    const state = await bootN1Detector()
    const request = fakeRequest('req-normal')

    await state.hooks.onRequest[0]!(request)
    n1Api(state).recordQuery('req-normal')
    expect(n1Api(state).getQueryCount('req-normal')).toBe(1)

    await state.hooks.onResponse[0]!(request)
    expect(n1Api(state).getQueryCount('req-normal')).toBe(0)

    request.raw.emit('close')
    expect(__n1DetectorTest.size()).toBe(0)
  })

  it('超过 TTL 的残留条目在写入清扫时移除', async () => {
    const state = await bootN1Detector()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      n1Api(state).recordQuery('req-stale')

      vi.setSystemTime(new Date(Date.now() + __n1DetectorTest.REQUEST_ENTRY_TTL_MS + 1_000))
      for (let i = 0; i < __n1DetectorTest.SWEEP_EVERY_WRITES; i++) {
        n1Api(state).recordQuery(`req-fresh-${i}`)
      }

      expect(n1Api(state).getQueryCount('req-stale')).toBe(0)
      expect(__n1DetectorTest.size()).toBe(__n1DetectorTest.SWEEP_EVERY_WRITES)
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
