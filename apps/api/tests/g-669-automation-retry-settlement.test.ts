// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-669 自动化重试按确定性分流 —— 行为验收(2026-10-01 立)。
 *
 * 覆盖票面四条互不顶账的判据 + 一条"成功路径不变"的对照:
 *  ① permanent(缺凭据/4xx/rrule)⇒ **第二次 tick 不再被取出**(不再每 60s 无限重放);
 *  ② transient ⇒ 有界退避(单调不减)且**超过上限后不再重试**;
 *  ③ 结算只发生一次(每次执行恰好一条 update;重复 tick 不二次落库);
 *  ④ 票面没写但决定验收能否过的 B 格:`consumeAgentStream` 的非 ok 响应(401/403/400)
 *     **不再被当成功**(不被"成功语义"覆盖、status 转 paused、停止重排)。
 * 另有 ledger.release 与 orchestrator 的 `TickReport.dropped` 点名(C 格)。
 *
 * 取证口径(为什么这样才算"行为断言",不是"我加了写时间戳的代码"):
 * - db 是**内存替身**:select 返回全表快照,update 按 where 条件里的参数落回同一行。
 *   到期判定不由替身做,而由生产代码的 JS 复核 `isAutomationDue` 做(tick 的真实决策路径),
 *   所以"第二次还取不取"是跑出来的,不是断言出来的。
 * - SQL 侧与 JS 侧是同一条规则的两个投影:本文件末尾用 `PgDialect` 把
 *   `automationDueConditions` 渲染成 SQL 文本,逐分支核它确实覆盖了 JS 判据读的那些列 ——
 *   否则"JS 挡住了"这句话只是半个答案。
 * - 时钟用 `vi.useFakeTimers({toFake:['Date']})` 钉死:executeAutomation 内部 `new Date()`
 *   必须等于我这一轮喂给 tick 的时刻,不然退避步长不可断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UserAutomation } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

type Row = UserAutomation
type Patch = Record<string, unknown>

/** 内存替身的可访问句柄(由 vi.mock 工厂暴露,与 admin-agreements/d30 测试同范本)。 */
interface DbMockHandles {
  __setRows: (rows: Row[]) => void
  __getRow: (id: string) => Row | undefined
  __updates: () => Array<{ id: string | null; patch: Patch }>
  __reset: () => void
}

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const state: { rows: Map<string, Row>; updates: Array<{ id: string | null; patch: Patch }> } = {
    rows: new Map(),
    updates: [],
  }

  const snapshot = (): Row[] => Array.from(state.rows.values(), (r) => ({ ...r }))

  /** 从 where 条件里取被更新行的 id(渲染成参数表,不碰 drizzle 私有结构)。 */
  const targetIdOf = (cond: unknown): string | null => {
    const rendered = dialect.sqlToQuery(cond as never)
    for (const param of rendered.params) {
      if (typeof param === 'string' && state.rows.has(param)) return param
    }
    return null
  }

  const selectChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Row[]) => unknown) => Promise.resolve(snapshot()).then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) chain[m] = () => chain
    return chain
  }

  const handles: DbMockHandles = {
    __setRows: (rows) => {
      state.rows = new Map(rows.map((r) => [r.id, r]))
    },
    __getRow: (id) => state.rows.get(id),
    __updates: () => state.updates,
    __reset: () => {
      state.rows = new Map()
      state.updates = []
    },
  }

  return {
    ...handles,
    db: {
      select: vi.fn(() => selectChain()),
      update: vi.fn(() => {
        let pending: Patch = {}
        const chain: Record<string, unknown> = {
          set: (patch: Patch) => {
            pending = patch
            return chain
          },
          where: (cond: unknown) => {
            const id = targetIdOf(cond)
            state.updates.push({ id, patch: pending })
            if (id !== null) {
              const current = state.rows.get(id)
              if (current) state.rows.set(id, { ...current, ...pending } as Row)
            }
            return chain
          },
          then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }
        for (const m of ['returning', 'orderBy']) chain[m] = () => chain
        return chain
      }),
    },
    dbRead: { select: vi.fn(() => selectChain()) },
  }
})

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetchStream: vi.fn(),
}))

