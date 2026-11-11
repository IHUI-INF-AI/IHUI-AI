// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-68 回归:直播礼物扣款必须落在钱包主账本 user_margins.token_quantity,
// 并同事务写 token_flows;孤儿表 user_token_balance 不得再被 UPDATE/INSERT。
//
// 改前:POST /live-gifts/:id/send 读/扣 user_token_balance(全仓无入账写入点,余额恒 0),
// 钱包有余额的用户永远「余额不足」,且不产生 token_flows。
// 本用例同时锁源码形状(防止孤儿表写入回潮)与运行时落点(表名/流水条数/扣款次数)。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE = readFileSync(
  fileURLToPath(new URL('../src/routes/live-gifts.ts', import.meta.url)),
  'utf8',
)

/** 去掉注释,只留可执行代码 —— 注释里允许出现 user_token_balance 的历史说明。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CODE = stripComments(SOURCE)

type WriteEntry = {
  op: 'update' | 'insert'
  table: string
  values: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
  writes: [] as WriteEntry[],
  wallet: 0,
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
          mocks.writes.push({ op: 'update', table: String(table), values })
          if (table !== 'userMargins') return [values]
          const vals = (values.tokenQuantity as { vals?: unknown[] } | undefined)?.vals ?? []
          const amount = Number(vals.find((v) => typeof v === 'number') ?? 0)
          if (mocks.wallet < amount) return []
          mocks.wallet -= amount
          return [{ balance: mocks.wallet }]
        },
      }),
    }),
  }),
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      mocks.writes.push({ op: 'insert', table: String(table), values })
      return { returning: async () => [{ id: 'gift-1', ...values }] }
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

const SEND = handlers.get('POST /live-gifts/:id/send')!

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

beforeEach(() => {
  mocks.wallet = 100
  mocks.writes.length = 0
  mocks.execute.mockClear()
})

describe('F-68 源码形状:孤儿表 user_token_balance 禁止写入', () => {
  it('去掉注释后全文不再出现 user_token_balance', () => {
    expect(CODE).not.toMatch(/user_token_balance/i)
    expect(CODE).not.toMatch(/userTokenBalance/)
  })

  it('不存在以孤儿表为目标的 UPDATE/INSERT', () => {
    const writeTargets = [...CODE.matchAll(/\.(?:update|insert)\(\s*([A-Za-z_$][\w$]*)/g)].map(
      (m) => m[1],
    )
    expect(writeTargets).not.toContain('userTokenBalance')
    expect(CODE).not.toMatch(/\.(?:update|insert)\(\s*['"`]user_token_balance/i)
  })

  it('扣款走 userMargins、入账流水走 tokenFlows(opType=1)', () => {
    expect(CODE).toMatch(/\.update\(userMargins\)/)
    expect(CODE).toMatch(/\.insert\(tokenFlows\)/)
    expect(CODE).toMatch(/opType:\s*1/)
  })
})

describe('F-68 运行时:扣款落钱包主账本', () => {
  it('单次送礼只扣一次 userMargins 并写一条 token_flows', async () => {
    const reply = makeReply()
    await SEND({ userId: 'u1', params: { id: '1' }, body: { quantity: 1, liveId: 9 } }, reply)

    expect(reply.statusCode).toBe(200)
    expect(mocks.wallet).toBe(90)
    const updates = mocks.writes.filter((w) => w.op === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0]?.table).toBe('userMargins')
    const flows = mocks.writes.filter((w) => w.op === 'insert' && w.table === 'tokenFlows')
    expect(flows).toHaveLength(1)
    expect(flows[0]?.values).toMatchObject({
      userId: 'u1',
      opType: 1,
      quantity: 10,
      balanceAfter: 90,
    })
    expect(mocks.writes.some((w) => w.table === 'user_token_balance')).toBe(false)
  })

  it('余额不足:400 拒绝,不扣款、不写礼物记录、不写流水', async () => {
    mocks.wallet = 5
    const reply = makeReply()
    await SEND({ userId: 'u1', params: { id: '1' }, body: { quantity: 1, liveId: 9 } }, reply)

    expect(reply.statusCode).toBe(400)
    expect(mocks.wallet).toBe(5)
    const inserts = mocks.writes.filter((w) => w.op === 'insert')
    expect(inserts).toHaveLength(0)
    expect(mocks.writes.some((w) => w.table === 'user_token_balance')).toBe(false)
  })

  it('按 price × quantity 一次性扣足,不重复扣款', async () => {
    const reply = makeReply()
    await SEND({ userId: 'u2', params: { id: '1' }, body: { quantity: 3, liveId: 9 } }, reply)

    expect(reply.statusCode).toBe(200)
    expect(mocks.wallet).toBe(70)
    expect(mocks.writes.filter((w) => w.op === 'update')).toHaveLength(1)
    const flows = mocks.writes.filter((w) => w.table === 'tokenFlows')
    expect(flows).toHaveLength(1)
    expect(flows[0]?.values).toMatchObject({ quantity: 30, balanceAfter: 70 })
  })
})
