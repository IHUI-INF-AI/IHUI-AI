// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-396 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/developer/relay/redeem 传入的 apiKeyId 未校验属主,核销 SQL 只按 id 更新
 * ⇒ 可用他人 Key 的 id 把额度充到他人账下(或绕过归属校验)。
 *
 * 本文件锁:
 *   ① 用他人 apiKeyId 核销被拒(统一文案,不区分是否存在);
 *   ② developerApiKeys 的充值 UPDATE 的 where 含当前 userId;
 *   ③ 本人 Key 正常核销成功(防误伤);
 *   ④ 不存在的 Key 与他人 Key 返回同一状态码 + 同一文案。
 *
 * 测试模式:mock 鉴权 / config / db;@ihui/database 用真实 schema(仅取表定义,不连库)。
 * 假 DB 按 real drizzle SQL 的 queryChunks 还原 where 字面量,行为上等价于:
 *   UPDATE ... WHERE id = $keyId [AND user_id = $caller]
 * 未带 user_id 谓词时,他人 Key 会被命中 —— 正是本票要防的路径。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'
const OWN_KEY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_KEY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MISSING_KEY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const UNIFIED_MSG = '指定的 API Key 不存在或无权操作'

const h = vi.hoisted(() => ({
  state: {
    /** 兑换码抢占 UPDATE ... RETURNING 的命中集 */
    claimRows: [] as Array<Record<string, unknown>>,
    /** 假库中的 API Key 行 */
    keys: [] as Array<{ id: string; userId: string; tokenBalance: number }>,
    /** 每次 developerApiKeys 充值 UPDATE 的 where 字面量(用于断言含 userId) */
    keyUpdateConditions: [] as string[][],
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 鉴权只负责注入当前用户
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_ID
  }),
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_ID
  }),
  requirePermission: () => vi.fn(async () => {}),
  requireAnyPermission: () => vi.fn(async () => {}),
}))

/** 从 drizzle 条件对象里递归收集字符串字面量(列名 / 绑定值都在 queryChunks 内) */
function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (!node || typeof node !== 'object') return out
  const n = node as { value?: unknown; queryChunks?: unknown[] }
  if (typeof n.value === 'string') out.push(n.value)
  if (Array.isArray(n.queryChunks)) {
    for (const chunk of n.queryChunks) collectStrings(chunk, out)
  }
  return out
}

/** 通用 select 链:任何形态都解析为空集(仅用于邮件通知等旁路查询) */
function selectChain(rows: unknown[]) {
  const p: any = Promise.resolve(rows)
  p.from = () => p
  p.where = () => p
  p.limit = () => p
  p.orderBy = () => p
  p.offset = () => p
  p.groupBy = () => p
  return { from: () => p }
}

/** UPDATE 链:set/where 可链式,returning() 或直接 await 都按 where 产出命中集 */
function updateChain(rowsFor: (cond: unknown) => unknown[]) {
  let cond: unknown
  const chain: any = {
    set: () => chain,
    where: (c: unknown) => {
      cond = c
      return chain
    },
    returning: () => Promise.resolve(rowsFor(cond)),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rowsFor(cond)).then(resolve, reject),
  }
  return chain
}

/**
 * 模拟 developer_api_keys 的充值 UPDATE:
 *   WHERE id = <keyId> [AND user_id = <caller>]
 * 若 where 未约束 user_id,他人 Key 会被命中(漏洞形态);约束后命中 0 行。
 */
function chargeKey(cond: unknown) {
  const strings = collectStrings(cond)
  h.state.keyUpdateConditions.push(strings)

  const target = h.state.keys.find((k) => strings.includes(k.id))
  if (!target) return []
  // 出现 caller 谓词时按属主过滤(真实 DB 语义)
  if (strings.includes(USER_ID) && target.userId !== USER_ID) return []
  const claimed = h.state.claimRows[0]
  const delta = typeof claimed?.tokenAmount === 'number' ? claimed.tokenAmount : 0
  target.tokenBalance += delta
  return [{ tokenBalance: target.tokenBalance }]
}

function makeDb() {
  const db: any = {
    select: () => selectChain([]),
    insert: () => updateChain(() => []),
    delete: () => updateChain(() => []),
    update: (table: any) =>
      table?.tokenBalance !== undefined && table?.userId !== undefined
        ? updateChain(chargeKey) // developerApiKeys
        : updateChain(() => h.state.claimRows), // redemptionCodes(其余 UPDATE)
    execute: () => Promise.resolve([]),
  }
  db.transaction = <T>(cb: (tx: any) => Promise<T>) => cb(db)
  return db
}

vi.mock('../src/db/index.js', () => ({
  db: makeDb(),
  dbRead: makeDb(),
  dbClient: {},
}))

import developerRelayRoutes from '../src/routes/developer-relay.js'

describe('F-396 /developer/relay/redeem 核销必须校验 apiKeyId 属主', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(developerRelayRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.state.claimRows = [
      { id: 'code-1', code: 'IHUI-AAAA-BBBB-CCCC', tokenAmount: 500, status: 'used' },
    ]
    h.state.keys = [
      { id: OWN_KEY_ID, userId: USER_ID, tokenBalance: 100 },
      { id: OTHER_KEY_ID, userId: OTHER_USER_ID, tokenBalance: 7 },
    ]
    h.state.keyUpdateConditions = []
  })

  const redeem = (apiKeyId: string) =>
    app.inject({
      method: 'POST',
      url: '/api/developer/relay/redeem',
      payload: { code: 'IHUI-AAAA-BBBB-CCCC', apiKeyId },
    })

  it('① 用他人 apiKeyId 核销被拒,且他人 Key 余额未变', async () => {
    const res = await redeem(OTHER_KEY_ID)

    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe(UNIFIED_MSG)
    expect(h.state.keys.find((k) => k.id === OTHER_KEY_ID)?.tokenBalance).toBe(7)
    expect(res.json().data).toBeUndefined()
  })

  it('② 充值 UPDATE 的 where 显式含当前 userId', async () => {
    const res = await redeem(OWN_KEY_ID)
    expect(res.statusCode).toBe(200)

    expect(h.state.keyUpdateConditions).toHaveLength(1)
    expect(h.state.keyUpdateConditions[0]).toContain(USER_ID)
  })

  it('③ 本人 Key 正常核销成功,返回结构与成功路径不变', async () => {
    const res = await redeem(OWN_KEY_ID)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { tokenAmount: 500, newTokenBalance: 600 },
    })
    expect(h.state.keys.find((k) => k.id === OWN_KEY_ID)?.tokenBalance).toBe(600)
  })

  it('④ 不存在的 Key 与他人 Key 返回同一状态码与同一文案', async () => {
    const other = await redeem(OTHER_KEY_ID)
    const missing = await redeem(MISSING_KEY_ID)

    expect(other.statusCode).toBe(missing.statusCode)
    expect(other.json().message).toBe(missing.json().message)
    expect(other.json().message).toBe(UNIFIED_MSG)
  })
})
