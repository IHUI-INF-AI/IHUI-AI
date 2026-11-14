// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-222 回归锁(2026-11-13)。
 *
 * 病灶:apps/api/src/plugins/scheduler.ts 在**装配期**逐条 `await upsertJobScheduler`(29 条),
 * 而 connection 带 `maxRetriesPerRequest: null` ⇒ Redis 未就绪/宕机时 BullMQ 命令只挂起、
 * 不 reject;插件体永不 resolve,进程既不 listen 也不报错,readiness 恒失败且无错误日志。
 *
 * 本文件锁:
 *   ① 超时:假队列的 upsertJobScheduler 永不 resolve 时,插件装配(app.ready())仍然完成,
 *      产出一条点名"repeatable jobs not registered"的 warn,不抛未捕获异常;
 *   ② 报错:upsertJobScheduler 直接 reject 时同样降级 + warn,装配完成;
 *   ③ 正常:全部 resolve 时逐条注册全部任务、无 warn(与修复前行为一致);
 *   ④ 止血:掐表后原 Promise 迟到 reject 不得变成 unhandledRejection;
 *   ⑤ 自证:把注册换回裸 await,同一假队列下装配永远不完成 ⇒ ①③ 必红(fake timers 控制)。
 *
 * 只 mock bullmq(假 Queue)与 outbox(db 侧),不触达真实 Redis / PG。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  mode: 'resolve' as 'resolve' | 'hang' | 'reject',
  calls: [] as string[],
  closed: 0,
}))

vi.mock('bullmq', () => {
  class FakeQueue {
    constructor(_name: string, _opts: unknown) {}
    upsertJobScheduler(name: string): Promise<unknown> {
      state.calls.push(name)
      if (state.mode === 'hang') return new Promise<never>(() => {})
      if (state.mode === 'reject') return Promise.reject(new Error('connect ECONNREFUSED'))
      return Promise.resolve({ id: name })
    }
    async close(): Promise<void> {
      state.closed += 1
    }
  }
  return { Queue: FakeQueue }
})

// 装配期 onReady 会跑 outbox 启动扫描:桩掉 db 侧,本套件不碰真库。
vi.mock('../src/utils/outbox.js', () => ({
  processOutbox: vi.fn(async () => ({ processed: 0, failed: 0 })),
  cleanupProcessedOutbox: vi.fn(async () => 0),
}))

import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import {
  scheduler,
  SCHEDULED_JOBS,
  SCHEDULER_REGISTER_TIMEOUT_MS,
  registerScheduledJobs,
} from '../src/plugins/scheduler.js'

interface CapturedLog {
  level: string
  obj: Record<string, unknown>
  msg: string
}

/** 假 logger:只为断言降级时必须点名(level=warn + job/registered)。 */
function makeCaptureLogger(sink: CapturedLog[]): Record<string, unknown> {
  const emit = (level: string) => (obj: unknown, msg?: string) => {
    sink.push({ level, obj: (obj ?? {}) as Record<string, unknown>, msg: String(msg ?? '') })
  }
  const logger: Record<string, unknown> = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
  }
  logger.child = () => logger
  return logger
}

function warnLogs(logs: CapturedLog[]): CapturedLog[] {
  return logs.filter((l) => l.level === 'warn')
}

let app: FastifyInstance | undefined
let logs: CapturedLog[]

beforeEach(() => {
  state.mode = 'resolve'
  state.calls.length = 0
  state.closed = 0
  logs = []
})

afterEach(async () => {
  if (app) {
    await app.close()
    app = undefined
  }
  vi.useRealTimers()
})

