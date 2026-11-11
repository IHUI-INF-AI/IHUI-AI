// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

// SDB-17：推荐写入曾是无冲突处理的裸 insert，第二次推荐同一 (user, content, strategy)
// 必然撞唯一键 → 接口 500；且重刷会把 clicked 覆盖回 false。
// 这里用内存表复刻「唯一键冲突即更新」的 upsert 语义，让上述回归在测试里可观察。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

type Cond =
  | { op: 'eq'; col: string; value: unknown }
  | { op: 'and'; conds: Cond[] }

type ContentRow = { id: string; title: string; views: number; likes: number }

type RecRow = {
  userId: string
  contentId: string
  strategy: string
  score: number
  reason: string[]
  clicked: boolean
  dismissed: boolean
  servedAt: Date
}

type RecInsert = Omit<RecRow, 'servedAt'>

const state = vi.hoisted(() => ({
  contentRows: [] as ContentRow[],
  rows: [] as RecRow[],
  insertValues: [] as RecInsert[],
  conflictTargets: [] as unknown[][],
  updateSets: [] as Array<Record<string, unknown>>,
  updateConds: [] as Cond[],
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return {
    ...actual,
    eq: (col: unknown, value: unknown): Cond => ({ op: 'eq', col: String(col), value }),
    and: (...conds: Cond[]): Cond => ({ op: 'and', conds }),
    desc: (value: unknown) => value,
    // sql 只用于生成 excluded.* 描述符，测试里据此把 upsert 的新值代入冲突行。
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      op: 'sql',
      text: strings.join('?'),
      values,
    }),
  }
})

vi.mock('@ihui/database', () => ({
  tourContent: {
    id: 'tourContent.id',
    title: 'tourContent.title',
    viewCount: 'tourContent.viewCount',
    likeCount: 'tourContent.likeCount',
    tags: 'tourContent.tags',
    status: 'tourContent.status',
    destination: 'tourContent.destination',
  },
  tourRecommendations: {
    userId: 'tourRecommendations.userId',
    contentId: 'tourRecommendations.contentId',
    strategy: 'tourRecommendations.strategy',
    score: 'tourRecommendations.score',
    reason: 'tourRecommendations.reason',
    servedAt: 'tourRecommendations.servedAt',
    clicked: 'tourRecommendations.clicked',
    dismissed: 'tourRecommendations.dismissed',
  },
}))

vi.mock('../src/db/index.js', () => {
  const selectBuilder = {
    from: () => selectBuilder,
    where: () => selectBuilder,
    orderBy: () => selectBuilder,
    groupBy: () => selectBuilder,
    limit: () => Promise.resolve(state.contentRows),
  }

  const db = {
    select: () => selectBuilder,
    insert: () => ({
      values: (values: RecInsert[]) => {
        state.insertValues.push(...values)
        return {
          onConflictDoUpdate: (opts: {
            target: unknown[]
            set: Record<string, unknown>
          }) => {
            state.conflictTargets.push(opts.target)
            state.updateSets.push(opts.set)
            upsert(values, opts.set)
            return Promise.resolve()
          },
        }
      },
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => ({
        where: (cond: Cond) => {
          state.updateConds.push(cond)
          for (const row of state.rows) {
            if (matches(cond, row)) Object.assign(row, payload)
          }
          return Promise.resolve()
        },
      }),
    }),
  }

  return { db, dbRead: {}, dbClient: {} }
})

import { markClicked, recommend } from '../src/services/tour/tour-recommendation.js'

/** 条件求值：列名取描述符末段映射到内存行字段。 */
function matches(cond: Cond, row: RecRow): boolean {
  if (cond.op === 'and') return cond.conds.every((c) => matches(c, row))
  const field = cond.col.split('.').at(-1) ?? ''
  return (row as Record<string, unknown>)[field] === cond.value
}

/** 把 excluded.score / excluded.reason 解析成本次推荐的新值。 */
function resolveSetValue(value: unknown, incoming: RecInsert): unknown {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'op' in value) {
    const text = (value as { text?: string }).text ?? ''
    const excluded = /excluded\.(\w+)/.exec(text)
    if (excluded) {
      const key = excluded[1]!.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
      return (incoming as unknown as Record<string, unknown>)[key]
    }
  }
  return value
}

