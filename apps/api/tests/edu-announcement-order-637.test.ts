// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { buildAnnouncementListQuery } from '../src/db/message-queries.js'

// drizzle 0.45 的 SQL 片段没有 toSQL():统一交给 PgDialect 渲染成真 SQL + 参数。
const dialect = new PgDialect()

const render = (expr: unknown): { sql: string; params: unknown[] } => {
  const q = dialect.sqlToQuery(expr as never)
  return {
    sql: q.sql.replace(/"/g, '').replace(/\s+/g, ' ').trim().toLowerCase(),
    params: q.params as unknown[],
  }
}

const NOW = new Date('2026-11-08T00:00:00.000Z')
const BASE = { page: 1, pageSize: 20 }

// 修复前的排序列(仅 isTop desc, id desc):用于确保本次断言真的钉住了 sort/publishTime。
const LEGACY_ORDER = ['edu_announcements.is_top desc', 'edu_announcements.id desc']

describe('F-637 教育公告列表排序与定时发布可见性', () => {
  it('a) 对外模式 where 含 publishTime 为 null 或 <= now 的条件', () => {
    const { conditions } = buildAnnouncementListQuery({ ...BASE, publishedOnly: true }, NOW)
    const rendered = conditions.map(render)

    expect(rendered.some((r) => r.sql.includes('is_published'))).toBe(true)
    expect(rendered.some((r) => r.sql.includes('status'))).toBe(true)
    // (publish_time is null or publish_time <= $n)
    const publishWindow = rendered.find((r) => r.sql.includes('publish_time is null'))
    expect(publishWindow).toBeDefined()
    expect(publishWindow?.sql).toContain('publish_time <=')
    expect(publishWindow?.params.some((p) => String(p).includes('2026-11-08T00:00:00.000Z'))).toBe(
      true,
    )
  })

  it('b) orderBy 依次为 isTop desc / sort asc / publishTime desc / id desc', () => {
    const { orderBy } = buildAnnouncementListQuery({ ...BASE, publishedOnly: true }, NOW)
    const rendered = orderBy.map((expr) => render(expr).sql)

    expect(rendered).toHaveLength(4)
    expect(rendered).toEqual([
      'edu_announcements.is_top desc',
      'edu_announcements.sort asc',
      'edu_announcements.publish_time desc',
      'edu_announcements.id desc',
    ])
    // 旧实现(仅 is_top desc, id desc)必须被判红
    expect(rendered).not.toEqual(LEGACY_ORDER)
  })

  it('c) 后台模式不含 publishTime 上界过滤，排序与对外一致', () => {
    const { conditions, orderBy } = buildAnnouncementListQuery(
      { ...BASE, publishedOnly: false, isPublished: false },
      NOW,
    )
    const rendered = conditions.map(render)

    expect(rendered.some((r) => r.sql.includes('is_published'))).toBe(true)
    // 后台需要看到未来公告:不得出现 publish_time 的任何上界/空值过滤
    expect(rendered.some((r) => r.sql.includes('publish_time'))).toBe(false)
    expect(
      rendered.some((r) => r.params.some((p) => String(p).includes('2026-11-08T00:00:00.000Z'))),
    ).toBe(false)

    expect(orderBy.map((expr) => render(expr).sql)).toEqual([
      'edu_announcements.is_top desc',
      'edu_announcements.sort asc',
      'edu_announcements.publish_time desc',
      'edu_announcements.id desc',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
