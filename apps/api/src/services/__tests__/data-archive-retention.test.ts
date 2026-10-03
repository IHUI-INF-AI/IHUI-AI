// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * data-archive-service 留存期清理测试。
 *
 * 覆盖 2026-10-03 新增的两段（chat_messages / conversation_message_archives，365 天档）:
 * 1. 超期被删、未超不删（两表各一组）—— 用真实的 created_at 数据判据，不是"调用发生次数"
 * 2. 单分支抛异常时 errors[] 有记录，且**其余五段照常执行**（单表失败不阻断其他表）
 * 3. 阈值边界：恰好 365 天整**不删**（`lt` 严格小于，保留期语义是"至少 365 天"）
 * 4. 分批删除：>1000 行分多批删完，不留尾巴（drizzle 的 delete builder 无 .limit()）
 *
 * mock 设计：db 是**会真的解析 drizzle 条件 AST** 的内存表 —— where 里的
 * `lt(created_at, Date)` 会被求值成对行数据的比较，而不是被记成一次调用。
 * 这样"超期删/未超不删"断言的是数据结果；若AST 形状变了，测试会失败而不是静默通过。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// ─────────────────────────────────────────────────────────────
// Mock:db 层 —— 内存表 + drizzle 条件求值
// ─────────────────────────────────────────────────────────────
const { store, failOn, dbCalls, resetStore } = vi.hoisted(() => {
  /** 表名 → 行数组(行字段用数据库列名,与 drizzle 列的 .name 对齐) */
  const store: Record<string, Array<Record<string, unknown>>> = {}
  /** 指定表名注入异常,用来验证"单分支失败不阻断其他分支" */
  const failOn = new Set<string>()
  const dbCalls: Array<{ op: string; table: string }> = []
  const resetStore = () => {
    for (const k of Object.keys(store)) delete store[k]
    failOn.clear()
    dbCalls.length = 0
  }
  return { store, failOn, dbCalls, resetStore }
})

vi.mock('../../db/index.js', () => ({
  db: {
    delete: (table: unknown) => makeDeleteChain(tableName(table)),
    select: (_cols?: unknown) => makeSelectChain(),
    // 2026-10-03:agent_user_profile 的到期回收走 execute(ctid 子查询),
    // 因为该表主键是 user_id 而非 id,进不了 makeSelectChain/makeDeleteChain 那条
    // "按 id 取批再删"的路。mock 必须覆盖它,否则该分支会因
    // "db.execute is not a function" 记一条假 error —— 那会让
    // 「单分支异常」用例误以为有第二个分支炸了。
    //
    // 语义与真 SQL 对齐:DELETE ... WHERE ctid IN (SELECT ... WHERE expires_at
    // IS NOT NULL AND expires_at <= NOW() LIMIT n) —— 即按 expires_at 判到期、
    // NULL(显式长期保留)不删、分批。drizzle 的 sql`` 模板无法拆 AST,
    // 故这里直接扫 store 里的 expires_at(与实现同一判据)。
    execute: (q: unknown) => {
      const text = String(q)
      const table = Object.keys(store).find((t) => text.includes(t))
      if (!table) return Promise.resolve([])
      if (failOn.has(table)) return Promise.reject(new Error(`${table} 注入异常`))
      const rows = store[table] ?? []
      const now = Date.now()
      const hit = rows.filter((r) => {
        const e = r.expires_at
        if (e === null || e === undefined) return false // NULL = 显式长期保留
        return (e instanceof Date ? e.getTime() : new Date(e as string).getTime()) <= now
      })
      dbCalls.push({ op: 'execute', table })
      store[table] = rows.filter((r) => !hit.includes(r))
      return Promise.resolve(hit)
    },
  },
}))

// 条件 AST 求值所需的类型(与 service 侧同源,但此处只需结构)
type AnyChunk = Record<string, unknown>
type Predicate = { col: string; op: string; val: unknown }

function tableName(table: unknown): string {
  const name = (table as Record<symbol, string | undefined>)[Symbol.for('drizzle:Name')]
  if (typeof name !== 'string') throw new Error('传入的不是 drizzle 表对象(缺少 drizzle:Name)')
  return name
}

