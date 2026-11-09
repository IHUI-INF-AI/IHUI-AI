// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 查询层行为夹具：把 drizzle 的条件构造换成可求值的标记对象，
 * 让 `db.select().from(t).where(cond)` 真的按 cond 过滤行。
 *
 * 用途：断言「哪一笔数据被返回/被排除」，而不是只断言「某函数被调用过」。
 */
type Col = { name: string }
type Cond =
  | { op: 'eq'; col: Col; val: unknown }
  | { op: 'isNull'; col: Col }
  | { op: 'and' | 'or'; args: Cond[] }
  | { op: 'inArray'; col: Col; vals: unknown }
  | { op: 'ilike'; col: Col; pat: unknown }
  | { op: 'raw' }

export const tagOps = {
  eq: (col: Col, val: unknown): Cond => ({ op: 'eq', col, val }),
  isNull: (col: Col): Cond => ({ op: 'isNull', col }),
  and: (...args: Cond[]): Cond => ({ op: 'and', args }),
  or: (...args: Cond[]): Cond => ({ op: 'or', args }),
  inArray: (col: Col, vals: unknown): Cond => ({ op: 'inArray', col, vals }),
  ilike: (col: Col, pat: unknown): Cond => ({ op: 'ilike', col, pat }),
  desc: (col: Col) => ({ op: 'desc', col }),
  asc: (col: Col) => ({ op: 'asc', col }),
  sql: () => ({ op: 'raw' }),
}

function cell(row: Record<string, unknown>, col: Col): unknown {
  return row[col.name]
}

export function matches(cond: Cond, row: Record<string, unknown>): boolean {
  switch (cond.op) {
    case 'and':
      return cond.args.every((c) => matches(c, row))
    case 'or':
      return cond.args.some((c) => matches(c, row))
    case 'eq':
      return cell(row, cond.col) === cond.val
    case 'isNull':
      return cell(row, cond.col) === null || cell(row, cond.col) === undefined
    case 'inArray':
      return Array.isArray(cond.vals) ? cond.vals.includes(cell(row, cond.col)) : false
    case 'ilike': {
      const needle = String(cond.pat ?? '').replaceAll('%', '')
      return String(cell(row, cond.col) ?? '').includes(needle)
    }
    case 'raw':
      return true
    default:
      return true
  }
}

export interface FakeDbState {
  /** 最近一次 .limit(n) 的实参；未调用为 undefined */
  lastLimit: number | undefined
}

export function createFakeDb(tables: Record<'files' | 'projects' | 'users', Record<string, unknown>[]>) {
  const state: FakeDbState = { lastLimit: undefined }

  // drizzle 表对象把表名挂在 `Symbol.for('drizzle:Name')` 上（部分版本另有 `_.name`），
  // 用名字分派行集，避免夹具反向 import schema 造成与 drizzle-orm mock 的加载环。
  const TABLE_NAME = Symbol.for('drizzle:Name')
  const tableRows = (table: unknown): Record<string, unknown>[] => {
    const t = table as { [k: symbol]: unknown; _?: { name?: string } } | undefined
    const name = (t?.[TABLE_NAME] ?? t?._?.name) as string | undefined
    if (name === 'files') return tables.files
    if (name === 'projects') return tables.projects
    if (name === 'users') return tables.users
    return []
  }

  const select = (cols?: Record<string, unknown>) => {
    const q = {
      __cols: cols,
      __table: undefined as unknown,
      __cond: undefined as Cond | undefined,
      __order: undefined as { op: string; col: Col } | undefined,
      __limit: undefined as number | undefined,
      from(table: unknown) {
        q.__table = table
        return q
      },
      innerJoin() {
        return q
      },
      leftJoin() {
        return q
      },
      where(cond: Cond) {
        q.__cond = cond
        return q
      },
      orderBy(order: { op: string; col: Col }) {
        q.__order = order
        return q
      },
      async limit(n: number) {
        q.__limit = n
        state.lastLimit = n
        return run(q)
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        return Promise.resolve(run(q)).then(resolve, reject)
      },
    }
    return q
  }

  function run(q: ReturnType<typeof select>): unknown {
    let out = tableRows(q.__table).slice()
    if (q.__cond) out = out.filter((r) => matches(q.__cond as Cond, r))
    if (q.__order) {
      const key = q.__order.col.name
      const dir = q.__order.op === 'desc' ? -1 : 1
      out.sort((a, b) => {
        const av = a[key] as number | Date | null
        const bv = b[key] as number | Date | null
        const an = av instanceof Date ? av.getTime() : Number(av ?? 0)
        const bn = bv instanceof Date ? bv.getTime() : Number(bv ?? 0)
        return (an - bn) * dir
      })
    }
    const n = q.__limit
    if (typeof n === 'number') out = out.slice(0, n)
    if (q.__cols && Object.prototype.hasOwnProperty.call(q.__cols, 'count')) {
      return [{ count: out.length }]
    }
    return out
  }

  const db = {
    select,
    insert: () => ({ values: async () => [] }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
  }

  return { db, dbRead: { select }, state }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
