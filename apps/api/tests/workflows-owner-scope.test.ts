// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `workflows.ts` / `workflow-queries.ts` 的归属回归锁(2026-11-01 IDOR 收口)。
 *
 * 缺陷形状(修复前实读):
 *  · `findWorkflows({page,pageSize})` 无任何 where、`findInstances` 只按 workflowId/status 过滤;
 *  · 路由层 5 条实例端点 + 工作流详情/trigger 全部只按 id 取，不校验 createdBy;
 *  · 同文件 PATCH/DELETE 早就有 `existing.createdBy !== request.userId` —— 说明是遗漏不是设计。
 *
 * 这条锁两层同时钉：
 *  ① **静态接线**：源文件里每个 findWorkflows/findInstances 调用都必须带 `userId`，
 *     裸的 findInstanceById/findWorkflowById 只允许出现在两个归属 helper 里(+trigger 的自建实例回读)。
 *  ② **行为**：假库按 drizzle 的 SQL chunk 形状真求值(`user_id` / `created_by` 谓词进 SQL)，
 *     他人 id 一律 404 且副作用未发生；超时 sweep 全量遍历但**只回计数**。
 *
 * 变异自证：同一判据拿去判"去掉归属参数"的变体必须红(见文件末尾两格)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

const W_MINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const W_OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const I_MINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const I_OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
const I_OTHER_RUNNING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'

/**
 * 假库：只实现本族用到的语句形态，按 drizzle 的 chunk 形状真求值 ——
 * 不具备语义的语句**直接抛**，拒绝"静默放行"。
 *
 * chunk 形状(0.45.2 实测)：StringChunk={value:string[]}、Column={name}、
 * Param={value}、SQL={queryChunks}、select 构建器(子查询)= 被 Param 包住的普通对象。
 */
