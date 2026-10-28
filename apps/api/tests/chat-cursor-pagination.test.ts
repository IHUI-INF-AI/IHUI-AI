// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

// =============================================================================
// 内存 mock(无真实 DB):用 vi.mock 替换 ../src/db/index.js 的 db/dbRead。
// 通过解析 drizzle 生成的 SQL queryChunks,忠实模拟 keyset 复合游标过滤/排序/切片,
// 从而在不连库的情况下验证 findMessagesCursor 的"不重不漏 + hasMore + 边界"契约。
// =============================================================================

/** 内存表中的一行(字段用 camelCase,与 drizzle select 返回一致) */
type MockRow = Record<string, unknown>

/** SQL 列名 → 内存行属性名 */
function colProp(sqlName: string): string {
  if (sqlName === 'conversation_id') return 'conversationId'
  if (sqlName === 'created_at') return 'createdAt'
  return sqlName // id
}

/** 比较运算符求值(createdAt 走时间戳,id 走字符串字典序) */
function applyOp(op: string, left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    const l = left instanceof Date ? left.getTime() : new Date(String(left)).getTime()
    const r = right instanceof Date ? right.getTime() : new Date(String(right)).getTime()
    if (op === '=') return l === r
    if (op === '<') return l < r
    if (op === '>') return l > r
    if (op === '<=') return l <= r
    if (op === '>=') return l >= r
    return false
  }
  if (op === '=') return left === right
  if (op === '<') return (left as number | string) < (right as number | string)
  if (op === '>') return (left as number | string) > (right as number | string)
  if (op === '<=') return (left as number | string) <= (right as number | string)
  if (op === '>=') return (left as number | string) >= (right as number | string)
  return false
}

// =============================================================================
// 通用 drizzle SQL 求值器(2026-09-16 修正):不再假设固定 chunk 段数,
// 把 SQL 树扁平化为 token 序列(列/操作符文本/参数值/括号),再按
// 「三连(col,op,value)→布尔,布尔间 and/or 连接」求值,对任意嵌套成立。
// =============================================================================

type FlatToken =
  | { kind: 'col'; name: string }
  | { kind: 'op'; text: string }
  | { kind: 'val'; value: unknown }
  | { kind: 'paren' }

/** 深度优先扁平化 drizzle SQL 树(Column/String 块/Param/嵌套 SQL) */
function flattenSql(node: unknown, out: FlatToken[]): void {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    for (const child of node) flattenSql(child, out)
    return
  }
  if (typeof node !== 'object') {
    out.push({ kind: 'val', value: node })
    return
  }
  const obj = node as Record<string, unknown>
  if (Array.isArray(obj.queryChunks)) {
    for (const child of obj.queryChunks) flattenSql(child, out)
    return
  }
  // 字符串块(drizzle 把操作符/括号包成 { value: [' and '] })
  if (Array.isArray(obj.value) && obj.value.every((v) => typeof v === 'string')) {
    for (const v of obj.value as string[]) out.push({ kind: 'op', text: v })
    return
  }
  // Column 对象:有 name 且无 value(RLS 包装列同样暴露 name)
  if ('name' in obj && obj.value === undefined) {
    out.push({ kind: 'col', name: String(obj.name) })
    return
  }
  // Param/原始值包装
  if ('value' in obj) {
    out.push({ kind: 'val', value: obj.value })
    return
  }
  // 未知对象(如 encoder):忽略
}

/** 比较符/逻辑符优先级(and 高于 or;括号由栈处理) */
function precedence(op: string): number {
  if (op === 'and') return 2
  if (op === 'or') return 1
  return 4 // 比较符最高
}

/**
 * 扁平 token 序列 → 布尔:经典双栈(Shunting-yard)求值,
 * 正确处理括号与 and/or 优先级(keyset 的 or( lt, and(eq, lt) ) 必须按 SQL 语义求值)。
 */
