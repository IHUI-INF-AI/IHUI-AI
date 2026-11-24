// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-175 回归锁:技能同步 upsert 必须是「唯一索引 + ON CONFLICT」的原子写,
 * 不能是「先查后插/先查后更」。
 *
 * 假库按目标 DDL 建模(唯一键 = (author_id, slug)):
 *  - INSERT 命中已存在键且没有 onConflictDoUpdate ⇒ 抛唯一冲突(等价 PG 23505);
 *  - onConflictDoUpdate ⇒ 原子合并到同一行(等价 PG 的 ON CONFLICT DO UPDATE);
 *  - 同内容 hash 的重复 push 走 unchanged 快路径,不写库。
 *
 * 并发用 Promise.all 真并发:两个调用都先读到空表,再各自尝试写入 ——
 * 旧实现会双插出两行(或撞唯一索引抛错),新实现只落一行。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

interface FakeSkillRow {
  id: string
  authorId: string
  slug: string
  name: string
  description: string | null
  content: string | null
  contentHash: string | null
  isPublished: boolean
  lastSyncedAt: Date | null
  syncSource: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const state = vi.hoisted(() => ({
  rows: [] as FakeSkillRow[],
  inserts: 0,
  upserts: 0,
  selects: 0,
  capturedTargets: [] as unknown[],
  capturedSets: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => {
  const findRow = (authorId: string, slug: string) =>
    state.rows.find((row) => row.authorId === authorId && row.slug === slug)

  const selectBuilder = () => {
    let key: { authorId: string; slug: string } | null = null
    let idKey: string | null = null
    let onlyLive = false
    const snapshot = () => {
      if (idKey !== null) {
        const row = state.rows.find((r) => r.id === idKey)
        if (!row) return []
        return onlyLive && row.deletedAt !== null ? [] : [{ ...row }]
      }
      const row = key ? findRow(key.authorId, key.slug) : undefined
      return row ? [{ ...row }] : []
    }
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'orderBy', 'offset']) b[m] = () => b
    b.where = (where: unknown) => {
      const q = new PgDialect().sqlToQuery(where as never)
      // 写后回读面 = where(id) + isNull(deletedAt):只有 1 个参数时按 id 命中
      if (q.params.length === 1) {
        idKey = String(q.params[0])
        onlyLive = /deleted_at.*is null/i.test(q.sql)
      } else if (q.params.length >= 2) {
        key = { authorId: String(q.params[0]), slug: String(q.params[1]) }
        idKey = null
        onlyLive = false
      }
      return b
    }
    b.limit = () => {
      state.selects++
      return Promise.resolve(snapshot())
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(snapshot()).then(res, rej)
    return b
  }

  const insertBuilder = () => {
    let values: Record<string, unknown> = {}
    let conflict: { target: unknown; set: Record<string, unknown> } | null = null
    const b: Record<string, unknown> = {
      values: (v: Record<string, unknown>) => {
        values = v
        return b
      },
      onConflictDoUpdate: (cfg: { target: unknown; set: Record<string, unknown> }) => {
        conflict = cfg
        state.capturedTargets.push(cfg.target)
        state.capturedSets.push(cfg.set)
        return b
      },
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            const key = { authorId: String(values.authorId), slug: String(values.slug) }
            const existing = findRow(key.authorId, key.slug)
            if (existing && !conflict) {
              // 等价 PG:duplicate key value violates unique constraint "skills_author_slug_uniq"
              throw new Error(
                'duplicate key value violates unique constraint "skills_author_slug_uniq"',
              )
            }
            if (existing && conflict) {
              state.upserts++
              // SQL DO UPDATE 只覆盖 set 列:未列出的 isPublished/authorId/slug 保持不变
              Object.assign(existing, conflict.set)
              return [{ ...existing, inserted: false }]
            }
            state.inserts++
            const now = new Date()
            const row: FakeSkillRow = {
              id: `00000000-0000-4000-8000-${String(state.rows.length + 1).padStart(12, '0')}`,
              authorId: key.authorId,
              slug: key.slug,
              name: String(values.name ?? ''),
              description: (values.description as string | null | undefined) ?? null,
              content: (values.content as string | null | undefined) ?? null,
              contentHash: (values.contentHash as string | null | undefined) ?? null,
              isPublished: Boolean(values.isPublished ?? false),
              lastSyncedAt: (values.lastSyncedAt as Date | undefined) ?? null,
              syncSource: (values.syncSource as string | undefined) ?? null,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            }
            state.rows.push(row)
            return [{ ...row, inserted: true }]
          })
          .then(res, rej),
    }
    return b
  }

  return {
    db: {
      select: () => selectBuilder(),
      insert: () => insertBuilder(),
      update: () => selectBuilder(),
      delete: () => selectBuilder(),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

import { upsertSkillBySlug } from '../src/db/skills-queries.js'

const AUTHOR = '7f0f3f2a-1c4b-4a8e-9d21-0a3b5c7e9f01'

beforeEach(() => {
  state.rows.length = 0
  state.inserts = 0
  state.upserts = 0
  state.selects = 0
  state.capturedTargets.length = 0
  state.capturedSets.length = 0
})

describe('F-175 并发两次 push 同一 slug', () => {
  it('空表两条并发 ⇒ 只落一行(旧实现双插/撞唯一冲突)', async () => {
    const results = await Promise.all([
      upsertSkillBySlug({
        slug: 'same-slug',
        name: '设备A',
        content: 'A',
        contentHash: 'hash-a',
        authorId: AUTHOR,
      }),
      upsertSkillBySlug({
        slug: 'same-slug',
        name: '设备B',
        content: 'B',
        contentHash: 'hash-b',
        authorId: AUTHOR,
      }),
    ])

    expect(state.rows).toHaveLength(1)
    expect(state.inserts).toBe(1)
    expect(state.upserts).toBe(1)
    // 两次调用返回同一行 id
    expect(new Set(results.map((r) => r.skill.id)).size).toBe(1)
    expect(results.map((r) => r.action).sort()).toEqual(['created', 'updated'])
  })
})

describe('F-175 不同 slug 正常', () => {
  it('两条并发不同 slug ⇒ 各落一行,互不抢占', async () => {
    const results = await Promise.all([
      upsertSkillBySlug({
        slug: 'slug-a',
        name: 'A',
        content: 'A',
        contentHash: 'hash-a',
        authorId: AUTHOR,
      }),
      upsertSkillBySlug({
        slug: 'slug-b',
        name: 'B',
        content: 'B',
        contentHash: 'hash-b',
        authorId: AUTHOR,
      }),
    ])

    expect(state.rows).toHaveLength(2)
    expect(state.inserts).toBe(2)
    expect(state.upserts).toBe(0)
    expect(results.map((r) => r.action)).toEqual(['created', 'created'])
  })
})

describe('F-175 幂等与复活', () => {
  it('同 contentHash 重复 push ⇒ unchanged,不写库', async () => {
    state.rows.push({
      id: 'row-1',
      authorId: AUTHOR,
      slug: 'slug-a',
      name: 'A',
      description: null,
      content: 'A',
      contentHash: 'hash-a',
      isPublished: false,
      lastSyncedAt: new Date('2026-01-01'),
      syncSource: 'cli',
      deletedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })

    const r = await upsertSkillBySlug({
      slug: 'slug-a',
      name: 'A',
      content: 'A',
      contentHash: 'hash-a',
      authorId: AUTHOR,
    })

    expect(r.action).toBe('unchanged')
    expect(state.inserts).toBe(0)
    expect(state.upserts).toBe(0)
  })

  it('软删行内容变更 ⇒ 原子复活(deletedAt=null)', async () => {
    state.rows.push({
      id: 'row-1',
      authorId: AUTHOR,
      slug: 'slug-a',
      name: 'A',
      description: null,
      content: 'old',
      contentHash: 'hash-old',
      isPublished: true,
      lastSyncedAt: new Date('2026-01-01'),
      syncSource: 'cli',
      deletedAt: new Date('2026-02-01'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })

    const r = await upsertSkillBySlug({
      slug: 'slug-a',
      name: 'A2',
      content: 'new',
      contentHash: 'hash-new',
      authorId: AUTHOR,
    })

    expect(r.action).toBe('updated')
    expect(r.skill.deletedAt).toBeNull()
    expect(state.rows[0]?.deletedAt).toBeNull()
    // UPDATE 集合不含 isPublished ⇒ 发布状态不被同步覆盖
    expect(state.rows[0]?.isPublished).toBe(true)
  })
})

describe('F-175 SQL 形态', () => {
  it('冲突目标是 (author_id, slug),忽略输入自带的 id/authorId 回写', async () => {
    await upsertSkillBySlug({
      slug: 'slug-a',
      name: 'A',
      content: 'A',
      contentHash: 'hash-a',
      authorId: AUTHOR,
    })

    const target = state.capturedTargets[0] as Array<{ name: string }>
    expect(target.map((c) => c.name)).toEqual(['author_id', 'slug'])
    const set = state.capturedSets[0] as Record<string, unknown>
    expect(set.deletedAt).toBeNull()
    expect(set).not.toHaveProperty('id')
    expect(set).not.toHaveProperty('authorId')
    expect(set).not.toHaveProperty('slug')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
