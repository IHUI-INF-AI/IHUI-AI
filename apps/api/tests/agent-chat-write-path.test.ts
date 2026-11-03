// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * B1 写路径回归(离线,不连库):`POST /agents/:id/messages` 的落库必须只追加、
 * 不截断 —— 上下文窗口只作用于喂给 LLM 的那 20 条,不是会话真相。
 *
 * 判据:
 *  ① 30 轮后会话保留 60 条(每轮 user+assistant),`seq` 连续 0..59;
 *  ② 并发两次 POST 不丢消息(4 条,两条 user 内容都在),且只建一条会话;
 *  ③ 发给 LLM 的历史仍 ≤20 条(30 轮时恰为 20 条 + system + 本轮 user);
 *  ④ `version=1` GET 响应形状不变(`data` 为数组,键集恰为 id/role/content)。
 *
 * 假 db 的语义按真实 SQL 的可观察结果实现:where 谓词经 PgDialect 编译后按列/参数匹配,
 * update 的 set 若含 `|| $n::jsonb` 就**追加**数组,若是普通数组就整列覆盖 —— 后者正是
 * 本票要拦的回归形态(把追加改回 `[...history, user, assistant]` 会让用例①变红)。
 * `pg_advisory_xact_lock` 被实现为按键排队的事务互斥,与生产的事务级锁同语义。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const harness = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, any>>,
  agents: [] as Array<Record<string, any>>,
  users: [] as Array<Record<string, any>>,
  lockTail: new Map<string, Promise<void>>(),
}))

const llmCalls = vi.hoisted(
  () => [] as Array<{ messages: Array<{ role: string; content: string }> }>,
)

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

