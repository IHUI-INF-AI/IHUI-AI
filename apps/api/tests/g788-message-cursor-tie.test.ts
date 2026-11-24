// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-788:消息游标分页的"同值时间戳兄弟行被永久跳过"缺陷回归。
 *
 * 病灶(现网候选缺陷):`apps/api/src/db/chat-queries.ts` 旧分页分支的游标只比
 * `createdAt` 单列(`lt/gt(chatMessages.createdAt, cursorMsg.createdAt)`),而导入路径
 * `apps/api/src/routes/conversation-import.ts:165-167` 把缺省/非法的 message createdAt
 * 一律回退到**同一个** `conversationCreatedAt` ⇒ 同值兄弟行成批存在。
 * 单列比较会把"与游标同一时间戳、序上排在它之前/之后"的行整批排除,且全程零报错。
 *
 * 判据形态:走内存 mock 的 db(不连生产 PG,AGENTS §5 测试隔离铁律;本机亦无 PG 监听)。
 * mock 不猜测实现意图 —— 它**忠实求值**被传给 `.where()` 的 drizzle SQL 树
 * (flattenSql + 双栈求值,形态复用既有 chat-cursor-pagination.test.ts 中验证过的解释器),
 * 所以把实现退回单列 `lt(createdAt, …)` 时,用例①必然翻红(变异自证见交付报告)。
 *
 * id 决胜键的顺序语义:`chat_messages.id` 是 `uuid('id').defaultRandom()`(schema/chat.ts:66)。
 * PG 对 uuid 按字节序比较(无 collation、全序、唯一);生成侧恒为小写规范形,
 * 故 JS 字符串字典序与 PG 字节序同结论 —— 本文件因此只用小写规范 UUID 作 id。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockRow = Record<string, unknown>
type FlatToken =
  | { kind: 'col'; name: string }
  | { kind: 'op'; text: string }
  | { kind: 'val'; value: unknown }

