// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-68 夹具:送礼物必须扣钱包主账本 user_margins.token_quantity,并写 token_flows。
//
// 改前:余额读/扣都走孤儿表 user_token_balance(全仓无入账写入点,余额恒 0),
// 钱包里有 100 的用户送礼会被判「余额不足」,且不产生任何 token_flows。
// 改后:条件 UPDATE user_margins(够才扣)+ live_gift + token_flows(opType=1)同一事务。

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
}))

const store = vi.hoisted(() => ({
  wallet: 0,
  giftFlows: [] as Array<Record<string, unknown>>,
}))

function makeChain(rows: unknown[]) {
  const q: Record<string, unknown> = {
    from: () => q,
    leftJoin: () => q,
    orderBy: () => q,
    limit: () => Promise.resolve(rows),
    offset: () => q,
    where: () => q,
    then: (resolve: (v: unknown) => void) => resolve(rows),
  }
  return q
}

const TX = {
  update: (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => ({
        returning: async () => {
          if (table !== 'userMargins') return [values]
          const vals = (values.tokenQuantity as { vals?: unknown[] } | undefined)?.vals ?? []
          const amount = Number(vals.find((v) => typeof v === 'number') ?? 0)
          if (store.wallet < amount) return []
          store.wallet -= amount
          return [{ balance: store.wallet }]
        },
      }),
    }),
  }),
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      if (table === 'tokenFlows') store.giftFlows.push(values)
      return {
        returning: async () => [{ id: 'gift-1', ...values }],
      }
    },
  }),
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mocks.select,
    execute: mocks.execute,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
  },
  dbRead: { select: mocks.select, execute: mocks.execute },
}))

vi.mock('@ihui/database', () => ({
  liveGift: 'liveGift',
  liveGiftCatalog: 'liveGiftCatalog',
  users: { id: 'users.id', nickname: 'users.nickname' },
  userMargins: 'userMargins',
  tokenFlows: 'tokenFlows',
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock('../src/plugins/business-metrics.js', () => ({ recordLiveGiftIncome: vi.fn() }))

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join('?'), vals }),
    { raw: (s: string) => s },
  ),
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
  log: { error: vi.fn(), warn: vi.fn() },
}

mocks.execute.mockResolvedValue({})
mocks.select.mockImplementation((fields?: Record<string, unknown>) =>
  makeChain(
    fields && 'nickname' in fields
      ? [{ nickname: '送礼人' }]
      : [{ id: 1, name: '火箭', price: 10, status: 1 }],
  ),
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

const SEND = handlers.get('POST /live-gifts/:id/send')!

beforeEach(() => {
  store.wallet = 100
  store.giftFlows.length = 0
  mocks.execute.mockClear()
})

describe('F-68 礼物统一到钱包主账本', () => {
  it('钱包 100 的用户送礼成功:扣 user_margins 并写 token_flows(opType=1)', async () => {
    const reply = makeReply()
    await SEND({ userId: 'u1', params: { id: '1' }, body: { quantity: 1, liveId: 9 } }, reply)

    expect(reply.statusCode).toBe(200)
    expect(store.wallet).toBe(90)
    expect(store.giftFlows).toHaveLength(1)
    expect(store.giftFlows[0]).toMatchObject({
      userId: 'u1',
      opType: 1,
      quantity: 10,
      balanceAfter: 90,
    })
    // 改前余额读 user_token_balance(恒 0)⇒ 400 余额不足,本断言红。
    // 且改前根本不写 token_flows ⇒ giftFlows 为空,第二条也红。
  })

  it('余额不足时 400 且不写 token_flows', async () => {
    store.wallet = 5
    const reply = makeReply()
    await SEND({ userId: 'u1', params: { id: '1' }, body: { quantity: 1, liveId: 9 } }, reply)

    expect(reply.statusCode).toBe(400)
    expect(store.giftFlows).toHaveLength(0)
    expect(store.wallet).toBe(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
