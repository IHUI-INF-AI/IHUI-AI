// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-790 常驻尺子:JSON 内容过滤必须与**独立判别条件同谓词** ∧ 失败态不得被读面筛掉。
 *
 * 立因(票面):`payload->>'x'` 这类"按 JSON 内容判类别"的过滤,今天命中集合正确往往只是
 * **巧合** —— 只有某一族写入者会写那个顶层键。明天新增一个写入者(内部任务 / 系统调用 /
 * 新端点)也写同名键,看板与用量表就会混入无关条目,而**条数与分页都"看起来正常"**。
 * 另一半:`mode=relay` 这类否定式筛选如果不限定行族,会把与本轮完全无关的记录也算进来,
 * 而失败态记录一旦再加一条 `status='success'` 就被静默筛掉 —— 一次用户可见的失败在每张
 * 表面上都不存在。
 *
 * 本机事实(AGENTS §5b/§12f):PG 在 `127.0.0.1:5432/ihui` 可连,但**本文件一律不连**
 * (§5 测试隔离铁律)—— db 层全部 mock,判据是"把被审路由交给 Drizzle 自己编译出来的
 * WHERE 拿来看"(取向同 `apps/api/tests/learn/published-lessons-filter-axes.test.ts`)。
 * 真库分页/排序行为属 `--db` 档(vitest.real.config.ts),本机未跑,见票面交付报告。
 *
 * 判据清单(每条都有配套的"没牙即红"对照):
 *  D1 byok 模式:JSON 内容条件与判别列条件**同时**在谓词里
 *  D2 relay 模式:判别列条件同在,且 error 行不被筛掉(失败态留在读面)
 *  D3 mode=all:既无 JSON 内容条件也无 api_key_id 条件 ⇒ 新增守卫没有收窄默认视图
 *  D4 阳性对照:去掉判别列的旧形态,干扰行**会**命中(证明 D1 的排除来自判别列,不是尺子恒假)
 *  D5 analytics/hot-pages:JSON 内容过滤与 `event` 判别列同谓词(既有正例的回潮锁)
 *  D6 读面 /history:failed 与 partial 批次仍在返回列表,且谓词里没有 status 收窄
 *  D7 读面 /knowledge-status:唯一一次失败留痕仍读得出 status=failed(不是"没有记录")
 *  D6/D7 同时是"判别列进谓词"的正例登记:留痕查询用 `source`(varchar 列)划族,
 *     而不是往 JSON 里塞一个键再按那个键筛。
 *
 * ⚠️ 求值器是**测试夹具**不是第二份生产实现:认不出的形态一律返回 null,
 * 而 null 会让当条断言当场红("判据失效必须表现为红,绝不静默放行",同
 * `exam-signup-ownership.test.ts` 的取值纪律)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { sql, type SQL } from 'drizzle-orm'
import {
  analyticsEvents,
  chatConversations,
  conversationImports,
  llmCallLogs,
} from '@ihui/database'

// ─────────────────────────────────────────────────────────────
// db 层 mock:捕获每次 select 链上的 WHERE 对象,行数据由夹具队列喂
// ─────────────────────────────────────────────────────────────
const cap = vi.hoisted(() => ({
  wheres: [] as unknown[],
  /** 每个 await 消费一批行(读面用例要按查询次序喂不同夹具;取空 ⇒ 返回空数组) */
  batches: [] as unknown[][],
  reset: () => {
    cap.wheres.length = 0
    cap.batches.length = 0
  },
}))