// ─────────────────────────────────────────────────────────────────────────────
// 内存 db(含 drizzle SQL 求值器)。
// 整块必须待在 vi.hoisted 内:被 mock 的模块在**测试文件体之前**就被求值,
// 放外面的 const/class 此刻尚未初始化(实测报 "Cannot access 'mockDb' before initialization")。
// ─────────────────────────────────────────────────────────────────────────────
const { mockDb, tables } = vi.hoisted(() => {
  const tables: { chatMessages: MockRow[] } = { chatMessages: [] }

  /** SQL 列名 → 内存行属性名(camelCase,与 drizzle select 返回一致) */
  function colProp(sqlName: string): string {
    if (sqlName === 'conversation_id') return 'conversationId'
    if (sqlName === 'created_at') return 'createdAt'
    if (sqlName === 'turn_ordinal') return 'turnOrdinal'
    return sqlName // id / role / content / ...
  }

  function applyOp(op: string, left: unknown, right: unknown): boolean {
    if (left instanceof Date || right instanceof Date) {
      const l = left instanceof Date ? left.getTime() : new Date(String(left)).getTime()
      const r = right instanceof Date ? right.getTime() : new Date(String(right)).getTime()
      if (op === '=') return l === r
      if (op === '<') return l < r
      if (op === '>') return l > r
      if (op === '<=') return l <= r
      if (op === '>=') return l >= r
      throw new Error(`applyOp: 未支持的日期比较符 ${op}`)
    }
    if (op === '=') return left === right
    if (op === '<') return (left as string | number) < (right as string | number)
    if (op === '>') return (left as string | number) > (right as string | number)
    if (op === '<=') return (left as string | number) <= (right as string | number)
    if (op === '>=') return (left as string | number) >= (right as string | number)
    throw new Error(`applyOp: 未支持的比较符 ${op}`)
  }

  /** 深度优先扁平化 drizzle SQL 树;未知形态一律抛错,绝不静默判真 */
  function flattenSql(node: unknown, out: FlatToken[], depth = 0): void {
    if (depth > 64) throw new Error('flattenSql: 递归过深(SQL 形态异常)')
    if (node === null || node === undefined) return
    if (Array.isArray(node)) {
      for (const c of node) flattenSql(c, out, depth + 1)
      return
    }
    if (typeof node !== 'object') {
      out.push({ kind: 'val', value: node })
      return
    }
    const obj = node as Record<string, unknown>
    if (Array.isArray(obj.queryChunks)) {
      for (const c of obj.queryChunks as unknown[]) flattenSql(c, out, depth + 1)
      return
    }
    // 字符串块(drizzle 把操作符/括号包成 { value: [' and '] })
    if (Array.isArray(obj.value) && (obj.value as unknown[]).every((v) => typeof v === 'string')) {
      for (const v of obj.value as string[]) out.push({ kind: 'op', text: v })
      return
    }
    // Column 对象:有 name 且无 value(RLS 包装表暴露的列同样有 name)
    if ('name' in obj && obj.value === undefined) {
      out.push({ kind: 'col', name: String(obj.name) })
      return
    }
    if ('value' in obj) {
      out.push({ kind: 'val', value: obj.value })
      return
    }
    throw new Error(`flattenSql: 无法识别的 SQL 节点 <${String(obj.constructor?.name)}>`)
  }

  const CMP = new Set(['=', '<', '>', '<=', '>=', '!=', '<>'])
  function precedence(op: string): number {
    if (op === 'and') return 2
    if (op === 'or') return 1
    return 4
  }

  /** 双栈(Shunting-yard):括号 + and/or 优先级;keyset 的 or(lt, and(eq,lt)) 必须按 SQL 语义求值 */
  function evalTokens(tokens: FlatToken[], row: MockRow): boolean {
    const out: unknown[] = []
    const ops: string[] = []
    const applyTop = (): void => {
      const op = ops.pop()
      if (!op) return
      const b = out.pop()
      const a = out.pop()
      if (op === 'and') out.push(Boolean(a) && Boolean(b))
      else if (op === 'or') out.push(Boolean(a) || Boolean(b))
      else out.push(applyOp(op, a, b))
    }
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!
      if (t.kind === 'val') {
        out.push(t.value)
        continue
      }
      if (t.kind === 'col') {
        const next = tokens[i + 1]
        if (next && next.kind === 'op' && CMP.has(next.text.trim())) {
          const op = next.text.trim()
          const valT = tokens[i + 2]
          out.push(
            applyOp(op, row[colProp(t.name)], valT && valT.kind === 'val' ? valT.value : undefined),
          )
          i += 2
        } else {
          out.push(Boolean(row[colProp(t.name)]))
        }
        continue
      }
      const trimmed = t.text.trim()
      if (trimmed === '(') {
        ops.push('(')
        continue
      }
      if (trimmed === ')') {
        while (ops.length > 0 && ops[ops.length - 1] !== '(') applyTop()
        ops.pop()
        continue
      }
      const lower = trimmed.toLowerCase()
      if (lower === 'and' || lower === 'or') {
        while (
          ops.length > 0 &&
          ops[ops.length - 1] !== '(' &&
          precedence(ops[ops.length - 1]!) >= precedence(lower)
        )
          applyTop()
        ops.push(lower)
        continue
      }
      if (CMP.has(lower)) ops.push(lower)
    }
    while (ops.length > 0) applyTop()
    const r = out.pop()
    return typeof r === 'boolean' ? r : Boolean(r)
  }

  function evalWhere(cond: unknown, row: MockRow): boolean {
    if (cond === null || cond === undefined) return true
    const tokens: FlatToken[] = []
    flattenSql(cond, tokens)
    return evalTokens(tokens, row)
  }

  /** thenable 构造器:同时支持 .limit(n) 与 .limit(n).offset(m) 两种链尾 */
  class SelectBuilder {
    private rows: MockRow[] = []
    private condition: unknown = null
    private order: { prop: string; dir: 'asc' | 'desc' }[] = []
    private limitVal = Infinity
    private offsetVal = 0
    private countOnly = false

    constructor(fields?: unknown) {
      // db.select({ count: sql`COUNT(*)` }) —— 计数查询按过滤后的行数回答
      if (
        fields &&
        typeof fields === 'object' &&
        !Array.isArray(fields) &&
        'count' in (fields as object)
      ) {
        this.countOnly = true
      }
    }
    from(table: unknown): SelectBuilder {
      this.rows =
        table && typeof table === 'object' && 'conversationId' in (table as object)
          ? tables.chatMessages
          : []
      return this
    }
    where(cond: unknown): SelectBuilder {
      this.condition = cond
      return this
    }
    orderBy(...cols: unknown[]): SelectBuilder {
      this.order = cols.map((c) => {
        const tokens: FlatToken[] = []
        flattenSql(c, tokens)
        let prop = 'id'
        let dir: 'asc' | 'desc' = 'asc'
        for (const t of tokens) {
          if (t.kind === 'col') prop = colProp(t.name)
          if (t.kind === 'op' && t.text.trim().toLowerCase() === 'desc') dir = 'desc'
        }
        return { prop, dir }
      })
      return this
    }
    limit(n: number): SelectBuilder {
      this.limitVal = n
      return this
    }
    offset(n: number): SelectBuilder {
      this.offsetVal = n
      return this
    }
    private resolve(): MockRow[] {
      let rows = this.rows.filter((r) => evalWhere(this.condition, r))
      if (this.order.length > 0) {
        rows = rows.slice().sort((a, b) => {
          for (const o of this.order) {
            const av = a[o.prop]
            const bv = b[o.prop]
            let cmp = 0
            if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime()
            else if (typeof av === 'string' && typeof bv === 'string')
              cmp = av < bv ? -1 : av > bv ? 1 : 0
            else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
            if (cmp !== 0) return o.dir === 'desc' ? -cmp : cmp
          }
          return 0
        })
      }
      if (this.countOnly) return [{ count: rows.length }]
      const end = this.limitVal === Infinity ? undefined : this.offsetVal + this.limitVal
      return rows.slice(this.offsetVal, end)
    }
    then<T>(onFulfilled?: (v: MockRow[]) => T, onRejected?: (e: unknown) => T): Promise<T> {
      return Promise.resolve(this.resolve()).then(onFulfilled, onRejected)
    }
  }

  const mockDb = {
    select: (fields?: unknown) => new SelectBuilder(fields),
  }
  return { mockDb, tables }
})

