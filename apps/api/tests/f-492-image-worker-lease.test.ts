// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-492 回归 —— 生图 worker 必须持租约:抢占失败跳过、写回校验归属、失败释放可重试。
 *
 * 存储面说明:图片任务落 Redis(键 `imgtask:{id}`),并不存在 DB 表/`locked_by` 列;
 * 等价租约由 `SET imgtask-claim:{id} <token> EX 900 NX` 原子承载,任务记录内的
 * claimToken/claimedAt 即归属与租约时间(15 分钟,与既有 F-48 实现一致)。
 *
 * 本文件钉住四件事:
 *  ① 抢占失败(租约被其他实例持有)⇒ 直接跳过,不调上游生图;
 *  ② 抢占成功才处理,完成后归还租约;
 *  ③ 完成/失败写回带归属条件:令牌易主时丢弃本次结果,不覆写他人产出、不假报成功;
 *  ④ 失败释放租约(仅令牌匹配才释放),任务可被重新认领重试。
 *
 * 零连库、零真实 Redis、零真实上游:FakeRedis 承载任务与租约,forwardToChannel 全程 mock。
 */
import type { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  upstreamMode: 'ok' as 'ok' | 'throw',
  upstreamCalls: 0,
  /** 上游调用期间的回调:模拟「慢调用期间租约过期,任务被另一实例重新认领」。 */
  duringUpstream: null as null | (() => void),
}))

vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: async () => {
    state.upstreamCalls++
    state.duringUpstream?.()
    state.duringUpstream = null
    if (state.upstreamMode === 'throw') throw new Error('上游超时')
    return {
      ok: true,
      response: {
        json: async () => ({ data: [{ url: 'https://img.test/lease.png' }] }),
      },
    }
  },
}))

const { getImageTask, __setImageTaskRedisForTest } = await import('../src/routes/v1-multimodal.js')
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
  state.duringUpstream = null
})

afterEach(() => {
  __setImageTaskRedisForTest(null)
})

describe('F-492 生图 worker 租约', () => {
  it('① 抢占失败(租约被其他实例持有)⇒ 跳过且不调上游生图', async () => {
    // 认领者崩溃留下的现场:任务卡 processing 且 claimedAt 已过租约,但租约键还在别人手里
    seedTask('t-held', {
      status: 'processing',
      claimedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    })
    redis.store.set('imgtask-claim:t-held', 'other-instance-token')

    const r = await processImageTasks()

    expect(state.upstreamCalls).toBe(0)
    expect(r).toMatchObject({ processed: 1, ok: 0, failed: 0 })
    const task = await getImageTask('t-held')
    expect(task?.status).toBe('processing')
    expect(task?.claimToken).toBeUndefined()
    // 抢占失败方不得动他人租约键
    expect(redis.store.get('imgtask-claim:t-held')).toBe('other-instance-token')
  })

  it('② 抢占成功才处理:调一次上游并归还租约', async () => {
    seedTask('t-claimed')

    const r = await processImageTasks()

    expect(r).toMatchObject({ processed: 1, ok: 1, failed: 0 })
    expect(state.upstreamCalls).toBe(1)
    const task = await getImageTask('t-claimed')
    expect(task?.status).toBe('succeeded')
    expect(task?.result).toEqual(['https://img.test/lease.png'])
    // 结算后租约归还,不残留锁
    expect(redis.store.has('imgtask-claim:t-claimed')).toBe(false)
  })

  it('③ 完成写回带归属条件:令牌易主后旧实例结果被丢弃,不覆写新认领者', async () => {
    seedTask('t-takeover')
    state.duringUpstream = () => {
      // 慢调用期间租约过期,另一实例已重新认领(令牌换成它的)
      writeTaskRaw('t-takeover', {
        ...readTaskRaw('t-takeover'),
        status: 'processing',
        claimToken: 'newer-instance-token',
        claimedAt: new Date().toISOString(),
      })
    }

    const r = await processImageTasks()

    expect(state.upstreamCalls).toBe(1)
    const task = await getImageTask('t-takeover')
    expect(task?.status).toBe('processing')
    expect(task?.claimToken).toBe('newer-instance-token')
    expect(task?.result).toBeUndefined()
    // 被拒的写回不计 ok/failed,避免上报假成功
    expect(r).toMatchObject({ ok: 0, failed: 0 })
  })

  it('④ 失败释放租约:失败后任务可被重新认领重试', async () => {
    seedTask('t-retry')
    state.upstreamMode = 'throw'

    const first = await processImageTasks()

    expect(first).toMatchObject({ processed: 1, ok: 0, failed: 1 })
    expect(redis.store.has('imgtask-claim:t-retry')).toBe(false)
    const failedTask = await getImageTask('t-retry')
    expect(failedTask?.status).toBe('failed')
    expect(failedTask?.error).toBe('上游超时')

    // 重试投递:租约已释放,重新入 pending 后可立即再次抢占并处理
    writeTaskRaw('t-retry', { ...readTaskRaw('t-retry'), status: 'pending', error: undefined })
    state.upstreamMode = 'ok'
    const second = await processImageTasks()

    expect(second).toMatchObject({ processed: 1, ok: 1, failed: 0 })
    expect(state.upstreamCalls).toBe(2)
    expect((await getImageTask('t-retry'))?.status).toBe('succeeded')
  })
})