const dbMock = (await import('../src/db/index.js')) as unknown as DbMockHandles
const streamMock = vi.mocked((await import('../src/utils/ai-service-fetch.js')).aiServiceFetchStream)
const {
  runAutomationTick,
  executeAutomation,
  isAutomationDue,
  automationDueConditions,
  transientBackoffMs,
  MAX_TRANSIENT_ATTEMPTS,
} = await import('../src/services/agent-automation-scheduler.js')
const { describeAutomationFailure, classifyAutomationFailure } = await import(
  '../src/services/automations/failure-class.js'
)

// =============================================================================
// 夹具
// =============================================================================

let seq = 0
const nextId = (): string => {
  seq += 1
  return `00000000-0000-4000-8000-0000000000${String(seq).padStart(2, '0')}`
}

function makeRow(over: Partial<Row> = {}): Row {
  const id = over.id ?? nextId()
  return {
    id,
    userId: 'u-1',
    name: '测试自动化',
    prompt: '跑一下',
    scheduleType: 'once',
    rrule: null,
    scheduledAt: new Date('2026-10-01T00:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    status: 'active',
    conversationId: null,
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
    attempt: 0,
    lastError: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...over,
  }
}

/** 抛穿型失败(走 catch)。statusCode 用于"error 对象自带状态码"那一档判据。 */
function streamThrows(message: string, statusCode?: number): void {
  streamMock.mockImplementation(async () => {
    const err = new Error(message)
    if (statusCode !== undefined) Object.assign(err, { statusCode })
    throw err
  })
}

/** 上游响应(走 consumeAgentStream)。非 ok = B 格那条路。 */
function streamResponds(status: number): void {
  streamMock.mockResolvedValue(new Response('{"error":"Invalid or expired token"}', { status }))
}

/** 正常 SSE 流:一个 summary 事件后结束。 */
function streamSummarizes(summary: string): void {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: {"summary":"${summary}"}\n\n`))
      controller.close()
    },
  })
  streamMock.mockResolvedValue(new Response(body, { status: 200 }))
}

const T0 = new Date('2026-10-01T00:00:00.000Z')

/** console.warn 采集(scheduler 的"点名"面就住在这里;不静默 = 可断言)。 */
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  dbMock.__reset()
  streamMock.mockReset()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  // 只还原 console 探针 —— restoreAllMocks 会连带 reset 掉 db 工厂里的 vi.fn,
  // 那会让下一个用例拿到 undefined 链(与判据无关的自伤)
  warnSpy.mockRestore()
})

/** 到当前为止,上游真的被打过几次。 */
const upstreamCalls = (): number => streamMock.mock.calls.length
const warnedText = (): string =>
  warnSpy.mock.calls
    .flat()
    .map((part) => (typeof part === 'string' ? part : ''))
    .join('\n')

// =============================================================================
// ① permanent:第二次 tick 不再被取出(票面验收"缺凭据类错误 ⇒ 第二次不再重放并显示 paused")
// =============================================================================

describe('G-669 ① permanent 置终态后不再重放', () => {
  it('catch 抛穿的缺凭据错误 ⇒ 第一次执行后落 paused,第二次 tick 不再执行', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamThrows('Invalid or expired token')

    await runAutomationTick(T0)
    expect(upstreamCalls()).toBe(1)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    expect(settled.lastRunAt).toBeInstanceOf(Date)
    expect(settled.updatedAt).toBeInstanceOf(Date)
    expect(settled.nextRunAt).toBeNull()
    expect(settled.lastError).toContain('permanent')

    // 行为断言(不是"我加了写时间戳的代码"):再跑两次 tick,一次也不许被取出
    await runAutomationTick(new Date(T0.getTime() + 60_000))
    await runAutomationTick(new Date(T0.getTime() + 3_600_000))
    expect(upstreamCalls()).toBe(1)
    // 被复核挡下的行必须点名(不得静默丢)
    expect(warnedText()).toContain(row.id)
    expect(warnedText()).toContain('不再到期')
  })

  it('401 响应经分类器判 permanent(缺凭据形状),而 500/429 判 transient', () => {
    expect(classifyAutomationFailure({ status: 401 })).toBe('permanent')
    expect(classifyAutomationFailure({ status: 403 })).toBe('permanent')
    expect(classifyAutomationFailure({ status: 400 })).toBe('permanent')
    expect(classifyAutomationFailure({ status: 500 })).toBe('transient')
    expect(classifyAutomationFailure({ status: 503 })).toBe('transient')
    expect(classifyAutomationFailure({ status: 429 })).toBe('transient')
    expect(classifyAutomationFailure({ status: 408 })).toBe('transient')
  })
})

// =============================================================================
// ② transient:有界退避,超上限不再重试
// =============================================================================

describe('G-669 ② transient 回队 + 有界退避', () => {
  it('transient 首次失败 ⇒ attempt=1、nextRunAt=now+5min、status 仍 active', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamThrows('fetch failed')

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('active')
    expect(settled.attempt).toBe(1)
    expect(settled.nextRunAt!.getTime() - T0.getTime()).toBe(transientBackoffMs(1))
    expect(settled.lastError).toContain('transient')
  })

  it('退避未到不执行;到期执行;连续 transient 共 MAX+1 次后落 paused 且不再重试', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamThrows('socket hang up')

    const gaps: number[] = []
    let cursor = T0.getTime()
    let executions = 0

    for (let round = 0; round < 40; round++) {
      const at = new Date(cursor)
      vi.setSystemTime(at)
      const callsBefore = upstreamCalls()
      await runAutomationTick(at)
      const ran = upstreamCalls() - callsBefore
      if (ran === 0) {
        // 退避窗口内的 tick 必须一次都不执行(否则就是每 60s 重放)
        continue
      }
      executions += ran
      const settled = dbMock.__getRow(row.id)!
      if (settled.status === 'paused') break
      const wait = settled.nextRunAt!.getTime() - settled.lastRunAt!.getTime()
      gaps.push(wait)
      // 退避窗口内(差 1ms)一次都不许执行 —— 这就是"不再每 60s 重放"的正证
      const dueAt = settled.nextRunAt!
      const callsAtBoundary = upstreamCalls()
      vi.setSystemTime(new Date(dueAt.getTime() - 1))
      await runAutomationTick(new Date(dueAt.getTime() - 1))
      expect(upstreamCalls()).toBe(callsAtBoundary)
      cursor = dueAt.getTime()
    }

    // 恰好 MAX+1 次执行:首跑 + MAX 次 transient 重试,第 MAX+1 次失败即终态
    expect(executions).toBe(MAX_TRANSIENT_ATTEMPTS + 1)
    expect(gaps).toHaveLength(MAX_TRANSIENT_ATTEMPTS)
    // 期望值**独立写死**(分钟档),不拿被测函数自己当期望 —— 否则退避函数整体算错也不会红
    expect(gaps).toEqual([5, 10, 20, 40, 80, 160, 320, 360].map((m) => m * 60_000))
    // 单调不减
    for (let n = 1; n < gaps.length; n++) expect(gaps[n]!).toBeGreaterThanOrEqual(gaps[n - 1]!)

    const final = dbMock.__getRow(row.id)!
    expect(final.status).toBe('paused')
    expect(final.nextRunAt).toBeNull()
    expect(final.attempt).toBe(MAX_TRANSIENT_ATTEMPTS)
    expect(final.lastError).toContain('重试已达上限')

    // 第 N+1 次:推到很远的将来也不再被取出
    const executionsBefore = upstreamCalls()
    for (let extra = 0; extra < 5; extra++) {
      const far = new Date(final.updatedAt.getTime() + extra * 86_400_000)
      vi.setSystemTime(far)
      await runAutomationTick(far)
    }
    expect(upstreamCalls()).toBe(executionsBefore)
  })

  it('退避函数:单调不减、封顶不越界', () => {
    expect(transientBackoffMs(1)).toBe(5 * 60_000)
    expect(transientBackoffMs(2)).toBe(10 * 60_000)
    let prev = 0
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30, 1000]) {
      const ms = transientBackoffMs(n)
      expect(ms).toBeGreaterThanOrEqual(prev)
      expect(ms).toBeLessThanOrEqual(6 * 60 * 60_000)
      prev = ms
    }
    // 非正/非有限输入不得产出 0 或 NaN(退避为 0 等于无限重放)
    expect(transientBackoffMs(0)).toBe(5 * 60_000)
    expect(transientBackoffMs(Number.NaN)).toBe(5 * 60_000)
  })

  it('recurring 的 transient 也走同一条回队路(nextRunAt=退避点,成功后回归 rrule 排程)', async () => {
    const row = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])
    streamThrows('fetch failed')

    await runAutomationTick(T0)
    const afterFail = dbMock.__getRow(row.id)!
    expect(afterFail.attempt).toBe(1)
    expect(afterFail.nextRunAt!.getTime()).toBe(T0.getTime() + transientBackoffMs(1))

    streamSummarizes('报告已生成')
    const t1 = afterFail.nextRunAt!
    vi.setSystemTime(t1)
    await runAutomationTick(t1)
    const afterOk = dbMock.__getRow(row.id)!
    expect(afterOk.attempt).toBe(0)
    expect(afterOk.lastError).toBeNull()
    // 成功后 nextRunAt 由 rrule 重算(按行上 timezone 的墙钟 09:00),不再是退避点
    expect(afterOk.nextRunAt!.getTime()).toBeGreaterThan(t1.getTime())
    expect(afterOk.nextRunAt!.getTime()).not.toBe(t1.getTime() + transientBackoffMs(1))
  })
})

// =============================================================================
// ③ 结算只发生一次(幂等)
// =============================================================================

describe('G-669 ③ 一次执行只结算一次', () => {
  it('每次执行恰好一条 update;重复 tick 不二次落库', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamThrows('fetch failed')

    await runAutomationTick(T0)
    expect(dbMock.__updates()).toHaveLength(1)

    // 同一个 now 再跑一次:行已不再到期 ⇒ 既不执行也不写库
    await runAutomationTick(T0)
    expect(dbMock.__updates()).toHaveLength(1)

    // 到期后第二次执行 ⇒ 恰好第二条(不是每次执行两条)
    const next = dbMock.__getRow(row.id)!.nextRunAt!
    vi.setSystemTime(next)
    await runAutomationTick(next)
    const updates = dbMock.__updates()
    expect(updates).toHaveLength(2)
    expect(updates.every((u) => u.id === row.id)).toBe(true)
  })

  it('成功路径也只写一条 update', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamSummarizes('每日报告')
    await runAutomationTick(T0)
    expect(dbMock.__updates()).toHaveLength(1)
  })
})

// =============================================================================
// ④ B 格:非 ok 响应不得被当成功
// =============================================================================

describe('G-669 ④ 非 ok 响应(401 = 缺凭据形状)不被当成功', () => {
  it('401 响应 ⇒ 分类 permanent ⇒ paused + last_error,且不落"成功语义"', async () => {
    const row = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])
    streamResponds(401)

    await runAutomationTick(T0)
    expect(upstreamCalls()).toBe(1)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    // lastRunAt **必须**落(A 格的解药就是"失败也留时间戳"),但它不得带着成功语义:
    // 成功结算的三件标志 —— lastError=null、按 rrule 重排出 nextRunAt、summary 是真摘要 ——
    // 一件都不许出现在这条 401 路径上。
    expect(settled.lastRunAt).toBeInstanceOf(Date)
    expect(settled.lastError).toContain('permanent:status:401')
    expect(settled.nextRunAt).toBeNull() // 停止重排,而不是按 rrule 排下一次
    expect(settled.lastResult?.summary.startsWith('执行失败')).toBe(true)
    expect(settled.attempt).toBe(0) // 首跑就永久失败,不该被计成"重试过一次"

    // 第二次 tick 不再被取出
    const later = new Date(T0.getTime() + 86_400_000)
    vi.setSystemTime(later)
    const callsBefore = upstreamCalls()
    await runAutomationTick(later)
    expect(upstreamCalls()).toBe(callsBefore)
    expect(streamMock).toHaveBeenCalledTimes(1)
  })

  it('503 响应 ⇒ transient 回队(不因上游抖动停掉用户的定时任务)', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamResponds(503)

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('active')
    expect(settled.attempt).toBe(1)
    expect(settled.lastResult?.summary.startsWith('执行失败')).toBe(true)
  })

  it('run-now 侧:非 ok 响应返回 null(调用方按 502 处理),不再返回 200 + "执行完成"', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamResponds(403)
    await expect(executeAutomation(row, null)).resolves.toBeNull()
  })
})

// =============================================================================
// 对照:正常成功路径行为一字未变
// =============================================================================

describe('G-669 对照:成功路径不变', () => {
  it('once 成功 ⇒ lastRunAt/lastResult/updatedAt 与改造前同形,status 仍 active', async () => {
    const row = makeRow({ nextRunAt: new Date(T0.getTime() - 1) })
    dbMock.__setRows([row])
    streamSummarizes('每日报告')

    await runAutomationTick(T0)
    expect(upstreamCalls()).toBe(1)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.lastRunAt).toEqual(T0)
    expect(settled.updatedAt).toEqual(T0)
    expect(settled.lastResult).toEqual({
      finishedAt: T0.toISOString(),
      summary: '每日报告',
    })
    expect(settled.status).toBe('active')
    expect(settled.attempt).toBe(0)
    expect(settled.lastError).toBeNull()
    // 一次性任务成功后不再被取出(nextRunAt 被显式清掉,legacy 的 scheduled_at 值不会顶成重试位)
    expect(settled.nextRunAt).toBeNull()
    const later = new Date(T0.getTime() + 86_400_000)
    vi.setSystemTime(later)
    const callsBefore = upstreamCalls()
    await runAutomationTick(later)
    expect(upstreamCalls()).toBe(callsBefore)
  })

  it('recurring 成功 ⇒ nextRunAt 等于 parseNextRun 的产出(墙钟按行上 timezone)', async () => {
    const rrule = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0'
    const row = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule,
      timezone: 'Asia/Shanghai',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])
    streamSummarizes('日报')

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.nextRunAt!.getTime()).toBe(new Date('2026-10-01T01:00:00.000Z').getTime())
    expect(settled.status).toBe('active')
  })

  it('rrule 非法 ⇒ 仍按改造前落 paused,并额外留下 last_error(摘要仍返回,run-now 不因此变 502)', async () => {
    const row = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=NONSENSE',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])
    streamSummarizes('日报')

    await expect(executeAutomation(row, null)).resolves.toBe('日报')
    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    expect(settled.nextRunAt).toBeNull()
    expect(settled.lastError).toContain('rrule')
    expect(settled.lastResult?.summary).toBe('日报')
    expect(dbMock.__updates()).toHaveLength(1)
  })
})

// =============================================================================
// 分类器本身(表驱动)
// =============================================================================

describe('G-669 分类器:档位与命中判据', () => {
  it('缺凭据 / 配置 / rrule 族 ⇒ permanent', () => {
    for (const message of [
      'Invalid or expired token',
      '未配置 API key',
      'missing credentials for provider openai',
      'JWT_SECRET not configured',
      '凭证已过期',
      'rrule 无法计算出下次执行时间',
    ]) {
      expect(classifyAutomationFailure({ message })).toBe('permanent')
    }
  })

  it('网络 / 超时 / 上游不可用族 ⇒ transient', () => {
    for (const message of [
      'fetch failed',
      'connect ECONNREFUSED 127.0.0.1:8803',
      'UND_ERR_HEADERS_TIMEOUT',
      'socket hang up',
      '上游服务暂时不可用',
      'request timed out',
    ]) {
      expect(classifyAutomationFailure({ message })).toBe('transient')
    }
  })

  it('拿不准一律 transient(默认档,由有界退避收口)', () => {
    expect(describeAutomationFailure({ message: 'Something odd happened' }).reason).toBe(
      'default-transient',
    )
    expect(classifyAutomationFailure({})).toBe('transient')
  })

  it('状态码优先级:显式 status > error.statusCode > 文案里的状态码', () => {
    const withCode = Object.assign(new Error('fetch failed'), { statusCode: 401 })
    expect(classifyAutomationFailure({ error: withCode })).toBe('permanent')
    const withCause = Object.assign(new Error('bad gateway'), {
      cause: { statusCode: 502 },
    })
    expect(classifyAutomationFailure({ error: withCause })).toBe('transient')
    // 文案里书写的状态码(executor 的 `→ 401:` 形态)
    expect(classifyAutomationFailure({ message: 'ai-service /api/agents/execute → 401: nope' })).toBe(
      'permanent',
    )
    // 端口号不得被读成状态码(8803 里没有 803)
    expect(classifyAutomationFailure({ message: 'connect ECONNREFUSED 127.0.0.1:8803' })).toBe(
      'transient',
    )
    expect(describeAutomationFailure({ message: '上游服务异常(状态码 503)' })).toEqual({
      kind: 'transient',
      reason: 'status:503',
    })
  })
})

// =============================================================================
// C 格:ledger.release + orchestrator 的 dropped 点名
// =============================================================================

describe('G-669 C 格:认领可释放且逐条点名', () => {
  const dirs: string[] = []
  const scratch = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'g-669-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('release 后可重新认领;未认领/超上限一律 false(有界重试的"界")', async () => {
    const { createFileLedger, MAX_RELEASES_PER_KEY } = await import(
      '../src/services/automations/ledger.js'
    )
    const ledger = createFileLedger(join(scratch(), 'ledger.json'))
    expect(ledger.claim('issue:1')).toBe(true)
    expect(ledger.release('issue:2', '从未认领')).toBe(false)
    expect(ledger.release('issue:1', 'transient')).toBe(true)
    expect(ledger.has('issue:1')).toBe(false)
    expect(ledger.claim('issue:1')).toBe(true)
    expect(ledger.releaseCount('issue:1')).toBe(1)

    for (let n = 2; n <= MAX_RELEASES_PER_KEY; n++) {
      expect(ledger.release('issue:1', `第 ${n} 次释放`)).toBe(true)
      expect(ledger.claim('issue:1')).toBe(true)
    }
    // 次数用尽 ⇒ 保留认领(终态),不再回队
    expect(ledger.release('issue:1', '再试一次')).toBe(false)
    expect(ledger.has('issue:1')).toBe(true)
    expect(ledger.releaseCount('issue:1')).toBe(MAX_RELEASES_PER_KEY)
  })

  it('orchestrator:transient 失败 ⇒ 释放认领 + dropped 点名 + 本轮不发"失败"公告;permanent ⇒ 保留认领', async () => {
    const { createOrchestrator } = await import('../src/services/automations/orchestrator.js')
    const { createFileLedger } = await import('../src/services/automations/ledger.js')
    const { loadAutomationsConfig } = await import('../src/services/automations/config.js')

    const config = loadAutomationsConfig({
      IHUI_AUTOMATIONS_ENABLED: 'true',
      IHUI_GITHUB_PAT: 'pat-for-test-only',
      IHUI_AUTOMATIONS_REPO: 'o/r',
      IHUI_AUTOMATIONS_CLAIM_COMMENT: 'true',
    })
    const comments: Array<{ issue: number; body: string }> = []
    const github = {
      scanIssues: async () => [
        {
          key: 'issue:7',
          source: 'issue' as const,
          title: '跑挂了',
          detail: 'd',
          url: null,
          issueNumber: 7,
        },
      ],
      scanCodeScanningAlerts: async () => [],
      scanFailedRuns: async () => [],
      createFixBranch: async () => ({ base: 'main' }),
      createPullRequest: async () => ({ url: 'https://x/pull/1', number: 1 }),
      addIssueComment: async (issueNumber: number, body: string) => {
        comments.push({ issue: issueNumber, body })
      },
    }
    const transientLedger = createFileLedger(join(scratch(), 'l1.json'))
    const transientRunner = createOrchestrator({
      config,
      github,
      ledger: transientLedger,
      executor: {
        name: 'stub',
        execute: async () => ({ ok: false, summary: '', error: 'agent 执行器提交失败: fetch failed' }),
      },
    })

    const report = await transientRunner.runOnce()
    expect(report.failed).toBe(1)
    expect(report.dropped).toHaveLength(1)
    expect(report.dropped[0]).toMatchObject({ key: 'issue:7', kind: 'transient', released: true })
    expect(report.dropped[0]!.reason).toContain('已释放认领')
    // 回队的条目不是终态 ⇒ 不发"❌ 执行失败"公告(只有认领公告)
    expect(comments.every((c) => !c.body.includes('❌'))).toBe(true)
    expect(transientLedger.has('issue:7')).toBe(false)

    // 下一轮:因为已释放,可以重新认领(不是永久静默丢弃)
    const second = await transientRunner.runOnce()
    expect(second.claimed).toBe(1)
    expect(second.dropped[0]!.released).toBe(true)

    const permLedger = createFileLedger(join(scratch(), 'l2.json'))
    const permRunner = createOrchestrator({
      config,
      github,
      ledger: permLedger,
      executor: {
        name: 'stub',
        execute: async () => ({ ok: false, summary: '', error: 'execute → 401: Invalid or expired token' }),
      },
    })
    const permReport = await permRunner.runOnce()
    expect(permReport.dropped[0]).toMatchObject({ kind: 'permanent', released: false })
    expect(permLedger.has('issue:7')).toBe(true)
    // 终态 ⇒ 发一次结果回帖,并在后续轮次不再重复动作
    expect(comments.some((c) => c.body.includes('❌'))).toBe(true)
    const after = await permRunner.runOnce()
    expect(after.claimed).toBe(0)
    expect(after.dropped).toEqual([])
  })
})

// =============================================================================
// SQL 投影与 JS 投影的对账(防止"JS 挡住了而 SQL 其实漏了")
// =============================================================================

describe('G-669 到期判据:SQL 投影覆盖 JS 投影读的每一列', () => {
  it('渲染 automationDueConditions ⇒ 三个分支的列与算子都在 SQL 文本里', async () => {
    const { PgDialect } = await import('drizzle-orm/pg-core')
    const cond = automationDueConditions(T0)
    expect(cond).toBeDefined()
    const rendered = new PgDialect().sqlToQuery(cond as never)
    const sql = rendered.sql

    // 状态闸 + 三个分支的列/算子逐条点名
    expect(sql).toContain('"status" =')
    expect(sql).toContain('"schedule_type" =')
    expect(sql).toContain('"last_run_at" is null')
    expect(sql).toContain('"scheduled_at" <=')
    expect(sql).toContain('"next_run_at" <=')
    expect(sql).toContain('"attempt" >')
    expect(sql).toContain('"next_run_at" is not null')
    // 参数表里有 'active',且三个分支的时间参数都等于喂进去的 now
    // (dialect 把 timestamptz 参数序列化成 ISO 串,所以按串核,不按 instanceof Date)
    expect(rendered.params).toContain('active')
    expect(rendered.params.filter((p) => p === T0.toISOString())).toHaveLength(3)
    // 重试分支的 attempt 阈值确实进了 SQL(参数 0),而不是只在 JS 侧判
    expect(rendered.params).toContain(0)
  })

  it('isAutomationDue 与行状态的真值表', () => {
    const now = T0
    const base = makeRow()
    // once 首跑
    expect(isAutomationDue(base, now)).toBe(true)
    // once 已跑过且没有重试位 ⇒ 不再到期
    expect(isAutomationDue({ ...base, lastRunAt: now }, now)).toBe(false)
    // legacy once:nextRunAt=scheduledAt 但 attempt=0 ⇒ 不得被当成重试位
    expect(
      isAutomationDue({ ...base, lastRunAt: now, nextRunAt: new Date(now.getTime() - 1) }, now),
    ).toBe(false)
    // once 重试位:attempt>0 且 nextRunAt 未到 ⇒ 不到期;已到 ⇒ 到期
    const retrying = {
      ...base,
      lastRunAt: now,
      attempt: 1,
      nextRunAt: new Date(now.getTime() + 60_000),
    }
    expect(isAutomationDue(retrying, now)).toBe(false)
    expect(isAutomationDue(retrying, new Date(now.getTime() + 60_000))).toBe(true)
    // paused 一律不到期
    expect(isAutomationDue({ ...base, status: 'paused' }, now)).toBe(false)
    // recurring
    const rec = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      nextRunAt: new Date(now.getTime() + 1),
    })
    expect(isAutomationDue(rec, now)).toBe(false)
    expect(isAutomationDue({ ...rec, nextRunAt: now }, now)).toBe(true)
    // 未知 schedule_type ⇒ 一律不到期(不在射程,而不是"默认执行")
    expect(isAutomationDue({ ...base, scheduleType: 'weekly' }, now)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
