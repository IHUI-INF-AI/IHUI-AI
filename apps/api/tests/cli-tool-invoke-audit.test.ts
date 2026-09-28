// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86A2「工具证据流水的 HTTP 摄入路由挂载」离线回归(2026-09-28)。
 *
 * 走 Fastify app.inject() 跑**真实路由**(含插件内 preHandler 鉴权钩子与
 * recordToolLedgerAuditIngest 的逐条映射),全程 mock db/logger/config/
 * @ihui/database/siem-exporter,不触任何真实库与真实服务端口
 * (§5 测试隔离铁律;本机 8802/8810 亦无监听)。
 * 真库端到端(INSERT 进 audit_logs_chain 并在链上查回)随路由后的落库验收另计。
 *
 * 钉四条判据(与 86A2 交付判据一一对应):
 * 1. 正向:inject 一批合法 facts ⇒ 链写入口逐条被调 N 次,响应
 *    {requested, accepted, failed} 三个诚实计数且 code=0;
 * 2. 反向 1:body 混入 userId / user_id ⇒ 400 且**零写入**
 *    (断言事务从未开启,不是只看状态码);
 * 3. 反向 2:匿名(无令牌)⇒ 401/403 且零写入;另加"主体非 UUID"入口即拒;
 * 4. 反向 3:部分条目落库失败 ⇒ 响应**不得为 success**(code≠0),
 *    failed 如实计数、accepted 只计库侧确认集。
 *
 * 鉴权边界如实登记:authenticate 被 mock 是刻意的 —— 它自身的 JWT 校验由
 * plugins/auth 的既有测试负责;本文件判的是**路由的合同**:authenticate 抛错时
 * 必须先回 401 且不进 handler、request.userId 必须逐字落到链行的 user_id 参数位、
 * body 里的自报身份永远不可能赢。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockLoggerWarn, mockTransaction, mockAuthenticate, USER_ID } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockTransaction: vi.fn(),
  mockAuthenticate: vi.fn(),
  // 形状必须是真 UUID v4 形态(版本位 4 / variant 位 8):86A2 的路由入口把关用
  // z.uuid()(zod v4,校版本与 variant nibble),比服务层的形状正则更严。
  // 夹具写 '...-4444-...' 会被入口正当拒绝(本文件第一版就栽在这个假象上,
  // 现象是"正向用例 401" —— 先怀疑夹具形状,再怀疑判据)。
  USER_ID: '11111111-2222-4333-8444-555555555555',
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: mockLoggerWarn, error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64),
    NODE_ENV: 'test',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
  dbRead: {},
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题,
// 与 tests/tool-ledger-audit-ingest.test.ts 同因同法)
vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
}))

// siem-exporter 被 audit-log-service 顶层 import,而该文件此刻由 86C 并发持有;
// 本测试不碰它的任何判据,整模块 stub 掉以隔离在飞改动。
vi.mock('../src/services/siem-exporter.js', () => ({
  streamExport: vi.fn(),
}))

// 路由的唯一鉴权依赖:mock 成"按测试头决定主体"(边界见文件头注)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { cliToolInvokeAuditRoutes } from '../src/routes/cli-tool-invoke-audit.js'

// =============================================================================
// 夹具
// =============================================================================

/** 把 drizzle SQL 模板对象摊平成 { text, params }(与 86A 服务层测试同法)。 */
function inspectSql(raw: unknown): { text: string; params: unknown[] } | null {
  const chunks = (raw as { queryChunks?: unknown[] } | null)?.queryChunks
  if (!Array.isArray(chunks)) return null
  const text: string[] = []
  const walk = (list: unknown[]): void => {
    for (const c of list) {
      if (typeof c === 'string') {
        text.push(c)
      } else if (c && typeof c === 'object') {
        const inner = (c as { queryChunks?: unknown[]; value?: unknown }).queryChunks
        if (Array.isArray(inner)) walk(inner)
        else if ('value' in (c as object)) text.push(String((c as { value: unknown }).value))
      }
    }
  }
  walk(chunks)
  const params = (raw as { params?: unknown[] }).params
  return { text: text.join(''), params: Array.isArray(params) ? params : [] }
}

