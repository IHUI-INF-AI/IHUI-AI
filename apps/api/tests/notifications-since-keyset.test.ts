// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 通知断点续读的复合 keyset 谓词锁(零连接档:与 notifications-archive-partition.test.ts
// 同款链式假 db)。判的是"查询究竟长什么样",不是"函数跑没跑通":
// ① (createdAt,id) 双列同向 gt 必须真挂上,同刻靠 id 决胜(批量插入同刻是常态);
// ② since 模式从旧到新升序、offset=0,普通模式保持 desc + offset 逐字节不变;
// ③ 源码变异锁:把任一键位抹掉,本文件必须变红。
const state = vi.hoisted(() => ({
  wheres: [] as unknown[],
  orderBys: [] as unknown[][],
  offsets: [] as number[],
  rows: [] as unknown[],
  counts: [{ count: 0 }] as { count: number }[],
}))

vi.mock('../src/db/index.js', () => {
  function makeApi(kind: 'list' | 'count') {
    const api: Record<string, unknown> = {
      from: () => api,
      where: (w: unknown) => {
        state.wheres.push(w)
        return api
      },
      orderBy: (...columns: unknown[]) => {
        state.orderBys.push(columns)
        return api
      },
      limit: () => api,
      offset: (n: number) => {
        state.offsets.push(n)
        return api
      },
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(kind === 'count' ? state.counts : state.rows).then(res, rej),
    }
    return api
  }
  return {
    db: {
      select: (shape?: unknown) =>
        makeApi(shape && typeof shape === 'object' && 'count' in shape ? 'count' : 'list'),
    },
  }
})

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQLWrapper } from 'drizzle-orm'
import { findNotificationsByUser } from '../src/db/notification-queries.js'

const dialect = new PgDialect()

function sqlOf(w: unknown): string {
  const wrapper = w as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function')
    throw new Error('SQL 片段取不到 getSQL,判据失效方向必须是显式报错而不是静默通过')
  return dialect.sqlToQuery(wrapper.getSQL()).sql
}

const SINCE = { createdAt: new Date('2026-11-24T12:00:00.000Z'), id: 'n-watermark' }

beforeEach(() => {
  state.wheres.length = 0
  state.orderBys.length = 0
  state.offsets.length = 0
  state.rows = []
  state.counts = [{ count: 0 }]
})

describe('通知断点续读:复合 keyset 水位', () => {
  it('有水位 ⇒ where 真带 (created_at > ? OR (created_at = ? AND id > ?)),offset=0', async () => {
    await findNotificationsByUser('u-1', { page: 7, pageSize: 100, since: SINCE })
    const sql = sqlOf(state.wheres[0]).toLowerCase()
    expect(sql).toContain('"created_at" >')
    expect(sql).toContain('"created_at" =')
    expect(sql).toContain('"id" >')
    expect(sql).toContain('"user_id"')
    expect(state.offsets[0]).toBe(0)
  })

  it('无水位 ⇒ 谓词与分页逐字节保持旧语义(不带 keyset,page 仍走 offset)', async () => {
    await findNotificationsByUser('u-1', { page: 3, pageSize: 100 })
    const sql = sqlOf(state.wheres[0]).toLowerCase()
    expect(sql).not.toContain('"created_at" >')
    expect(sql).toContain('"archived_at" is null')
    expect(state.offsets[0]).toBe(200)
  })

  it('方向不可漂:since 双列升序,普通模式仍 createdAt 降序', async () => {
    await findNotificationsByUser('u-1', { page: 1, pageSize: 100, since: SINCE })
    const sinceOrder = state.orderBys[0].map((c) => sqlOf(c).toLowerCase()).join(' | ')
    expect(sinceOrder).toContain('asc')
    expect(sinceOrder).toContain('"created_at"')
    expect(sinceOrder).toContain('"id"')

    state.orderBys.length = 0
    await findNotificationsByUser('u-1', { page: 1, pageSize: 100 })
    const plainOrder = state.orderBys[0].map((c) => sqlOf(c).toLowerCase()).join(' | ')
    expect(plainOrder).toContain('desc')
    expect(plainOrder).not.toContain('asc')
  })

  it('变异锁:抹掉任一复合键位或升序锁,本测试即红', () => {
    const src = readFileSync(resolve(__dirname, '../src/db/notification-queries.ts'), 'utf8')
    const markers = [
      'gt(notifications.createdAt, createdAt)',
      'eq(notifications.createdAt, createdAt)',
      'gt(notifications.id, id)',
      'asc(notifications.createdAt), asc(notifications.id)',
    ]
    for (const marker of markers) expect(src).toContain(marker)
    const stripped = markers.reduce((text, marker) => text.split(marker).join(''), src)
    for (const marker of markers) expect(stripped).not.toContain(marker)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
