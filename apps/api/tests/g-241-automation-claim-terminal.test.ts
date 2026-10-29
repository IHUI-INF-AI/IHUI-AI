// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 自动化「结算状态机」—— 认领 + 终态两格的行为验收(2026-10-26 立)。
 *
 * 票面三问的现读判定(取证见 .ihui-agent/tmp/s4-settlement/progress.md):
 *  ① 认领:原先 tick 只有 `SELECT 到期` + 取回后的**只读**复核,进程内单飞看不见别的执行体
 *     ⇒ 两个执行体同刻读到同一行就各跑一次。本文件把它打成可断言的行为(见"① 认领"族)。
 *  ② 退避:attempt / next_run_at 自 G-669 起就是**库列**(schema user_automations.ts:43-50
 *     + 迁移 20261001170000_automation_retry_ledger),重启后仍在 ⇒ 前提已腐烂,本票不重建,
 *     只留一条"认领不得动退避语义"的对照用例(:'② 退避前提未腐烂')。
 *  ③ 终态:permanent / 超上限 / rrule 不可解析 / 手动暂停 四台机器过去全压成 paused,
 *     只能猜自由文本 last_error ⇒ 本文件逐档断言 terminal_reason,并断言人为恢复会重开重试预算。
 *
 * 取证口径(为什么这算"跑出来的",不是"断言出来的"):
 *  - db 替身**按条件树求值** select 的 where 与 update 的 where(drizzle 的 queryChunks 递归解释,
 *    认不出的算子直接 throw)⇒ "第二次还取不取""认领命中几行"都是库的面自己决定的,
 *    不是测试替它决定的;摘掉认领条件那一条 SQL 就会翻红。
 *  - UPDATE 的"求值 + 写回"在同一次同步调用里完成 ⇒ 它就是 Postgres 行锁给出的那份串行化,
 *    两次并发认领必然一次 0 行一次 1 行(票面要求的"重复认领不会发生")。
 *  - 正向对照始终成对:同一刻另一条不同 id 必须仍然认领成功,否则"挡住了"可能只是"全都挡住了"。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { UserAutomation } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

type Row = UserAutomation
type Patch = Record<string, unknown>

/** db 替身的对外句柄(与 g-669 那份同范本,但这里的 where 是真求值)。 */
interface DbMockHandles {
  __setRows: (rows: Row[]) => void
  __getRow: (id: string) => Row | undefined
  __updates: () => Array<{ id: string; patch: Patch }>
  __reset: () => void
}