vi.mock('../src/db/index.js', () => ({ db: mockDb, dbRead: mockDb }))

import { findMessages } from '../src/db/chat-queries.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'
const T = new Date(Date.UTC(2026, 8, 30, 0, 0, 0))
/** 小写规范 UUID(字节序 == 字典序),用于构造同值时间戳的兄弟行 */
const uuidAt = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function seed(rows: { id: string; createdAt: Date; conversationId?: string }[]): void {
  for (const r of rows) {
    tables.chatMessages.push({
      id: r.id,
      conversationId: r.conversationId ?? CONV_ID,
      role: 'user',
      content: r.id,
      reasoning: null,
      tokens: null,
      metadata: {},
      createdAt: r.createdAt,
    })
  }
}

const ids = (list: { id: string }[]): string[] => list.map((m) => m.id)

describe('G-788 旧分页分支游标必须按 (createdAt, id) 双列比较', () => {
  beforeEach(() => {
    tables.chatMessages.length = 0
  })

  // ① 缺陷的直接反证:同一 createdAt 的两条兄弟行,向旧翻时必须两条都读得到
  it('before:与游标同一 createdAt 的两条行都能被读到(旧单列实现下本条必红)', async () => {
    seed([
      { id: uuidAt(1), createdAt: T },
      { id: uuidAt(2), createdAt: T },
      { id: uuidAt(3), createdAt: T },
    ])
    // 游标 = …03(三条同值);向旧翻应拿到 …01、…02 两条
    const res = await findMessages(CONV_ID, { page: 1, pageSize: 2, before: uuidAt(3) })
    expect(ids(res.list)).toEqual([uuidAt(1), uuidAt(2)])
    expect(res.hasMore).toBe(false)
    expect(res.nextCursor).toBeNull()

    // 逐页 pageSize=1 走完整个同值族:兄弟行各出现一次,一条都不掉
    const seen: string[] = []
    let cursor: string | null = uuidAt(3)
    let guard = 0
    while (cursor && guard < 10) {
      const page = await findMessages(CONV_ID, { page: 1, pageSize: 1, before: cursor })
      seen.push(...ids(page.list))
      cursor = page.hasMore ? page.nextCursor : null
      guard++
    }
    expect(seen).toEqual([uuidAt(2), uuidAt(1)])
    expect(new Set([...seen, uuidAt(3)]).size).toBe(3)
  })

  // ② 正向对照:混合不同时间戳时,翻页序与总数不变(修同值问题不得改变既有行为)
  it('before:不同时间戳混排时翻页序与 total 逐字不变', async () => {
    const base = Date.UTC(2026, 0, 1)
    seed([
      { id: uuidAt(11), createdAt: new Date(base) },
      { id: uuidAt(12), createdAt: new Date(base + 1000) },
      { id: uuidAt(13), createdAt: new Date(base + 2000) },
      { id: uuidAt(14), createdAt: new Date(base + 3000) },
      { id: uuidAt(15), createdAt: new Date(base + 4000) },
    ])
    // 游标不存在 → 空页(既有行为)
    const missing = await findMessages(CONV_ID, { page: 1, pageSize: 2, before: uuidAt(5) })
    expect(missing).toEqual({ list: [], total: 0, hasMore: false, nextCursor: null })

    // offset 模式:page=1 是最新两条(正序),total=5
    const first = await findMessages(CONV_ID, { page: 1, pageSize: 2 })
    expect(ids(first.list)).toEqual([uuidAt(14), uuidAt(15)])
    expect(first.total).toBe(5)
    expect(first.hasMore).toBe(true)
    expect(first.nextCursor).toBe(uuidAt(14))

    // before 续传(游标 = 上一页最旧一条 id):严格早于 …14 的三条里取最新两条
    const second = await findMessages(CONV_ID, {
      page: 1,
      pageSize: 2,
      before: first.nextCursor!,
    })
    expect(ids(second.list)).toEqual([uuidAt(12), uuidAt(13)])
    expect(second.hasMore).toBe(true)
    expect(second.nextCursor).toBe(uuidAt(12))

    const third = await findMessages(CONV_ID, { page: 1, pageSize: 2, before: second.nextCursor! })
    expect(ids(third.list)).toEqual([uuidAt(11)])
    expect(third.hasMore).toBe(false)
  })

  // ③ 双向各一例:两侧集合交为空、并为全集(不重不漏)
  it('before / after 双向:交为空、并为全集(含同值兄弟行)', async () => {
    const t2 = new Date(T.getTime() + 1000)
    seed([
      { id: uuidAt(21), createdAt: T },
      { id: uuidAt(22), createdAt: T }, // 同值兄弟行
      { id: uuidAt(23), createdAt: T },
      { id: uuidAt(24), createdAt: t2 },
      { id: uuidAt(25), createdAt: t2 }, // 同值兄弟行
      { id: uuidAt(26), createdAt: t2 },
    ])
    const cursor = uuidAt(23) // (T, …23):T 那一族里正中间那条
    const older = await findMessages(CONV_ID, { page: 1, pageSize: 100, before: cursor })
    const newer = await findMessages(CONV_ID, { page: 1, pageSize: 100, after: cursor })
    const oldSet = new Set(ids(older.list))
    const newSet = new Set(ids(newer.list))
    // 不重:两侧无交集,且都不含游标自身
    for (const id of oldSet) expect(newSet.has(id)).toBe(false)
    expect(oldSet.has(cursor)).toBe(false)
    expect(newSet.has(cursor)).toBe(false)
    // 不漏:两侧 ∪ 游标 = 全集
    expect([...oldSet, ...newSet, cursor].sort()).toEqual([
      uuidAt(21),
      uuidAt(22),
      uuidAt(23),
      uuidAt(24),
      uuidAt(25),
      uuidAt(26),
    ])
    // 两侧各自都是时间正序(before 分支 reverse 过,after 本就 ASC)
    expect(ids(older.list)).toEqual([uuidAt(21), uuidAt(22)])
    expect(ids(newer.list)).toEqual([uuidAt(24), uuidAt(25), uuidAt(26)])
    expect(older.hasMore).toBe(false)
    expect(newer.hasMore).toBe(false)
    expect(newer.nextCursor).toBeNull()
  })

  it('after:同值兄弟行不被跳过(向新翻次级键与主键同向)', async () => {
    seed([
      { id: uuidAt(31), createdAt: T },
      { id: uuidAt(32), createdAt: T },
      { id: uuidAt(33), createdAt: T },
    ])
    // 游标 = …31(同值族最旧一条)→ 向新翻应拿到 …32、…33
    const res = await findMessages(CONV_ID, { page: 1, pageSize: 10, after: uuidAt(31) })
    expect(ids(res.list)).toEqual([uuidAt(32), uuidAt(33)])
    // pageSize=1 续翻:不得"翻不动"(游标停在同值族中间)
    const p1 = await findMessages(CONV_ID, { page: 1, pageSize: 1, after: uuidAt(31) })
    expect(ids(p1.list)).toEqual([uuidAt(32)])
    expect(p1.hasMore).toBe(true)
    expect(p1.nextCursor).toBe(uuidAt(32))
    const p2 = await findMessages(CONV_ID, { page: 1, pageSize: 1, after: p1.nextCursor! })
    expect(ids(p2.list)).toEqual([uuidAt(33)])
    expect(p2.hasMore).toBe(false)
  })

  // ④ 对外契约形状逐字未变
  it('返回值形状与 hasMore 判定基(limit+1)未变', async () => {
    seed([
      { id: uuidAt(41), createdAt: T },
      { id: uuidAt(42), createdAt: T },
      { id: uuidAt(43), createdAt: T },
    ])
    const res = await findMessages(CONV_ID, { page: 1, pageSize: 2, before: uuidAt(43) })
    expect(Object.keys(res).sort()).toEqual(['hasMore', 'list', 'nextCursor', 'total'])
    expect(typeof res.hasMore).toBe('boolean')
    // 旧模式游标仍是"裸 message id"(不是 keyset 的 base64 复合游标)—— 客户端透明回传即可
    expect(res.nextCursor === null || typeof res.nextCursor === 'string').toBe(true)
    // 恰满一页(2 条)⇒ hasMore=false:证明 hasMore 仍按 limit+1 取数、裁剪后判定
    expect(res.list).toHaveLength(2)
    expect(res.hasMore).toBe(false)
    const offsetRes = await findMessages(CONV_ID, { page: 1, pageSize: 3 })
    expect(offsetRes.hasMore).toBe(false)
    expect(offsetRes.total).toBe(3)
    expect(typeof offsetRes.total).toBe('number')
  })

  it('游标不跨会话泄漏:另一会话的同值行不得被带入', async () => {
    const other = '22222222-2222-2222-2222-222222222222'
    seed([
      { id: uuidAt(51), createdAt: T },
      { id: uuidAt(52), createdAt: T, conversationId: other },
      { id: uuidAt(53), createdAt: T },
    ])
    const res = await findMessages(CONV_ID, { page: 1, pageSize: 10, before: uuidAt(53) })
    expect(ids(res.list)).toEqual([uuidAt(51)])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