vi.mock('../../db/index.js', () => {
  // 链上每个方法都返回链本身,值类型统一按 unknown 收(then 的形参是 resolve/reject 回调,
  // 若把链声明成 `(...args: unknown[]) => unknown` 会和它的签名对不上 ⇒ tsc 直接红)
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const rec = (): Record<string, unknown> => chain
    chain.select = rec
    chain.from = rec
    chain.where = (cond: unknown) => {
      cap.wheres.push(cond)
      return chain
    }
    chain.groupBy = rec
    chain.orderBy = rec
    chain.limit = rec
    chain.offset = rec
    chain.as = rec
    chain.returning = () => Promise.resolve([{ id: 'conv-1' }])
    chain.values = () => chain
    chain.then = (onF?: unknown, onR?: unknown) => {
      const batch = cap.batches.shift() ?? []
      return Promise.resolve(batch).then(
        onF as (v: unknown) => unknown,
        onR as (e: unknown) => unknown,
      )
    }
    return chain
  }
  const dbMock = {
    select: () => makeChain(),
    insert: () => makeChain(),
    execute: () => makeChain(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: dbMock }
})

// 会话导入读面用 plugins/auth 的 authenticate(与 require-permission 是两个不同出口)
vi.mock('../../plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }): Promise<void> => {
    request.userId = 'user-1'
  },
}))
vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async () => {
    throw new Error('本判据不发解析请求(读面用例不触 /parse)')
  },
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string; roleId?: number }): Promise<void> => {
    request.userId = 'user-1'
    request.roleId = 1
  },
  requireAdmin: async (request: { userId?: string; roleId?: number }): Promise<void> => {
    request.userId = 'user-1'
    request.roleId = 1
  },
}))

// developer-relay 的兄弟服务与本判据无关,全部打桩(打桩后它们的 import 副作用不会执行,
// 也就不会碰 db / redis —— §5 测试隔离铁律)。
vi.mock('../../services/relay-billing-service.js', () => ({
  rechargeApiKeyFromWallet: vi.fn(),
  recordCall: vi.fn(),
}))
vi.mock('../../services/model-mapping-service.js', () => ({
  createMapping: vi.fn(),
  listMappings: vi.fn(),
}))
vi.mock('../../services/redemption-code-service.js', () => ({ redeemCode: vi.fn() }))
vi.mock('../../services/developer-api-keys-service.js', () => ({
  createKey: vi.fn(),
  updateKey: vi.fn(),
  rotateSecret: vi.fn(),
  revokeKey: vi.fn(),
}))
vi.mock('../../services/coupon-service.js', () => ({
  claimCoupon: vi.fn(),
  listUserCoupons: vi.fn(),
}))
vi.mock('../../services/relay-commission-service.js', () => ({ listUserCommissions: vi.fn() }))
vi.mock('../../services/tiered-pricing-service.js', () => ({ getTieredProgress: vi.fn() }))
vi.mock('../../services/api-subscription-service.js', () => ({
  listApiSubscriptionPlans: vi.fn(),
  getUserSubscriptionStatus: vi.fn(),
}))
vi.mock('../../services/order-service.js', () => ({ placeOrder: vi.fn() }))
// conversation-knowledge 的入库动作与"读面是否筛掉失败"无关,打桩后它的 import 副作用
// (连 RAG / embedding 依赖)不会执行 —— §5 测试隔离铁律要求零真实出口。
vi.mock('../../services/knowledge-rag-service.js', () => ({
  knowledgeRagService: { ingestConversation: vi.fn() },
}))

// developerRelayRoutes 是 **default 导出**(developer-relay.ts 末尾 `export default developerRelayRoutes`),
// 命名导入会拿到 undefined
// —— Fastify 此时报 "Plugin must be a function",而这条红是夹具错不是判据错,故按默认导出取。
const { default: developerRelayRoutes } = await import('../developer-relay.js')
const { adminAnalyticsRoutes } = await import('../analytics.js')
const { conversationImportRoutes } = await import('../conversation-import.js')
const { conversationKnowledgeRoutes } = await import('../conversation-knowledge.js')

// ─────────────────────────────────────────────────────────────
// 编译:把捕获的 WHERE 交给 Drizzle 自己的 QueryBuilder 出 SQL 文本 + 参数
// ─────────────────────────────────────────────────────────────
function compileWhere(
  where: unknown,
  table: typeof llmCallLogs,
): { sql: string; params: unknown[] } {
  const built = new QueryBuilder()
    .select({ id: table.id })
    .from(table)
    .where(where as SQL)
  return built.toSQL() as unknown as { sql: string; params: unknown[] }
}