vi.mock('../src/db/index.js', async () => {
  // 条件树里的列是**数据库列名**(`claim_token`),而内存替身行按 **TS 属性名**(`claimToken`)存。
  // 映射表从 schema 现取(getTableColumns),不靠"蛇形转驼峰"猜 —— 猜错一次就是替身自己放行。
  const { getTableColumns } = await import('drizzle-orm')
  const { userAutomations } = await import('@ihui/database')
  const tsKeyOf: Record<string, string> = {}
  for (const [key, col] of Object.entries(
    getTableColumns(userAutomations) as Record<string, { name: string }>,
  )) {
    tsKeyOf[col.name] = key
  }

  const state: {
    rows: Map<string, Row>
    updates: Array<{ id: string; patch: Patch }>
  } = { rows: new Map(), updates: [] }

  const snapshot = (): Row[] => Array.from(state.rows.values(), (r) => ({ ...r }))

  // ───────────────────────── 条件树求值器(测试替身的一部分,不是生产判据) ─────────────────────────
  type Item =
    | { kind: 'str'; v: string }
    | { kind: 'col'; name: string }
    | { kind: 'param'; value: unknown }
    | { kind: 'sql'; node: unknown }

  const isPlainObject = (n: unknown): n is Record<string, unknown> =>
    typeof n === 'object' && n !== null

  const classify = (n: unknown): Item | null => {
    if (!isPlainObject(n)) return null
    if (Array.isArray(n.queryChunks)) return { kind: 'sql', node: n }
    if ('encoder' in n && 'brand' in n) return { kind: 'param', value: n.value }
    if ('columnType' in n && typeof n.name === 'string') return { kind: 'col', name: n.name }
    // StringChunk.value 是**字符串数组**(实测:drizzle 0.45 把渲染片段收成数组),不是裸串
    if (Array.isArray(n.value) && n.value.every((v) => typeof v === 'string')) {
      return { kind: 'str', v: n.value.join('') }
    }
    if (typeof n.value === 'string') return { kind: 'str', v: n.value }
    return null
  }

  /** 括号与空串不参与判定(它们只是 drizzle 渲染时的排版)。 */
  const meaningful = (items: Item[]): Item[] =>
    items.filter((i) => !(i.kind === 'str' && (i.v.trim() === '' || i.v === '(' || i.v === ')')))

  const compare = (a: unknown, b: unknown): number => {
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    if (typeof a === 'number' && typeof b === 'number') return a - b
    throw new Error(`条件求值器:不支持的比较对象 ${String(a)} / ${String(b)}`)
  }

  const leafEquals = (cur: unknown, want: unknown): boolean => {
    if (cur instanceof Date && want instanceof Date) return cur.getTime() === want.getTime()
    if (cur instanceof Date && typeof want === 'string')
      return cur.getTime() === new Date(want).getTime()
    return cur === want
  }

  const evalLeaf = (items: Item[]): boolean => {
    const cols = items.filter((i) => i.kind === 'col') as Array<{ kind: 'col'; name: string }>
    const strs = items.filter((i) => i.kind === 'str') as Array<{ kind: 'str'; v: string }>
    const params = items.filter((i) => i.kind === 'param') as Array<{
      kind: 'param'
      value: unknown
    }>
    if (cols.length !== 1) throw new Error(`条件求值器:叶子条件应有 1 个列,读到 ${cols.length}`)
    const name = cols[0]!.name
    const op = strs[strs.length - 1]?.v?.trim()
    if (op === undefined) throw new Error('条件求值器:叶子条件读不到算子')
    const cur = currentRowForLeaf[tsKeyOf[name] ?? name]
    // SQL 三值逻辑:与 NULL 比大小的结果是 NULL(不是 true)⇒ 关系算子/等号一律不成立;
    // 只有 is null / is not null 这两支对 NULL 有确定答案。
    if (op === 'is null') return cur === null || cur === undefined
    if (op === 'is not null') return !(cur === null || cur === undefined)
    if (cur === null || cur === undefined) return false
    switch (op) {
      case '=':
        return leafEquals(cur, params[0]?.value)
      case '<=':
        return compare(cur, params[0]?.value) <= 0
      case '<':
        return compare(cur, params[0]?.value) < 0
      case '>':
        return compare(cur, params[0]?.value) > 0
      case '>=':
        return compare(cur, params[0]?.value) >= 0
      default:
        throw new Error(`条件求值器:未识别的算子 "${op}"`)
    }
  }

  /** 求值中的当前行(叶子求值按名字读它)。 */
  let currentRowForLeaf: Row

  const evalItems = (items: Item[]): boolean => {
    const cleaned = meaningful(items)
    const connectors = cleaned.filter(
      (i) => i.kind === 'str' && (i.v === ' and ' || i.v === ' or '),
    ) as Array<{ kind: 'str'; v: string }>
    if (connectors.length > 0) {
      const kinds = new Set(connectors.map((c) => c.v))
      if (kinds.size > 1) throw new Error('条件求值器:同层不判混合 and/or')
      const isOr = kinds.has(' or ')
      const groups: Item[][] = []
      let cursor: Item[] = []
      for (const item of cleaned) {
        if (item.kind === 'str' && (item.v === ' and ' || item.v === ' or ')) {
          groups.push(cursor)
          cursor = []
        } else cursor.push(item)
      }
      groups.push(cursor)
      return isOr ? groups.some((g) => evalItems(g)) : groups.every((g) => evalItems(g))
    }
    // 无同层连接词 ⇒ 要么是一层包裹(唯一子节点),要么就是叶子比较
    const children = cleaned.filter((i) => i.kind === 'sql') as Array<{
      kind: 'sql'
      node: unknown
    }>
    if (children.length === 1 && cleaned.length === 1) {
      return evalNode(children[0]!.node)
    }
    if (cleaned.every((i) => i.kind !== 'sql')) return evalLeaf(cleaned)
    throw new Error('条件求值器:无法归约的条件形态')
  }

  const evalNode = (node: unknown): boolean => {
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks
    if (!Array.isArray(chunks)) throw new Error('条件求值器:节点缺 queryChunks')
    const items = chunks.map(classify).filter((i): i is Item => i !== null)
    return evalItems(items)
  }

  const matches = (cond: unknown, row: Row): boolean => {
    if (cond === undefined || cond === null) return true
    currentRowForLeaf = row
    return evalNode(cond)
  }

  // ───────────────────────── 链式替身 ─────────────────────────
  const selectChain = (conditions: unknown[]): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: (cond: unknown) => selectChain([...conditions, cond]),
      orderBy: () => chain,
      offset: (_n: number) => chain,
      limit: (n: number) => {
        const limited: Record<string, unknown> = {
          then: (resolve: (v: Row[]) => unknown) => {
            const rows = conditions.reduce((acc, c) => acc.filter((r) => matches(c, r)), snapshot())
            return Promise.resolve(rows.slice(0, n)).then(resolve)
          },
        }
        return limited
      },
      then: (resolve: (v: Row[]) => unknown) => {
        const rows = conditions.reduce((acc, c) => acc.filter((r) => matches(c, r)), snapshot())
        return Promise.resolve(rows).then(resolve)
      },
    }
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
      select: vi.fn(() => selectChain([])),
      update: vi.fn(() => {
        let pending: Patch = {}
        const chain: Record<string, unknown> = {
          set: (patch: Patch) => {
            pending = patch
            return chain
          },
          // 求值 + 写回在同一次同步调用里完成 = Postgres 行锁给出的那份串行化(并发认领只可能一份留下)
          where: (cond: unknown) => {
            const hit: Row[] = []
            for (const row of snapshot()) {
              if (!matches(cond, row)) continue
              hit.push(row)
              state.rows.set(row.id, { ...row, ...pending } as Row)
              state.updates.push({ id: row.id, patch: pending })
            }
            chain.__hit = hit
            return chain
          },
          returning: () => {
            const hit = (chain.__hit as Row[] | undefined) ?? []
            return Promise.resolve(hit.map((r) => ({ id: r.id })))
          },
          then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }
        return chain
      }),
      insert: vi.fn(() => {
        const chain: Record<string, unknown> = {
          values: () => chain,
          returning: () => Promise.resolve([]),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }
        return chain
      }),
      delete: vi.fn(() => {
        const chain: Record<string, unknown> = {
          where: () => chain,
          returning: () => Promise.resolve([]),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }
        return chain
      }),
    },
    dbRead: { select: vi.fn(() => selectChain([])) },
  }
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi
    .fn()
    .mockResolvedValue({ userId: '00000000-0000-4000-8000-000000000fee', roleId: 1 }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetchStream: vi.fn(),
}))

