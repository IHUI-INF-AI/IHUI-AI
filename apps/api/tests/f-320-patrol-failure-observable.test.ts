// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-320 回归锁(2026-11-13)。
 *
 * 病灶:后台 tick 以 `executePatrol(task, null)` 调用,失败时 catch 只有
 * `request?.log.warn(...)`(request 为 null ⇒ 日志不落);既不写 patrol_runs(status='error'),
 * 也不推进 next_run_at ⇒ 每 60s 重放同一任务,last_run_at/last_result 永停更。
 *
 * 本文件锁四条判据:
 *   ① 后台 tick 中 executePatrol 抛错 ⇒ next_run_at 被推进到未来(下一 tick 不再取出同一行);
 *   ② 失败写一条 status='error' 的 patrol_runs 记录(文案截断);
 *   ③ 失败经模块级 logger.warn 留痕(后台 request=null 也要可观测);
 *   ④ 成功路径仍按 rrule 原周期推进(防误伤)。
 *
 * db 用内存替身;agent-runtime 依赖(consumeAgentStream/parseNextRun)整模块替换。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { patrolRuns, patrolTasks } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

type TaskRow = {
  id: string
  userId: string
  name: string
  patrolType: string
  target: string | null
  prompt: string | null
  rrule: string
  timezone: string
  status: string
  notifyConversationId: string | null
  lastRunAt: Date | null
  nextRunAt: Date | null
  lastResult: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

interface DbHandles {
  __reset: (tasks: TaskRow[], runStatuses?: string[]) => void
  __tasks: () => TaskRow[]
  __inserts: () => Array<{ table: unknown; values: Record<string, unknown> }>
  __updates: () => Array<{ table: unknown; patch: Record<string, unknown> }>
}

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const { patrolTasks, patrolRuns } = await import('@ihui/database')
  const dialect = new PgDialect()

  const state = {
    tasks: [] as TaskRow[],
    runStatuses: [] as string[],
    inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    updates: [] as Array<{ table: unknown; patch: Record<string, unknown> }>,
  }

  const paramsOf = (cond: unknown): unknown[] => dialect.sqlToQuery(cond as never).params

  /** where 里被 drizzle 渲染成 ISO 串的时间参数(到期线),取最后一个。 */
  const cutoffOf = (cond: unknown): Date | undefined => {
    const stamps = paramsOf(cond).filter(
      (p): p is string => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(p),
    )
    return stamps.length > 0 ? new Date(stamps[stamps.length - 1]!) : undefined
  }

  /** select 链:按 from 的表名分派;patrol_tasks 用 where 里的时间参数模拟到期过滤。 */
  const selectChain = () => {
    let table: unknown = null
    let cond: unknown = null
    const rows = (): unknown[] => {
      if (table === patrolTasks) {
        const cutoff = cutoffOf(cond)
        if (!cutoff) return []
        return state.tasks.filter(
          (t) =>
            t.status === 'active' &&
            t.nextRunAt !== null &&
            t.nextRunAt.getTime() <= cutoff.getTime(),
        )
      }
      if (table === patrolRuns) return state.runStatuses.map((status) => ({ status }))
      return []
    }
    const chain: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t
        return chain
      },
      where: (c: unknown) => {
        cond = c
        return chain
      },
      orderBy: () => chain,
      limit: () => Promise.resolve(rows()),
    }
    return chain
  }

  const handles: DbHandles = {
    __reset: (tasks, runStatuses = []) => {
      state.tasks = tasks.map((t) => ({ ...t }))
      state.runStatuses = [...runStatuses]
      state.inserts = []
      state.updates = []
    },
    __tasks: () => state.tasks,
    __inserts: () => state.inserts,
    __updates: () => state.updates,
  }

  return {
    ...handles,
    db: {
      select: vi.fn(() => selectChain()),
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          state.inserts.push({ table, values })
          return Promise.resolve()
        },
      })),
      update: vi.fn((table: unknown) => {
        let patch: Record<string, unknown> = {}
        const chain: Record<string, unknown> = {
          set: (p: Record<string, unknown>) => {
            patch = p
            return chain
          },
          where: (cond: unknown) => {
            state.updates.push({ table, patch })
            // 落回内存行,供第二次 tick 的真实到期判定使用(模拟 SQL UPDATE 命中)
            const ids = paramsOf(cond).filter((p): p is string => typeof p === 'string')
            for (const task of state.tasks) {
              if (ids.includes(task.id)) Object.assign(task, patch)
            }
            return Promise.resolve()
          },
        }
        return chain
      }),
    },
  }
})

const consumeAgentStreamMock = vi.hoisted(() => vi.fn())
const parseNextRunMock = vi.hoisted(() => vi.fn())

