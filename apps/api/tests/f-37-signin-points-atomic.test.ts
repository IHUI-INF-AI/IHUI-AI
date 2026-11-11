// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-37 回归锁(2026-11-11):签到记录成功但积分流水写入失败被吞。
 *
 * HEAD 已修:签到记录与积分发放收敛到 `signInWithPoints` 的同一个 `db.transaction`,
 * 任一失败整体回滚;路由只在唯一冲突(并发双击)时转 409,其余异常直接上抛给
 * Fastify 返回 500 —— 不再出现「接口 2xx 但积分不到账」。
 *
 * 用例(mock db,不连真实库):
 *  1. 流水写入失败 → 签到一并回滚,接口 500,不返回成功;
 *  2. 成功路径 → 签到 + 流水各写一次,201 响应带 points,流水 referenceId 指向签到;
 *  3. 当日重复签到 → 409,不产生任何写入(幂等);
 *  4. 并发唯一冲突(23505)→ 回滚 + 409,连续天数/幂等语义不变。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

type Row = Record<string, unknown>

const { mockAuthenticate, state, counters, flags, tables } = vi.hoisted(() => {
  const makeTable = (name: string, cols: string[]): Row => {
    const t: Row = { __table: name }
    for (const c of cols) t[c] = c
    return t
  }
  return {
    mockAuthenticate: vi.fn(),
    state: {
      points: [] as Row[],
      signIns: [] as Row[],
      txs: [] as Row[],
      levels: [] as Row[],
    },
    counters: {
      signInInsert: 0,
      txInsert: 0,
      pointsUpdate: 0,
      transactions: 0,
      commits: 0,
      rollbacks: 0,
    },
    flags: { failPointTxInsert: false, failSignInUnique: false },
    tables: {
      userPoints: makeTable('userPoints', [
        'id',
        'userId',
        'points',
        'totalEarned',
        'totalSpent',
        'level',
        'experience',
        'updatedAt',
      ]),
      pointTransactions: makeTable('pointTransactions', [
        'id',
        'userId',
        'type',
        'source',
        'amount',
        'balanceAfter',
        'description',
        'referenceId',
        'createdAt',
      ]),
      signInRecords: makeTable('signInRecords', [
        'id',
        'userId',
        'signInDate',
        'consecutiveDays',
        'rewardPoints',
        'createdAt',
      ]),
      levels: makeTable('levels', [
        'id',
        'level',
        'name',
        'minExperience',
        'maxExperience',
        'icon',
        'benefits',
        'createdAt',
      ]),
      users: makeTable('users', ['id', 'nickname', 'avatar']),
    },
  }
})

vi.mock('@ihui/database', () => ({ ...tables }))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
}))

/**
 * 内存版 db:transaction 在草稿副本上执行,只有回调正常返回才提交;
 * 抛错即丢弃草稿(等价于真实事务 ROLLBACK)。
 */