describe('① 装配期注册有界:Redis 不可用不再永久挂死(F-222)', () => {
  it('upsertJobScheduler 永不 resolve:超时后装配仍完成,并 warn "调度未注册"', async () => {
    state.mode = 'hang'
    app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
    await app.register(scheduler, { registerTimeoutMs: 30 })

    // 修复前这里是永不完结的 await
    await expect(app.ready()).resolves.toBeDefined()

    // 降级即停止逐条重试:只碰过第一条
    expect(state.calls).toEqual([SCHEDULED_JOBS[0]!.name])
    // 队列句柄在降级路径同样已 decorate(onClose 可正常关闭)
    expect(app.schedulerQueue).toBeDefined()

    const warns = warnLogs(logs)
    expect(warns).toHaveLength(1)
    expect(warns[0]!.msg).toContain('not registered')
    expect(warns[0]!.obj).toMatchObject({
      job: SCHEDULED_JOBS[0]!.name,
      registered: 0,
      total: SCHEDULED_JOBS.length,
    })
  })

  it('upsertJobScheduler 直接 reject:降级 + warn,装配完成且无 unhandledRejection', async () => {
    state.mode = 'reject'
    const rejections: unknown[] = []
    const onRejection = (err: unknown) => rejections.push(err)
    process.on('unhandledRejection', onRejection)
    try {
      app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
      await app.register(scheduler, { registerTimeoutMs: 30 })

      await expect(app.ready()).resolves.toBeDefined()

      const warns = warnLogs(logs)
      expect(warns).toHaveLength(1)
      expect(warns[0]!.msg).toContain('not registered')

      // 给迟到的 unhandledRejection 一次落地机会
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })

  it('全部 resolve:逐条注册全部任务,无 warn(修复前行为不变)', async () => {
    state.mode = 'resolve'
    app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
    await app.register(scheduler, { registerTimeoutMs: 30 })

    await expect(app.ready()).resolves.toBeDefined()

    expect(state.calls).toEqual(SCHEDULED_JOBS.map((job) => job.name))
    expect(warnLogs(logs)).toHaveLength(0)
  })
})

describe('② 掐表后的残留 Promise 不得变成 unhandledRejection', () => {
  it('迟到 reject:registerScheduledJobs 已按超时返回,进程不收到未处理拒绝', async () => {
    const rejections: unknown[] = []
    const onRejection = (err: unknown) => rejections.push(err)
    process.on('unhandledRejection', onRejection)
    try {
      const late = new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('late ECONNREFUSED')), 40)
      })
      const queue = { upsertJobScheduler: vi.fn(() => late) }
      const warn = vi.fn()

      const result = await registerScheduledJobs(queue, { warn }, { timeoutMs: 10 })

      expect(result).toMatchObject({
        registered: 0,
        degraded: true,
        reason: 'timeout',
        job: SCHEDULED_JOBS[0]!.name,
      })
      expect(warn).toHaveBeenCalledTimes(1)

      // 等迟到 reject 真正落地
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})

describe('③ 自证:回退成裸 await 即变红', () => {
  it('同一假队列下,裸 await 的装配永远不完成;registerScheduledJobs 则按时超时返回', async () => {
    vi.useFakeTimers()
    try {
      const queue = { upsertJobScheduler: vi.fn(() => new Promise<never>(() => {})) }

      // 复刻修复前插件体的写法(F-222 病灶原样)
      let bareAwaitAssemblyDone = false
      void (async () => {
        for (const job of SCHEDULED_JOBS) {
          await queue.upsertJobScheduler(job.name, {}, {})
        }
        bareAwaitAssemblyDone = true
      })()

      await vi.advanceTimersByTimeAsync(SCHEDULER_REGISTER_TIMEOUT_MS * 3)
      // 裸 await 版本恒挂 ⇒ 与 ①/③ 的"超时后装配仍完成"断言互斥,回退即变红
      expect(bareAwaitAssemblyDone).toBe(false)

      // 对照:同一条假队列走 registerScheduledJobs 会按时降级返回
      const bounded = registerScheduledJobs(queue, { warn: vi.fn() }, { timeoutMs: 10 })
      await vi.advanceTimersByTimeAsync(11)
      await expect(bounded).resolves.toMatchObject({ degraded: true, reason: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })
})