const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>
  type Chunk = {
    value?: unknown
    name?: string
    queryChunks?: Chunk[]
    __fakeSelect?: boolean
    cond?: Chunk
  }

  const tables: Record<string, Row[]> = {
    workflows: [],
    workflow_instances: [],
    workflow_tasks: [],
    workflow_logs: [],
  }
  const log: Array<{ op: string; table: string; params: unknown[] }> = []

  const isText = (c: Chunk | undefined): boolean => Array.isArray(c?.value)
  const textOf = (c: Chunk): string => (c.value as string[]).join('')
  const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
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
    if (node.__fakeSelect) return collectParams(node.cond, out)
    const wrapped = (node as { value?: Chunk }).value
    if (wrapped && typeof wrapped === 'object' && wrapped.__fakeSelect) {
      // in (子查询)：参数在子查询自己的 where 里，必须穿透进去看
      return collectParams(wrapped.cond, out)
    }
    if (Array.isArray(node.queryChunks)) {
      for (const c of node.queryChunks) collectParams(c, out)
      return out
    }
    if ('value' in node && typeof node.name !== 'string' && typeof node.value !== 'object') {
      out.push(node.value)
    }
    return out
  }

  function subqueryValues(node: Chunk): unknown[] {
    const sel = node.__fakeSelect ? node : (node.value as Chunk | undefined)
    if (!sel?.__fakeSelect || typeof (sel as { resolveValues?: unknown }).resolveValues !== 'function') {
      throw new Error('假库: in 右侧只支持子查询')
    }
    return (sel as unknown as { resolveValues: () => unknown[] }).resolveValues()
  }

  function evalNode(node: Chunk | undefined, row: Row): boolean {
    if (!node) return true
    if (isText(node)) return true
    if (!Array.isArray(node.queryChunks)) throw new Error('假库: 无法求值的条件节点')
    let parts = significant(node.queryChunks)
    // 剥包裹括号
    const head = parts[0]
    const tail = parts[parts.length - 1]
    if (parts.length >= 3 && isText(head) && textOf(head!).trim() === '(' && isText(tail) && textOf(tail!).trim() === ')') {
      parts = parts.slice(1, -1)
    }
    if (parts.length === 1) return evalNode(parts[0], row)
    const sep = parts.findIndex((c) => isText(c) && textOf(c).trim().toLowerCase() === 'and')
    if (sep > 0) {
      const left: Chunk = parts.length === 1 ? parts[0]! : { queryChunks: parts.slice(0, sep) }
      const right: Chunk = { queryChunks: parts.slice(sep + 1) }
      return evalNode(left, row) && evalNode(right, row)
    }
    const [left, op, right] = parts
    if (!left || !op || !right || typeof left.name !== 'string' || !isText(op)) {
      throw new Error('假库: 不认识的条件形态')
    }
    const col = snakeToCamel(left.name)
    const operator = textOf(op).trim().toLowerCase()
    if (operator === '=') {
      const v = (right as { value?: unknown }).value
      return row[col] === v
    }
    if (operator === 'in') {
      return subqueryValues(right).includes(row[col])
    }
    throw new Error(`假库: 不认识的运算符 ${operator}`)
  }

  const project = (row: Row, projection?: Record<string, Chunk>): Row => {
    if (!projection) return { ...row }
    const out: Row = {}
    for (const [key, val] of Object.entries(projection)) {
      if (val && typeof val.name === 'string') out[key] = row[snakeToCamel(val.name)]
    }
    return out
  }

  const isCountProjection = (projection?: Record<string, Chunk>): boolean =>
    !!projection && Object.keys(projection).length === 1 && !!projection.count?.queryChunks

  class FakeSelect {
    __fakeSelect = true
    cond?: Chunk
    private table?: unknown
    private limitN?: number
    private offsetN = 0
    private readonly projection?: Record<string, Chunk>

    constructor(projection?: Record<string, Chunk>) {
      this.projection = projection
    }
    from(t: unknown) {
      this.table = t
      return this
    }
    where(c: Chunk) {
      this.cond = c
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
    private rows(): Row[] {
      if (!this.table) throw new Error('假库: select 缺 from')
      const name = tableName(this.table)
      log.push({ op: 'select', table: name, params: collectParams(this.cond, []) })
      const all = tables[name]
      if (!all) throw new Error(`假库: 未知表 ${name}`)
      const filtered = this.cond ? all.filter((r) => evalNode(this.cond, r)) : [...all]
      const start = this.offsetN
      return this.limitN === undefined ? filtered.slice(start) : filtered.slice(start, start + this.limitN)
    }
    run(): Row[] {
      const rows = this.rows()
      if (isCountProjection(this.projection)) return [{ count: rows.length }]
      return rows.map((r) => project(r, this.projection))
    }
    resolveValues(): unknown[] {
      const rows = this.rows()
      const key = Object.keys(this.projection ?? {})[0]
      if (!key) throw new Error('假库: 子查询缺投影列')
      return rows.map((r) => project(r, this.projection)[key])
    }
    then<T>(ok?: (v: Row[]) => T, err?: (e: unknown) => T): Promise<T> {
      return Promise.resolve()
        .then(() => this.run())
        .then(ok, err)
    }
  }

  class FakeInsert {
    private table?: unknown
    private vals: Row[] = []
    private returningProj?: Record<string, Chunk>
    private readonly op: string
    constructor(t: unknown, op = 'insert') {
      this.table = t
      this.op = op
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
      log.push({ op: this.op, table: name, params: [] })
      const now = new Date().toISOString()
      const created = this.vals.map((v) => ({
        id: (v.id as string) ?? crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
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
    insert: (t: unknown) => new FakeInsert(t),
    update: (t: unknown) => new FakeUpdate(t),
    delete: (t: unknown) => new FakeDelete(t),
  }

  return { tables, log, db }
})

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

import { findInstances, findWorkflows } from '../src/db/workflow-queries.js'
import { workflowRoutes } from '../src/routes/workflows.js'

let app: FastifyInstance

function seed() {
  for (const key of Object.keys(fake.tables)) fake.tables[key]!.length = 0
  fake.log.length = 0
  fake.tables.workflows!.push(
    {
      id: W_MINE,
      name: '我的工作流',
      createdBy: ME,
      isActive: true,
      steps: [{ type: 'echo', name: 's1' }],
      triggerConfig: {},
      updatedAt: '2026-11-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: W_OTHER,
      name: '他人的工作流',
      createdBy: OTHER,
      isActive: true,
      steps: [{ type: 'echo', name: 's1' }],
      triggerConfig: {},
      updatedAt: '2026-11-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  )
  fake.tables.workflow_instances!.push(
    { id: I_MINE, workflowId: W_MINE, status: 'failed', context: {}, createdAt: '2026-11-01T00:00:00.000Z' },
    { id: I_OTHER, workflowId: W_OTHER, status: 'failed', context: {}, createdAt: '2026-11-01T00:00:00.000Z' },
    {
      id: I_OTHER_RUNNING,
      workflowId: W_OTHER,
      status: 'running',
      context: { timeout: 1 },
      startedAt: '2020-01-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  )
  fake.tables.workflow_tasks!.push(
    { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', instanceId: I_MINE, stepIndex: 0, name: 's1', type: 'echo', status: 'failed' },
    { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', instanceId: I_OTHER, stepIndex: 0, name: 's1', type: 'echo', status: 'failed' },
  )
}

const as = (userId: string) => ({ authorization: `Bearer tok-for-${userId}` })
const selects = (table: string) => fake.log.filter((e) => e.op === 'select' && e.table === table)

/** 归属判据：这些行是否全部属于 me(工作流看 createdBy，实例看其所属工作流的 createdBy)。 */
function onlyMine(
  rows: Array<{ id: string; createdBy?: string; workflowId?: string }>,
  me: string,
): boolean {
  return rows.every((r) => {
    if (r.createdBy !== undefined) return r.createdBy === me
    const inst = fake.tables.workflow_instances!.find((x) => x.id === r.id)
    const wf = fake.tables.workflows!.find((x) => x.id === inst?.workflowId)
    return wf?.createdBy === me
  })
}

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(workflowRoutes, { prefix: '/api' })
  await app.ready()
})

beforeEach(seed)

afterAll(async () => {
  await app.close()
})

describe('工作流面：列表/实例列表的归属进 SQL', () => {
  it('GET /workflows 只返回本人的工作流，SQL 的 created_by 参数就是令牌主体', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workflows', headers: as(ME) })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }>; total: number }
    expect(data.list.map((r) => r.id)).toEqual([W_MINE])
    expect(data.total).toBe(1)
    const q = selects('workflows')
    expect(q.length).toBeGreaterThan(0)
    for (const e of q) expect(e.params).toEqual([ME])
  })

  it('GET /workflows 换个人就换一份数据(不是"只返回第一条")', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workflows', headers: as(OTHER) })
    const data = res.json().data as { list: Array<{ id: string }> }
    expect(data.list.map((r) => r.id)).toEqual([W_OTHER])
    expect(onlyMine(data.list, OTHER)).toBe(true)
  })

  it('GET /workflows/instances 只返回本人工作流下的实例(子查询形态，不在内存过滤)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workflows/instances', headers: as(ME) })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }>; total: number }
    expect(data.list.map((r) => r.id)).toEqual([I_MINE])
    expect(data.total).toBe(1)
    expect(onlyMine(data.list, ME)).toBe(true)
    const q = selects('workflow_instances')
    expect(q.length).toBeGreaterThan(0)
    // 子查询里绑的 created_by 必须是令牌主体：params 会穿透到子查询内部
    for (const e of q) expect(e.params).toEqual([ME])
  })
})