const dbMock = (await import('../src/db/index.js')) as unknown as DbMockHandles
const streamMock = vi.mocked(
  (await import('../src/utils/ai-service-fetch.js')).aiServiceFetchStream,
)
const {
  runAutomationTick,
  executeAutomation,
  claimAutomationRun,
  isAutomationClaimFree,
  automationDueConditions,
  automationUnclaimedCondition,
  AUTOMATION_CLAIM_LEASE_MS,
  MAX_TRANSIENT_ATTEMPTS,
} = await import('../src/services/agent-automation-scheduler.js')
const automationsRoutes = (await import('../src/routes/automations.js')).default

// =============================================================================
// 夹具
// =============================================================================

let seq = 0
const nextId = (): string => {
  seq += 1
  return `00000000-0000-4000-8000-000000000${String(seq).padStart(3, '0')}`
}

function makeRow(over: Partial<Row> = {}): Row {
  const id = over.id ?? nextId()
  return {
    id,
    userId: '00000000-0000-4000-8000-000000000fee',
    name: '测试自动化',
    prompt: '跑一下',
    scheduleType: 'once',
    rrule: null,
    scheduledAt: new Date('2026-10-26T00:00:00.000Z'),
    timezone: 'Asia/Shanghai',
    status: 'active',
    conversationId: null,
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
    attempt: 0,
    lastError: null,
    // G-241 三列
    terminalReason: null,
    claimToken: null,
    claimedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...over,
  }
}