/** 复刻唯一键 (user_id, content_id, strategy)：命中则更新，未命中才新增。 */
function upsert(values: RecInsert[], set: Record<string, unknown>): void {
  for (const incoming of values) {
    const existing = state.rows.find(
      (r) =>
        r.userId === incoming.userId &&
        r.contentId === incoming.contentId &&
        r.strategy === incoming.strategy,
    )
    if (!existing) {
      state.rows.push({ ...incoming, servedAt: new Date() })
      continue
    }
    for (const [key, value] of Object.entries(set)) {
      ;(existing as unknown as Record<string, unknown>)[key] = resolveSetValue(value, incoming)
    }
  }
}

function makeRow(overrides: Partial<RecRow> & Pick<RecRow, 'contentId' | 'strategy'>): RecRow {
  return {
    userId: 'u1',
    score: 0.5,
    reason: ['hot'],
    clicked: false,
    dismissed: false,
    servedAt: new Date(),
    ...overrides,
  }
}

describe('SDB-17 推荐写入幂等', () => {
  beforeEach(() => {
    state.contentRows = []
    state.rows = []
    state.insertValues = []
    state.conflictTargets = []
    state.updateSets = []
    state.updateConds = []
  })

  it('① 同一 (user, content, strategy) 连续两次推荐：不抛错且不新增行', async () => {
    state.contentRows = [{ id: 'c1', title: 'T1', views: 100, likes: 10 }]

    const first = await recommend({ userId: 'u1', strategy: 'hot' })
    expect(state.rows).toHaveLength(1)

    // 模拟首次落库后分数被后续数据改写，验证第二次推荐确实刷新了可刷新字段
    state.rows[0]!.score = 0.42
    const second = await recommend({ userId: 'u1', strategy: 'hot' })

    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]!.score).toBe(1)
    expect(second).toEqual(first)
    expect(state.conflictTargets).toHaveLength(2)
    expect(state.conflictTargets[0]).toEqual([
      'tourRecommendations.userId',
      'tourRecommendations.contentId',
      'tourRecommendations.strategy',
    ])
  })

  it('② 已点击行再次推荐：clicked 不被重置', async () => {
    state.contentRows = [{ id: 'c1', title: 'T1', views: 100, likes: 10 }]

    await recommend({ userId: 'u1', strategy: 'hot' })
    state.rows[0]!.clicked = true

    await recommend({ userId: 'u1', strategy: 'hot' })

    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]!.clicked).toBe(true)
    // upsert 的 set 只能刷新可变字段，不能把用户行为带回初值
    expect(state.updateSets[0]).not.toHaveProperty('clicked')
    expect(state.updateSets[0]).not.toHaveProperty('dismissed')
  })

  it('③ markClicked 后同内容不同策略行都置为 clicked', async () => {
    state.rows = [
      makeRow({ contentId: 'c1', strategy: 'hot' }),
      makeRow({ contentId: 'c1', strategy: 'nearby' }),
      makeRow({ contentId: 'c2', strategy: 'hot' }),
    ]

    await markClicked('u1', 'c1')

    expect(state.rows.find((r) => r.contentId === 'c1' && r.strategy === 'hot')!.clicked).toBe(true)
    expect(state.rows.find((r) => r.contentId === 'c1' && r.strategy === 'nearby')!.clicked).toBe(
      true,
    )
    expect(state.rows.find((r) => r.contentId === 'c2')!.clicked).toBe(false)
    // 更新条件只按 (user, content)，带 strategy 就会漏标其它策略行
    expect(JSON.stringify(state.updateConds)).not.toContain('strategy')
  })

  it('④ 首次推荐行为不变：返回结构一致且落库默认未点击/未忽略', async () => {
    state.contentRows = [{ id: 'c1', title: 'T1', views: 100, likes: 10 }]

    const list = await recommend({ userId: 'u1', strategy: 'hot' })

    expect(list).toEqual([
      { contentId: 'c1', score: 1, reason: ['hot'], strategy: 'hot' },
    ])
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]).toMatchObject({
      userId: 'u1',
      contentId: 'c1',
      strategy: 'hot',
      score: 1,
      reason: ['hot'],
      clicked: false,
      dismissed: false,
    })
  })
})