function evalTokens(tokens: FlatToken[], row: MockRow): boolean {
  const out: Array<unknown> = [] // 操作数栈(值)
  const ops: string[] = [] // 运算符栈
  const applyTop = (): void => {
    const op = ops.pop()
    if (!op) return
    if (op === 'not') {
      const v = out.pop()
      out.push(!v)
      return
    }
    const b = out.pop()
    const a = out.pop()
    if (op === 'and') out.push(Boolean(a) && Boolean(b))
    else if (op === 'or') out.push(Boolean(a) || Boolean(b))
    else out.push(applyOp(op, a, b))
  }
  const cmpOps = new Set(['=', '<', '>', '<=', '>=', '!=', '<>'])
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.kind === 'val') {
      out.push(t.value)
      continue
    }
    if (t.kind === 'col') {
      // 列引用:后跟比较符则留待三连求值;否则取行值(布尔上下文)
      const next = tokens[i + 1]
      if (next && next.kind === 'op' && cmpOps.has(next.text.trim())) {
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
    // op / paren
    const text = t.kind === 'paren' ? t.text : t.text
    const trimmed = text.trim()
    if (trimmed === '(') {
      ops.push('(')
      continue
    }
    if (trimmed === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') applyTop()
      ops.pop() // 弹出 "("
      continue
    }
    const lower = trimmed.toLowerCase()
    if (lower === 'and' || lower === 'or') {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        precedence(ops[ops.length - 1]) >= precedence(lower)
      )
        applyTop()
      ops.push(lower)
      continue
    }
    if (cmpOps.has(lower)) {
      ops.push(lower)
      continue
    }
    // 其他文本(空白/关键字 like 等):忽略
  }
  while (ops.length > 0) applyTop()
  const result = out.pop()
  return typeof result === 'boolean' ? result : Boolean(result)
}

function evalSql(node: unknown, row: MockRow): boolean {
  const tokens: FlatToken[] = []
  flattenSql(node, tokens)
  return evalTokens(tokens, row)
}

class SelectBuilder {
  private tableRows: MockRow[] = []
  private condition: unknown = null
  private orderByCols: { prop: string; dir: 'asc' | 'desc' }[] = []
  private limitVal = Infinity
  private offsetVal = 0