function fact(overrides?: Record<string, unknown>) {
  return {
    callId: 'a'.repeat(16) + '#1',
    turn: 1,
    streamId: 't1-uuidish',
    seq: 1,
    fingerprint: 'a'.repeat(16),
    toolName: 'read_file',
    state: 'settled',
    early: true,
    ok: true,
    ...overrides,
  }
}

function ingestBody(overrides?: Record<string, unknown>) {
  return {
    version: 1,
    turn: 1,
    streamId: 't1-uuidish',
    createdAtMs: 1730000000000,
    facts: [
      fact(),
      fact({
        callId: 'b'.repeat(16) + '#1',
        seq: 2,
        toolName: 'run_command',
        state: 'lost',
        early: false,
      }),
      fact({
        callId: 'c'.repeat(16) + '#1',
        seq: 3,
        state: 'started',
        early: false,
        ok: undefined,
      }),
    ],
    ...overrides,
  }
}

const INGEST_PATH = '/api/cli/audit/tool-invokes'

/** 与 routes/index.ts 的注册形态一致:挂 /api/cli 前缀,插件声明 /audit/tool-invokes。 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 复刻被 mock 掉的真实 auth 插件对实例的装饰(plugins/auth.ts 顶层
  // `server.decorateRequest('userId', undefined)`):Fastify v5 下未装饰的
  // request.userId 赋值在下游 handler 里读不到 —— 不补这一句,测的是
  // "mock 没接到真插件的装饰合同",而不是路由的鉴权合同(第一版即栽在此)。
  app.decorateRequest('userId', undefined)
  await app.register(cliToolInvokeAuditRoutes, { prefix: '/api/cli' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  // 真实 authenticate 的合同面:已登录才写 request.userId;未登录抛 401
  mockAuthenticate.mockImplementation(
    async (request: { headers: Record<string, unknown>; userId?: string }) => {
      const marker = request.headers['x-test-auth']
      if (marker === 'user') {
        request.userId = USER_ID
        return { userId: USER_ID }
      }
      if (marker === 'nonuuid') {
        request.userId = 'client-self-reported-1'
        return { userId: 'client-self-reported-1' }
      }
      const err = new Error('Unauthorized') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    },
  )
})

/**
 * 装 db.transaction 的逐条 execute 序列(advisory lock → 链尾查询 → INSERT RETURNING id),
 * 把每条 INSERT 的**摊平 SQL 文本**(值经 queryChunks 逐段内联,与 86A 服务层测试
 * 同一判据形态 —— 该 drizzle/postgres-js 组合下 SQL 对象的 params 读取为空,
 * 值只出现在摊平 text 里)捕获进返回数组。failResourceIds 命中的 INSERT 抛错,
 * 模拟 recordAuditLog 事务降级 → 计 failed。
 */
function armDbCaptures(failResourceIds: readonly string[] = []): string[] {
  const insertTexts: string[] = []
  mockTransaction.mockImplementation(
    (cb: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<unknown>) =>
      cb({
        execute: async (query: unknown) => {
          const sqlInfo = inspectSql(query)
          if (!sqlInfo) throw new Error('inspectSql 摊平失败:测试判定器失效,不得记通过')
          const text = sqlInfo.text
          if (text.includes('pg_advisory_xact_lock')) return []
          if (text.includes('SELECT current_hash')) return []
          if (text.includes('INSERT INTO audit_logs_chain')) {
            insertTexts.push(text)
            if (failResourceIds.some((id) => text.includes(id))) {
              throw new Error(`injected write failure for ${failResourceIds.join(',')}`)
            }
            return [{ id: `row-${insertTexts.length}` }]
          }
          throw new Error(`unexpected execute: ${text.slice(0, 60)}`)
        },
      }),
  )
  return insertTexts
}

// =============================================================================
// 判据 1:正向 — 一批 facts 逐条进链写入口,三计数诚实
// =============================================================================