/** 到期且未被认领的 once 行(scheduled_at 已过)。 */
const dueOnce = (over: Partial<Row> = {}): Row =>
  makeRow({ scheduledAt: new Date(T0.getTime() - 1), ...over })

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

/** 抛穿型失败(走 catch ⇒ transient)。 */
function streamThrows(message: string): void {
  streamMock.mockImplementation(async () => {
    throw new Error(message)
  })
}

const T0 = new Date('2026-10-26T00:00:00.000Z')

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
  warnSpy.mockRestore()
})

const upstreamCalls = (): number => streamMock.mock.calls.length
const warnedText = (): string =>
  warnSpy.mock.calls
    .flat()
    .map((part) => (typeof part === 'string' ? part : ''))
    .join('\n')

// =============================================================================
// ① 认领:同一次触发只准一个执行体跑(票面核心断言)
// =============================================================================

describe('G-241 ① 并发认领只有一份成功', () => {
  it('同一行两次并发认领 ⇒ 一次成功一次 null;另一条不同 id 同时认领成功(正向对照)', async () => {
    const row = dueOnce()
    const other = dueOnce()
    dbMock.__setRows([row, other])

    const [mine, loser, otherClaim] = await Promise.all([
      claimAutomationRun(row.id, { now: T0, requireDue: true }),
      claimAutomationRun(row.id, { now: T0, requireDue: true }),
      claimAutomationRun(other.id, { now: T0, requireDue: true }),
    ])

    // 票面判据:并发两次认领只有一次成功
    const successes = [mine, loser].filter((t) => t !== null)
    expect(successes).toHaveLength(1)
    // 正向对照:挡住的不是"所有认领",另一行照样拿到
    expect(otherClaim).not.toBeNull()
    expect(otherClaim).toBe(dbMock.__getRow(other.id)!.claimToken)
    expect(dbMock.__getRow(other.id)!.claimedAt).toBeInstanceOf(Date)

    // 库里只留下一份凭据,且落在被认领的那一行
    const claimedRow = dbMock.__getRow(row.id)!
    expect(claimedRow.claimToken).toBe(successes[0])
    expect(claimedRow.status).toBe('active')
    // 认领是一次 UPDATE(拿到的人 1 笔),而不是"读一次再写一次"
    expect(dbMock.__updates().filter((u) => u.id === row.id)).toHaveLength(1)
  })

  it('两个 tick 并发跑同一行 ⇒ 上游只被打一次(原缺陷就是这里 double-run)', async () => {
    const row = dueOnce()
    dbMock.__setRows([row])
    streamSummarizes('日报')

    await Promise.all([runAutomationTick(T0), runAutomationTick(T0)])

    expect(upstreamCalls()).toBe(1)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.lastResult?.summary).toBe('日报')
    // 让路的那一路必须点名,不得静默丢
    expect(warnedText()).toContain(row.id)
    expect(warnedText()).toMatch(/认领未命中|已被并发执行体认领/)
  })

  it('已结算(认领被释放)的同一时刻第二次 tick 不再跑:once 行不会因释放而重放', async () => {
    const row = dueOnce()
    dbMock.__setRows([row])
    streamSummarizes('日报')

    await runAutomationTick(T0)
    await runAutomationTick(T0)
    expect(upstreamCalls()).toBe(1)

    const settled = dbMock.__getRow(row.id)!
    expect(settled.claimToken).toBeNull()
    expect(settled.claimedAt).toBeNull()
  })

  it('租约未超龄 ⇒ 不可接管并点名;租约超龄 ⇒ 允许接管(执行体崩溃不得让这一行永远停摆)', async () => {
    const fresh = dueOnce({ claimToken: 'tok-held', claimedAt: new Date(T0.getTime() - 60_000) })
    const aged = dueOnce({
      claimToken: 'tok-crashed',
      claimedAt: new Date(T0.getTime() - AUTOMATION_CLAIM_LEASE_MS - 1),
    })
    dbMock.__setRows([fresh, aged])

    expect(isAutomationClaimFree(fresh, T0)).toBe(false)
    expect(isAutomationClaimFree(aged, T0)).toBe(true)

    streamSummarizes('日报')
    await runAutomationTick(T0)

    // 超龄那枚被接管并跑掉;新鲜那枚本轮一次都不许跑
    expect(upstreamCalls()).toBe(1)
    expect(dbMock.__getRow(aged.id)!.claimToken).not.toBe('tok-crashed')
    expect(dbMock.__getRow(fresh.id)!.claimToken).toBe('tok-held')
    // 新鲜租约是被**窄筛那条 SQL** 挡掉的(不是靠取回后再猜),所以它连本轮候选都不该出现
    expect(warnedText()).not.toContain(fresh.id)
  })

  it('带 claim_token 却读不出 claimed_at ⇒ 不接管 + 喊出来(不得猜"超龄"造成双跑)', async () => {
    const broken = dueOnce({ claimToken: 'tok-broken', claimedAt: null as unknown as Date })
    dbMock.__setRows([broken])
    streamSummarizes('日报')

    expect(isAutomationClaimFree(broken, T0)).toBe(false)
    expect(warnedText()).toContain('读不出 claimed_at')

    await runAutomationTick(T0)
    expect(upstreamCalls()).toBe(0)
  })

  it('run-now 认领不要求到点(paused 行也允许人工立即运行),但不得抢正在跑的行', async () => {
    const idle = makeRow({ status: 'paused', scheduledAt: new Date(T0.getTime() + 86_400_000) })
    const held = makeRow({
      status: 'paused',
      scheduledAt: new Date(T0.getTime() + 86_400_000),
      claimToken: 'tok-held',
      claimedAt: T0,
    })
    dbMock.__setRows([idle, held])

    expect(await claimAutomationRun(idle.id, { now: T0, requireDue: false })).not.toBeNull()
    expect(await claimAutomationRun(held.id, { now: T0, requireDue: false })).toBeNull()
    // requireDue=true 时未到点 ⇒ 一律不认领(与 tick 那一档分开)
    expect(await claimAutomationRun(idle.id, { now: T0, requireDue: true })).toBeNull()
  })

  it('② 退避前提未腐烂:认领只加一维,transient 的 attempt/next_run_at 语义一字未动', async () => {
    const row = dueOnce()
    dbMock.__setRows([row])
    streamThrows('fetch failed')

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.attempt).toBe(1)
    expect(settled.status).toBe('active')
    expect(settled.terminalReason).toBeNull()
    expect(settled.nextRunAt!.getTime()).toBe(T0.getTime() + 5 * 60_000)

    // 退避到点后仍能被认领并再跑一次(认领没有把重试队列堵死)
    vi.setSystemTime(settled.nextRunAt!)
    await runAutomationTick(settled.nextRunAt!)
    expect(upstreamCalls()).toBe(2)
    expect(dbMock.__getRow(row.id)!.attempt).toBe(2)
  })
})