// 鉴权在本用例里不是被测面:直接注入主体,后续归属谓词用的就是这个 userId。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'user-b1'
    return true
  },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: async (_path: string, init: { body?: unknown }) => {
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    llmCalls.push(body)
    await new Promise((resolve) => setTimeout(resolve, 3))
    const last = body.messages[body.messages.length - 1]
    return { ok: true, json: async () => ({ content: `回复:${last?.content ?? ''}` }) }
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const schema = await import('@ihui/database')
  const dialect = new PgDialect()

  type Row = Record<string, any>
  const TABLE_KEYS = new Map<unknown, 'sessions' | 'agents' | 'users'>([
    [schema.agentRuntimeSessions, 'sessions'],
    [schema.agents, 'agents'],
    [schema.users, 'users'],
  ])

  const compile = (expr: unknown) => dialect.sqlToQuery(expr as never)
  const camel = (col: string) => col.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

  function tableOf(table: unknown): 'sessions' | 'agents' | 'users' {
    const key = TABLE_KEYS.get(table)
    if (!key) throw new Error('fake-db: 未识别的表')
    return key
  }

  function rowsOf(name: 'sessions' | 'agents' | 'users'): Row[] {
    if (name === 'sessions') return harness.sessions
    if (name === 'agents') return harness.agents
    return harness.users
  }

  function columnOf(expr: unknown): string {
    // 投影里的列是 drizzle Column(有 DB 列名 .name),不是 SQL 表达式。
    const name = (expr as { name?: unknown }).name
    if (typeof name === 'string' && name.length > 0) return camel(name)
    throw new Error('fake-db: 无法解析列表达式')
  }

  function project(row: Row, projection: Record<string, unknown>): Row {
    const out: Row = {}
    for (const [key, expr] of Object.entries(projection)) out[key] = row[columnOf(expr)]
    return out
  }

  /** where 谓词:编译成 SQL 后按 `"col" = $n` 抽取 (列, 值) 对,只支持等值(本用例全部形态)。 */
  function matches(row: Row, cond: unknown): boolean {
    if (cond === undefined) return true
    const { sql: text, params } = compile(cond)
    const pairs = [...text.matchAll(/"(\w+)"\s*=\s*\$(\d+)/g)]
    if (pairs.length === 0) throw new Error(`fake-db: 无法解析 where ${text}`)
    return pairs.every(([, col, idx]) => row[camel(col!)] === params[Number(idx) - 1])
  }

  function orderOf(specs: unknown[]): Array<{ key: string; desc: boolean }> {
    return specs.map((spec) => {
      const { sql: text } = compile(spec)
      const m = /"(\w+)"\s+(asc|desc)/i.exec(text)
      if (!m) throw new Error(`fake-db: 无法解析 orderBy ${text}`)
      return { key: camel(m[1]!), desc: m[2]!.toLowerCase() === 'desc' }
    })
  }

  function compare(a: unknown, b: unknown): number {
    if (a instanceof Date || b instanceof Date) {
      return new Date(a as Date).getTime() - new Date(b as Date).getTime()
    }
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
    return Number(a) - Number(b)
  }

  function isSqlExpr(value: unknown): boolean {
    return typeof value === 'object' && value !== null && 'queryChunks' in value
  }

  function applySet(row: Row, set: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(set)) {
      if (value === undefined) continue
      if (value instanceof Date) {
        row[key] = value
        continue
      }
      if (isSqlExpr(value)) {
        const q = compile(value)
        // `messages = messages || $1::jsonb` ⇒ 追加;其它 SQL 表达式本用例不产生。
        if (q.sql.includes('||') && typeof q.params[0] === 'string') {
          row[key] = [...(Array.isArray(row[key]) ? row[key] : []), ...JSON.parse(q.params[0])]
        } else {
          throw new Error(`fake-db: 未实现的 set 表达式 ${q.sql}`)
        }
        continue
      }
      row[key] = value
    }
  }

  function makeSelect(projection?: Record<string, unknown>) {
    let table: 'sessions' | 'agents' | 'users' | undefined
    let cond: unknown
    let order: unknown[] = []
    let limit: number | undefined

    const run = (): Row[] => {
      if (!table) throw new Error('fake-db: select 缺 from')
      let rows = rowsOf(table).filter((row) => matches(row, cond))
      const specs = orderOf(order)
      if (specs.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const spec of specs) {
            const delta = compare(a[spec.key], b[spec.key])
            if (delta !== 0) return spec.desc ? -delta : delta
          }
          return 0
        })
      }
      if (limit !== undefined) rows = rows.slice(0, limit)
      return projection
        ? rows.map((row) => project(row, projection))
        : rows.map((row) => ({ ...row }))
    }

    const chain: any = {
      from(t: unknown) {
        table = tableOf(t)
        return chain
      },
      where(c: unknown) {
        cond = c
        return chain
      },
      orderBy(...specs: unknown[]) {
        order = specs
        return chain
      },
      limit(n: number) {
        limit = n
        return chain
      },
      for() {
        return chain
      },
      then(resolve: (v: Row[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(run).then(resolve, reject)
      },
    }
    return chain
  }

  function makeInsert(tableName: 'sessions' | 'agents' | 'users') {
    let values: Row = {}
    let inserted: Row[] | null = null
    const apply = (): Row[] => {
      if (inserted) return inserted
      const row: Row = { metadata: {}, createdAt: new Date(), updatedAt: new Date(), ...values }
      rowsOf(tableName).push(row)
      inserted = [row]
      return inserted
    }
    const chain: any = {
      values(v: Row) {
        values = v
        return chain
      },
      returning(projection?: Record<string, unknown>) {
        const rows = apply()
        return Promise.resolve(projection ? rows.map((row) => project(row, projection)) : rows)
      },
      onConflictDoNothing() {
        return chain
      },
      onConflictDoUpdate() {
        return chain
      },
      then(resolve: (v: Row[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(apply).then(resolve, reject)
      },
    }
    return chain
  }

  function makeUpdate(tableName: 'sessions' | 'agents' | 'users') {
    let cond: unknown
    let set: Record<string, unknown> = {}
    let applied: Row[] | null = null
    const apply = (): Row[] => {
      if (applied) return applied
      applied = rowsOf(tableName).filter((row) => matches(row, cond))
      for (const row of applied) applySet(row, set)
      return applied
    }
    const chain: any = {
      set(v: Record<string, unknown>) {
        set = v
        return chain
      },
      where(c: unknown) {
        cond = c
        return chain
      },
      returning(projection?: Record<string, unknown>) {
        const rows = apply()
        return Promise.resolve(projection ? rows.map((row) => project(row, projection)) : rows)
      },
      then(resolve: (v: Row[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(apply).then(resolve, reject)
      },
    }
    return chain
  }

  /**
   * 事务级 advisory lock 的内存版:同键排队,事务结束(commit/rollback 都算)释放。
   * 真实 PG 的 `pg_advisory_xact_lock` 在事务结束时自动释放,这里由 transaction() 兜底。
   */
  async function acquire(key: string): Promise<() => void> {
    const prev = harness.lockTail.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    harness.lockTail.set(
      key,
      prev.then(() => gate),
    )
    await prev
    return () => release()
  }

  function makeApi(releases: Array<() => void> | null) {
    return {
      select: (projection?: Record<string, unknown>) => makeSelect(projection),
      insert: (table: unknown) => makeInsert(tableOf(table)),
      update: (table: unknown) => makeUpdate(tableOf(table)),
      delete: () => makeInsert('sessions'),
      async execute(expr: unknown) {
        const q = compile(expr)
        if (/pg_advisory_xact_lock/i.test(q.sql)) {
          const key = String(q.params[0] ?? '')
          const release = await acquire(key)
          releases?.push(release)
        }
        return []
      },
      async transaction(cb: (tx: unknown) => Promise<unknown>) {
        const txReleases: Array<() => void> = []
        const tx = makeApi(txReleases)
        try {
          return await cb(tx)
        } finally {
          for (const release of txReleases.reverse()) release()
        }
      },
    }
  }

  const api = makeApi(null)
  return { db: api, dbRead: api }
})

import { mobileChatRoutes } from '../src/routes/mobile-chat-routes.js'

const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const URL_AGENT = `/api/agents/${AGENT_ID}/messages`

function sessionMessages(): Array<{ id: string; role: string; content: string; seq?: number }> {
  const session = harness.sessions.find((row) => row.botId === AGENT_ID)
  return (session?.messages ?? []) as Array<{
    id: string
    role: string
    content: string
    seq?: number
  }>
}

describe('B1 agent 会话写路径(只追加、不截断)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(mobileChatRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    harness.sessions.length = 0
    harness.agents.length = 0
    harness.users.length = 0
    harness.lockTail.clear()
    llmCalls.length = 0
    harness.agents.push({
      agentId: AGENT_ID,
      agentPrompt: '你是测试助手',
      agentModel: 'test-model',
      status: 'published',
    })
  })

  async function post(content: string) {
    return server.inject({ method: 'POST', url: URL_AGENT, payload: { content } })
  }

  async function getHistory() {
    return server.inject({ method: 'GET', url: URL_AGENT })
  }

  it('30 轮 POST 后 60 条仍在,seq 连续且只建一条会话', async () => {
    for (let round = 1; round <= 30; round += 1) {
      const res = await post(`第${round}轮`)
      expect(res.statusCode).toBe(200)
    }

    expect(harness.sessions).toHaveLength(1)
    const messages = sessionMessages()
    expect(messages).toHaveLength(60)
    expect(messages.map((m) => m.role)).toEqual(
      Array.from({ length: 30 }, () => ['user', 'assistant']).flat(),
    )
    expect(messages.map((m) => m.seq)).toEqual(Array.from({ length: 60 }, (_, i) => i))
    expect(messages[0]!.content).toBe('第1轮')
    expect(messages[messages.length - 2]!.content).toBe('第30轮')

    const history = await getHistory()
    const body = history.json() as { data: unknown[] }
    expect(body.data).toHaveLength(60)
  })

  it('并发两次 POST 不丢消息,且只建一条会话', async () => {
    const [a, b] = await Promise.all([post('并发A'), post('并发B')])
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)

    expect(harness.sessions).toHaveLength(1)
    const messages = sessionMessages()
    expect(messages).toHaveLength(4)
    expect(
      messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .sort(),
    ).toEqual(['并发A', '并发B'])
    expect(messages.map((m) => m.seq).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([0, 1, 2, 3])
  })

  it('发给 LLM 的上下文仍只取最近 20 条', async () => {
    for (let round = 1; round <= 30; round += 1) await post(`上下文${round}`)

    const last = llmCalls[llmCalls.length - 1]!
    expect(last.messages[0]!.role).toBe('system')
    expect(last.messages[last.messages.length - 1]!.role).toBe('user')
    // 去掉 system 与本轮 user 后,历史 = 20 条(第 20~29 轮的 10 问 10 答)
    const windowed = last.messages.slice(1, -1)
    expect(windowed).toHaveLength(20)
    expect(windowed[0]!.content).toBe('上下文20')
  })

  it('version=1 GET 响应形状逐字段不变(data 数组,键集 id/role/content)', async () => {
    const res = await post('你好')
    expect(res.statusCode).toBe(200)
    const postBody = res.json() as { code: number; data: Record<string, unknown> }
    expect(postBody.code).toBe(0)
    expect(Object.keys(postBody.data).sort()).toEqual(['content', 'id', 'role'])
    expect(postBody.data.role).toBe('assistant')
    expect(postBody.data.content).toBe('回复:你好')

    const history = await getHistory()
    const body = history.json() as {
      code: number
      message: string
      data: Array<Record<string, unknown>>
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toEqual([
      { id: expect.stringMatching(/^msg_\d+_u$/), role: 'user', content: '你好' },
      { id: expect.stringMatching(/^msg_\d+_a$/), role: 'assistant', content: '回复:你好' },
    ])
    for (const message of body.data) {
      expect(new Set(Object.keys(message))).toEqual(new Set(['id', 'role', 'content']))
    }
  })
})
