// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-536 / G-431：路由把**未校验的外部字符串**直喂 `uuid` 列 —— 五处真缺陷的行为断言。
 *
 * 病灶一型：`req.body` 里一个只约束了"非空/长度"、没约束**格式**的字符串，被直接交给
 * Postgres 的 `uuid` 列 ⇒ `22P02 invalid input syntax for type uuid` ⇒ 客户端拿到 **500**。
 * 症状上"你传错了"与"服务坏了"完全同形。
 *
 * 五处（判定依据：同一 schema 的**其它字段都已校验**，只漏了落 uuid 列的那一个）：
 *   ① `POST /invoices/titles`            `userId`  → `edu_invoice_titles.user_id`
 *   ② `POST /auth-find-info`            `userUuid` → `user_auth_info.user_uuid`
 *   ③ `POST /auth-user-margin`          `userUuid` → `user_margins.user_id`（还是主键）
 *   ④ `POST /edu/classes/schedules`     `classId`  → `lesson_chapters.lesson_id`
 *   ⑤ `POST /agents/charge`             `agentId`  → `zhs_agent_buy.agent_id`（uuid NOT NULL）
 *
 * 修法：**在路由输入 schema 层**补 uuid 判据（而不是在每个 SQL 调用点散落 guards）——
 * 后者是本仓记过最多次的失败型"两处实现必漂移"。复用现成惯例 `z.uuid()`（全仓 117 处）。
 *
 * 三条不变量：
 *  ① 畸形值 ⇒ **400**，且 **db.insert 一次都没被调用**
 *     （只断言状态码会放过"先插了再抛"那一型；形状闸必须在进 SQL 之前）；
 *  ② 合法 uuid ⇒ 闸不误拒，正常走到 insert（闸不许把正当请求一起挡掉）；
 *  ③ 五个目标列**现读必须是 uuid**（前置对账：防将来有人把列换成 varchar/text，
 *     那时 z.uuid() 就成了误拒 —— 这正是 G-624 在共享 idParamSchema 上踩过的坑）。
 *
 * 判据归属（照 `utils/uuid.ts` 的立论）：本出口答"这串会不会让 uuid 列抛 22P02"，
 * `z.uuid()` 答"这串是不是语义合法的 uuid"，后者**更严**（校验版本位/变体位）。
 * 这里选 `z.uuid()`：与同仓 117 处路由惯例一致，且这五处都已是"每字段都有校验"的 schema，
 * 在该层加严不构成"把别人的宽判据换窄"。
 *
 * 测试隔离铁律（AGENTS §5）：全程不连生产 PostgreSQL / Redis —— db 层整体桩掉。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mocks } = vi.hoisted(() => ({
  mocks: {
    dbInsert: vi.fn(),
    dbSelect: vi.fn(),
    dbUpdate: vi.fn(),
    dbExecute: vi.fn(),
    verifyAccessToken: vi.fn(),
    getUserStatus: vi.fn(),
    checkAnyPermission: vi.fn(),
  },
}))

