// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// SDB-43 回归锁:告警巡检自己查库失败,不得被读成「判过且 0 条」,也不得只进 errors 不上报。
//
// 三条断言各钉一段:
// ① 聚合查询抛错 ⇒ errors 非空且 escalated=1。备份链在用例里是**干净**的(两库都有新鲜档),
//    排除"别的成因碰巧让 escalated=1",只留 errors 这一条解释。
// ② worker 的 alert-check-daily 分支必须真的把错误摘要送进 pushAlert;
//    关键的是**备份告警同时也存在**的场景 —— 修复前 errors 摘要挂在
//    `backupAlerts.length === 0` 之下,这种场景会被整条跳过(既不升级也不上报)。
// ③ 无错路径 escalated 不得恒为 1,健康时不发任何告警。
//
// 全程不连库、不碰真实备份目录:db.select / node:fs/promises 都是可注入的假实现。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type * as NodeFsPromises from 'node:fs/promises'

const state = vi.hoisted(() => ({
  failDb: false,
  dbError: 'audit_logs 查询失败: connect ECONNREFUSED 127.0.0.1:5432',
  /** 两次聚合查询各自的 count(依次:本窗口 checked、上一窗口 resolved) */
  counts: [0, 0] as number[],
  selectCalls: 0,
  /** 备份目录里"看得到"的文件名;缺某个库的名字 = 该库判缺失,备份告警非空 */
  backupFiles: [] as string[],
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFsPromises>()
  return {
    ...actual,
    readdir: vi.fn(async () => state.backupFiles),
    stat: vi.fn(async () => ({ size: 2048, mtimeMs: Date.now() })),
  }
})

vi.mock('../src/db/index.js', () => {
  function builder(): Record<string, unknown> {
    const idx = state.selectCalls++
    const b: Record<string, unknown> = {
      from: () => b,
      where: () => Promise.resolve([{ count: state.counts[idx] ?? 0 }]),
    }
    return b
  }
  const stub = {
    select: () => {
      if (state.failDb) throw new Error(state.dbError)
      return builder()
    },
  }
  return {
    db: stub,
    dbRead: stub,
    dbScoped: stub,
    dbReadScoped: stub,
    dbClient: {},
    returningOne: vi.fn(),
    poolLeakDetector: {},
    stopPoolTracker: vi.fn(),
    registerPoolTrackerCleanup: vi.fn(),
    closeDbPools: vi.fn(),
  }
})

// 不连 Redis:只截获 processor,由用例直接驱动
vi.mock('../src/plugins/queue.js', () => ({ createWorker: vi.fn() }))
vi.mock('../src/services/alert-notification-service.js', () => ({
  pushAlert: vi.fn(async () => undefined),
  pushAlertWithResult: vi.fn(async () => ({ ok: true })),
}))

import { checkDailyAlerts } from '../src/services/alert-check-service.js'
import { startSchedulerWorker } from '../src/workers/scheduler-worker.js'
import { createWorker } from '../src/plugins/queue.js'
import { pushAlert } from '../src/services/alert-notification-service.js'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedPushAlert = vi.mocked(pushAlert)

const BOTH_FRESH = ['ihui_dev_20261111_0400.dump', 'keycloak_20261111_0400.dump']

function makeServer(): FastifyInstance {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    startBizTimer: vi.fn(() => ({ end: vi.fn() })),
    recordJobExecution: vi.fn(),
  } as unknown as FastifyInstance
}

/** 起 worker、取出 processor、跑一次 alert-check-daily(不连 BullMQ) */
async function runAlertCheckJob(): Promise<void> {
  mockedCreateWorker.mockClear()
  startSchedulerWorker(makeServer())
  expect(mockedCreateWorker).toHaveBeenCalled()
  const processor = mockedCreateWorker.mock.calls[0]![2] as (job: {
    id?: string
    name: string
  }) => Promise<unknown>
  await processor({ id: 'job-sdb43', name: 'alert-check-daily' })
}

function alertMessages(): string[] {
  return mockedPushAlert.mock.calls.map((c) => String((c[0] as { message: unknown }).message))
}

beforeEach(() => {
  state.failDb = false
  state.counts = [0, 0]
  state.selectCalls = 0
  state.backupFiles = []
  mockedPushAlert.mockClear()
})

describe('SDB-43:巡检自身失败 ⇒ 进 escalated 且进告警', () => {
  it('① 聚合查询抛错 ⇒ errors 非空、escalated=1(备份链干净,排除别的成因)', async () => {
    state.failDb = true
    state.backupFiles = BOTH_FRESH
    const res = await checkDailyAlerts()

    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]).toContain('ECONNREFUSED')
    // 「没判到」不得写成「判过且 0 条」
    expect(res.checked).toBe(0)
    expect(res.resolved).toBe(0)
    // 备份这一侧本轮无任何问题 ⇒ escalated=1 只可能来自 errors
    expect(res.backupIssues).toEqual([])
    expect(res.backupUndetermined).toEqual([])
    expect(res.backupAlerts).toEqual([])
    expect(res.escalated).toBe(1)
  })

  it('② worker 把错误摘要推进告警(备份告警同时存在时也不得被吞)', async () => {
    state.failDb = true
    // 只看到 ihui_dev 的档 ⇒ keycloak 判"缺失" ⇒ backupAlerts 非空
    state.backupFiles = ['ihui_dev_20261111_0400.dump']

    await runAlertCheckJob()

    const messages = alertMessages()
    const errorAlert = messages.find((m) => m.includes('告警检查自身失败'))
    expect(errorAlert, 'errors 非空却没有一条告警正文带失败摘要 —— 又变成「没判到」无声').toBeTruthy()
    expect(errorAlert!).toContain('ECONNREFUSED')
    // 备份告警与自身失败是两件事,各自都要到人
    expect(messages.some((m) => m.includes('keycloak'))).toBe(true)
  })

  it('③ 无错路径 escalated 不恒为 1,健康时不推任何告警', async () => {
    state.backupFiles = BOTH_FRESH

    const quiet = await checkDailyAlerts()
    expect(quiet.errors).toEqual([])
    expect(quiet.escalated).toBe(0)

    mockedPushAlert.mockClear()
    await runAlertCheckJob()
    expect(mockedPushAlert).not.toHaveBeenCalled()

    // 阈值那一档照旧该升:近 24h 错误数 51
    state.counts = [51, 0]
    state.selectCalls = 0
    const loud = await checkDailyAlerts()
    expect(loud.errors).toEqual([])
    expect(loud.escalated).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
