// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `resource-context.ts` 的归属回归锁(2026-11-01 IDOR 收口)。
 *
 * 缺陷形状(修复前实读)：list/create 两处本来就带 `eq(resourceContexts.userId, userId)`，
 * 而 GET /:id、PUT /:id、DELETE /:id、bind、/session/:sessionId 五处**只按 id 或只校验"资源存在"**。
 * 后果：拿到任一 resourceContexts.id 即可读走 content/fileId/metadata、改写、删除；
 * bind 能把他人资源绑到自己的 sessionId，AI 回答时把他人的私有文件当自己的上下文引用；
 * /session/:sessionId 还能反向跨用户读。
 *
 * 两层同时钉：
 *  ① **静态**：归属谓词必须出现 5 处(list + 四处 :id)，且不得存在"只按 id"的 where。
 *  ② **行为**：假库按 drizzle chunk 形状真求值，他人 id 一律 404 且副作用未发生；
 *     /session/:sessionId 只有在"该会话下全部资源属主 = 当前用户"时才返回。
 *
 * 变异自证见文件末尾：同一判据对"去掉归属谓词/去掉属主全等校验"的变体必须红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { resourceContexts } from '@ihui/database'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

const RC_MINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const RC_OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const B_MINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const B_OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
const B_MIXED_OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
const B_MIXED_MINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'

/**
 * 假库：只实现本文件用到的语句形态(SELECT / SELECT DISTINCT / innerJoin / INSERT /
 * UPDATE / DELETE)，按 drizzle 的 chunk 形状真求值；不具备语义的语句直接抛，
 * 拒绝"静默放行"。
 */