function isSqlNode(v: unknown): v is { queryChunks: AnyChunk[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as AnyChunk).queryChunks)
}

/**
 * 把 drizzle 条件 AST 摊平成若干 `{col, op, val}` 谓词。
 * `and(a, b)` 在 AST 里是「StringChunk('(') + 内嵌 SQL + StringChunk(')')」的包裹，
 * 谓词并不直接挂在顶层 —— 所以遇到子 SQL 必须递归下去收集，最后按 AND 合并。
 */
function extractPredicates(node: unknown, out: Predicate[] = []): Predicate[] {
  const chunks = (isSqlNode(node) ? node.queryChunks : []) as AnyChunk[]
  let col: string | null = null
  let op: string | null = null
  let val: unknown
  let hasVal = false

  for (const ch of chunks) {
    if (isSqlNode(ch)) {
      extractPredicates(ch, out)
      continue
    }
    // inArray 的参数列表是裸数组(元素为 Param)
    if (Array.isArray(ch)) {
      val = (ch as Array<{ value: unknown }>).map((p) => p.value)
      hasVal = true
      continue
    }
    if (ch === null || typeof ch !== 'object') continue
    // 列引用:带 table + name
    if (ch.table !== undefined && typeof ch.name === 'string') {
      col = ch.name
      continue
    }
    const v = (ch as { value?: unknown }).value
    // StringChunk: value 是字符串数组;非空即比较运算符
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      const t = (v as string[]).join('').trim()
      // 'in' 必须列进来:分批删除走inArray(table.id, ids),漏了它会让谓词解析为空
      // ⇒ matchRow 退化成"全表命中",测试就会假绿/假红。
      if (['<', '>', '=', '<=', '>=', '<>', 'in'].includes(t)) op = t
      continue
    }
    if (v instanceof Date || typeof v === 'string' || typeof v === 'boolean') {
      val = v
      hasVal = true
    }
  }

  if (col && op && hasVal) out.push({ col, op, val })
  return out
}

function matchRow(row: Record<string, unknown>, cond: unknown): boolean {
  const preds = extractPredicates(cond)
  // 解析不出谓词就必须炸:静默"全表命中"会让本文件所有断言失去意义
  // (曾真的踩过 —— 漏了 'in' 运算符,分批删除被当成全表删,测试假绿)。
  if (preds.length === 0) {
    throw new Error(`未能从条件 AST 中提取谓词: ${JSON.stringify(cond)}`)
  }
  return preds.every(({ col, op, val }) => {
    const cell = row[col]
    if (op === 'in') return (val as unknown[]).includes(cell)
    if (op === '<') return (cell as Date) < (val as Date)
    if (op === '<=') return (cell as Date) <= (val as Date)
    if (op === '>') return (cell as Date) > (val as Date)
    if (op === '>=') return (cell as Date) >= (val as Date)
    if (op === '=') return cell === val
    if (op === '<>') return cell !== val
    throw new Error(`未处理的运算符: ${op}`)
  })
}

/** delete 链:where 可叠加,await 时求值并真的从store 里移除 */
function makeDeleteChain(table: string, cond: unknown = null): unknown {
  // 注意:失败必须**通过 onRejected 回调**回传,不能在 then 里直接 throw ——
  // await 只认回调的返回值,直接 throw 会变成一条无人认领的 unhandled rejection。
  const run = (): Promise<Array<{ id: unknown }>> => {
    if (failOn.has(table)) return Promise.reject(new Error(`${table} 注入异常`))
    const rows = store[table] ?? []
    const hit = cond ? rows.filter((r) => matchRow(r, cond)) : rows.slice()
    dbCalls.push({ op: 'delete', table })
    store[table] = rows.filter((r) => !hit.includes(r))
    return Promise.resolve(hit.map((r) => ({ id: r.id })))
  }
  return {
    where: (c: unknown) => makeDeleteChain(table, c),
    returning: () => makeDeleteChain(table, cond),
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      run().then(onFulfilled, onRejected),
    catch: (onRejected?: (e: unknown) => unknown) => run().catch(onRejected),
  }
}