describe('工作流面：他人 id 一律 404 且副作用未发生', () => {
  it('GET /workflows/:id 他人 ⇒ 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/workflows/${W_OTHER}`, headers: as(ME) })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('工作流不存在')
  })

  it('GET /workflows/instances/:id 他人 ⇒ 404，且没有去读他人的 tasks', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/workflows/instances/${I_OTHER}`, headers: as(ME) })
    expect(res.statusCode).toBe(404)
    expect(selects('workflow_tasks').length).toBe(0)
  })

  it('GET /workflows/instances/:id/tasks 与 /logs 他人 ⇒ 404', async () => {
    for (const suffix of ['tasks', 'logs']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/workflows/instances/${I_OTHER}/${suffix}`,
        headers: as(ME),
      })
      expect(res.statusCode).toBe(404)
    }
    expect(selects('workflow_tasks').length).toBe(0)
    expect(selects('workflow_logs').length).toBe(0)
  })

  it('POST /workflows/instances/:id/cancel 他人 ⇒ 404，实例状态原封不动', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/instances/${I_OTHER}/cancel`,
      headers: as(ME),
    })
    expect(res.statusCode).toBe(404)
    expect(fake.tables.workflow_instances!.find((r) => r.id === I_OTHER)!.status).toBe('failed')
    expect(fake.log.filter((e) => e.op === 'update')).toHaveLength(0)
  })

  it('POST /workflows/instances/:id/retry 他人 ⇒ 404，实例状态原封不动', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/instances/${I_OTHER}/retry`,
      headers: as(ME),
    })
    expect(res.statusCode).toBe(404)
    expect(fake.tables.workflow_instances!.find((r) => r.id === I_OTHER)!.status).toBe('failed')
    expect(fake.log.filter((e) => e.op === 'update')).toHaveLength(0)
  })

  it('POST /workflows/:id/trigger 他人 ⇒ 404，且没有为他人建实例(不消耗其额度)', async () => {
    const before = fake.tables.workflow_instances!.length
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/${W_OTHER}/trigger`,
      headers: as(ME),
      payload: {},
    })
    expect(res.statusCode).toBe(404)
    expect(fake.tables.workflow_instances!.length).toBe(before)
    expect(fake.log.filter((e) => e.op === 'insert' && e.table === 'workflow_instances')).toHaveLength(0)
  })
})

describe('工作流面：本人正例(证明收口没把合法路径一起堵死)', () => {
  it('GET 本人实例详情 ⇒ 200 且带 tasks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workflows/instances/${I_MINE}`,
      headers: as(ME),
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { instance: { id: string }; tasks: unknown[] }
    expect(data.instance.id).toBe(I_MINE)
    expect(data.tasks).toHaveLength(1)
  })

  it('POST 本人实例 retry ⇒ 200，状态回到 pending', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/instances/${I_MINE}/retry`,
      headers: as(ME),
    })
    expect(res.statusCode).toBe(200)
    expect(fake.tables.workflow_instances!.find((r) => r.id === I_MINE)!.status).toBe('pending')
  })

  it('POST 本人工作流 trigger ⇒ 201 且新实例挂在本人工作流下', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/${W_MINE}/trigger`,
      headers: as(ME),
      payload: {},
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data as { instance: { workflowId: string } }
    expect(data.instance.workflowId).toBe(W_MINE)
    expect(fake.tables.workflow_instances!.some((r) => r.workflowId === W_MINE && r.id !== I_MINE)).toBe(true)
  })
})