function compileAnalyticsWhere(where: unknown): { sql: string; params: unknown[] } {
  const built = new QueryBuilder()
    .select({ id: analyticsEvents.id })
    .from(analyticsEvents)
    .where(where as SQL)
  return built.toSQL() as unknown as { sql: string; params: unknown[] }
}

/** 取第 n 次 select 的 WHERE 编译结果(先证明路由真的带了谓词,再谈内容)。 */
function whereAt(index: number, table: typeof llmCallLogs): { sql: string; params: unknown[] } {
  const cond = cap.wheres[index]
  if (cond === undefined) {
    throw new Error(
      `cap.wheres[${index}] 不存在(实际 ${cap.wheres.length} 次)——路由这次没走带 where 的查询`,
    )
  }
  return compileWhere(cond, table)
}

// ─────────────────────────────────────────────────────────────
// 窄求值器(测试夹具):只认本判据用到的那几种叶形态,认不出 ⇒ null ⇒ 断言红
// ─────────────────────────────────────────────────────────────
type FixtureRow = Record<string, unknown>

/** `col->>'key'` 的 PG 文本语义:boolean→'true'/'false',缺键→null。 */
function jsonText(colValue: unknown, key: string): string | null {
  if (colValue === null || colValue === undefined || typeof colValue !== 'object') return null
  const v = (colValue as Record<string, unknown>)[key]
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return JSON.stringify(v)
}

function leafPredicate(leaf: string, params: unknown[]): ((r: FixtureRow) => boolean) | null {
  const body = leaf.trim()

  // "tbl"."col" is not null / is null
  let m = /^"?\w*"?\."?([a-z_]+)"? is not null$/i.exec(body)
  if (m) {
    const col = m[1]!
    return (r) => r[col] !== null && r[col] !== undefined
  }
  m = /^"?\w*"?\."?([a-z_]+)"? is null$/i.exec(body)
  if (m) {
    const col = m[1]!
    return (r) => r[col] === null || r[col] === undefined
  }

  // ("tbl"."col"->>'key') is not null —— analytics 的 isNotNull(sql`...`) 形态
  m = /^\("?\w*"?\."?([a-z_]+)"?->>'([^']+)'(?:\)::text)?\) is not null$/i.exec(body)
  if (!m) m = /^\("?\w*"?\."?([a-z_]+)"?->>'([^']+)'\) is not null$/i.exec(body)
  if (m) {
    const col = m[1]!
    const key = m[2]!
    return (r) => jsonText(r[col], key) !== null
  }

  // "tbl"."col"->>'key' = / != 'literal'
  m = /^"?\w*"?\."?([a-z_]+)"?->>'([^']+)' (?:=|!=) '([^']*)'$/i.exec(body)
  if (m) {
    const col = m[1]!
    const key = m[2]!
    const op = body.includes('!=') ? '!=' : '='
    const want = m[3]!
    return (r) => {
      const got = jsonText(r[col], key)
      return op === '=' ? got === want : got !== want
    }
  }

  // "tbl"."col"->>'key' IS NULL / IS NOT NULL
  m = /^"?\w*"?\."?([a-z_]+)"?->>'([^']+)' is (not )?null$/i.exec(body)
  if (m) {
    const col = m[1]!
    const key = m[2]!
    const negated = m[3] !== undefined
    return (r) => {
      const isNull = jsonText(r[col], key) === null
      return negated ? !isNull : isNull
    }
  }

  // "tbl"."col" = / >= / <= $N
  m = /^"?\w*"?\."?([a-z_]+)"? (=|>=|<=) \$(\d+)$/i.exec(body)
  if (m) {
    const col = m[1]!
    const op = m[2]!
    const idx = Number(m[3]) - 1
    if (idx < 0 || idx >= params.length) return null
    const want = params[idx]
    if (op === '=') {
      if (
        want !== null &&
        want !== undefined &&
        typeof want !== 'string' &&
        typeof want !== 'number' &&
        typeof want !== 'boolean' &&
        !(want instanceof Date)
      ) {
        return null
      }
      return (r) => r[col] === want || String(r[col]) === String(want)
    }
    // 时间/数值比较:参数只认 Date / ISO 串 / number;其余 ⇒ 认不出(不得把 NaN 比较当成"不命中")
    const wantMs = toTime(want)
    if (wantMs === null) return null
    return (r) => {
      const gotMs = toTime(r[col])
      if (gotMs === null) return false
      return op === '>=' ? gotMs >= wantMs : gotMs <= wantMs
    }
  }

  return null
}

