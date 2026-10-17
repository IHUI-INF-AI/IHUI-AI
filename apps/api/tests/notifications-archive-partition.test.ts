// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

// D195 归档维度的谓词锁(零连接档:与 notification-topic.test.ts 同款链式假 db)。
// 这里判的是"这条 where 究竟长什么样",不是"函数跑没跑通":
// ① 分区谓词必须真的挂在 where 上(默认 active ⇒ is null;archived ⇒ is not null);
// ② 归属维 user_id 必须与 id 同时在场 —— 只按 id 更新就是拿别人的通知做状态迁移;
// ③ 归档写入用 COALESCE 保首次时刻(重复隐藏不得把时间刷成新值),恢复写 null;
// ④ 未读计数必须只数未归档(红点与 active 分区同源,否则隐藏后角标仍亮)。
const state = vi.hoisted(() => ({
  wheres: [] as unknown[],
  sets: [] as Record<string, unknown>[],
  rows: [] as unknown[],
  counts: [{ count: 0 }] as { count: number }[],
}))

vi.mock('../src/db/index.js', () => {
  function makeApi(kind: 'list' | 'count' | 'update') {
    const api: Record<string, unknown> = {
      from: () => api,
      orderBy: () => api,
      limit: () => api,
      offset: () => api,
      where: (w: unknown) => {
        state.wheres.push(w)
        return api
      },
      set: (v: Record<string, unknown>) => {
        state.sets.push(v)
        return api
      },
      returning: () => Promise.resolve(state.rows),
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(kind === 'count' ? state.counts : state.rows).then(res, rej),
    }
    return api
  }
  return {
    db: {
      select: (shape?: unknown) =>
        makeApi(shape && typeof shape === 'object' && 'count' in shape ? 'count' : 'list'),
      update: () => makeApi('update'),
    },
  }
})

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQLWrapper } from 'drizzle-orm'
import {
  archiveNotification,
  countUnread,
  findNotificationsByUser,
  restoreNotification,
} from '../src/db/notification-queries.js'

// drizzle 0.45 的 SQL 片段没有 toSQL(),渲染口径只有一条:交给 PgDialect。
const dialect = new PgDialect()

function sqlOf(w: unknown): string {
  const wrapper = w as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function')
    throw new Error('where 片段取不到 getSQL,判据失效方向必须是显式报错而不是静默通过')
  return dialect.sqlToQuery(wrapper.getSQL()).sql
}

beforeEach(() => {
  state.wheres.length = 0
  state.sets.length = 0
  state.rows = []
  state.counts = [{ count: 0 }]
})

describe('D195 notification-queries 分区与归属谓词', () => {
  it('缺省分区即 active:list 的两条 where(取行 + 计数)都挂 archived_at is null', async () => {
    await findNotificationsByUser('u-1', { page: 1, pageSize: 10 })
    expect(state.wheres.length).toBe(2)
    for (const w of state.wheres) {
      const sql = sqlOf(w)
      expect(sql).toContain('"archived_at" is null')
      expect(sql).toContain('"user_id"')
    }
  })

  it('archived 分区:谓词翻成 is not null(不是"少一个条件"那种放宽)', async () => {
    await findNotificationsByUser('u-1', { page: 1, pageSize: 10, partition: 'archived' })
    const sql = sqlOf(state.wheres[0])
    expect(sql).toContain('"archived_at" is not null')
    expect(sql).not.toContain('"archived_at" is null')
  })

  it('未读计数只数未归档未读', async () => {
    state.counts = [{ count: 3 }]
    expect(await countUnread('u-1')).toBe(3)
    const sql = sqlOf(state.wheres[0])
    expect(sql).toContain('"archived_at" is null')
    expect(sql).toContain('"is_read"')
    expect(sql).toContain('"user_id"')
  })

  it('归档:写 COALESCE 保首次时刻,where 同时钉 id 与 user_id,取回行才算成功', async () => {
    const row = { id: 'n-1', userId: 'u-1', archivedAt: new Date('2026-10-18T00:00:00Z') }
    state.rows = [row]
    expect(await archiveNotification('n-1', 'u-1')).toBe(row)
    const set = state.sets[0]
    const archivedAt = (set as { archivedAt: unknown }).archivedAt
    expect(archivedAt).toBeDefined()
    expect(sqlOf(archivedAt).toLowerCase()).toContain('coalesce')
    const sql = sqlOf(state.wheres[0])
    expect(sql).toContain('"id"')
    expect(sql).toContain('"user_id"')
  })

  it('恢复:archived_at 显式写 null(整列覆盖不得靠"不写字段"实现)', async () => {
    const row = { id: 'n-1', userId: 'u-1', archivedAt: null }
    state.rows = [row]
    expect(await restoreNotification('n-1', 'u-1')).toBe(row)
    expect(state.sets[0]).toEqual({ archivedAt: null })
    expect(sqlOf(state.wheres[0])).toContain('"user_id"')
  })

  it('阳性对照:归属不匹配时取回 0 行 ⇒ 返回 undefined,由路由层判 404(不得冒认成功)', async () => {
    state.rows = []
    expect(await archiveNotification('n-1', 'u-other')).toBeUndefined()
    expect(await restoreNotification('n-1', 'u-other')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