  from(table: unknown): SelectBuilder {
    this.tableRows = getTable(table)
    return this
  }
  where(cond: unknown): SelectBuilder {
    this.condition = cond
    return this
  }
  orderBy(...cols: unknown[]): SelectBuilder {
    // 通用解析:扁平化每个排序 SQL,取其中的列名与 desc/asc 标记
    this.orderByCols = cols.map((c) => {
      const tokens: FlatToken[] = []
      flattenSql(c, tokens)
      let prop = 'id'
      let dir: 'asc' | 'desc' = 'asc'
      for (const t of tokens) {
        if (t.kind === 'col') prop = colProp(t.name)
        if (t.kind === 'op' && t.text.trim() === 'desc') dir = 'desc'
      }
      return { prop, dir }
    })
    return this
  }
  offset(n: number): SelectBuilder {
    this.offsetVal = n
    return this
  }
  limit(_n: number): Promise<MockRow[]> {
    let rows = this.tableRows.filter((r) => evalSql(this.condition, r))

    if (this.orderByCols.length > 0) {
      rows = rows.slice().sort((a, b) => {
        for (const o of this.orderByCols) {
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
    const end = this.limitVal === Infinity ? undefined : this.offsetVal + this.limitVal
    return Promise.resolve(rows.slice(this.offsetVal, end))
  }
}

class InsertBuilder {
  private tableRows: MockRow[] = []
  private valuesList: MockRow[] = []
  constructor(table: unknown) {
    this.tableRows = getTable(table)
  }
  values(rows: MockRow | MockRow[]): InsertBuilder {
    this.valuesList = Array.isArray(rows) ? rows : [rows]
    return this
  }
  returning(): Promise<MockRow[]> {
    const inserted = this.valuesList.map((v) => {
      const row: MockRow = { ...v }
      if (row.id === undefined) row.id = randomUUID()
      if (row.createdAt === undefined) row.createdAt = new Date()
      if (row.updatedAt === undefined) row.updatedAt = new Date()
      if (row.metadata === undefined) row.metadata = {}
      this.tableRows.push(row)
      return row
    })
    return Promise.resolve(inserted)
  }
}

class UpdateBuilder {
  set(): UpdateBuilder {
    return this
  }
  where(): UpdateBuilder {
    return this
  }
  returning(): Promise<MockRow[]> {
    return Promise.resolve([])
  }
}

class DeleteBuilder {
  where(): DeleteBuilder {
    return this
  }
  returning(): Promise<MockRow[]> {
    return Promise.resolve([])
  }
}

function makeDb(): Record<string, unknown> {
  return {
    select: () => new SelectBuilder(),
    insert: (table: { name: string }) => new InsertBuilder(table),
    update: () => new UpdateBuilder(),
    delete: () => new DeleteBuilder(),
    transaction: (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(makeDb()),
  }
}

const { mockDb, tables } = vi.hoisted(() => {
  const tables: { chatMessages: MockRow[]; chatConversations: MockRow[] } = {
    chatMessages: [],
    chatConversations: [],
  }
  const mockDb = makeDb()
  return { mockDb, tables }
})

vi.mock('../src/db/index.js', () => ({ db: mockDb, dbRead: mockDb }))

function getTable(table: unknown): MockRow[] {
  // @ihui/database 的 RLS 包装表无 .name 属性,改用区分性列判定(导出表直接暴露列)
  let result: MockRow[]
  if (table && typeof table === 'object' && 'conversationId' in (table as object)) {
    result = tables.chatMessages
  } else if (table && typeof table === 'object' && 'userId' in (table as object)) {
    result = tables.chatConversations
  } else {
    result = []
  }

  return result
}

// 导入被测函数(在 vi.mock 之后,确保 db 被替换为 mock)
import {
  findMessagesCursor,
  encodeMessageCursor,
  decodeMessageCursor,
  type MessageCursor,
} from '../src/db/chat-queries.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'

/** 写入 count 条消息,createdAt = base + i*1000ms(i 越大越新) */
function seedMessages(count: number, base = Date.UTC(2026, 0, 1)): MessageCursor[] {
  const cursors: MessageCursor[] = []
  for (let i = 0; i < count; i++) {
    const id = `m${i}`
    const createdAt = new Date(base + i * 1000)
    tables.chatMessages.push({
      id,
      conversationId: CONV_ID,
      role: 'user',
      content: `c${i}`,
      reasoning: null,
      tokens: null,
      metadata: {},
      createdAt,
    })
    cursors.push({ id, createdAt: createdAt.toISOString() })
  }
  return cursors
}

describe('findMessagesCursor — keyset 复合游标分页', () => {
  beforeEach(() => {
    tables.chatMessages.length = 0
    tables.chatConversations.length = 0
  })

  it('initial:取最新 N 条(时间正序)且 hasMore=true', async () => {
    const cursors = seedMessages(25)
    const res = await findMessagesCursor(CONV_ID, { limit: 10, direction: 'initial' })
    expect(res.messages).toHaveLength(10)
    expect(res.hasMore).toBe(true)
    // 最新 10 条 = m15..m24(时间正序)
    expect(res.messages.map((m) => m.id)).toEqual(cursors.slice(15).map((c) => c.id))
    // 升序:后一条 createdAt 不早于前一条
    for (let i = 1; i < res.messages.length; i++) {
      expect((res.messages[i].createdAt as Date).getTime()).toBeGreaterThanOrEqual(
        (res.messages[i - 1].createdAt as Date).getTime(),
      )
    }
    // nextCursor = 本页最旧一条 m15
    expect(res.nextCursor).not.toBeNull()
    expect(res.nextCursor?.id).toBe('m15')
  })

  it('initial:不足一页时 hasMore=false 且 nextCursor=null', async () => {
    seedMessages(5)
    const res = await findMessagesCursor(CONV_ID, { limit: 10, direction: 'initial' })
    expect(res.messages).toHaveLength(5)
    expect(res.hasMore).toBe(false)
    expect(res.nextCursor).toBeNull()
  })

  it('older:从 initial 的游标续传,返回更早的 N 条且与首屏不重复', async () => {
    const cursors = seedMessages(25)
    const first = await findMessagesCursor(CONV_ID, { limit: 10, direction: 'initial' })
    expect(first.nextCursor).not.toBeNull()
    const second = await findMessagesCursor(CONV_ID, {
      limit: 10,
      direction: 'older',
      cursor: first.nextCursor,
    })
    expect(second.messages).toHaveLength(10)
    expect(second.hasMore).toBe(true)
    // 更早 10 条 = m5..m14(时间正序)
    expect(second.messages.map((m) => m.id)).toEqual(cursors.slice(5, 15).map((c) => c.id))
    // 与首屏无交集
    const firstIds = new Set(first.messages.map((m) => m.id))
    for (const m of second.messages) expect(firstIds.has(m.id)).toBe(false)
  })

  it('older:连续翻页到底,并集=全量且无重复(不重不漏)', async () => {
    seedMessages(25)
    const allIds = new Set<string>()
    let cursor: MessageCursor | null = null
    let pages = 0
    // 首屏
    const initial = await findMessagesCursor(CONV_ID, { limit: 10, direction: 'initial' })
    for (const m of initial.messages) allIds.add(m.id)
    cursor = initial.nextCursor
    pages++
    // 续传直到 hasMore=false
    while (cursor && pages < 20) {
      // 上限防死循环(求值缺陷时快速失败)
      const res = await findMessagesCursor(CONV_ID, { limit: 10, direction: 'older', cursor })
      for (const m of res.messages) allIds.add(m.id)
      pages++
      if (!res.hasMore) {
        expect(res.nextCursor).toBeNull()
        break
      }
      cursor = res.nextCursor
    }
    // 3 页:10 + 10 + 5 = 25
    expect(pages).toBe(3)
    expect(allIds.size).toBe(25)
    expect(new Set(tables.chatMessages.map((m) => m.id as string)).size).toBe(25)
  })

  it('边界:older 游标指向最旧消息时返回空,hasMore=false,nextCursor=null', async () => {
    const cursors = seedMessages(25)
    const oldest = cursors[0]
    const res = await findMessagesCursor(CONV_ID, {
      limit: 10,
      direction: 'older',
      cursor: oldest,
    })
    expect(res.messages).toHaveLength(0)
    expect(res.hasMore).toBe(false)
    expect(res.nextCursor).toBeNull()
  })

  it('createdAt 相同时严格 keyset:用 id 字典序切分,不重不漏', async () => {
    // 同一 createdAt 的 5 条消息,id 字典序可排序
    const t = new Date(Date.UTC(2026, 5, 1))
    const ids = ['id-01', 'id-02', 'id-03', 'id-04', 'id-05']
    for (const id of ids) {
      tables.chatMessages.push({
        id,
        conversationId: CONV_ID,
        role: 'user',
        content: id,
        reasoning: null,
        tokens: null,
        metadata: {},
        createdAt: t,
      })
    }
    // initial limit=2 → (createdAt,id) desc 取 id-05,id-04 → 反转 asc = id-04,id-05
    const first = await findMessagesCursor(CONV_ID, { limit: 2, direction: 'initial' })
    expect(first.messages.map((m) => m.id)).toEqual(['id-04', 'id-05'])
    expect(first.nextCursor?.id).toBe('id-04')
    // older from id-04 → (createdAt,id) < (t, id-04) → id-01,id-02,id-03
    // limit=2 → 返回最新的 2 条(id-02,id-03),hasMore=true,nextCursor 指向 id-02
    const second = await findMessagesCursor(CONV_ID, {
      limit: 2,
      direction: 'older',
      cursor: first.nextCursor,
    })
    expect(second.messages.map((m) => m.id)).toEqual(['id-02', 'id-03'])
    expect(second.hasMore).toBe(true)
    expect(second.nextCursor?.id).toBe('id-02')
    // 第三页:取剩余的 id-01,hasMore=false
    const third = await findMessagesCursor(CONV_ID, {
      limit: 2,
      direction: 'older',
      cursor: second.nextCursor,
    })
    expect(third.messages.map((m) => m.id)).toEqual(['id-01'])
    expect(third.hasMore).toBe(false)
    expect(third.nextCursor).toBeNull()
  })
})

describe('encodeMessageCursor / decodeMessageCursor', () => {
  it('round-trip 还原一致', () => {
    const c: MessageCursor = {
      createdAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)).toISOString(),
      id: 'abc-123',
    }
    const encoded = encodeMessageCursor(c)
    expect(typeof encoded).toBe('string')
    expect(encoded).not.toContain('{') // base64url,非明文
    const decoded = decodeMessageCursor(encoded)
    expect(decoded).toEqual(c)
  })

  it('非法/截断输入返回 null(路由层据此转 400)', () => {
    expect(decodeMessageCursor('not-base64-!!!')).toBeNull()
    expect(decodeMessageCursor(Buffer.from('{"foo":1}').toString('base64url'))).toBeNull()
    expect(decodeMessageCursor('')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