describe('工作流面：超时 sweep 属系统级清理，只回计数', () => {
  it('全量遍历(含他人 running 实例)但响应里没有 id 列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workflows/instances/timeout',
      headers: as(ME),
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as Record<string, unknown>
    expect(Object.keys(data)).toEqual(['count'])
    expect(data.count).toBe(1)
    // 他人实例确实被判超时(系统级遍历仍生效) —— 但调用方只拿到一个数
    expect(fake.tables.workflow_instances!.find((r) => r.id === I_OTHER_RUNNING)!.status).toBe('timeout')
    expect(JSON.stringify(res.body)).not.toContain(I_OTHER_RUNNING)
    // sweep 的查询不得把归属谓词绑到请求者身上(否则他人实例永远清不掉)
    const sweep = selects('workflow_instances').at(-1)!
    expect(sweep.params).toEqual(['running'])
  })
})

// ===========================================================================
// 静态接线锁 + 变异自证
// ===========================================================================

const SRC_URL = new URL('../src/routes/workflows.ts', import.meta.url)

/** 返回违规项；空数组 = 接线完整。 */
function scanWiring(src: string): string[] {
  const violations: string[] = []
  const readCalls = [...src.matchAll(/findWorkflows\(\{([^}]*)\}/g)]
  if (readCalls.length === 0) violations.push('找不到 findWorkflows 调用')
  for (const m of readCalls) {
    if (!/userId:\s*request\.userId!/.test(m[1] ?? '')) violations.push('findWorkflows 调用未带 userId')
  }
  const instCalls = [...src.matchAll(/findInstances\(\{([^}]*)\}/g)]
  if (instCalls.length === 0) violations.push('找不到 findInstances 调用')
  for (const m of instCalls) {
    if (!/userId:\s*request\.userId!/.test(m[1] ?? '')) violations.push('findInstances 调用未带 userId')
  }
  // 裸取实体只允许出现在两个归属 helper(+ trigger 的自建实例回读)
  if ((src.match(/await findInstanceById\(/g) ?? []).length !== 2) {
    violations.push('findInstanceById 裸调用数量异常(只允许 helper 内 1 处 + trigger 自建实例回读 1 处)')
  }
  if ((src.match(/await findWorkflowById\(/g) ?? []).length !== 2) {
    violations.push('findWorkflowById 裸调用数量异常(只允许两个 helper 内各 1 处)')
  }
  if (!/createdBy === userId/.test(src)) violations.push('缺少 createdBy 归属比较')
  if (!/: undefined/.test(src)) violations.push('归属不符时没有返回 undefined')
  // 实例侧 5 条端点必须都走 helper
  if ((src.match(/loadOwnedInstance\(parsed\.data\.id, request\.userId!\)/g) ?? []).length !== 5) {
    violations.push('5 条实例端点没有全部走 loadOwnedInstance')
  }
  // 全文件口径统一为 404：不得残留 403 分支
  if (/无权修改该工作流|无权删除该工作流/.test(src)) violations.push('残留 403 口径')
  return violations
}

describe('静态接线 + 变异自证', () => {
  it('源文件的六处归属调用都带 userId，裸取实体只在 helper 里', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    expect(scanWiring(src)).toEqual([])
  })

  it('变异自证 1：把 userId 实参从调用里去掉，同一判据必须报违规', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    const mutated = src.replace(/userId: request\.userId!/g, '')
    expect(mutated).not.toBe(src)
    expect(scanWiring(mutated).length).toBeGreaterThan(0)
  })

  it('变异自证 2：把 helper 里的归属比较短路掉，同一判据必须报违规', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(SRC_URL, 'utf8')
    const mutated = src.replace(
      /return \w+\.createdBy === userId \? \w+ : undefined/g,
      'return item',
    )
    expect(mutated).not.toBe(src)
    expect(scanWiring(mutated).length).toBeGreaterThan(0)
  })

  it('变异自证 3：行为判据对"去掉归属谓词"的旧形态会红', async () => {
    // 旧形态 = 只按 status 过滤，等价于修复前的 findInstances(没有归属谓词)
    const leaky = (await fake.db
      .select()
      .from({ [Symbol.for('drizzle:Name')]: 'workflow_instances' })
      .where(undefined as never)) as unknown as Array<{ id: string }>
    expect(leaky.map((r) => r.id)).toContain(I_OTHER_RUNNING)
    // 同一条判据(onlyMine)在旧形态上必须为 false
    expect(onlyMine(leaky, ME)).toBe(false)
    // 而修复后的真实查询，同一判据为 true
    const mine = await findInstances({ page: 1, pageSize: 20, userId: ME })
    expect(onlyMine(mine.list, ME)).toBe(true)
    const mineWf = await findWorkflows({ page: 1, pageSize: 20, userId: ME })
    expect(mineWf.list.every((w) => w.createdBy === ME)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