const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>
  type Chunk = {
    value?: unknown
    name?: string
    queryChunks?: Chunk[]
  }

  const tables: Record<string, Row[]> = {
    resource_contexts: [],
    resource_context_bindings: [],
  }
  const log: Array<{ op: string; table: string; params: unknown[] }> = []

  const isText = (c: Chunk | undefined): boolean => Array.isArray(c?.value)
  const textOf = (c: Chunk): string => (c.value as string[]).join('')
  const snakeToCamel = (s: string): string =>
    s.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
  const tableName = (t: unknown): string => {
    const name = (t as Record<symbol, string>)[Symbol.for('drizzle:Name')]
    if (typeof name !== 'string') throw new Error('假库: 拿不到表名')
    return name
  }

  function significant(chunks: Chunk[]): Chunk[] {
    return chunks.filter((c) => !(isText(c) && textOf(c).trim() === ''))
  }

  function collectParams(node: Chunk | undefined, out: unknown[]): unknown[] {
    if (!node) return out
    if (isText(node)) return out
    if (Array.isArray(node.queryChunks)) {
      for (const c of node.queryChunks) collectParams(c, out)
      return out
    }
    if ('value' in node && typeof node.name !== 'string' && typeof node.value !== 'object') {
      out.push(node.value)
    }
    return out
  }

  type ScopeEntry = { table: string; row: Row }

  const tableNameOf = (t: unknown): string | undefined => {
    const name = (t as Record<symbol, string> | undefined)?.[Symbol.for('drizzle:Name')]
    return typeof name === 'string' ? name : undefined
  }

  /**
   * 按"列所属的表"取值 —— join 时两张表都有 `id`，合并视图会张冠李戴，
   * 所以列对象带的 `.table` 优先，取不到再退回合并行。
   */
  function colOf(c: Chunk, row: Row, scope?: ScopeEntry[]): unknown {
    const name = c.name
    if (typeof name !== 'string') return undefined
    const tn = tableNameOf((c as { table?: unknown }).table)
    if (scope && tn) {
      const hit = scope.find((s) => s.table === tn)
      if (hit) return hit.row[snakeToCamel(name)]
    }
    return row[snakeToCamel(name)]
  }

  function evalNode(node: Chunk | undefined, row: Row, scope?: ScopeEntry[]): boolean {
    if (!node) return true
    if (isText(node)) return true
    if (!Array.isArray(node.queryChunks)) throw new Error('假库: 无法求值的条件节点')
    let parts = significant(node.queryChunks)
    const head = parts[0]
    const tail = parts[parts.length - 1]
    if (
      parts.length >= 3 &&
      isText(head) &&
      textOf(head!).trim() === '(' &&
      isText(tail) &&
      textOf(tail!).trim() === ')'
    ) {
      parts = parts.slice(1, -1)
    }
    if (parts.length === 1) return evalNode(parts[0], row, scope)
    const sep = parts.findIndex((c) => isText(c) && textOf(c).trim().toLowerCase() === 'and')
    if (sep > 0) {
      return (
        evalNode({ queryChunks: parts.slice(0, sep) }, row, scope) &&
        evalNode({ queryChunks: parts.slice(sep + 1) }, row, scope)
      )
    }
    const [left, op, right] = parts
    if (!left || !op || !right || typeof left.name !== 'string' || !isText(op)) {
      throw new Error('假库: 不认识的条件形态')
    }
    const operator = textOf(op).trim().toLowerCase()
    if (operator === '=') {
      // 右侧可以是字面量(Param)也可以是同表/异表的列 —— join 条件就是后者
      const target =
        typeof (right as { name?: string }).name === 'string'
          ? colOf(right, row, scope)
          : (right as { value?: unknown }).value
      return colOf(left, row, scope) === target
    }
    throw new Error(`假库: 不认识的运算符 ${operator}`)
  }

  const project = (row: Row, projection?: Record<string, Chunk>, scope?: ScopeEntry[]): Row => {
    if (!projection) return { ...row }
    const out: Row = {}
    for (const [key, val] of Object.entries(projection)) {
      if (val && typeof val.name === 'string') out[key] = colOf(val, row, scope)
    }
    return out
  }

  const isCountProjection = (projection?: Record<string, Chunk>): boolean =>
    !!projection && Object.keys(projection).length === 1 && !!projection.count?.queryChunks

  class FakeSelect {
    private table?: unknown
    private join?: { table: unknown; cond?: Chunk }
    private cond?: Chunk
    private projection?: Record<string, Chunk>
    private distinct = false
    private limitN?: number
    private offsetN = 0

    constructor(projection?: Record<string, Chunk>, distinct = false) {
      this.projection = projection
      this.distinct = distinct
    }
    from(t: unknown) {
      this.table = t
      return this
    }
    innerJoin(t: unknown, cond: Chunk) {
      this.join = { table: t, cond }
      return this
    }
    where(c: unknown) {
      this.cond = c as Chunk
      return this
    }
    orderBy() {
      return this
    }
    limit(n: number) {
      this.limitN = n
      return this
    }
    offset(n: number) {
      this.offsetN = n
      return this
    }
    private pairs(): Array<{ row: Row; merged: Row; scope: ScopeEntry[] }> {
      if (!this.table) throw new Error('假库: select 缺 from')
      const name = tableName(this.table)
      const all = tables[name]
      if (!all) throw new Error(`假库: 未知表 ${name}`)
      log.push({ op: 'select', table: name, params: collectParams(this.cond, []) })
      if (!this.join) {
        return all.map((r) => ({ row: { ...r }, merged: r, scope: [{ table: name, row: r }] }))
      }
      const jname = tableName(this.join.table)
      const jall = tables[jname]
      if (!jall) throw new Error(`假库: 未知表 ${jname}`)
      const out: Array<{ row: Row; merged: Row; scope: ScopeEntry[] }> = []
      for (const l of all) {
        for (const r of jall) {
          const scope: ScopeEntry[] = [
            { table: name, row: l },
            { table: jname, row: r },
          ]
          if (this.join.cond && !evalNode(this.join.cond, { ...l, ...r }, scope)) continue
          out.push({ row: { [name]: l, [jname]: r }, merged: { ...l, ...r }, scope })
        }
      }
      return out
    }
    private matched(): Array<{ row: Row; merged: Row; scope: ScopeEntry[] }> {
      return this.pairs().filter((p) => (this.cond ? evalNode(this.cond, p.merged, p.scope) : true))
    }
    private dedupe(rows: Row[]): Row[] {
      if (!this.distinct) return rows
      const seen = new Set<string>()
      return rows.filter((r) => {
        const k = JSON.stringify(r)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    private slice<T>(rows: T[]): T[] {
      return rows.slice(
        this.offsetN,
        this.limitN === undefined ? undefined : this.offsetN + this.limitN,
      )
    }
    run(): Row[] {
      const rows = this.matched().map((p) => project(p.merged, this.projection, p.scope))
      return this.dedupe(this.slice(rows))
    }
    private projectRows(): Row[] {
      if (!this.join) return this.run()
      // 无投影的 join 返回嵌套形状(与 drizzle 一致)，有投影则按列取值
      const rows = this.matched().map((p) =>
        this.projection ? project(p.merged, this.projection, p.scope) : p.row,
      )
      return this.dedupe(this.slice(rows))
    }
    then<T>(ok?: (v: Row[]) => T, err?: (e: unknown) => T): Promise<T> {
      return Promise.resolve()
        .then(() =>
          isCountProjection(this.projection)
            ? [{ count: this.matched().length }]
            : this.projectRows(),
        )
        .then(ok, err)
    }
  }

  class FakeInsert {
    private table?: unknown
    private vals: Row[] = []
    private returningProj?: Record<string, Chunk>
    constructor(t: unknown) {
      this.table = t
    }
    values(v: Row | Row[]) {
      this.vals = Array.isArray(v) ? v : [v]
      return this
    }
    returning(p?: Record<string, Chunk>) {
      this.returningProj = p
      return this
    }
    private run(): Row[] {
      const name = tableName(this.table)
      const all = tables[name]
      if (!all) throw new Error(`假库: 未知表 ${name}`)
      log.push({ op: 'insert', table: name, params: [] })
      const created = this.vals.map((v) => ({
        id: (v.id as string) ?? crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...v,
      }))
      all.push(...created)
      return created.map((r) => project(r, this.returningProj))
    }
    then<T>(ok?: (v: Row[]) => T, err?: (e: unknown) => T): Promise<T> {
      return Promise.resolve()
        .then(() => this.run())
        .then(ok, err)
    }
  }

  class FakeUpdate {
    private table?: unknown
    private patch: Row = {}
    private cond?: Chunk
    private returningProj?: Record<string, Chunk>
    constructor(t: unknown) {
      this.table = t
    }
    set(v: Row) {
      this.patch = v
      return this
    }
    where(c: Chunk) {
      this.cond = c
      return this
    }
    returning(p?: Record<string, Chunk>) {
      this.returningProj = p
      return this
    }
    private run(): Row[] {
      const name = tableName(this.table)
      const all = tables[name]
      if (!all) throw new Error(`假库: 未知表 ${name}`)
      log.push({ op: 'update', table: name, params: collectParams(this.cond, []) })
      const hit = all.filter((r) => (this.cond ? evalNode(this.cond, r) : true))
      for (const r of hit) Object.assign(r, this.patch)
      return hit.map((r) => project(r, this.returningProj))
    }
    then<T>(ok?: (v: Row[]) => T, err?: (e: unknown) => T): Promise<T> {
      return Promise.resolve()
        .then(() => this.run())
        .then(ok, err)
    }
  }

  class FakeDelete {
    private table?: unknown
    private cond?: Chunk
    private returningProj?: Record<string, Chunk>
    constructor(t: unknown) {
      this.table = t
    }
    where(c: Chunk) {
      this.cond = c
      return this
    }
    returning(p?: Record<string, Chunk>) {
      this.returningProj = p
      return this
    }
    private run(): Row[] {
      const name = tableName(this.table)
      const all = tables[name]
      if (!all) throw new Error(`假库: 未知表 ${name}`)
      log.push({ op: 'delete', table: name, params: collectParams(this.cond, []) })
      const hit = all.filter((r) => (this.cond ? evalNode(this.cond, r) : true))
      for (const r of hit) all.splice(all.indexOf(r), 1)
      return hit.map((r) => project(r, this.returningProj))
    }
    then<T>(ok?: (v: Row[]) => T, err?: (e: unknown) => T): Promise<T> {
      return Promise.resolve()
        .then(() => this.run())
        .then(ok, err)
    }
  }

  const db = {
    select: (projection?: Record<string, Chunk>) => new FakeSelect(projection),
    selectDistinct: (projection?: Record<string, Chunk>) => new FakeSelect(projection, true),
    insert: (t: unknown) => new FakeInsert(t),
    update: (t: unknown) => new FakeUpdate(t),
    delete: (t: unknown) => new FakeDelete(t),
  }

  return { tables, log, db }
})

// 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/index.js', () => ({ db: fake.db }))

// 身份由生产同一条路给：authenticate 从令牌解出主体写 request.userId。这里只替掉"验签"。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { headers: Record<string, string>; userId?: string }) => {
    const m = /^Bearer tok-for-(.+)$/.exec(request.headers.authorization ?? '')
    if (!m) throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    const userId = m[1]!
    request.userId = userId
    return { userId, phone: '', familyId: 'test', roleId: 0 }
  },
  requireActiveUser: async () => {},
}))

