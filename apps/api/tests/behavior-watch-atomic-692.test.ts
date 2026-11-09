// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-692 回归锁:观看时长必须是「单条原子增量」,不能是「SELECT 快照 → 应用层相加 → 写回」。
 *
 * 假库按行为表真实唯一键 behavior_watch_records_user_topic_unique 建模:
 *  - INSERT 撞已存在键且没有 onConflictDoUpdate ⇒ 抛唯一冲突(等价 PG 报错,旧实现并发首写直接 500);
 *  - onConflictDoUpdate ⇒ 原子合并,时长按本次增量累加(等价 excluded.watch_duration 语义);
 *  - UPDATE ⇒ 用 set 里的绝对新值覆盖(旧实现的「旧值 + 增量」在并发下会互相覆盖)。
 *
 * 并发用 Promise.all 真并发(不是顺序调两次),两个调用都在对方落库前完成读/写意图。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

interface FakeRow {
  id: string
  watchDuration: number
  lastPosition: number
  topicTitle: string | null
}

const state = vi.hoisted(() => ({
  row: null as FakeRow | null,
  selects: 0,
  inserts: 0,
  updates: 0,
  upserts: 0,
  capturedTargets: [] as unknown[],
  capturedSets: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => {
  const execInsert = (values: Record<string, unknown>, set: Record<string, unknown> | null) => {
    state.inserts++
    const existed = state.row !== null
    if (existed && !set) {
      // 等价 PG:duplicate key value violates unique constraint
      throw new Error(
        'duplicate key value violates unique constraint "behavior_watch_records_user_topic_unique"',
      )
    }
    if (existed && state.row) {
      state.upserts++
      state.row.watchDuration += Number(values.watchDuration ?? 0)
      state.row.lastPosition = Number(values.lastPosition ?? 0)
      if (values.topicTitle !== undefined) state.row.topicTitle = values.topicTitle as string
      return [{ id: state.row.id, inserted: false }]
    }
    state.row = {
      id: '00000000-0000-4000-8000-000000000001',
      watchDuration: Number(values.watchDuration ?? 0),
      lastPosition: Number(values.lastPosition ?? 0),
      topicTitle: (values.topicTitle as string | undefined) ?? null,
    }
    return [{ id: state.row.id, inserted: true }]
  }

  const selectBuilder = () => {
    // 快照在调用时固定:并发两个请求都会读到同一份旧值(复现丢增量/首写冲突)
    const snapshot = state.row ? [{ ...state.row }] : []
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'offset']) b[m] = () => b
    b.limit = () => {
      state.selects++
      return Promise.resolve(snapshot)
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(snapshot).then(res, rej)
    return b
  }

  const insertBuilder = () => {
    let values: Record<string, unknown> = {}
    let set: Record<string, unknown> | null = null
    const b: Record<string, unknown> = {
      values: (v: Record<string, unknown>) => {
        values = v
        return b
      },
      onConflictDoUpdate: (cfg: { target: unknown; set: Record<string, unknown> }) => {
        set = cfg.set
        state.capturedTargets.push(cfg.target)
        state.capturedSets.push(cfg.set)
        return b
      },
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => execInsert(values, set)).then(res, rej),
    }
    return b
  }

  const updateBuilder = () => {
    let set: Record<string, unknown> = {}
    const b: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        set = v
        return b
      },
      where: () => b,
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            state.updates++
            state.capturedSets.push(set)
            if (!state.row) throw new Error('no row')
            state.row.watchDuration = Number(set.watchDuration)
            state.row.lastPosition = Number(set.lastPosition ?? state.row.lastPosition)
            if (set.topicTitle !== undefined) state.row.topicTitle = set.topicTitle as string
            return [{ id: state.row.id }]
          })
          .then(res, rej),
    }
    return b
  }

  return {
    db: {
      select: () => selectBuilder(),
      insert: () => insertBuilder(),
      update: () => updateBuilder(),
      delete: () => selectBuilder(),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

import { recordWatch } from '../src/db/behavior-queries.js'

const KEY = {
  userId: '00000000-0000-4000-8000-0000000000aa',
  topicId: 'lesson-692',
  topicType: 'lesson',
}

beforeEach(() => {
  state.row = null
  state.selects = 0
  state.inserts = 0
  state.updates = 0
  state.upserts = 0
  state.capturedTargets.length = 0
  state.capturedSets.length = 0
})

describe('F-692 并发首写:唯一冲突被 upsert 吃掉', () => {
  it('空表两条并发各 +10 ⇒ 都成功且终值 20(旧实现第二条抛唯一冲突)', async () => {
    const results = await Promise.all([
      recordWatch({ ...KEY, watchDuration: 10 }),
      recordWatch({ ...KEY, watchDuration: 10 }),
    ])

    expect(results).toHaveLength(2)
    expect(state.row?.watchDuration).toBe(20)
    // 第一次插入、第二次命中冲突走 upsert
    expect(state.inserts).toBe(2)
    expect(state.upserts).toBe(1)
  })
})

describe('F-692 并发丢增量', () => {
  it('已有行 0,两条并发各 +10 ⇒ 终值 20(旧实现都读 0 各写 10,终值 10)', async () => {
    state.row = { id: 'row-692', watchDuration: 0, lastPosition: 0, topicTitle: null }

    await Promise.all([
      recordWatch({ ...KEY, watchDuration: 10 }),
      recordWatch({ ...KEY, watchDuration: 10 }),
    ])

    expect(state.row?.watchDuration).toBe(20)
    // 新实现不再有「先读」
    expect(state.selects).toBe(0)
    expect(state.updates).toBe(0)
  })
})

describe('F-692 重放', () => {
  it('同一目标顺序重放 3×10 ⇒ 累计 30 且始终只有一行', async () => {
    for (let i = 0; i < 3; i++) {
      await recordWatch({ ...KEY, watchDuration: 10 })
    }
    expect(state.row?.watchDuration).toBe(30)
    expect(state.upserts).toBe(2)
    expect(state.inserts).toBe(3)
  })

  it('SQL 形态:无 SELECT、冲突目标三列、增量引用 excluded.watch_duration', async () => {
    await recordWatch({ ...KEY, watchDuration: 12, lastPosition: 30 })

    expect(state.selects).toBe(0)
    const target = state.capturedTargets[0] as Array<{ name: string }>
    expect(target.map((c) => c.name)).toEqual(['user_id', 'topic_id', 'topic_type'])

    const set = state.capturedSets[0] as Record<string, unknown>
    const rendered = new PgDialect().sqlToQuery(set.watchDuration as never)
    expect(rendered.sql).toMatch(/"behavior_watch_records"\."watch_duration"/)
    expect(rendered.sql).toMatch(/excluded\.watch_duration/)
    // 不能是把「算好的新值」当参数写回
    expect(rendered.params).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