/** Date / ISO 串 / number 三种都能折成毫秒;折不出 ⇒ null(交由上层判"认不出")。 */
function toTime(v: unknown): number | null {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

/** 把编译出的 SQL 文本(外层可能是 `(...)`)忠实折成行谓词;认不出 ⇒ null。 */
function toRowPredicate(rendered: string, params: unknown[]): ((r: FixtureRow) => boolean) | null {
  const s = rendered.trim()
  // 编译产物是完整 select 语句(`select "id" from "t" where <谓词>`),取 where 之后那段。
  // 找不到 ⇒ null(不得把"没找到谓词"读成"谓词恒真/恒假")
  const at = s.search(/\bwhere\b/i)
  if (at === -1) return null
  return evalExpr(s.slice(at).replace(/^\s*where\s*/i, ''), params)
}

/** 递归求值(只吃谓词表达式本体 —— 再找一次 where 会把每一片叶子都判成"认不出")。 */
function evalExpr(raw: string, params: unknown[]): ((r: FixtureRow) => boolean) | null {
  let s = raw.trim()
  // 反复剥成对的外层括号
  while (s.startsWith('(') && s.endsWith(')')) {
    const inner = s.slice(1, -1)
    if (!balanced(inner)) break
    s = inner.trim()
  }

  const andParts = splitTop(s, ' and ')
  if (andParts && andParts.length > 1) {
    const subs = andParts.map((p) => evalExpr(p, params))
    if (subs.some((x) => x === null)) return null
    return (r) => subs.every((sub) => sub !== null && sub(r))
  }
  const orParts = splitTop(s, ' or ')
  if (orParts && orParts.length > 1) {
    const subs = orParts.map((p) => evalExpr(p, params))
    if (subs.some((x) => x === null)) return null
    return (r) => subs.some((sub) => sub !== null && sub(r))
  }
  return leafPredicate(s, params)
}

function balanced(s: string): boolean {
  let depth = 0
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

/** 只在括号深度 0 处切连接词(大小写不敏感);切不开 ⇒ null(交由调用方判"认不出")。 */
function splitTop(s: string, connector: string): string[] | null {
  const lower = s.toLowerCase()
  const parts: string[] = []
  let depth = 0
  let start = 0
  let hits = 0
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0 && lower.startsWith(connector, i)) {
      hits++
      parts.push(s.slice(start, i))
      i += connector.length - 1
      start = i + 1
    }
  }
  if (hits === 0) return null
  parts.push(s.slice(start))
  return parts.every((p) => p.trim() !== '') ? parts : null
}

/** 求值前必须先证明尺子看得见这条谓词(否则"排除"可能是判据失明)。 */
function mustEvaluate(rendered: { sql: string; params: unknown[] }): (r: FixtureRow) => boolean {
  const p = toRowPredicate(rendered.sql, rendered.params)
  if (p === null) {
    throw new Error(
      `求值器认不出这条谓词,拒绝据此下结论。SQL=${rendered.sql} params=${JSON.stringify(
        rendered.params,
      )}`,
    )
  }
  return p
}

// ─────────────────────────────────────────────────────────────
// 夹具行
// ─────────────────────────────────────────────────────────────
const KEY_ID = '33333333-3333-4333-8333-333333333333'
const RECENT = new Date(Date.now() - 60_000)