vi.mock('../src/services/agent-automation-scheduler.js', () => ({
  consumeAgentStream: consumeAgentStreamMock,
  parseNextRun: parseNextRunMock,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const dbMock = (await import('../src/db/index.js')) as unknown as DbHandles
const { logger } = await import('../src/utils/logger.js')
const { runPatrolTick, patrolFailureBackoffMs } =
  await import('../src/services/patrol-scheduler.js')

const T0 = new Date('2026-11-13T00:00:00.000Z')
const TASK_ID = '00000000-0000-4000-8000-00000000f320'
const NEXT_RUN = new Date('2026-11-13T01:00:00.000Z')

function makeTask(over: Partial<TaskRow> = {}): TaskRow {
  return {
    id: TASK_ID,
    userId: '00000000-0000-4000-8000-0000000000aa',
    name: '夜间巡检',
    patrolType: 'log',
    target: null,
    prompt: null,
    rrule: 'FREQ=HOURLY',
    timezone: 'Asia/Shanghai',
    status: 'active',
    notifyConversationId: null,
    lastRunAt: null,
    nextRunAt: new Date(T0.getTime() - 60_000),
    lastResult: null,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  }
}

/** 取某张表最近一次的 update patch。 */
function lastPatchOf(table: unknown): Record<string, unknown> | undefined {
  const list = dbMock.__updates().filter((u) => u.table === table)
  return list[list.length - 1]?.patch
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  dbMock.__reset([makeTask()])
  parseNextRunMock.mockReturnValue(NEXT_RUN)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F-320 ① 失败推进 next_run_at,下一 tick 不再重放同一任务', () => {
  it('后台 tick 中 executePatrol 抛错 ⇒ next_run_at 在未来,第二次 tick 不再调用 agent', async () => {
    consumeAgentStreamMock.mockRejectedValue(new Error('agent-runtime down'))

    await runPatrolTick(T0)

    expect(consumeAgentStreamMock).toHaveBeenCalledTimes(1)
    const patch = lastPatchOf(patrolTasks)!
    const nextRunAt = patch.nextRunAt as Date
    expect(nextRunAt).toBeInstanceOf(Date)
    // 首次失败退避 60s * 2^1 = 120s
    expect(nextRunAt.getTime()).toBe(T0.getTime() + 120_000)
    expect(patch.lastRunAt).toEqual(T0)
    expect((patch.lastResult as Record<string, unknown>).status).toBe('error')

    // 60s 后的 tick 里该行尚未到期 ⇒ 不再对 agent-runtime 发起失败调用
    await runPatrolTick(new Date(T0.getTime() + 60_000))
    expect(consumeAgentStreamMock).toHaveBeenCalledTimes(1)
  })

  it('退避按失败次数指数增长并封顶 1h', () => {
    expect(patrolFailureBackoffMs(1)).toBe(120_000)
    expect(patrolFailureBackoffMs(2)).toBe(240_000)
    expect(patrolFailureBackoffMs(3)).toBe(480_000)
    expect(patrolFailureBackoffMs(20)).toBe(3_600_000)
  })
})

describe('F-320 ② 失败写 status=error 的运行记录', () => {
  it('抛错后插入一条 error 巡检记录,文案含原因且截断', async () => {
    consumeAgentStreamMock.mockRejectedValue(new Error('x'.repeat(2_000)))

    await runPatrolTick(T0)

    const runInserts = dbMock.__inserts().filter((i) => i.table === patrolRuns)
    expect(runInserts).toHaveLength(1)
    const values = runInserts[0]!.values
    expect(values.taskId).toBe(TASK_ID)
    expect(values.status).toBe('error')
    expect(String(values.summary)).toContain('巡检执行失败')
    expect(String(values.summary).length).toBeLessThanOrEqual(500)
  })
})

describe('F-320 ③ 失败经模块级 logger.warn 留痕', () => {
  it('后台 request=null 时仍有 warn 输出并带任务 id', async () => {
    consumeAgentStreamMock.mockRejectedValue(new Error('agent-runtime down'))

    await runPatrolTick(T0)

    const warnMock = vi.mocked(logger.warn)
    expect(warnMock).toHaveBeenCalled()
    const [message, meta] = warnMock.mock.calls[0]!
    expect(String(message)).toContain('巡检执行失败')
    expect(String((meta as Record<string, unknown>).patrolTaskId)).toBe(TASK_ID)
    expect(String((meta as Record<string, unknown>).err)).toContain('agent-runtime down')
  })
})

describe('F-320 ④ 成功路径仍按 rrule 原周期推进', () => {
  it('成功时写 ok 记录,next_run_at 取 parseNextRun 结果,不触发 warn', async () => {
    consumeAgentStreamMock.mockResolvedValue({
      summary: '[PATROL:OK] 一切正常',
      contentTail: '',
      errorMessage: null,
    })

    await runPatrolTick(T0)

    const runInserts = dbMock.__inserts().filter((i) => i.table === patrolRuns)
    expect(runInserts).toHaveLength(1)
    expect(runInserts[0]!.values.status).toBe('ok')

    const patch = lastPatchOf(patrolTasks)!
    expect(patch.nextRunAt).toEqual(NEXT_RUN)
    expect(patch.lastRunAt).toEqual(T0)
    expect((patch.lastResult as Record<string, unknown>).status).toBe('ok')
    expect(parseNextRunMock).toHaveBeenCalledWith('FREQ=HOURLY', T0, 'Asia/Shanghai')
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
