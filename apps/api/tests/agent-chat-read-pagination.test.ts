// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * B2 分页读回归(离线,不连库):`GET /agents/:id/messages` 的 v2 信封与 v1 兼容面。
 *
 * 判据:
 *  ① 缺省 / `version=1` 的响应形状逐字段不变(`data` 数组,键集 id/role/content);
 *  ② `version=2` 首页:items 20、total 45、hasMoreOlder=true、nextCursor=26;
 *  ③ 翻页:nextCursor 前推,最后一页 hasMoreOlder=false、nextCursor=null;
 *  ④ 游标越界/非法 400;limit 0/101 400,上限 100 生效;version 非 1/2 400;
 *  ⑤ 旧消息无 seq 时按下标补 1..n(浅层断言原数组对象仍无 seq —— 读不写库);
 *  ⑥ 空会话:v1 空数组,v2 全零信封。
 *
 * `readLatestSession` 被桩成原样返回 harness.session(同一对象引用),用于证明
 * 读路径没有为了补 seq 去改写会话行。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const AGENT_ID = '11111111-1111-4111-8111-111111111111'

const harness = vi.hoisted(() => ({
  session: null as null | { id: string; messages: Array<Record<string, any>> },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

// 鉴权不是被测面:注入固定主体,路由用 userId 找会话(此处被 queries 桩接管)。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'user-b2'
    return true
  },
}))

// 只读路径:readLatestSession 返回共享引用;写函数若被调用即失败(读不得写库)。
// pageAgentMessages 是纯函数,取真实实现(分页语义被测的就是它)。
vi.mock('../src/db/agent-chat-queries.js', async () => {
  const actual = await vi.importActual('../src/db/agent-chat-queries.js')
  return {
    readLatestSession: async () => harness.session,
    findLatestSession: async () => {
      throw new Error('B2 读路径不得调用 findLatestSession')
    },
    appendMessages: async () => {
      throw new Error('B2 读路径不得调用 appendMessages')
    },
    pageAgentMessages: (actual as { pageAgentMessages: unknown }).pageAgentMessages,
  }
})

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const caml = (col: string) => col.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
  const agentRow = {
    agentId: '11111111-1111-4111-8111-111111111111',
    agentPrompt: 'system',
    agentModel: 'm',
    status: 'published',
  } as const

  const compile = (expr: unknown) => dialect.sqlToQuery(expr as never)

  /** 只支持本路由的等值谓词(`"agent_id" = $1`)。 */
  function matches(cond: unknown): boolean {
    if (cond === undefined) return true
    const { sql: text, params } = compile(cond)
    const pairs = [...text.matchAll(/"(\w+)"\s*=\s*\$(\d+)/g)]
    if (pairs.length === 0) throw new Error(`fake-db: 无法解析 where ${text}`)
    return pairs.every(
      ([, col, idx]) =>
        (agentRow as Record<string, unknown>)[caml(col!)] === params[Number(idx) - 1],
    )
  }

  function makeSelect(projection?: Record<string, unknown>) {
    let cond: unknown
    let limit: number | undefined
    const run = (): Record<string, unknown>[] => {
      if (!matches(cond)) return []
      const row = projection
        ? Object.fromEntries(
            Object.entries(projection).map(([key, expr]) => [
              key,
              (agentRow as Record<string, unknown>)[caml((expr as { name: string }).name)],
            ]),
          )
        : { ...agentRow }
      return limit === undefined ? [row] : [row].slice(0, limit)
    }
    const chain: any = {
      from() {
        return chain
      },
      where(c: unknown) {
        cond = c
        return chain
      },
      orderBy() {
        return chain
      },
      limit(n: number) {
        limit = n
        return chain
      },
      then(resolve: (v: Record<string, unknown>[]) => void, reject?: (e: unknown) => void) {
        return Promise.resolve().then(run).then(resolve, reject)
      },
    }
    return chain
  }

  return { db: {}, dbRead: { select: makeSelect } }
})

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  const { mobileChatRoutes } = await import('../src/routes/mobile-chat-routes.js')
  await app.register(mobileChatRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  harness.session = null
})

/** 第 i 条消息:奇数为 user、偶数为 assistant;seq 传 undefined 表示旧数据无该键。 */
function msg(i: number, seq?: number) {
  return {
    id: `msg_${i}`,
    role: i % 2 === 1 ? 'user' : 'assistant',
    content: `第${i}条`,
    timestamp: i,
    ...(seq === undefined ? {} : { seq }),
  }
}

function numbered(count: number, withSeq: boolean) {
  return Array.from({ length: count }, (_, k) => msg(k + 1, withSeq ? k + 1 : undefined))
}

async function get(url: string) {
  const res = await app.inject({ method: 'GET', url })
  return { status: res.statusCode, body: res.json() as Record<string, any> }
}