/** select 链:支持 .from().where().limit()，await 时返回命中行 */
function makeSelectChain(
  table: string | null = null,
  cond: unknown = null,
  limitN: number | null = null,
): unknown {
  const run = (): Promise<Array<{ id: unknown }>> => {
    if (table && failOn.has(table)) return Promise.reject(new Error(`${table} 注入异常`))
    const rows = table ? (store[table] ?? []) : []
    const hit = cond ? rows.filter((r) => matchRow(r, cond)) : rows.slice()
    dbCalls.push({ op: 'select', table: table ?? '?' })
    return Promise.resolve((limitN === null ? hit : hit.slice(0, limitN)).map((r) => ({ id: r.id })))
  }
  return {
    from: (t: unknown) => makeSelectChain(tableName(t), cond, limitN),
    where: (c: unknown) => makeSelectChain(table, c, limitN),
    limit: (n: number) => makeSelectChain(table, cond, n),
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      run().then(onFulfilled, onRejected),
    catch: (onRejected?: (e: unknown) => unknown) => run().catch(onRejected),
  }
}

// ─────────────────────────────────────────────────────────────
// 固定"现在"，让 365 天边界可精确断言
// ─────────────────────────────────────────────────────────────
const NOW = new Date('2026-10-03T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
/** 相对 now 偏移 n 天 */
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

let archiveDailyData: typeof import('../data-archive-service.js').archiveDailyData

/** 给某表塞 n 行，行 created_at = offsetDays 天前 */
function seed(table: string, n: number, offsetDays: number, extra: Record<string, unknown> = {}) {
  store[table] = Array.from({ length: n }, (_, i) => ({
    id: `${table}-${i}`,
    created_at: daysAgo(offsetDays),
    ...extra,
  }))
}

/** 读某表当前行(该表从未被 seed 过就是空表,不是 undefined) */
function rowsOf(table: string): Array<Record<string, unknown>> {
  return store[table] ?? []
}

/** 该表当前是否还留有某 id */
const has = (table: string, id: string) => (store[table] ?? []).some((r) => r.id === id)

beforeEach(async () => {
  resetStore()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  ;({ archiveDailyData } = await import('../data-archive-service.js'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('archiveDailyData · chat_messages / conversation_message_archives 365 天清理', () => {
  it('chat_messages:超 365 天被删,未超的不被删', async () => {
    // 366 天前 ⇒ 过期; 364 天前 ⇒ 未过期; 100 天前 ⇒ 远未过期
    store['chat_messages'] = [
      { id: 'chat-old', created_at: daysAgo(366) },
      { id: 'chat-edge-old', created_at: daysAgo(365.5) },
      { id: 'chat-fresh', created_at: daysAgo(364) },
      { id: 'chat-new', created_at: daysAgo(100) },
    ]

    const r = await archiveDailyData()

    expect(r.chatMessagesArchived).toBe(2)
    expect(has('chat_messages', 'chat-old')).toBe(false)
    expect(has('chat_messages', 'chat-edge-old')).toBe(false)
    expect(has('chat_messages', 'chat-fresh')).toBe(true)
    expect(has('chat_messages', 'chat-new')).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('conversation_message_archives:超 365 天被删,未超的不被删', async () => {
    store['conversation_message_archives'] = [
      { id: 'arch-old', created_at: daysAgo(400) },
      { id: 'arch-fresh', created_at: daysAgo(200) },
    ]

    const r = await archiveDailyData()

    expect(r.conversationMessageArchivesArchived).toBe(1)
    expect(has('conversation_message_archives', 'arch-old')).toBe(false)
    expect(has('conversation_message_archives', 'arch-fresh')).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('阈值边界:恰好 365 天整算未过期(lt 严格小于 ⇒ 保留期是"至少 365 天")', async () => {
    // 三行分别:整 365 天、整 365 天少 1ms、整 365 天多 1ms
    store['chat_messages'] = [
      { id: 'exactly-365', created_at: new Date(NOW.getTime() - 365 * DAY) },
      { id: 'ms-under-365', created_at: new Date(NOW.getTime() - 365 * DAY + 1) },
      { id: 'ms-over-365', created_at: new Date(NOW.getTime() - 365 * DAY - 1) },
    ]

    const r = await archiveDailyData()

    // 只有"比整 365 天还早 1ms"那一行过期
    expect(r.chatMessagesArchived).toBe(1)
    expect(has('chat_messages', 'exactly-365')).toBe(true)
    expect(has('chat_messages', 'ms-under-365')).toBe(true)
    expect(has('chat_messages', 'ms-over-365')).toBe(false)
  })

  it('分批:超过单批 1000 行的过期数据被分多批删干净(不留尾巴)', async () => {
    // 2500 行全过期 ⇒ 1000 + 1000 + 500 三批
    seed('chat_messages', 2500, 400)
    // 混入 10 行未过期,它们不该被删
    rowsOf('chat_messages').push(
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `keep-${i}`,
        created_at: daysAgo(10),
      })),
    )

    const r = await archiveDailyData()

    expect(r.chatMessagesArchived).toBe(2500)
    expect(rowsOf('chat_messages')).toHaveLength(10)
    expect(rowsOf('chat_messages').every((row) => String(row.id).startsWith('keep-'))).toBe(true)
    // 3 批 ⇒ 3 次 select(按主键取批)+ 3 次 delete(按inArray 删批)
    const selects = dbCalls.filter((c) => c.op === 'select' && c.table === 'chat_messages')
    const deletes = dbCalls.filter((c) => c.op === 'delete' && c.table === 'chat_messages')
    expect(selects).toHaveLength(3)
    expect(deletes).toHaveLength(3)
  })

  it('单分支异常:errors[] 有记录,且其余五段仍继续执行', async () => {
    // 全部六张表都塞过期数据,便于验证"其他分支照跑"
    seed('audit_logs', 2, 100)
    seed('messages', 2, 200)
    seed('notifications', 2, 40, { is_read: true })
    seed('relay_messages', 2, 200)
    seed('chat_messages', 2, 400)
    seed('conversation_message_archives', 2, 400)

    // 只让 chat_messages 这一段炸
    failOn.add('chat_messages')

    const r = await archiveDailyData()

    // 失败被记录,消息风格与既有分支一致
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/^chat_messages archive failed: /)
    expect(r.errors[0]).toContain('chat_messages 注入异常')
    // 失败分支计数为 0
    expect(r.chatMessagesArchived).toBe(0)

    // 其余五段照常执行 —— 这是本设计的要点:单表失败不阻断其他表
    expect(r.auditLogsArchived).toBe(2)
    expect(r.messagesArchived).toBe(2)
    expect(r.notificationsArchived).toBe(2)
    expect(r.relayMessagesArchived).toBe(2)
    // 关键:排在失败分支之后的第六段仍然执行了(不是一fail 就整体中断)
    expect(r.conversationMessageArchivesArchived).toBe(2)
    expect(rowsOf('conversation_message_archives')).toHaveLength(0)
  })

  it('notifications 仍只删已读(判据未被新分支带偏)', async () => {
    store['notifications'] = [
      { id: 'n-read-old', created_at: daysAgo(40), is_read: true },
      { id: 'n-unread-old', created_at: daysAgo(40), is_read: false },
    ]

    const r = await archiveDailyData()

    expect(r.notificationsArchived).toBe(1)
    expect(has('notifications', 'n-read-old')).toBe(false)
    expect(has('notifications', 'n-unread-old')).toBe(true)
  })

  it('无过期数据时两段计数为 0 且不报错', async () => {
    seed('chat_messages', 3, 30)
    seed('conversation_message_archives', 3, 30)

    const r = await archiveDailyData()

    expect(r.chatMessagesArchived).toBe(0)
    expect(r.conversationMessageArchivesArchived).toBe(0)
    expect(r.errors).toEqual([])
    expect(rowsOf('chat_messages')).toHaveLength(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