// =============================================================================
// ③ 终态:四档可被判据区分
// =============================================================================

describe('G-241 ③ 终态档位', () => {
  it('permanent 失败 ⇒ terminal_reason=failed_permanent(与"人为暂停"不再是同一个 paused)', async () => {
    const row = dueOnce()
    dbMock.__setRows([row])
    streamMock.mockResolvedValue(
      new Response('{"error":"Invalid or expired token"}', { status: 401 }),
    )

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    expect(settled.terminalReason).toBe('failed_permanent')
    expect(settled.claimToken).toBeNull()
  })

  it('transient 连击超上限 ⇒ terminal_reason=failed_retries_exhausted(与 permanent 分档)', async () => {
    const row = dueOnce({ attempt: MAX_TRANSIENT_ATTEMPTS })
    dbMock.__setRows([row])
    streamThrows('fetch failed')

    await runAutomationTick(T0)
    const settled = dbMock.__getRow(row.id)!
    expect(settled.status).toBe('paused')
    expect(settled.terminalReason).toBe('failed_retries_exhausted')
  })

  it('once 成功 ⇒ completed;recurring 成功 ⇒ 无终态(它还要再跑)', async () => {
    const once = dueOnce()
    const recurring = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([once, recurring])
    streamSummarizes('日报')

    await runAutomationTick(T0)

    expect(dbMock.__getRow(once.id)!.terminalReason).toBe('completed')
    const rec = dbMock.__getRow(recurring.id)!
    expect(rec.terminalReason).toBeNull()
    expect(rec.status).toBe('active')
    expect(rec.nextRunAt!.getTime()).toBeGreaterThan(T0.getTime())
  })

  it('rrule 不可解析 ⇒ failed_permanent(它过去也只留一个 paused)', async () => {
    const row = makeRow({
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=NONSENSE',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])
    streamSummarizes('日报')

    await expect(executeAutomation(row, null)).resolves.toBe('日报')
    expect(dbMock.__getRow(row.id)!.terminalReason).toBe('failed_permanent')
  })
})

// =============================================================================
// SQL 投影:认领维度确实进了那条 SQL(不是只在 JS 里挡)
// =============================================================================

describe('G-241 到期窄筛与认领条件的 SQL 投影', () => {
  it('automationDueConditions 同时含到期三支与"未被持有"', () => {
    const rendered = new PgDialect().sqlToQuery(automationDueConditions(T0) as never)
    const sql = rendered.sql
    expect(sql).toContain('"status" =')
    expect(sql).toContain('"last_run_at" is null')
    expect(sql).toContain('"attempt" >')
    // 认领维:未认领 or 租约超龄,两条都在
    expect(sql).toContain('"claim_token" is null')
    expect(sql).toContain('"claimed_at" <')
    // 租约超龄线 = now - LEASE,与到期用的 now 是两个不同参数(不得拿同一个值冒充)
    // dialect 把 timestamptz 参数序列化成 ISO 串 ⇒ 只取"能解析成时刻"的参数串
    const timeParams = rendered.params
      .filter((p) => typeof p === 'string' && !Number.isNaN(new Date(p).getTime()))
      .map((p) => new Date(p as string).getTime())
    expect(rendered.params).toContain(T0.toISOString())
    expect(Math.min(...timeParams)).toBe(T0.getTime() - AUTOMATION_CLAIM_LEASE_MS)
  })

  it('automationUnclaimedCondition 单独渲染 ⇒ 只有 claim 两列', () => {
    const rendered = new PgDialect().sqlToQuery(automationUnclaimedCondition(T0) as never)
    expect(rendered.sql).toContain('"claim_token" is null')
    expect(rendered.sql).toContain('"claimed_at" <')
    expect(rendered.sql).not.toContain('"next_run_at"')
  })
})

// =============================================================================
// 路由面:run-now 的 409 与 PATCH 的终态归属(人的动作写人那一档)
// =============================================================================

describe('G-241 路由面:run-now 认领 / PATCH 终态', () => {
  const server = Fastify({ logger: false })
  const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

  beforeAll(async () => {
    server.register(automationsRoutes, { prefix: '/api/automations' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('run-now:行正被执行体持有 ⇒ 409 且一次上游都不打', async () => {
    const held = makeRow({
      claimToken: 'tok-held',
      claimedAt: new Date(T0.getTime() - 1000),
    })
    dbMock.__setRows([held])
    streamSummarizes('日报')

    const res = await server.inject({
      method: 'POST',
      url: `/api/automations/${held.id}/run-now`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('正在执行中')
    expect(upstreamCalls()).toBe(0)
    expect(dbMock.__getRow(held.id)!.claimToken).toBe('tok-held')
  })

  it('run-now:空闲行照常执行(正向对照,409 不是恒 409)', async () => {
    const idle = makeRow({ status: 'paused', scheduledAt: new Date(T0.getTime() + 86_400_000) })
    dbMock.__setRows([idle])
    streamSummarizes('手工跑一次')

    const res = await server.inject({
      method: 'POST',
      url: `/api/automations/${idle.id}/run-now`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.summary).toBe('手工跑一次')
    expect(upstreamCalls()).toBe(1)
    // 结算把认领释放掉了
    expect(dbMock.__getRow(idle.id)!.claimToken).toBeNull()
  })

  it('PATCH status=paused ⇒ manual_pause(人为暂停自此与失败终态分得开)', async () => {
    const row = makeRow()
    dbMock.__setRows([row])

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/automations/${row.id}`,
      headers: AUTH_HEADERS,
      payload: { status: 'paused' },
    })
    expect(res.statusCode).toBe(200)
    expect(dbMock.__getRow(row.id)!.terminalReason).toBe('manual_pause')
  })

  it('PATCH 失败终态恢复 active ⇒ 终态清空 + 重开重试预算(不得一抖就被判回终态)', async () => {
    const row = makeRow({
      status: 'paused',
      terminalReason: 'failed_retries_exhausted',
      attempt: MAX_TRANSIENT_ATTEMPTS,
      lastError: 'transient:default-transient — fetch failed',
      nextRunAt: new Date(T0.getTime() - 1),
    })
    dbMock.__setRows([row])

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/automations/${row.id}`,
      headers: AUTH_HEADERS,
      payload: { status: 'active' },
    })
    expect(res.statusCode).toBe(200)

    const resumed = dbMock.__getRow(row.id)!
    expect(resumed.status).toBe('active')
    expect(resumed.terminalReason).toBeNull()
    expect(resumed.lastError).toBeNull()
    // once 行留 attempt=1:到期判据的重试分支认的就是 attempt>0,归零会让恢复后永不到期
    expect(resumed.attempt).toBe(1)

    // 恢复后第一次抖动必须还在预算内(而不是 attempt+1 > 上限立刻落回终态)
    streamThrows('fetch failed')
    await runAutomationTick(new Date(resumed.nextRunAt!.getTime() + 1))
    const after = dbMock.__getRow(row.id)!
    expect(after.status).toBe('active')
    expect(after.terminalReason).toBeNull()
    expect(after.attempt).toBe(2)
  })

  it('PATCH 改排程把 once 行重新武装 ⇒ 粘着的 completed 必须清掉', async () => {
    const row = makeRow({
      terminalReason: 'completed',
      lastRunAt: new Date(T0.getTime() - 3600_000),
      scheduledAt: new Date(T0.getTime() - 3600_000),
    })
    dbMock.__setRows([row])

    const res = await server.inject({
      method: 'PATCH',
      url: `/api/automations/${row.id}`,
      headers: AUTH_HEADERS,
      payload: { scheduledAt: new Date(T0.getTime() + 86_400_000).toISOString() },
    })
    expect(res.statusCode).toBe(200)
    expect(dbMock.__getRow(row.id)!.terminalReason).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
