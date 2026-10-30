// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

/**
 * G2 Automations 产品闭环 —— 行为验收(2026-10-30 立)。
 *
 * 覆盖票面三格:
 *  ① Goal 自评迭代循环:未达标且预算内且过水位 ⇒ 重跑计数(runs+1、attempt≥1 借道
 *     到期判据分支②、nextRunAt=now+60s、非终态零通知);达上限 ⇒ 停止并记结论;
 *     水位不足 ⇒ 拒跑(once 落 failed_permanent+paused)+ 独立拒跑通知。
 *  ② 结果摘要推送只发终态:transient 回队不发 / permanent 与 once 完成发 /
 *     recurring 常规轮不发(D30 回帖"回队不重复发"同款纪律);transient 结算
 *     不得洗掉 goal 状态(withGoalCarryover)。
 *  ③ 纯函数决策表(planGoalOutcome / parseGoalVerdict / readGoalState)逐分支。
 *
 * 取证口径与 g-669 同范本:db 是**内存替身**(select 按表分流 —— automations 返回
 * 行快照、user_margins 返回余额;update 按 where 参数落回同一行),通知服务是
 * vi.mock 探针(每一次 createNotification 调用都可断言),时钟用 fake Date 钉死
 * (executeAutomation 内部 new Date() === 我喂的 T0,重跑延迟才可精确断言)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { UserAutomation } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

type Row = UserAutomation
type Patch = Record<string, unknown>

interface DbMockHandles {
  __setRows: (rows: Row[]) => void
  __getRow: (id: string) => Row | undefined
  __updates: () => Array<{ id: string | null; patch: Patch }>
  __setBalance: (n: number) => void
  __reset: () => void
}

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const { getTableName } = await import('drizzle-orm')
  const dialect = new PgDialect()

  const state: {
    rows: Map<string, Row>
    updates: Array<{ id: string | null; patch: Patch }>
    balance: number
  } = { rows: new Map(), updates: [], balance: 100 }

  const snapshot = (): Row[] => Array.from(state.rows.values(), (r) => ({ ...r }))

  /** 从 where 条件里取被更新行的 id(渲染成参数表,不碰 drizzle 私有结构)。 */
  const targetIdOf = (cond: unknown): string | null => {
    const rendered = dialect.sqlToQuery(cond as never)
    for (const param of rendered.params) {
      if (typeof param === 'string' && state.rows.has(param)) return param
    }
    return null
  }

  /** G2 增量:select 按**表**分流(水位检查读 user_margins,其余仍是 automations 快照)。 */
  const selectChain = (): Record<string, unknown> => {
    let tableName: string | null = null
    const rowsFor = (): unknown[] =>
      tableName === 'user_margins' ? [{ tokenQuantity: state.balance }] : snapshot()
    const chain: Record<string, unknown> = {
      from: (t: unknown) => {
        tableName = getTableName(t as never)
        return chain
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(rowsFor()).then(resolve),
    }
    for (const m of ['where', 'orderBy', 'limit', 'offset']) chain[m] = () => chain
    return chain
  }

  const handles: DbMockHandles = {
    __setRows: (rows) => {
      state.rows = new Map(rows.map((r) => [r.id, r]))
    },
    __getRow: (id) => state.rows.get(id),
    __updates: () => state.updates,
    __setBalance: (n) => {
      state.balance = n
    },
    __reset: () => {
      state.rows = new Map()
      state.updates = []
      state.balance = 100
    },
  }

  return {
    ...handles,
    db: {
      select: vi.fn(() => selectChain()),
      update: vi.fn(() => {
        let pending: Patch = {}
        let hitId: string | null = null
        const chain: Record<string, unknown> = {
          set: (patch: Patch) => {
            pending = patch
            return chain
          },
          where: (cond: unknown) => {
            const id = targetIdOf(cond)
            hitId = id
            state.updates.push({ id, patch: pending })
            if (id !== null) {
              const current = state.rows.get(id)
              if (current) state.rows.set(id, { ...current, ...pending } as Row)
            }
            return chain
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(hitId === null ? [] : [{ id: hitId }]).then(resolve),
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

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(async () => ({ id: 'n-1' })),
}))

const dbMock = (await import('../src/db/index.js')) as unknown as DbMockHandles
const streamMock = vi.mocked(
  (await import('../src/utils/ai-service-fetch.js')).aiServiceFetchStream,
)
const notifyMock = vi.mocked((await import('../src/db/notification-queries.js')).createNotification)
const { executeAutomation, isAutomationDue } =
  await import('../src/services/agent-automation-scheduler.js')
const {
  readGoalState,
  withGoalCarryover,
  parseGoalVerdict,
  planGoalOutcome,
  GOAL_RERUN_DELAY_MS,
  GOAL_DEFAULT_MAX_RUNS,
  GOAL_MAX_RUNS_CAP,
  AUTOMATION_NOTIFICATION_TYPE,
} = await import('../src/services/automations/goal-loop.js')

// =============================================================================
// 夹具(与 g-669 同范本)
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

/** goal 种子:嵌 last_result jsonb 的 goal 键(路由 POST 落库形态,见 routes/automations.ts)。 */
function goalSeed(runs = 0, maxRuns = 3): Row['lastResult'] {
  return {
    goal: { config: { target: '覆盖全部章节', maxRuns }, runs },
  } as unknown as Row['lastResult']
}

interface GoalView {
  runs: number
  config?: { target: string; maxRuns: number }
  lastVerdict?: { met: boolean }
  note?: string
}
const goalOf = (row: Row): GoalView =>
  ((row.lastResult ?? {}) as unknown as { goal?: GoalView }).goal ?? { runs: -1 }

const T0 = new Date('2026-10-01T00:00:00.000Z')

const sse = (obj: Record<string, unknown>): string => `data: ${JSON.stringify(obj)}\n\n`

/** 单轮流(无 goal 的行只会被打一次)。 */
function streamOnce(text: string): void {
  streamMock.mockResolvedValue(new Response(sse({ content: text }), { status: 200 }))
}

/** 主执行 + Goal 自评两轮:第 1 次回 main,第 2 次回 eval。 */
function streamMainThenEval(main: string, evalText: string): void {
  let n = 0
  streamMock.mockImplementation(async () => {
    n += 1
    return new Response(sse({ content: n === 1 ? main : evalText }), { status: 200 })
  })
}

function streamResponds(status: number): void {
  streamMock.mockResolvedValue(new Response('{"error":"boom"}', { status }))
}

const upstreamCalls = (): number => streamMock.mock.calls.length

beforeEach(() => {
  dbMock.__reset()
  streamMock.mockReset()
  notifyMock.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

// =============================================================================
// ① Goal 循环:重跑计数 / 达上限停止 / 水位不足拒跑
// =============================================================================

describe('G2 ① Goal 自评迭代循环', () => {
  it('未达标且预算内且水位 OK ⇒ 重跑计数(runs+1、attempt≥1、now+60s、非终态零通知)', async () => {
    const row = makeRow({ lastResult: goalSeed(0, 3) })
    dbMock.__setRows([row])
    streamMainThenEval('晨报产出', 'VERDICT: NOT_MET\nREASON: 第三章缺失')

    await executeAutomation(row, null)
    // 行为断言:主执行 + 自评各打一次上游
    expect(upstreamCalls()).toBe(2)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('active')
    expect(settled.terminalReason ?? null).toBeNull()
    expect(settled.attempt).toBe(1) // once 重跑借道到期判据分支②(attempt>0)
    expect((settled.nextRunAt as Date).getTime()).toBe(T0.getTime() + GOAL_RERUN_DELAY_MS)
    expect(goalOf(settled).runs).toBe(1)
    expect(goalOf(settled).lastVerdict?.met).toBe(false)
    // 回队不是终态:一条通知都不发
    expect(notifyMock).not.toHaveBeenCalled()
    // 重排真的排进去了:到点后这一行会被 tick 再取走
    expect(isAutomationDue(settled, new Date(T0.getTime() + 120_000))).toBe(true)
  })

  it('达标 ⇒ 终态 completed + 恰好一条终态通知(标题=名,正文含结论,深链 auto_<id>)', async () => {
    const row = makeRow({ lastResult: goalSeed(0, 3) })
    dbMock.__setRows([row])
    streamMainThenEval('晨报产出', 'VERDICT: MET\nREASON: 全部章节已覆盖')

    await executeAutomation(row, null)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.terminalReason).toBe('completed')
    expect(settled.nextRunAt).toBeNull()
    expect(settled.attempt).toBe(0)
    expect(goalOf(settled).runs).toBe(1)

    expect(notifyMock).toHaveBeenCalledTimes(1)
    const note = notifyMock.mock.calls[0]![0]
    expect(note.title).toBe('测试自动化')
    expect(note.type).toBe(AUTOMATION_NOTIFICATION_TYPE)
    expect(note.content).toContain('Goal 达标')
    expect((note.data as Record<string, unknown>).sessionId).toBe(`auto_${row.id}`)
    expect((note.data as Record<string, unknown>).terminalReason).toBe('completed')
  })

  it('未达标但预算已用尽 ⇒ 停止重跑、落 completed、通知点名"预算已用尽"', async () => {
    const row = makeRow({ lastResult: goalSeed(2, 3) })
    dbMock.__setRows([row])
    streamMainThenEval('晨报产出', 'VERDICT: NOT_MET\nREASON: 表格数据仍缺')

    await executeAutomation(row, null)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.terminalReason).toBe('completed')
    expect(settled.nextRunAt).toBeNull()
    expect(goalOf(settled).runs).toBe(3)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0]![0].content).toContain('预算已用尽')
  })

  it('水位不足 ⇒ 拒跑:once 落 failed_permanent+paused,发独立"Goal 重跑被拒"通知', async () => {
    const row = makeRow({ lastResult: goalSeed(0, 3) })
    dbMock.__setRows([row])
    dbMock.__setBalance(0) // 余额=0 走 hasPositiveTokenBalance 的 user_margins 分流
    streamMainThenEval('晨报产出', 'VERDICT: NOT_MET\nREASON: 还差两章')

    await executeAutomation(row, null)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    expect(settled.terminalReason).toBe('failed_permanent')
    expect(settled.nextRunAt).toBeNull()
    expect(String(settled.lastError)).toContain('水位')

    expect(notifyMock).toHaveBeenCalledTimes(1)
    const note = notifyMock.mock.calls[0]![0]
    expect(note.title).toContain('Goal 重跑被拒')
    expect((note.data as Record<string, unknown>).refusal).toBe('insufficient_balance')
  })

  it('自评不可解析 ⇒ 按未达标收敛不重跑(猜达标会把没做成说成做成)', async () => {
    const row = makeRow({ lastResult: goalSeed(0, 3) })
    dbMock.__setRows([row])
    streamMainThenEval('晨报产出', '我还需要更多上下文才能判断')

    await executeAutomation(row, null)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.terminalReason).toBe('completed')
    expect(settled.attempt).toBe(0)
    expect(settled.nextRunAt).toBeNull()
    expect(goalOf(settled).note).toContain('未能解析')
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('recurring + 达标 ⇒ 回到常规 rrule 排期、非终态、零通知(它还会跑下一轮)', async () => {
    const row = makeRow({
      scheduleType: 'recurring',
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      scheduledAt: null,
      lastResult: goalSeed(0, 3),
    })
    dbMock.__setRows([row])
    streamMainThenEval('晨报产出', 'VERDICT: MET\nREASON: 达标')

    await executeAutomation(row, null)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.terminalReason ?? null).toBeNull()
    expect(settled.nextRunAt).toBeInstanceOf(Date)
    expect((settled.nextRunAt as Date).getTime()).toBeGreaterThan(T0.getTime())
    expect(goalOf(settled).runs).toBe(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('无 goal 的行执行路径逐字节同旧:不追加自评 turn(上游只被打一次)', async () => {
    const row = makeRow()
    dbMock.__setRows([row])
    streamOnce('普通产出')

    await executeAutomation(row, null)
    expect(upstreamCalls()).toBe(1)
    const settled = dbMock.__getRow(row.id)!
    expect((settled.lastResult as Record<string, unknown> | null)?.goal).toBeUndefined()
  })
})

// =============================================================================
// ② 结果摘要推送:只发终态(D30 "回队不重复发"同款纪律)
// =============================================================================

describe('G2 ② 推送档位与 goal carryover', () => {
  it('transient(500)回队 ⇒ 零通知;permanent(401)⇒ 恰好一条', async () => {
    const transientRow = makeRow()
    dbMock.__setRows([transientRow])
    streamResponds(500)
    await executeAutomation(transientRow, null)
    expect(notifyMock).not.toHaveBeenCalled()
    expect(dbMock.__getRow(transientRow.id)!.status).toBe('active')

    notifyMock.mockReset()
    const permanentRow = makeRow({ id: nextId() })
    dbMock.__setRows([permanentRow])
    streamResponds(401)
    await executeAutomation(permanentRow, null)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0]![0].content).toContain('执行失败')
    expect((notifyMock.mock.calls[0]![0].data as Record<string, unknown>).terminalReason).toBe(
      'failed_permanent',
    )
  })

  it('once 成功发一条 / recurring 常规轮不发', async () => {
    const onceRow = makeRow()
    dbMock.__setRows([onceRow])
    streamOnce('完成')
    await executeAutomation(onceRow, null)
    expect(notifyMock).toHaveBeenCalledTimes(1)

    notifyMock.mockReset()
    const recurringRow = makeRow({
      id: nextId(),
      scheduleType: 'recurring',
      rrule: 'FREQ=HOURLY',
      scheduledAt: null,
    })
    dbMock.__setRows([recurringRow])
    streamOnce('完成')
    await executeAutomation(recurringRow, null)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('transient 回队结算不得洗掉 goal 状态(洗掉 = 用户迭代预算静默蒸发)', async () => {
    const row = makeRow({ lastResult: goalSeed(1, 3) })
    dbMock.__setRows([row])
    streamResponds(503)

    await executeAutomation(row, null)
    const settled = dbMock.__getRow(row.id)!
    expect(goalOf(settled).runs).toBe(1)
    expect(goalOf(settled)).toMatchObject({ config: { target: '覆盖全部章节', maxRuns: 3 } })
    expect(settled.attempt).toBe(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('通知落库失败不打断结算(settled 闸门语义高于旁路通知)', async () => {
    notifyMock.mockRejectedValueOnce(new Error('notifications 表写不进'))
    const row = makeRow()
    dbMock.__setRows([row])
    streamOnce('完成')

    await expect(executeAutomation(row, null)).resolves.toBeTruthy()
    const settled = dbMock.__getRow(row.id)!
    expect(settled.terminalReason).toBe('completed')
  })
})

// =============================================================================
// ③ 纯函数决策面(goal-loop.ts 是循环的唯一真相源)
// =============================================================================

describe('G2 ③ 纯函数决策表', () => {
  const now = T0
  const rruleNext = new Date(T0.getTime() + 3_600_000)

  it('readGoalState:脏值归一或判无 goal,绝不抛穿', () => {
    expect(readGoalState(null)).toBeNull()
    expect(readGoalState({ summary: 'x' })).toBeNull()
    expect(readGoalState({ goal: { config: { target: '  ' } } })).toBeNull()
    const capped = readGoalState({ goal: { config: { target: 'T', maxRuns: 99 }, runs: 0 } })
    expect(capped!.config.maxRuns).toBe(GOAL_MAX_RUNS_CAP)
    const defaulted = readGoalState({ goal: { config: { target: 'T', maxRuns: '脏' }, runs: 0 } })
    expect(defaulted!.config.maxRuns).toBe(GOAL_DEFAULT_MAX_RUNS)
  })

  it('withGoalCarryover:无 goal 原样返回(旧行为逐字节不变)', () => {
    const base = { finishedAt: 'x', summary: 'y' }
    expect(withGoalCarryover(base, null)).toBe(base)
    const g = readGoalState(goalSeed() as unknown)
    expect((withGoalCarryover(base, g) as Record<string, unknown>).goal).toBeTruthy()
  })

  it('parseGoalVerdict:NOT_MET 判序在 MET 前;解析不出 ⇒ null', () => {
    expect(parseGoalVerdict('VERDICT: NOT_MET\nREASON: 差一章')!.met).toBe(false)
    expect(parseGoalVerdict('verdict: met')!.met).toBe(true)
    expect(parseGoalVerdict('随便说点什么')).toBeNull()
    expect(parseGoalVerdict('')).toBeNull()
    expect(parseGoalVerdict('VERDICT: MET').reason).toBe('目标已达成')
  })

  it('planGoalOutcome 决策表逐档', () => {
    const goal = readGoalState(goalSeed(0, 3) as unknown)!
    const mk = (over: Record<string, unknown>) => ({
      goal,
      scheduleType: 'once' as const,
      rruleNextRunAt: rruleNext,
      now,
      balanceOk: true,
      ...over,
    })
    // 自评不可解析 ⇒ 不重跑
    const unparsed = planGoalOutcome(mk({ verdict: null }))
    expect(unparsed.action).toBe('finish')
    expect(unparsed.terminalReason).toBe('completed')
    // 达标 ⇒ completed
    const met = planGoalOutcome(mk({ verdict: { met: true, reason: 'r' } }))
    expect(met.terminalReason).toBe('completed')
    expect(met.nextRunAt).toBeNull()
    // 未达标预算内水位 OK ⇒ 重跑(非终态)
    const rerun = planGoalOutcome(mk({ verdict: { met: false, reason: 'r' } }))
    expect(rerun.action).toBe('rerun')
    expect(rerun.terminalReason).toBeNull()
    expect(rerun.nextRunAt!.getTime()).toBe(now.getTime() + GOAL_RERUN_DELAY_MS)
    expect(rerun.goal.runs).toBe(1)
    // 未达标水位不足 once ⇒ failed_permanent + paused + 拒跑通知
    const refusal = planGoalOutcome(mk({ verdict: { met: false, reason: 'r' }, balanceOk: false }))
    expect(refusal.terminalReason).toBe('failed_permanent')
    expect(refusal.status).toBe('paused')
    expect(refusal.refusalNotice).toBeTruthy()
    // 未达标水位不足 recurring ⇒ 回常规排期 + 拒跑通知(不停摆整条周期任务)
    const recurRefusal = planGoalOutcome(
      mk({ verdict: { met: false, reason: 'r' }, balanceOk: false, scheduleType: 'recurring' }),
    )
    expect(recurRefusal.nextRunAt).toBe(rruleNext)
    expect(recurRefusal.terminalReason).toBeNull()
    expect(recurRefusal.refusalNotice).toBeTruthy()
    // 预算用尽 ⇒ completed(once)
    const exhausted = planGoalOutcome(
      mk({ goal: readGoalState(goalSeed(2, 3) as unknown)!, verdict: { met: false, reason: 'r' } }),
    )
    expect(exhausted.terminalReason).toBe('completed')
    expect(exhausted.summaryLine).toContain('预算已用尽')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
