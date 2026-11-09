// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-199 回归锁(2026-11-08)。
 *
 * 缺陷:GET /live-gifts/records 未挂认证,匿名可分页读取全站打赏流水。
 * 判据:未登录 → 401 且不查库;登录 → 两条查询都带 userId=本人 的过滤。
 */
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}))

const whereArgs: unknown[] = []

function makeChain(rows: unknown[]) {
  const q: Record<string, unknown> = {
    from: () => q,
    leftJoin: () => q,
    orderBy: () => q,
    limit: () => q,
    offset: () => q,
    where: (cond: unknown) => {
      whereArgs.push(cond)
      return q
    },
    then: (resolve: (v: unknown) => void) => resolve(rows),
  }
  return q
}

vi.mock('../src/db/index.js', () => ({
  db: { execute: mocks.execute, select: mocks.select },
  dbRead: { select: mocks.select, execute: mocks.execute },
}))
vi.mock('@ihui/database', () => ({
  liveGift: { userId: 'liveGift.userId' },
  liveGiftCatalog: {},
  users: { id: 'users.id', nickname: 'users.nickname' },
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordLiveGiftIncome: vi.fn(),
}))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray) => ({ sql: strings.join('') }), {
    raw: (s: string) => s,
  }),
  and: (...xs: unknown[]) => ({ op: 'and', xs }),
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  desc: () => ({ op: 'desc' }),
}))

import { liveGiftsRoutes } from '../src/routes/live-gifts.js'

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const server = {
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  put: (p: string, ...a: unknown[]) => handlers.set(`PUT ${p}`, a[a.length - 1] as Handler),
  patch: (p: string, ...a: unknown[]) => handlers.set(`PATCH ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
  log: { error: vi.fn() },
}

mocks.execute.mockResolvedValue({})
mocks.select.mockImplementation((fields: Record<string, unknown>) =>
  makeChain('count' in fields ? [{ count: 0 }] : []),
)
await liveGiftsRoutes(server as never, {} as never)

function makeReply() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

describe('F-199 打赏流水匿名读', () => {
  it('未登录 → 401 且不查库', async () => {
    whereArgs.length = 0
    mocks.select.mockClear()
    const reply = makeReply()
    await handlers.get('GET /live-gifts/records')!({ query: {} }, reply)
    expect(reply.statusCode).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('登录用户只查本人记录(userId 过滤落到两条查询)', async () => {
    whereArgs.length = 0
    mocks.select.mockClear()
    const reply = makeReply()
    await handlers.get('GET /live-gifts/records')!({ userId: 'u1', query: {} }, reply)
    expect(reply.statusCode).toBe(200)
    expect(whereArgs).toHaveLength(2)
    for (const cond of whereArgs) {
      expect(cond).toMatchObject({ op: 'eq', col: 'liveGift.userId', val: 'u1' })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