function relayCallRow(extra: Partial<FixtureRow> = {}): FixtureRow {
  return {
    user_id: 'user-1',
    created_at: RECENT,
    api_key_id: KEY_ID,
    status: 'success',
    metadata: {},
    ...extra,
  }
}

function byokRow(): FixtureRow {
  return relayCallRow({ metadata: { byokMode: true, platformFeeCents: 3 } })
}
function relayRow(): FixtureRow {
  return relayCallRow({ metadata: { costCents: 12 } })
}
function relayErrorRow(): FixtureRow {
  return relayCallRow({ status: 'error', metadata: { costCents: 0 } })
}
/** 干扰行:带**同一个顶层键**,却不是 API Key 计费流水(内部任务/系统调用那一族)。 */
function decoyRow(): FixtureRow {
  return relayCallRow({ api_key_id: null, metadata: { byokMode: true } })
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  // 前缀与 routes/index.ts 里 `server.register(developerRelayRoutes, { prefix: '/api' })` /
  // `server.register(adminAnalyticsRoutes, { prefix: '/api/admin' })` 两条生产注册逐字一致
  // (插件内写的已是全路径,前缀写错会得到 404 —— 那是夹具错,不是判据红)
  await app.register(developerRelayRoutes, { prefix: '/api' })
  await app.register(adminAnalyticsRoutes, { prefix: '/api/admin' })
  // 与生产注册同前缀(routes/index.ts 的 `server.register(conversationImportRoutes, { prefix: '/api/user' })`)
  await app.register(conversationImportRoutes, { prefix: '/api/user' })
  await app.register(conversationKnowledgeRoutes, { prefix: '/api/user' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  cap.reset()
})

describe('G-790 判别列必须进 SQL 谓词(developer/relay/usage)', () => {
  it('D0 尺子的失效方向是红:看不见谓词 / 认不出的形态一律不得当作"通过"', () => {
    // 没有 WHERE 的语句、以及本夹具没实现的叶形态 ⇒ null ⇒ mustEvaluate 抛错。
    // 若这里不红,后面所有"被排除"的结论都可能只是"尺子什么都没判"。
    expect(toRowPredicate('select "id" from "llm_call_logs"', [])).toBe(null)
    expect(
      toRowPredicate('select "id" from "t" where to_char("x", \'YYYY\') = $1', ['2026-10-05']),
    ).toBe(null)
    expect(() =>
      mustEvaluate({ sql: 'select "id" from "llm_call_logs"', params: [] }),
    ).toThrowError(/认不出这条谓词/)
  })

  it('D1 byok 模式:JSON 内容条件与独立判别条件同谓词,干扰行被排除', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/developer/relay/usage?mode=byok' })
    expect(res.statusCode).toBe(200)
    // 列表与汇总两次查询共用同一个 where 对象(分页与 total 口径一致)
    expect(cap.wheres.length).toBeGreaterThanOrEqual(1)

    const rendered = whereAt(0, llmCallLogs)
    expect(rendered.sql).toMatch(/->>'byokMode'/)
    expect(rendered.sql.toLowerCase()).toContain('"api_key_id" is not null')

    const pred = mustEvaluate(rendered)
    expect(pred(byokRow())).toBe(true) // 正当数据不被误排除
    expect(pred(relayRow())).toBe(false)
    expect(pred(decoyRow())).toBe(false) // 同名顶层键、非计费流水 ⇒ 排除
  })

  it('D2 relay 模式:判别条件同在,且 error 行(用户可见的失败)留在读面', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/developer/relay/usage?mode=relay&groupBy=day',
    })
    expect(res.statusCode).toBe(200)
    const rendered = whereAt(0, llmCallLogs)
    expect(rendered.sql).toMatch(/byokMode/)
    expect(rendered.sql.toLowerCase()).toContain('"api_key_id" is not null')
    // 本票另一半:判别条件不得顺手把失败态筛掉 —— 谓词里没有任何 status 过滤
    expect(rendered.sql.toLowerCase()).not.toContain('"status"')

    const pred = mustEvaluate(rendered)
    expect(pred(relayRow())).toBe(true)
    expect(pred(relayErrorRow())).toBe(true) // 失败仍在读面
    expect(pred(byokRow())).toBe(false)
    expect(pred(decoyRow())).toBe(false)
    // 区分「OR 语义」与「把 OR 误拆成 AND」:byokMode='false' 的行按 OR 应落在 relay 档
    // (IS NULL 不成立但 != 'true' 成立);若求值器把两支当 AND,这条会假绿成红。
    expect(pred(relayCallRow({ metadata: { byokMode: 'false' } }))).toBe(true)
  })

  it('D3 mode=all(默认):不引入 JSON 内容过滤,也不引入判别条件(默认视图未被收窄)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/developer/relay/usage' })
    expect(res.statusCode).toBe(200)
    const rendered = whereAt(0, llmCallLogs)
    expect(rendered.sql).not.toMatch(/byokMode/)
    expect(rendered.sql.toLowerCase()).not.toContain('api_key_id')

    const pred = mustEvaluate(rendered)
    // 三行都留在默认视图里:守卫只作用于显式按模式筛选的请求
    expect(pred(byokRow())).toBe(true)
    expect(pred(relayRow())).toBe(true)
    expect(pred(decoyRow())).toBe(true)
  })

  it('D4 阳性对照:只按内容过滤的旧形态会让干扰行命中(排除确实来自判别列)', async () => {
    const oldForm = compileWhere(sql`${llmCallLogs.metadata}->>'byokMode' = 'true'`, llmCallLogs)
    expect(oldForm.sql).toMatch(/->>'byokMode'/)
    expect(oldForm.sql.toLowerCase()).not.toContain('api_key_id')
    const pred = mustEvaluate(oldForm)
    expect(pred(byokRow())).toBe(true)
    expect(pred(decoyRow())).toBe(true) // 没有判别列 ⇒ 混入(这就是本票要拦的形态)
  })
})