describe('POST /api/cli/audit/tool-invokes:正向摄入', () => {
  it('inject 3 条合法 facts ⇒ INSERT 入口被调 3 次,action/user_id 逐条正确,响应三计数诚实', async () => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'user' },
      payload: ingestBody(),
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as {
      code: number
      message: string
      data: { requested: number; accepted: number; failed: number }
    }
    expect(json.code).toBe(0)
    expect(json.message).toBe('success')
    expect(json.data).toEqual({ requested: 3, accepted: 3, failed: 0 })
    // 链写入口逐条被调,且身份取的是令牌主体而不是任何 body 值
    expect(mockTransaction).toHaveBeenCalledTimes(3)
    expect(captured).toHaveLength(3)
    const callIds = ['a'.repeat(16) + '#1', 'b'.repeat(16) + '#1', 'c'.repeat(16) + '#1']
    captured.forEach((text, i) => {
      expect(text).toContain(callIds[i]!)
      expect(text).toContain('tool.invoke')
      expect(text).toContain('agent_tool_call')
      expect(text).toContain(USER_ID)
    })
  })
})

// =============================================================================
// 判据 2:反向 1 — body 混入自报身份 ⇒ 400 且零写入
// =============================================================================

describe('反向 1:body 混入 userId/user_id 必拒且零写入', () => {
  it.each([
    ['userId', '22222222-3333-4444-8555-666666666666'],
    ['user_id', '22222222-3333-4444-8555-666666666666'],
  ] as const)('混入 %s ⇒ 400,事务一次都没开', async (key, value) => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const body = ingestBody() as Record<string, unknown>
    body[key] = value
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'user' },
      payload: body,
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: number }).code).toBe(400)
    // "零写入"只能由写入口计数证明,状态码本身不构成证明
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})

// =============================================================================
// 判据 3:反向 2 — 匿名与非 UUID 主体 ⇒ 拒绝且零写入
// =============================================================================

describe('反向 2:未挂载鉴权不得被绕过', () => {
  it('匿名(无令牌头)⇒ 401/403 且零写入', async () => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: INGEST_PATH, payload: ingestBody() })
    expect([401, 403]).toContain(res.statusCode)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })

  it('主体非 UUID(如 apiKey 侧非 uuid userId)⇒ 入口即拒 401,不外溢成 ::uuid cast 假 DB 故障', async () => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'nonuuid' },
      payload: ingestBody(),
    })
    expect(res.statusCode).toBe(401)
    expect((res.json() as { message: string }).message).toContain('UUID')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})

// =============================================================================
// 判据 4:反向 3 — 部分失败不得回 success,failed 如实计数
// =============================================================================

describe('反向 3:部分落库失败', () => {
  it('3 条中第 2 条写失败 ⇒ 207 且 code≠0,data 如实回 {requested:3, accepted:2, failed:1}', async () => {
    const captured = armDbCaptures(['b'.repeat(16) + '#1'])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'user' },
      payload: ingestBody(),
    })
    expect(res.statusCode).toBe(207)
    const json = res.json() as {
      code: number
      data: { requested: number; accepted: number; failed: number }
    }
    // 失败必须响:code=0 会被 fetchApi 判成 success,这条断言就是"不得为 success"
    expect(json.code).not.toBe(0)
    expect(json.data).toEqual({ requested: 3, accepted: 2, failed: 1 })
    expect(captured).toHaveLength(3) // 确实逐条尝试过,不是提前放弃
  })
})

// =============================================================================
// 参数校验的另外两条入口形态(宁拒不误收)
// =============================================================================

describe('非法 body 形状', () => {
  it('facts 为空数组 ⇒ 400 且零写入', async () => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'user' },
      payload: ingestBody({ facts: [] }),
    })
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })

  it('fact 的 fingerprint 形状不对 ⇒ 400 且零写入(strict schema 的字段级把关同样生效)', async () => {
    const captured = armDbCaptures()
    const app = await buildApp()
    const body = ingestBody() as { facts: Array<Record<string, unknown>> }
    body.facts[0]!.fingerprint = 'NOT-A-FINGERPRINT'
    const res = await app.inject({
      method: 'POST',
      url: INGEST_PATH,
      headers: { 'x-test-auth': 'user' },
      payload: body,
    })
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})
