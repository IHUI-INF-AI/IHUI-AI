// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiTaskTemplate, aiTaskRun } from '@ihui/database'

/**
 * AI 编排层执行器契约测试(HR-4,2026-11-11 立):不连库、不真调端点。
 *
 * 形状照抄同族既有件 tests/hr-jobs-contract.test.ts:vi.hoisted 账本 H + vi.mock 假库,
 * 全程不连真库。假库**按表对象引用分流**(H.keyOf(t),用 `t === H.tables.xxx` 判),
 * 不靠表名字符串 —— 执行器把真实表 token(aiTaskRun/aiTaskTemplate)传进 db 链。
 * 假库只回答 drizzle 链的真实形态:
 *   · select().from(t).where().limit() / .orderBy()  —— 按表身份从脚本队列吐行集;
 *   · select({ c: count() }).from(t).where()         —— count 查询,吐 [{ c: n }];
 *   · insert(t).values().onConflictDoNothing().returning() —— ai_task_run 按
 *     (template_id, idempotency_key) 唯一索引去重,命中返回 [] ⇒ 执行器判 skipped;
 *   · update(t).set().where().returning() —— 把 set 字段并进该 run 行回读。
 * 端点调用走注入的假 caller(返回固定对象或抛错),验证「上一步输出注入下一步」「失败即停」。
 */

type Row = Record<string, unknown>

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。 */
const H = vi.hoisted(() => {
  type Tbl = 'run' | 'template'
  return {
    tables: {} as Record<Tbl, unknown>,
    keyOf(t: unknown): Tbl | undefined {
      if (t === H.tables.run) return 'run'
      if (t === H.tables.template) return 'template'
      return undefined
    },
    /** 假库世界状态:ai_task_run 已存在行的 (templateId, idempotencyKey) 集 —— 唯一索引 */
    existingRuns: new Set<string>(),
    /** 自增 run id 计数器(insert 落行时分配,update 反查用) */
    nextRunId: 0,
    /** runId -> 该 run 行(insert 时登记,update 反查补 id) */
    runsByRunId: new Map<string, Row>(),
    /** ai_task_run insert().values 逐条留档 */
    runInserts: [] as Row[],
    /** ai_task_run update().set 逐条留档(成功/失败回写) */
    runUpdates: [] as Row[],
    /** ai_task_template update().set 逐条留档(lastRunAt 回写) */
    templateUpdates: [] as Row[],
    /** 模板表脚本化读队列(按调用序吐行集;耗尽后复用最后一条) */
    templateReads: [] as Row[][],
    /** run 表脚本化读队列(listAiTaskRuns 的 count / list 两查) */
    runReads: [] as Row[][],
    /** 兜底:select 命中未脚本化的表/队列耗尽,计数(>0 说明夹具没接上) */
    unscripted: 0,
    nextId: 0,
  }
})