describe('B2 agent 会话分页读', () => {
  it('v1 缺省与显式 version=1 形状逐字段不变', async () => {
    harness.session = { id: 'sess-b2', messages: [msg(1, 1), msg(2, 2), msg(3, 3)] }
    for (const url of [
      `/api/agents/${AGENT_ID}/messages`,
      `/api/agents/${AGENT_ID}/messages?version=1`,
    ]) {
      const { status, body } = await get(url)
      expect(status).toBe(200)
      expect(body).toEqual({
        code: 0,
        message: 'success',
        data: [
          { id: 'msg_1', role: 'user', content: '第1条' },
          { id: 'msg_2', role: 'assistant', content: '第2条' },
          { id: 'msg_3', role: 'user', content: '第3条' },
        ],
      })
      for (const item of body.data) {
        expect(Object.keys(item).sort()).toEqual(['content', 'id', 'role'])
      }
    }
  })

  it('v2 首页:默认 limit 20,total 45,hasMoreOlder 翻转且 nextCursor=26', async () => {
    harness.session = { id: 'sess-b2', messages: numbered(45, true) }
    const { status, body } = await get(`/api/agents/${AGENT_ID}/messages?version=2`)
    expect(status).toBe(200)
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(45)
    expect(body.data.items).toHaveLength(20)
    expect(body.data.hasMoreOlder).toBe(true)
    expect(body.data.nextCursor).toBe(26)
    expect(body.data.items[0]).toEqual({ id: 'msg_26', role: 'assistant', content: '第26条' })
    expect(body.data.items[19]).toEqual({ id: 'msg_45', role: 'user', content: '第45条' })
    for (const item of body.data.items) {
      expect(Object.keys(item).sort()).toEqual(['content', 'id', 'role'])
    }
  })

  it('v2 翻页:游标前推,最后一页 hasMoreOlder=false 且 nextCursor=null', async () => {
    harness.session = { id: 'sess-b2', messages: numbered(45, true) }
    const first = await get(`/api/agents/${AGENT_ID}/messages?version=2&cursor=26`)
    expect(first.status).toBe(200)
    expect(first.body.data.items).toHaveLength(20)
    expect(first.body.data.items[0]).toEqual({
      id: 'msg_6',
      role: 'assistant',
      content: '第6条',
    })
    expect(first.body.data.items[19]).toEqual({ id: 'msg_25', role: 'user', content: '第25条' })
    expect(first.body.data.hasMoreOlder).toBe(true)
    expect(first.body.data.nextCursor).toBe(6)

    const last = await get(`/api/agents/${AGENT_ID}/messages?version=2&cursor=6`)
    expect(last.status).toBe(200)
    expect(last.body.data.items).toHaveLength(5)
    expect(last.body.data.items[0]).toEqual({ id: 'msg_1', role: 'user', content: '第1条' })
    expect(last.body.data.items[4]).toEqual({ id: 'msg_5', role: 'user', content: '第5条' })
    expect(last.body.data.hasMoreOlder).toBe(false)
    expect(last.body.data.nextCursor).toBeNull()
  })

  it('游标越界/非法回 400', async () => {
    harness.session = { id: 'sess-b2', messages: numbered(45, true) }
    for (const cursor of ['46', '0', '-1', '1.5', 'abc']) {
      const { status, body } = await get(
        `/api/agents/${AGENT_ID}/messages?version=2&cursor=${cursor}`,
      )
      expect(status).toBe(400)
      expect(body.code).toBe(400)
      expect(String(body.message)).toContain('cursor')
    }
    // 空会话里任何游标都无有效 seq 可定位
    harness.session = null
    const empty = await get(`/api/agents/${AGENT_ID}/messages?version=2&cursor=1`)
    expect(empty.status).toBe(400)
    expect(empty.body.code).toBe(400)
  })

  it('limit 边界:0/101 回 400,100 生效,缺省 20', async () => {
    harness.session = { id: 'sess-b2', messages: numbered(45, true) }
    for (const limit of ['0', '101']) {
      const { status, body } = await get(
        `/api/agents/${AGENT_ID}/messages?version=2&limit=${limit}`,
      )
      expect(status).toBe(400)
      expect(body.code).toBe(400)
      expect(String(body.message)).toContain('limit')
    }
    const capped = await get(`/api/agents/${AGENT_ID}/messages?version=2&limit=100`)
    expect(capped.status).toBe(200)
    expect(capped.body.data.items).toHaveLength(45)
    expect(capped.body.data.hasMoreOlder).toBe(false)
    expect(capped.body.data.nextCursor).toBeNull()

    const missing = await get(`/api/agents/${AGENT_ID}/messages?version=2`)
    expect(missing.body.data.items).toHaveLength(20)
  })

  it('旧数据无 seq 按下标补 1..n,且读路径不改写原数组', async () => {
    harness.session = { id: 'sess-b2', messages: numbered(45, false) }
    const { status, body } = await get(`/api/agents/${AGENT_ID}/messages?version=2`)
    expect(status).toBe(200)
    expect(body.data.items).toHaveLength(20)
    expect(body.data.items[0].content).toBe('第26条')
    expect(body.data.items[19].content).toBe('第45条')
    expect(body.data.nextCursor).toBe(26)
    // 读时只计算:锁定的原会话行仍是旧形状(没有 seq 键)
    expect(harness.session!.messages.every((m) => !('seq' in m))).toBe(true)
  })

  it('空会话:v1 空数组,v2 全零信封', async () => {
    const v1 = await get(`/api/agents/${AGENT_ID}/messages`)
    expect(v1.status).toBe(200)
    expect(v1.body.data).toEqual([])

    const v2 = await get(`/api/agents/${AGENT_ID}/messages?version=2`)
    expect(v2.status).toBe(200)
    expect(v2.body.data).toEqual({
      items: [],
      total: 0,
      hasMoreOlder: false,
      nextCursor: null,
    })
  })

  it('version 非 1/2 回 400(固定断言)', async () => {
    harness.session = { id: 'sess-b2', messages: [msg(1, 1)] }
    for (const version of ['0', '3', '1.0', 'abc']) {
      const { status, body } = await get(`/api/agents/${AGENT_ID}/messages?version=${version}`)
      expect(status).toBe(400)
      expect(body).toEqual({ code: 400, message: 'version 只支持 1 或 2' })
    }
  })
})