vi.mock('jose', () => ({
  // requireAdmin 经 resolveAdminRoleId 读 request.jwtPayload.roleId，
  // 必须是 >= ADMIN_ROLE_ID(=1) 才放行，否则一律 403、请求根本到不了 body 校验。
  decodeJwt: () => ({ userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', roleId: 1 }),
}))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: mocks.getUserStatus,
}))
// 鉴权层整体桩掉：本文件只验"形状闸在进 SQL 之前"，不验 RBAC。
// 注意签名要同时吃两种调用形态：requireAdmin 走 authenticate(request)，
// 而作为 preHandler 注册时走 (request, reply, done)。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (...args: unknown[]) => {
    const request = args[0] as { jwtPayload?: unknown } | undefined
    if (request && !request.jwtPayload) {
      request.jwtPayload = { userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', roleId: 1 }
    }
    const done = args[2] as (() => void) | undefined
    if (typeof done === 'function') done()
  }),
  requireActiveUser: vi.fn(async () => true),
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../src/db/rbac-queries.js', () => ({
  checkAnyPermission: mocks.checkAnyPermission,
}))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(result).then(resolve),
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'onConflictDoUpdate',
      'leftJoin',
      'groupBy',
      'for',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  return {
    db: {
      execute: mocks.dbExecute,
      select: mocks.dbSelect,
      insert: mocks.dbInsert,
      update: mocks.dbUpdate,
      delete: vi.fn(() => createChain()),
    },
    dbRead: {
      select: vi.fn(() => createChain()),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

import { adminInvoicesRoutes } from '../src/routes/admin-invoices'
import { adminAuthEduRoutes } from '../src/routes/admin-auth-edu-routes'
import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

/** RFC 4122 v4：版本位=4、变体位=8，`z.uuid()` 收。 */
const VALID_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

/** 畸形输入矩阵：任务书要求的四类。 */
const MALFORMED = [
  { label: 'not-a-uuid', value: 'not-a-uuid' },
  { label: '空串', value: '' },
  { label: '超长(300 字符)', value: 'a'.repeat(300) },
  { label: '含 SQL 元字符', value: "'; DROP TABLE users;--" },
  { label: "uuid 形状但非法 hex('zz')", value: 'zzzzzzzz-4f89-41d3-9a0c-0305e82c3301' },
  { label: '纯数字(前导零丢失型)', value: '42' },
  { label: '带空白的合法 uuid', value: ` ${VALID_UUID} ` },
]

let invoicesApp: FastifyInstance
let authEduApp: FastifyInstance
let miniAppApp: FastifyInstance

/**
 * 镜像 `src/server.ts:145` 的 `errorHandler` 的**状态码判定**那一段。
 *
 * 为什么必须镜像而不是随手写:⑤ 那条路由用的是裸 `.parse()`(不是 `parseOrThrow`),
 * 抛的是 `ZodError` 而非 `AppError` —— 它没有 `statusCode`,只有靠全局 handler
 * 那条 `error.name === 'ZodError'` 特判才落到 400。若这里自己写一个"看 statusCode
 * 否则 500"的桩,⑤ 会被误判成"闸没修好",而线上其实是好的 —— 那就是测试在撒谎。
 * 只抄状态码判定这一段(1:1 对应 server.ts:151-157),不抄中文化/日志分支。
 */
const errorHandler = (error: any, _request: unknown, reply: any) => {
  if (reply.sent) return
  const isZodErr = error?.name === 'ZodError' && Array.isArray(error?.issues)
  const statusCode = isZodErr
    ? 400
    : error?.statusCode >= 400 && error?.statusCode < 600
      ? error.statusCode
      : 500
  const zodMsg = error?.issues?.[0]?.message
  reply.status(statusCode).send({
    code: statusCode,
    errorCode: isZodErr ? 'VALIDATION_FAILED' : undefined,
    message: isZodErr ? (zodMsg ?? '参数错误') : statusCode >= 500 ? '服务器错误' : error?.message,
  })
}

beforeAll(async () => {
  mocks.verifyAccessToken.mockResolvedValue({ userId: VALID_UUID, roleId: 1 })
  mocks.getUserStatus.mockResolvedValue(1)
  mocks.checkAnyPermission.mockResolvedValue(true)
  mocks.dbExecute.mockResolvedValue([{ id: 'mock-id' }])

  invoicesApp = Fastify({ logger: false })
  invoicesApp.setErrorHandler(errorHandler)
  await invoicesApp.register(adminInvoicesRoutes, { prefix: '/api/admin' })
  await invoicesApp.ready()

  authEduApp = Fastify({ logger: false })
  authEduApp.setErrorHandler(errorHandler)
  await authEduApp.register(adminAuthEduRoutes, { prefix: '/api/admin' })
  await authEduApp.ready()

  miniAppApp = Fastify({ logger: false })
  miniAppApp.setErrorHandler(errorHandler)
  await miniAppApp.register(miniappCompatRoutes, { prefix: '/api' })
  await miniAppApp.ready()
})

afterAll(async () => {
  await invoicesApp?.close()
  await authEduApp?.close()
  await miniAppApp?.close()
})

beforeEach(() => {
  mocks.dbInsert.mockClear()
  mocks.dbSelect.mockClear()
  mocks.dbUpdate.mockClear()
})

/** 五个缺陷点的路由表：URL + 一个"其余字段都合规"的请求体。 */
const TARGETS = [
  {
    name: '① POST /invoices/titles → edu_invoice_titles.user_id',
    app: () => invoicesApp,
    url: '/api/admin/invoices/titles',
    key: 'userId',
    body: (bad: string) => ({ userId: bad, title: '张三' }),
  },
  {
    name: '② POST /auth-find-info → user_auth_info.user_uuid',
    app: () => authEduApp,
    url: '/api/admin/auth-find-info',
    key: 'userUuid',
    body: (bad: string) => ({ userUuid: bad }),
  },
  {
    name: '③ POST /auth-user-margin → user_margins.user_id(主键)',
    app: () => authEduApp,
    url: '/api/admin/auth-user-margin',
    key: 'userUuid',
    body: (bad: string) => ({ userUuid: bad, tokenQuantity: 1 }),
  },
  {
    name: '④ POST /edu/classes/schedules → lesson_chapters.lesson_id',
    app: () => authEduApp,
    url: '/api/admin/edu/classes/schedules',
    key: 'classId',
    body: (bad: string) => ({ classId: bad, title: '第 1 节' }),
  },
  {
    name: '⑤ POST /agents/charge → zhs_agent_buy.agent_id(NOT NULL)',
    app: () => miniAppApp,
    url: '/api/agents/charge',
    key: 'agentId',
    body: (bad: string) => ({ agentId: bad, price: 1 }),
  },
] as const

describe('G-536/G-431 畸形 uuid 直喂 uuid 列 ⇒ 400 而非 500，且闸在进 SQL 之前', () => {
  it.each(TARGETS)('$name', async (t) => {
    for (const { label, value } of MALFORMED) {
      mocks.dbInsert.mockClear()
      const res = await t.app().inject({
        method: 'POST',
        url: t.url,
        headers: AUTH_HEADERS,
        payload: t.body(value) as never,
      })
      expect(res.statusCode, `${t.key} = ${label} ⇒ 期望 400,实得 ${res.statusCode}`).toBe(400)
      // 关键不变量①：形状闸必须先于 SQL 触发，否则"回 400"也可能来自 DB 之后的兜底。
      expect(mocks.dbInsert, `${t.key} = ${label} ⇒ 闸未拦住,SQL 已被调用`).not.toHaveBeenCalled()
    }
  })
})

describe('反向对照 —— 闸不得把正当请求一起挡掉', () => {
  it.each(TARGETS)('$name ⇒ 合法 uuid 照常进 insert', async (t) => {
    mocks.dbInsert.mockClear()
    mocks.dbInsert.mockReturnValue((() => {
      const chain: Record<string, unknown> = {}
      const methods = ['from', 'where', 'values', 'returning', 'onConflictDoUpdate', 'limit']
      for (const m of methods) chain[m] = () => chain
      chain.then = (resolve: (v: unknown[]) => unknown) => Promise.resolve([{ id: 'mock-id' }]).then(resolve)
      return chain
    })())
    const res = await t.app().inject({
      method: 'POST',
      url: t.url,
      headers: AUTH_HEADERS,
      payload: t.body(VALID_UUID) as never,
    })
    expect(mocks.dbInsert, `${t.key} = 合法 uuid ⇒ 闸误拒了正当请求`).toHaveBeenCalled()
    expect(res.statusCode).not.toBe(400)
  })
})

describe('③ 前置对账 —— 五个目标列现读必须仍是 uuid 类型', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const REPO = join(HERE, '..', '..', '..')

  const COLUMN_OWNERS: Array<{ file: string; sym: string; col: string; label: string }> = [
    { file: 'packages/database/src/schema/order.ts', sym: 'eduInvoiceTitles', col: 'userId', label: 'edu_invoice_titles.user_id' },
    { file: 'packages/database/src/schema/user-auth-info.ts', sym: 'userAuthInfo', col: 'userUuid', label: 'user_auth_info.user_uuid' },
    { file: 'packages/database/src/schema/wallet.ts', sym: 'userMargins', col: 'userId', label: 'user_margins.user_id' },
    { file: 'packages/database/src/schema/learn.ts', sym: 'lessonChapters', col: 'lessonId', label: 'lesson_chapters.lesson_id' },
    { file: 'packages/database/src/schema/agent-commerce.ts', sym: 'zhsAgentBuy', col: 'agentId', label: 'zhs_agent_buy.agent_id' },
  ]

  it.each(COLUMN_OWNERS)('$label 仍是 uuid(否则 z.uuid() 会变成误拒)', ({ file, sym, col }) => {
    const src = readFileSync(join(REPO, file), 'utf8')
    const i = src.search(new RegExp(`export const ${sym}\\s*=\\s*pgTable\\(`))
    expect(i, `${sym} 在 ${file} 里找不到 pgTable 定义（表/符号改名了？）`).toBeGreaterThan(-1)
    const win = src.slice(i, i + 1200)
    const re = new RegExp(`\\b${col}\\s*:\\s*uuid\\(`)
    expect(re.test(win), `${sym}.${col} 已不是 uuid 列 —— z.uuid() 会误拒合法请求，请连带回退本处校验`).toBe(true)
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‍‌‌‌‍‌‍‍‌‍‌‌‍‍‌‍‌‌‌‍‍‌‌‌‍‍‍‌‍‌‍‌‌‌‍‌‌‍‌‌‌‍‍‌‌‍‌‌‌‍‌‌‍‌‌‌‌‍‌‍‍‍‍‌‌‌‌‍‍‍‌‍‍‌‌‍‍‍‍‍‍‍‌‍‌‌‍‍‌‍‍‌‌‍‍‍‍‍‌‌‍‌‍‍‌‌‌‌‍‍‌‌‍‍‍‍‍‍‍‍‍‍‌‌‍‍‌‍‍‍‍‍‌‌‍‍‌‍‍‍‍‍‍‍‍‌‍‍‍‌‌‍‍‍‍‍‌‍‍‍‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‍‌‌‌‍‍‍‍‍‍‌‍‍‍‍‍‌‌‍‍‌‍‌‌‌‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‌‌‍‍‍‍‍‍‍‍‍‍‍‍‍‍‍‌‌‌‌‌‍‍‍‍‍‍‍‍‍‍‍‍‍‍‌‌‍‍‍‍‍‍‍‍‍‍‌‍‍‍‍‍‍‍‍‌‌‍‍‍‍‍‍‍‌‍‍‍‍‍‍‍‌‍‍‍‍‌‍‍‍‌‌‍‍‍‍‍‍‌‍‍‍‍‍‍‌‌‍‍‍‍‍‍‍‌‌‌‍‍‍‍‍‌‍‍‍‍‍‌‍‍‍‍‍‌‍‍‍‍‍‌‌‌‌‌‍‍‌‍‌‍‍‌‌‍‍‍‍‍‍‌‌‍‍‍‌‌‍‍‌‍‍‍‍‌‌‌‍‌‌‍‌‍‌‌‍‍‍‍‍‌‍‍‌‌‍‍‌‌‌‍‍‌‍‍‌‍‍‍‍‍‍‌‍‍‌‌‍‍‍‍‍‍‌‌‍‍‍‍‌‌‌‍‍‍‍‍‍‍‍‍‌‍‍‍‍‍‍‍‍‍‍﻿‌‌‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