/** 假库:select 链按 from(table) 身份从队列吐行;insert 链对 ai_task_run 按唯一索引去重。 */
vi.mock('../src/db/index.js', () => {
  const CHAIN = [
    'where',
    'orderBy',
    'limit',
    'offset',
    'groupBy',
    'having',
    'leftJoin',
    'innerJoin',
  ] as const
  const selectChain = () => {
    let rows: Row[] = []
    const step: Record<string, unknown> = {}
    step.from = vi.fn((t: unknown) => {
      // select({c:count()}) 与 select().from() 都走这里;按表身份取对应脚本队列
      const key = H.keyOf(t)
      const q = key === 'run' ? H.runReads : key === 'template' ? H.templateReads : undefined
      if (!q) {
        H.unscripted += 1
        rows = []
        return step
      }
      const next = q.shift()
      if (next) {
        rows = next
        q.unshift(next) // 队列耗尽后复用最后一条脚本(同表多查,如 count+list)
      } else if (q.length === 0) {
        H.unscripted += 1
        rows = []
      }
      return step
    })
    for (const m of CHAIN) step[m] = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const insertChain = (target: unknown) => {
    let values: Row | Row[] = []
    let applied: Row[] | null = null
    const applyOnce = (): Row[] => {
      if (applied) return applied
      const list = Array.isArray(values) ? values : [values]
      if (H.keyOf(target) !== 'run') {
        // ai_task_template 无 onConflictDoNothing 链,正常落行返回
        applied = list.map((r) => ({ id: `row-${(H.nextId += 1)}`, ...r }))
        return applied
      }
      // 唯一索引 (template_id, idempotency_key):命中 ⇒ onConflictDoNothing 被拦,返回空 ⇒ 执行器判 skipped
      const first = list[0] ?? {}
      const uk = `${String(first.templateId)}\u0000${String(first.idempotencyKey)}`
      if (H.existingRuns.has(uk)) {
        applied = []
        return applied
      }
      H.existingRuns.add(uk)
      const runId = `run-${(H.nextRunId += 1)}`
      const rec = { id: runId, ...first }
      H.runInserts.push(rec)
      H.runsByRunId.set(runId, rec)
      applied = [rec]
      return applied
    }
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Row | Row[]) => {
      values = v
      return step
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve(applyOnce()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(applyOnce()).then(resolve, reject)
    return step
  }

  const updateChain = (target: unknown) => {
    let sets: Row = {}
    let runId: string | undefined
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Row) => {
      sets = v
      return step
    })
    // eq(aiTaskRun.id, runId) 经 drizzle 编译,where 回调收到的是 SQL 表达式(非影子对象),
    // 所以 runId 反查只作 best-effort:真值拿到就并进对应行,拿不到则按 set 字段合成回读行。
    step.where = vi.fn((expr?: { runId?: { value?: string } }, eqValue?: unknown) => {
      const target0 = target as Record<string, unknown> | undefined
      if (H.keyOf(target0) === 'run') {
        const rid = expr?.runId?.value ?? (typeof eqValue === 'string' ? eqValue : undefined)
        if (typeof rid === 'string') runId = rid
      }
      return step
    })
    step.returning = vi.fn(() => Promise.resolve(resolveUpdateRow()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveUpdateRow()).then(resolve, reject)
    return step

    function resolveUpdateRow(): Row[] {
      const target0 = target as Record<string, unknown> | undefined
      if (H.keyOf(target0) === 'run') {
        const found = runId ? H.runsByRunId.get(runId) : undefined
        const rec: Row = found ? { ...found, ...sets } : { id: runId ?? 'run-?', ...sets }
        H.runUpdates.push(rec)
        return [rec]
      }
      H.templateUpdates.push(sets)
      return [{ id: `row-${H.nextId}`, status: sets.status ?? 'running' }]
    }
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn((t: unknown) => insertChain(t)),
    update: vi.fn((t: unknown) => updateChain(t)),
    delete: vi.fn(() => selectChain()),
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbWriter: dbMock, dbClient: {} }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

import { db } from '../src/db/index.js'
import {
  runAiTask,
  createAiTaskTemplate,
  listAiTaskTemplates,
  listAiTaskRuns,
  MAX_STEPS,
  type TaskStep,
  type TaskStepCaller,
} from '../src/services/ai-task-executor.js'

/** 统一重置:把表对象接进账本 + 清空世界状态(每个用例前跑)。 */
beforeEach(() => {
  H.tables.run = aiTaskRun
  H.tables.template = aiTaskTemplate
  H.existingRuns = new Set()
  H.nextRunId = 0
  H.runsByRunId = new Map()
  H.runInserts = []
  H.runUpdates = []
  H.templateUpdates = []
  H.templateReads = []
  H.runReads = [[]] // listAiTaskRuns 的 count 查默认吐 [{c:0}] 形状由用例覆盖
  H.unscripted = 0
  H.nextId = 0
})

/** 断言假库接上了:db 已被替换 + 表对象引用分流生效(防 vi.mock 路径漂移时测试静默通过)。 */
describe('假库夹具自检', () => {
  it('db 已被替换为夹具,且按表对象引用可识别两张表', () => {
    expect(typeof db.select).toBe('function')
    expect(typeof db.insert).toBe('function')
    expect(H.keyOf(aiTaskRun)).toBe('run')
    expect(H.keyOf(aiTaskTemplate)).toBe('template')
  })
})
/** 装一个 N 步模板进假库(喂进模板读队列,loadTemplate 的 select().from().limit() 即读到)。 */
function seedTemplate(name: string, steps: TaskStep[], enabled = true): void {
  H.templateReads = [
    [
      {
        id: 'tpl-1',
        name,
        goal: '测试目标',
        steps,
        triggerType: 'manual',
        cron: null,
        enabled,
        lastRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]
}

/** 造一个假 caller:每步返回 { step: <path>, paramsEcho };failAtStep 那步抛错。 */
function makeFakeCaller(): {
  caller: TaskStepCaller
  calls: Array<{ method: string; path: string; params: Record<string, unknown> }>
} {
  const calls: Array<{ method: string; path: string; params: Record<string, unknown> }> = []
  const caller: TaskStepCaller = async (method, path, params) => {
    calls.push({ method, path, params })
    if (failAtStep !== null && calls.length - 1 === failAtStep) {
      throw new Error(`step ${calls.length - 1} failed`)
    }
    return { step: path, paramsEcho: params }
  }
  return { caller, calls }
}

/** 用例级开关:假 caller 第 n 步抛错的下标(null = 不抛);每用例 beforeEach 归零。 */
let failAtStep: number | null = null

describe('createAiTaskTemplate 落模板契约', () => {
  it('正常落模板:返回含 name/goal/steps/triggerType 默认 manual', async () => {
    const steps: TaskStep[] = [{ method: 'GET', path: '/api/health' }]
    const [created] = await createAiTaskTemplate({ name: '巡检', goal: '每天巡检一遍', steps })
      .then((r) => [r])
      .then(([x]) => [x])
    expect(created.name).toBe('巡检')
    expect(created.goal).toBe('每天巡检一遍')
    expect(created.triggerType).toBe('manual')
    expect(created.steps).toEqual(steps)
  })

  it('steps 空数组 ⇒ 抛错、不落库', async () => {
    await expect(createAiTaskTemplate({ name: '空步骤', goal: 'g', steps: [] })).rejects.toThrow(
      /steps 不能为空/,
    )
  })

  it('steps 超过 MAX_STEPS ⇒ 抛错', async () => {
    const many: TaskStep[] = Array.from({ length: MAX_STEPS + 1 }, () => ({
      method: 'GET',
      path: '/x',
    }))
    await expect(createAiTaskTemplate({ name: '超限', goal: 'g', steps: many })).rejects.toThrow(
      /步数超限/,
    )
  })

  it('triggerType=cron 但缺 cron 表达式 ⇒ 抛错', async () => {
    await expect(
      createAiTaskTemplate({
        name: '定时',
        goal: 'g',
        steps: [{ method: 'GET', path: '/x' }],
        triggerType: 'cron',
      }),
    ).rejects.toThrow(/cron 表达式必填/)
  })
})

describe('runAiTask 执行契约', () => {
  beforeEach(() => {
    failAtStep = null
  })

  it('用例1:单步执行成功 ⇒ ok=true、留痕 status=success、stepResults 一条', async () => {
    seedTemplate('单步', [{ method: 'GET', path: '/api/health' }])
    const { caller, calls } = makeFakeCaller()
    const outcome = await runAiTask('单步', caller, { manual: true })
    expect(outcome.ok).toBe(true)
    expect(outcome.skipped).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/api/health')
    expect(outcome.run?.status).toBe('success')
    const results = outcome.run?.stepResults as Array<{ ok: boolean; path: string }>
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    expect(results[0].path).toBe('/api/health')
  })

  it('用例2:多步依赖注入 —— 上一步输出进下一步 params[injectFromPrev.into]', async () => {
    seedTemplate('链式', [
      { method: 'GET', path: '/api/first' },
      {
        method: 'POST',
        path: '/api/second',
        params: { extra: 1 },
        injectFromPrev: { into: 'prev' },
      },
      { method: 'POST', path: '/api/third', injectFromPrev: { into: 'prev' } },
    ])
    const { caller, calls } = makeFakeCaller()
    const outcome = await runAiTask('链式', caller, { manual: true })
    expect(outcome.ok).toBe(true)
    expect(calls).toHaveLength(3)
    // 第二步 params.prev = 第一步输出(整包)
    expect(calls[1].params.prev).toEqual({ step: '/api/first', paramsEcho: {} })
    expect(calls[1].params.extra).toBe(1)
    // 第三步 params.prev = 第二步输出(链式传递)
    expect(calls[2].params.prev).toEqual({
      step: '/api/second',
      paramsEcho: { extra: 1, prev: { step: '/api/first', paramsEcho: {} } },
    })
  })

  it('用例3:失败即停 —— 第 2 步抛错 ⇒ status=failed、failedStepIndex=1、后续步不执行', async () => {
    seedTemplate('失败链', [
      { method: 'GET', path: '/a' },
      { method: 'GET', path: '/b' },
      { method: 'GET', path: '/c' },
    ])
    failAtStep = 1
    const { caller, calls } = makeFakeCaller()
    const outcome = await runAiTask('失败链', caller, { manual: true })
    expect(outcome.ok).toBe(false)
    expect(outcome.run?.status).toBe('failed')
    expect(outcome.run?.failedStepIndex).toBe(1)
    expect(outcome.run?.errorMessage).toContain('step 1 failed')
    expect(calls).toHaveLength(2) // 第 3 步不执行
    const results = outcome.run?.stepResults as Array<{ ok: boolean; error?: string }>
    expect(results).toHaveLength(2)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toContain('step 1 failed')
  })

  it('用例4:失败重放从 failedStepIndex 续跑 ⇒ 已成功步不重复调端点', async () => {
    seedTemplate('重放链', [
      { method: 'GET', path: '/a' },
      { method: 'GET', path: '/b' },
      { method: 'GET', path: '/c' },
    ])
    failAtStep = 1
    const first = makeFakeCaller()
    const r1 = await runAiTask('重放链', first.caller, { manual: true })
    expect(r1.ok).toBe(false)
    expect(r1.run?.failedStepIndex).toBe(1)
    expect(first.calls.map((c) => c.path)).toEqual(['/a', '/b'])

    failAtStep = null
    const second = makeFakeCaller()
    const r2 = await runAiTask('重放链', second.caller, { manual: true, replayFromStep: 1 })
    expect(r2.ok).toBe(true)
    expect(second.calls.map((c) => c.path)).toEqual(['/b', '/c'])
    expect(r2.run?.status).toBe('success')
  })

  it('用例5:幂等命中 ⇒ skipped=true、caller 未被调用、不落新痕', async () => {
    seedTemplate('幂等', [{ method: 'GET', path: '/a' }])
    H.existingRuns.add('tpl-1\u0000幂等:2026-11-11') // (templateId, idemKey) 预置命中
    const { caller, calls } = makeFakeCaller()
    const outcome = await runAiTask('幂等', caller, { manual: false }) // cron 形态,同窗口键
    expect(outcome.skipped).toBe(true)
    expect(outcome.ok).toBe(true)
    expect(outcome.run).toBeNull()
    expect(calls).toHaveLength(0)
    expect(H.runInserts).toHaveLength(0)
  })

  it('用例6:未知模板名 ⇒ 抛错、不调端点、不留痕', async () => {
    const { caller, calls } = makeFakeCaller()
    await expect(runAiTask('不存在的模板', caller, { manual: true })).rejects.toThrow(
      /unknown ai task template/,
    )
    expect(calls).toHaveLength(0)
    expect(H.runInserts).toHaveLength(0)
  })

  it('用例7:replayFromStep 越界 ⇒ 抛错(负数 / 超步数)', async () => {
    seedTemplate('越界', [{ method: 'GET', path: '/a' }])
    const { caller } = makeFakeCaller()
    await expect(runAiTask('越界', caller, { manual: true, replayFromStep: -1 })).rejects.toThrow(
      /replayFromStep 越界/,
    )
    await expect(runAiTask('越界', caller, { manual: true, replayFromStep: 5 })).rejects.toThrow(
      /replayFromStep 越界/,
    )
  })

  it('用例8:执行历史 listAiTaskRuns 分页契约(返回 list + total)', async () => {
    H.runReads = [[{ id: 'run-1', templateName: 'x', status: 'success', c: 3 }]]
    const r = await listAiTaskRuns({ templateName: 'x', limit: 10, offset: 0 })
    expect(Array.isArray(r.list)).toBe(true)
    expect(typeof r.total).toBe('number')
    expect(r.total).toBe(3)
  })

  it('用例9:listAiTaskTemplates 返回模板列表数组', async () => {
    seedTemplate('清单', [{ method: 'GET', path: '/a' }])
    const list = await listAiTaskTemplates()
    expect(Array.isArray(list)).toBe(true)
    expect((list as Array<{ name: string }>)[0]?.name).toBe('清单')
  })

  it('契约锁:执行器不得 import api-bridge(api 服务层禁反向依赖 CLI)', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.promises.readFile('src/services/ai-task-executor.ts', 'utf8'),
    )
    expect(src).not.toMatch(/from\s+['"].*api-bridge/)
    expect(src).not.toMatch(/require\(\s*['"].*api-bridge/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