describe('G-790 既有正例的回潮锁(analytics/hot-pages)', () => {
  it('D5 JSON 内容过滤与 event 判别列同谓词;同名顶层键的其他事件被排除', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/hot-pages' })
    expect(res.statusCode).toBe(200)
    expect(cap.wheres.length).toBeGreaterThanOrEqual(1)
    const rendered = compileAnalyticsWhere(cap.wheres[0])
    expect(rendered.sql).toContain('->>')
    expect(rendered.sql.toLowerCase()).toContain('"event" = $1')
    expect(rendered.params).toContain('page_view')

    const pred = mustEvaluate(rendered)
    expect(pred({ event: 'page_view', properties: { path: '/home' }, created_at: RECENT })).toBe(
      true,
    )
    // 干扰行:download 事件也带顶层 path 键 ⇒ 只有 JSON 条件时会被算成页面热度
    expect(pred({ event: 'download', properties: { path: '/file.zip' }, created_at: RECENT })).toBe(
      false,
    )
    // 正当 page_view 但没带 path ⇒ 由 JSON 条件本身排除(两条条件各司其职,不是冗余)
    expect(pred({ event: 'page_view', properties: {}, created_at: RECENT })).toBe(false)
  })
})

describe('G-790 失败态条目不得从读面被筛掉(conversation-import 读面)', () => {
  /** 把会话导入读面捕到的 WHERE 编译出来看形状(判"有没有偷偷加 status 收窄")。 */
  function compileImportWhere(where: unknown): { sql: string; params: unknown[] } {
    const built = new QueryBuilder()
      .select({ id: conversationImports.id })
      .from(conversationImports)
      .where(where as SQL)
    return built.toSQL() as unknown as { sql: string; params: unknown[] }
  }

  it('D6 /history:failed 与 partial 批次都在返回列表里,且谓词不含任何 status 收窄', async () => {
    cap.batches.push([
      {
        id: 'imp-1',
        source: 'claude_code',
        conversationId: 'c-1',
        fileName: 'ok.json',
        parsedCount: 2,
        importedCount: 2,
        failedCount: 0,
        status: 'success',
        errorMessage: null,
        importedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        // 失败批次:没有 conversationId(整批回滚),但**必须**留在读面上 ——
        // 否则"一次用户可见的失败在每张表面上都不存在"(本票失效型)。
        id: 'imp-2',
        source: 'codex',
        conversationId: null,
        fileName: 'bad.json',
        parsedCount: 3,
        importedCount: 0,
        failedCount: 3,
        status: 'failed',
        errorMessage: '落库失败: 消息写入超时',
        importedAt: new Date('2026-10-02T10:00:00.000Z'),
      },
      {
        id: 'imp-3',
        source: 'cursor',
        conversationId: 'c-3',
        fileName: 'part.json',
        parsedCount: 4,
        importedCount: 2,
        failedCount: 2,
        status: 'partial',
        errorMessage: null,
        importedAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/api/user/conversation-import/history' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: Array<Record<string, unknown>>; total: number } }
    expect(body.data.total).toBe(3)
    const statuses = body.data.list.map((x) => x.status)
    expect(statuses).toContain('success')
    expect(statuses).toContain('failed')
    expect(statuses).toContain('partial')
    const failed = body.data.list.find((x) => x.status === 'failed')
    expect(failed).toBeTruthy()
    expect(failed?.conversationId).toBeNull() // 留痕不靠 conversationId 存活
    expect(String(failed?.errorMessage)).toContain('消息写入超时')
    expect(failed?.failedCount).toBe(3)

    expect(cap.wheres.length).toBe(1)
    const rendered = compileImportWhere(cap.wheres[0])
    // 读面的谓词只按属主筛,绝不按 status 筛 —— 加了 status='success' 就是把失败筛掉
    expect(rendered.sql.toLowerCase()).toContain('"owner_uuid" = $1')
    expect(rendered.sql.toLowerCase()).not.toContain('"status"')
    expect(rendered.params).toEqual(['user-1'])
  })

  it('D7 /knowledge-status:唯一一次失败留痕仍是可读结论(status=failed 而非"没有记录")', async () => {
    cap.batches.push(
      // 注意键名:mock 直接把行交给 handler,而 handler 读的是投影里的 **JS 属性名**
      // (`select({ id: chatConversations.id, userId: chatConversations.userId })`),不是物理列名。
      [{ id: 'c-1', userId: 'user-1' }], // 属主校验
      [
        {
          id: 'trail-1',
          status: 'failed',
          errorMessage: 'embedding 服务不可用',
          importedCount: 0,
          importedAt: new Date('2026-10-04T08:00:00.000Z'),
        },
      ],
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/user/conversation-import/knowledge-status?conversationId=c-1',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, unknown> }
    // 关键:失败态**看得见**(status='failed' + errorMessage),而不是回 'none'(= 从未尝试)
    expect(body.data.status).toBe('failed')
    expect(body.data.ingested).toBe(false)
    expect(body.data.errorMessage).toBe('embedding 服务不可用')
    expect(body.data.importedAt).toBe('2026-10-04T08:00:00.000Z')

    // 两次查询(属主校验 + 留痕读取)都不带 status 收窄;留痕查询按 source 判别列筛,
    // 正是本票要求的"独立判别列进谓词"的正例(varchar 列而非 JSON 内容)
    expect(cap.wheres.length).toBe(2)
    const trailWhere = compileImportWhere(cap.wheres[1])
    expect(trailWhere.sql.toLowerCase()).toContain('"source" = $3')
    expect(trailWhere.params).toContain('knowledge_ingest')
    expect(trailWhere.sql.toLowerCase()).not.toContain('"status"')
    // 属主校验那一查同样不收窄失败态
    const ownerWhere = new QueryBuilder()
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(cap.wheres[0] as SQL)
      .toSQL() as unknown as { sql: string }
    expect(ownerWhere.sql.toLowerCase()).not.toContain('"status"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