import resourceContextPlugin from '../src/routes/resource-context.js'

let app: FastifyInstance

function seed() {
  for (const key of Object.keys(fake.tables)) fake.tables[key]!.length = 0
  fake.log.length = 0
  fake.tables.resource_contexts!.push(
    {
      id: RC_MINE,
      userId: ME,
      name: '我的资料',
      type: 'text',
      content: '我的私有正文',
      metadata: { secret: 'mine' },
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: RC_OTHER,
      userId: OTHER,
      name: '他人的资料',
      type: 'text',
      content: '他人的私有正文',
      metadata: { secret: 'other' },
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  )
  fake.tables.resource_context_bindings!.push(
    { id: B_MINE, resourceContextId: RC_MINE, sessionId: 'sess-mine', createdAt: '2026-11-01T00:00:00.000Z' },
    { id: B_OTHER, resourceContextId: RC_OTHER, sessionId: 'sess-other', createdAt: '2026-11-01T00:00:00.000Z' },
    { id: B_MIXED_OTHER, resourceContextId: RC_OTHER, sessionId: 'sess-mixed', createdAt: '2026-11-01T00:00:00.000Z' },
    { id: B_MIXED_MINE, resourceContextId: RC_MINE, sessionId: 'sess-mixed', createdAt: '2026-11-01T00:00:00.000Z' },
  )
}

const as = (userId: string) => ({ authorization: `Bearer tok-for-${userId}` })

/** 归属判据：该行是否属于 me。 */
function ownedBy(row: { userId?: string }, me: string): boolean {
  return row.userId === me
}

beforeAll(async () => {
  app = Fastify({ logger: false })
  // 该插件的路由已自带 /api 前缀，注册时不能再叠 prefix
  await app.register(resourceContextPlugin)
  await app.ready()
})

beforeEach(seed)

afterAll(async () => {
  await app.close()
})

describe('资源上下文 :id 四端点：归属进 SQL，他人一律 404', () => {
  it('GET 本人 ⇒ 200；GET 他人 ⇒ 404，且 SQL 同时绑了 id 与 user_id', async () => {
    const mine = await app.inject({
      method: 'GET',
      url: `/api/resource-context/${RC_MINE}`,
      headers: as(ME),
    })
    expect(mine.statusCode).toBe(200)
    expect(ownedBy(mine.json().data as { userId?: string }, ME)).toBe(true)

    fake.log.length = 0
    const other = await app.inject({
      method: 'GET',
      url: `/api/resource-context/${RC_OTHER}`,
      headers: as(ME),
    })
    expect(other.statusCode).toBe(404)
    expect(JSON.stringify(other.body)).not.toContain('他人的私有正文')
    const sel = fake.log.filter((e) => e.op === 'select' && e.table === 'resource_contexts')
    expect(sel).toHaveLength(1)
    expect(sel[0]!.params).toEqual([RC_OTHER, ME])
  })

  it('PUT 他人 ⇒ 404，且那一行的内容/元数据一个字段都没被改写', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/resource-context/${RC_OTHER}`,
      headers: as(ME),
      payload: { content: '被越权改写', name: '被改名' },
    })
    expect(res.statusCode).toBe(404)
    const row = fake.tables.resource_contexts!.find((r) => r.id === RC_OTHER)!
    expect(row.content).toBe('他人的私有正文')
    expect(row.name).toBe('他人的资料')
    const upd = fake.log.filter((e) => e.op === 'update')
    expect(upd).toHaveLength(1)
    expect(upd[0]!.params).toEqual([RC_OTHER, ME])
  })

  it('DELETE 他人 ⇒ 404，行仍在、bindings 也没被级联清掉', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/resource-context/${RC_OTHER}`,
      headers: as(ME),
    })
    expect(res.statusCode).toBe(404)
    expect(fake.tables.resource_contexts!.some((r) => r.id === RC_OTHER)).toBe(true)
    expect(fake.tables.resource_context_bindings!.some((r) => r.resourceContextId === RC_OTHER)).toBe(true)
    expect(fake.log.filter((e) => e.op === 'delete')).toHaveLength(1)
  })

  it('本人三连(读/改/删)都成功 —— 证明收口没把合法路径一起堵死', async () => {
    const read = await app.inject({
      method: 'GET',
      url: `/api/resource-context/${RC_MINE}`,
      headers: as(ME),
    })
    expect(read.statusCode).toBe(200)

    const put = await app.inject({
      method: 'PUT',
      url: `/api/resource-context/${RC_MINE}`,
      headers: as(ME),
      payload: { content: '我改我自己的' },
    })
    expect(put.statusCode).toBe(200)
    expect(fake.tables.resource_contexts!.find((r) => r.id === RC_MINE)!.content).toBe('我改我自己的')

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/resource-context/${RC_MINE}`,
      headers: as(ME),
    })
    expect(del.statusCode).toBe(200)
    expect(fake.tables.resource_contexts!.some((r) => r.id === RC_MINE)).toBe(false)
  })
})

describe('资源上下文 bind：只能绑自己的资源', () => {
  it('绑他人资源 ⇒ 404，且没有写入任何 binding(数据外带路径被堵)', async () => {
    const before = fake.tables.resource_context_bindings!.length
    const res = await app.inject({
      method: 'POST',
      url: '/api/resource-context/bind',
      headers: as(ME),
      payload: { resourceContextId: RC_OTHER, sessionId: 'sess-mine' },
    })
    expect(res.statusCode).toBe(404)
    expect(fake.tables.resource_context_bindings!.length).toBe(before)
    expect(fake.log.filter((e) => e.op === 'insert')).toHaveLength(0)
  })

  it('绑本人资源 ⇒ 200 且 binding 落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resource-context/bind',
      headers: as(ME),
      payload: { resourceContextId: RC_MINE, sessionId: 'sess-new' },
    })
    expect(res.statusCode).toBe(200)
    expect(fake.tables.resource_context_bindings!.some((r) => r.sessionId === 'sess-new')).toBe(true)
  })
})

describe('资源上下文 /session/:sessionId：属主全等才返回', () => {
  it('全是本人的会话 ⇒ 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resource-context/session/sess-mine',
      headers: as(ME),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json().data as { list: unknown[] }).list).toHaveLength(1)
  })

  it('全是他人资源的会话 ⇒ 404(反向跨用户读被堵)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resource-context/session/sess-other',
      headers: as(ME),
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('他人的私有正文')
  })

  it('混合会话(一条他人) ⇒ 404，不做"部分返回"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resource-context/session/sess-mixed',
      headers: as(ME),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('会话不存在')
  })

  it('空会话 ⇒ 200 + 空列表(没有可泄露的行)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resource-context/session/sess-none',
      headers: as(ME),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json().data as { list: unknown[] }).list).toHaveLength(0)
  })

  it('未登录 ⇒ 401(鉴权链没被绕过)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resource-context/session/sess-mine' })
    expect(res.statusCode).toBe(401)
  })
})

// ===========================================================================
// 静态接线锁 + 变异自证
// ===========================================================================

const SRC_URL = new URL('../src/routes/resource-context.ts', import.meta.url)

/** 返回违规项；空数组 = 接线完整。 */
function scanWiring(src: string): string[] {
  const violations: string[] = []
  const ownerPreds = (src.match(/eq\(resourceContexts\.userId, userId\)/g) ?? []).length
  // list(条件数组) + GET + PUT + DELETE + bind
  if (ownerPreds !== 5) violations.push(`归属谓词出现 ${ownerPreds} 处(应为 5)`)
  // 不得存在只按 id 的 where
  if (/\.where\(\s*eq\(resourceContexts\.id/.test(src)) violations.push('存在只按 id 的 where')
  // bind 的取资源查询必须是 and(id, userId)
  if (!/and\(\s*eq\(resourceContexts\.id, parsed\.data\.resourceContextId\)/.test(src)) {
    violations.push('bind 的取资源查询没有和归属一起判')
  }
  // 会话端点必须有属主全等校验
  if (!/owners\.some\(\(o\) => o\.ownerId !== userId\)/.test(src)) {
    violations.push('/session/:sessionId 缺少属主全等校验')
  }
  if (!/\.selectDistinct\(\{ ownerId: resourceContexts\.userId \}\)/.test(src)) {
    violations.push('/session/:sessionId 没有反查绑定资源的属主')
  }
  return violations
}

describe('静态接线 + 变异自证', () => {
  it('五处归属谓词齐备，没有只按 id 的 where', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    expect(scanWiring(src)).toEqual([])
  })

  it('变异自证 1：删掉归属谓词，同一判据必须报违规', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    const mutated = src.replace(/eq\(resourceContexts\.userId, userId\)/g, '')
    expect(mutated).not.toBe(src)
    expect(scanWiring(mutated).length).toBeGreaterThan(0)
  })

  it('变异自证 2：删掉会话端点的属主全等校验，同一判据必须报违规', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    const mutated = src
      .replace(/if \(owners\.some\(\(o\) => o\.ownerId !== userId\)\) \{[\s\S]*?\n      \}\n/, '')
      .replace(/\.selectDistinct\(\{ ownerId: resourceContexts\.userId \}\)/g, '.select()')
    expect(mutated).not.toBe(src)
    expect(scanWiring(mutated).length).toBeGreaterThan(0)
  })

  it('变异自证 3：行为判据对"只按 id 查"的旧形态会红', async () => {
    // 旧形态 = 只按 id 查(修复前的 GET /:id)
    const leaky = await fake.db.select().from(resourceContexts).where(eq(resourceContexts.id, RC_OTHER))
    expect(leaky).toHaveLength(1)
    // 同一条判据(ownedBy)在旧形态上必须为 false —— 说明它真能分辨"他人的行"
    expect(ownedBy(leaky[0] as { userId?: string }, ME)).toBe(false)

    // 修复后的真实路径：同一判据为 true / 他人取不到
    const mineRes = await app.inject({
      method: 'GET',
      url: `/api/resource-context/${RC_MINE}`,
      headers: as(ME),
    })
    expect(ownedBy(mineRes.json().data as { userId?: string }, ME)).toBe(true)
    const otherRes = await app.inject({
      method: 'GET',
      url: `/api/resource-context/${RC_OTHER}`,
      headers: as(ME),
    })
    expect(otherRes.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
