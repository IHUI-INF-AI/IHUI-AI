// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-48 回归 —— 异步图片任务必须原子认领(pending → processing 不能是「先读后写」两步)。
 *
 * 缺陷:worker 用 getImageTask 只读判断 `status !== 'pending'` 再处理,两个 worker
 * (或重复投递)可同时通过判断 → 同一任务重复调上游生图、重复计费。
 *
 * 本文件钉住四件事:
 *  ① 同一任务的并发认领只有一个成功(SET NX 租约是原子仲裁点);
 *  ② worker 拿不到认领就直接跳过,不重复执行、不重复调上游;
 *  ③ 失败释放租约并置 failed;非当前认领令牌的推进被丢弃(不做他人任务的凶手);
 *  ④ 认领者崩溃(状态卡 processing)后,租约过期可被回收。
 *
 * 零连库、零真实 Redis、零真实上游:任务存储用内存版 FakeRedis,forwardToChannel 全程 mock。
 */
import type { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  upstreamMode: 'ok' as 'ok' | 'throw' | 'empty',
  upstreamCalls: 0,
}))

vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: async () => {
    state.upstreamCalls++
    if (state.upstreamMode === 'throw') throw new Error('上游超时')
    if (state.upstreamMode === 'empty') {
      return { ok: true, response: { json: async () => ({ data: [] }) } }
    }
    return { ok: true, response: { json: async () => ({ data: [{ url: 'https://img.test/1.png' }] }) } }
  },
}))

const {
  claimImageTask,
  completeImageTask,
  failImageTask,
  getImageTask,
  listPendingImageTasks,
  __setImageTaskRedisForTest,
} = await import('../src/routes/v1-multimodal.js')
const { processImageTasks } = await import('../src/workers/image-task-worker.js')

/** 仅实现本票用到的命令:set(NX/EX) / get / del / keys。 */
class FakeRedis {
  readonly store = new Map<string, string>()

  async set(key: string, value: string, ...rest: unknown[]): Promise<'OK' | null> {
    if (rest.includes('NX') && this.store.has(key)) return null
    this.store.set(key, value)
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
    return [...this.store.keys()].filter((k) => k.startsWith(prefix))
  }
}

let redis: FakeRedis

function seedTask(id: string, extra: Record<string, unknown> = {}): void {
  redis.store.set(
    `imgtask:${id}`,
    JSON.stringify({
      id,
      status: 'pending',
      model: 'gpt-image-1',
      prompt: 'a cat',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      ...extra,
    }),
  )
}

function readTaskRaw(id: string): Record<string, unknown> {
  return JSON.parse(redis.store.get(`imgtask:${id}`) ?? '{}') as Record<string, unknown>
}

function writeTaskRaw(id: string, value: Record<string, unknown>): void {
  redis.store.set(`imgtask:${id}`, JSON.stringify(value))
}

beforeEach(() => {
  redis = new FakeRedis()
  __setImageTaskRedisForTest(redis as unknown as Redis)
  state.upstreamMode = 'ok'
  state.upstreamCalls = 0
})

afterEach(() => {
  __setImageTaskRedisForTest(null)
})

describe('F-48 异步图片任务原子认领', () => {
  it('同一任务被两个 worker 同时认领,只有一个拿到令牌', async () => {
    seedTask('t-concurrent')

    const [a, b] = await Promise.all([claimImageTask('t-concurrent'), claimImageTask('t-concurrent')])

    expect([a, b].filter((t) => t !== null)).toHaveLength(1)
    const task = await getImageTask('t-concurrent')
    expect(task?.status).toBe('processing')
    // 任务的认领令牌必须是唯一成功那一次,不是「后写覆盖」
    expect(task?.claimToken).toBe(a ?? b)
    // 认领租约键留在 Redis 中,直到处理结束
    expect(redis.store.get('imgtask-claim:t-concurrent')).toBe(a ?? b)
  })

  it('重复投递不重复执行:首次成功后再扫不会二次调上游', async () => {
    seedTask('t-once')

    const first = await processImageTasks()
    const second = await processImageTasks()

    expect(first).toMatchObject({ processed: 1, ok: 1, failed: 0 })
    expect(second).toMatchObject({ processed: 0, ok: 0, failed: 0 })
    expect(state.upstreamCalls).toBe(1)
    const task = await getImageTask('t-once')
    expect(task?.status).toBe('succeeded')
    expect(task?.result).toEqual(['https://img.test/1.png'])
    // 结算后归还认领租约,不残留锁
    expect(redis.store.has('imgtask-claim:t-once')).toBe(false)
  })

  it('任务已被其他 worker 持锁(租约未过期)时,本 worker 跳过且不调上游', async () => {
    // processing + 过期 claimedAt ⇒ 会被 listPending 回收,但租约键还在别人手里
    seedTask('t-held', {
      status: 'processing',
      claimedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })
    redis.store.set('imgtask-claim:t-held', 'other-worker-token')

    const r = await processImageTasks()

    expect(state.upstreamCalls).toBe(0)
    expect(r).toMatchObject({ processed: 1, ok: 0, failed: 0 })
    expect((await getImageTask('t-held'))?.status).toBe('processing')
  })

  it('处理失败置 failed 并释放租约', async () => {
    seedTask('t-fail')
    state.upstreamMode = 'throw'

    const r = await processImageTasks()

    expect(r).toMatchObject({ processed: 1, ok: 0, failed: 1 })
    const task = await getImageTask('t-fail')
    expect(task?.status).toBe('failed')
    expect(task?.error).toBe('上游超时')
    expect(redis.store.has('imgtask-claim:t-fail')).toBe(false)
  })

  it('非当前认领令牌的失败/完成被丢弃(旧 worker 不能把他人任务置终态)', async () => {
    seedTask('t-stale')
    const mine = await claimImageTask('t-stale')
    expect(mine).toBeTruthy()

    // 模拟租约过期后另一 worker 重新认领
    const takenOver = readTaskRaw('t-stale')
    writeTaskRaw('t-stale', {
      ...takenOver,
      status: 'processing',
      claimToken: 'newer-worker-token',
      claimedAt: new Date().toISOString(),
    })

    expect(await failImageTask('t-stale', '旧 worker 失败', mine ?? undefined)).toBe(false)
    expect(await completeImageTask('t-stale', ['https://img.test/old.png'], mine ?? undefined)).toBe(
      false,
    )
    const task = await getImageTask('t-stale')
    expect(task?.status).toBe('processing')
    expect(task?.error).toBeUndefined()
    expect(task?.result).toBeUndefined()
  })

  it('认领者崩溃(卡 processing)后租约过期可被回收重跑', async () => {
    seedTask('t-crash')
    const crashed = await claimImageTask('t-crash')
    expect(crashed).toBeTruthy()

    // 崩溃现场:租约键随 TTL 消失,任务停在 processing 且 claimedAt 已超 15 分钟租约
    redis.store.delete('imgtask-claim:t-crash')
    writeTaskRaw('t-crash', {
      ...readTaskRaw('t-crash'),
      claimedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })

    const listed = await listPendingImageTasks()
    expect(listed.map((t) => t.id)).toContain('t-crash')

    const reclaimed = await claimImageTask('t-crash')
    expect(reclaimed).toBeTruthy()
    expect(reclaimed).not.toBe(crashed)
    expect((await getImageTask('t-crash'))?.claimToken).toBe(reclaimed)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