vi.mock('../src/db/index.js', () => {
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-${++seq}`

  interface Store {
    points: Row[]
    signIns: Row[]
    txs: Row[]
  }

  const tableName = (table: unknown) => String((table as { __table?: string }).__table ?? '')

  function rowsFor(table: unknown, store: Store): Row[] {
    switch (tableName(table)) {
      case 'userPoints':
        return store.points
      case 'signInRecords':
        return store.signIns
      case 'pointTransactions':
        return store.txs
      case 'levels':
        return state.levels
      default:
        return []
    }
  }

  /** 从 drizzle 的 sql 模板片段里取增量(如 points + 10 的 10)。 */
  function amountOf(setVals: Row): number {
    for (const key of ['points', 'totalEarned', 'experience']) {
      const chunks = (setVals[key] as { queryChunks?: unknown[] } | undefined)?.queryChunks
      if (!Array.isArray(chunks)) continue
      for (const chunk of chunks) {
        if (typeof chunk === 'number') return chunk
      }
    }
    return 0
  }

  function buildClient(store: Store): Row {
    return {
      select: () => ({
        from: (table: unknown) => {
          const rows = rowsFor(table, store)
          return {
            where: () =>
              Object.assign(Promise.resolve(rows.slice()), {
                limit: async (n: number) => rows.slice(0, n),
              }),
            orderBy: async () => rows.slice(),
          }
        },
      }),
      insert: (table: unknown) => ({
        values: (vals: Row) => ({
          returning: async () => {
            const name = tableName(table)
            if (name === 'signInRecords') {
              counters.signInInsert += 1
              if (flags.failSignInUnique) {
                throw Object.assign(new Error('duplicate key value violates unique constraint'), {
                  code: '23505',
                })
              }
              const row: Row = { id: nextId('signin'), ...vals, createdAt: new Date() }
              store.signIns.push(row)
              return [row]
            }
            if (name === 'pointTransactions') {
              if (flags.failPointTxInsert) throw new Error('point_transactions insert failed')
              counters.txInsert += 1
              const row: Row = { id: nextId('tx'), ...vals, createdAt: new Date() }
              store.txs.push(row)
              return [row]
            }
            if (name === 'userPoints') {
              const row: Row = {
                id: nextId('points'),
                points: 0,
                totalEarned: 0,
                totalSpent: 0,
                level: 1,
                experience: 0,
                updatedAt: new Date(),
                ...vals,
              }
              store.points.push(row)
              return [row]
            }
            return []
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (vals: Row) => ({
          where: () => ({
            returning: async () => {
              if (tableName(table) !== 'userPoints') return []
              counters.pointsUpdate += 1
              const base = store.points[0]
              const amount = amountOf(vals)
              const next: Row = {
                id: base?.id ?? nextId('points'),
                userId: base?.userId,
                points: Number(base?.points ?? 0) + amount,
                totalEarned: Number(base?.totalEarned ?? 0) + amount,
                totalSpent: Number(base?.totalSpent ?? 0),
                level: 1,
                experience: Number(base?.experience ?? 0) + amount,
                updatedAt: new Date(),
              }
              store.points = [next]
              return [next]
            },
          }),
        }),
      }),
    }
  }

  const db: Row = {
    ...buildClient(state as unknown as Store),
    transaction: async (cb: (tx: Row) => Promise<unknown>) => {
      counters.transactions += 1
      const draft: Store = {
        points: state.points.map((r) => ({ ...r })),
        signIns: state.signIns.map((r) => ({ ...r })),
        txs: state.txs.map((r) => ({ ...r })),
      }
      try {
        const result = await cb(buildClient(draft))
        state.points = draft.points
        state.signIns = draft.signIns
        state.txs = draft.txs
        counters.commits += 1
        return result
      } catch (e) {
        counters.rollbacks += 1
        throw e
      }
    },
  }

  return { db, dbRead: db, dbClient: {} }
})

import { gamificationRoutes } from '../src/routes/gamification'
import { todayString } from '../src/utils/checkin-helpers.js'

const USER_ID = '00000000-0000-4000-8000-0000000000f37'

interface SignInResponse {
  code: number
  message: string
  data: {
    record: { id: string; consecutiveDays: number; rewardPoints: number }
    points: { points: number; experience: number }
  }
}

function seedPoints() {
  state.points = [
    {
      id: 'points-1',
      userId: USER_ID,
      points: 0,
      totalEarned: 0,
      totalSpent: 0,
      level: 1,
      experience: 0,
      updatedAt: new Date(),
    },
  ]
}

describe('F-37 签到与积分流水原子性', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    await server.register(gamificationRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    state.points = []
    state.signIns = []
    state.txs = []
    for (const k of Object.keys(counters) as (keyof typeof counters)[]) counters[k] = 0
    flags.failPointTxInsert = false
    flags.failSignInUnique = false
  })

  it('积分流水写入失败 → 签到整体回滚,接口 500,不返回成功', async () => {
    seedPoints()
    flags.failPointTxInsert = true

    const res = await server.inject({ method: 'POST', url: '/api/sign-in' })

    expect(res.statusCode).toBe(500)
    // 事务内确实先写了签到,随后流水失败 → 已提交状态里没有任何残留
    expect(counters.signInInsert).toBe(1)
    expect(state.signIns).toHaveLength(0)
    expect(state.txs).toHaveLength(0)
    expect(counters.transactions).toBe(1)
    expect(counters.commits).toBe(0)
    expect(counters.rollbacks).toBe(1)
  })

  it('成功路径 → 签到与流水各写一次,201 返回 points', async () => {
    seedPoints()

    const res = await server.inject({ method: 'POST', url: '/api/sign-in' })
    const body = res.json() as SignInResponse

    expect(res.statusCode).toBe(201)
    expect(body.code).toBe(0)
    expect(counters.transactions).toBe(1)
    expect(counters.signInInsert).toBe(1)
    expect(counters.txInsert).toBe(1)
    expect(state.signIns).toHaveLength(1)
    expect(state.txs).toHaveLength(1)

    // 首签:连续 1 天,奖励 10 分;积分入账与签到在同一事务内提交
    expect(body.data.record.consecutiveDays).toBe(1)
    expect(body.data.record.rewardPoints).toBe(10)
    expect(body.data.points.points).toBe(10)
    expect(state.txs[0]!.type).toBe('earn')
    expect(state.txs[0]!.source).toBe('signin')
    expect(state.txs[0]!.amount).toBe(10)
    expect(state.txs[0]!.referenceId).toBe(state.signIns[0]!.id)
  })

  it('当日重复签到 → 409 且零写入(幂等)', async () => {
    seedPoints()
    state.signIns = [
      {
        id: 'signin-existing',
        userId: USER_ID,
        signInDate: todayString(),
        consecutiveDays: 3,
        rewardPoints: 20,
        createdAt: new Date(),
      },
    ]

    const res = await server.inject({ method: 'POST', url: '/api/sign-in' })

    expect(res.statusCode).toBe(409)
    expect((res.json() as { message: string }).message).toBe('今日已签到')
    expect(counters.transactions).toBe(0)
    expect(counters.signInInsert).toBe(0)
    expect(counters.txInsert).toBe(0)
    expect(state.signIns).toHaveLength(1)
    expect(state.txs).toHaveLength(0)
  })

  it('并发双击命中唯一约束(23505)→ 回滚 + 409,不重复发积分', async () => {
    seedPoints()
    flags.failSignInUnique = true

    const res = await server.inject({ method: 'POST', url: '/api/sign-in' })

    expect(res.statusCode).toBe(409)
    expect(counters.transactions).toBe(1)
    expect(counters.rollbacks).toBe(1)
    expect(counters.commits).toBe(0)
    expect(counters.txInsert).toBe(0)
    expect(state.signIns).toHaveLength(0)
    expect(state.txs).toHaveLength(0)
    expect(state.points[0]!.points).toBe(0)
  })
})
