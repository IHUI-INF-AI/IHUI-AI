// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-19 回归(2026-11-08): /files/search 必须有上限。
 * 改前必红口径(按行断言): 造 60 条可见文件,
 *  - limit=20 仍返回 60 条(旧代码完全忽略 limit);
 *  - 不带 limit 也返回 60 条(旧代码无默认上限)。
 */
import { describe, it, expect, vi } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

const rows = vi.hoisted(() =>
  Array.from({ length: 150 }, (_, i) => ({
    id: `f-${String(i + 1).padStart(3, '0')}`,
    name: `批量文件-${i + 1}.pdf`,
    uploaded_by: 'u1',
    user_id: 'u1',
    project_id: 'p1',
    deleted_at: null as Date | null,
    deleted_by: null as string | null,
    created_at: new Date(2026, 10, 8, 10, 0, i),
    mime_type: 'application/pdf',
    size: 1024,
    path: `/uploads/f-${i + 1}`,
  })),
)

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  const { tagOps } = await import('./fake-drizzle-rows.js')
  return { ...actual, ...tagOps }
})

vi.mock('../workspace-queries.js', () => ({
  findProjectById: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../index.js', async () => {
  const { createFakeDb } = await import('./fake-drizzle-rows.js')
  const built = createFakeDb({ files: rows, projects: [], users: [] })
  return { db: built.db, dbRead: built.dbRead }
})

import { searchFiles } from '../file-queries.js'

describe('F-19 文件搜索必须有上限', () => {
  it('传 limit=20 时只返回 20 条', async () => {
    const list = await searchFiles({ userId: 'u1', limit: 20 })
    expect(list).toHaveLength(20)
  })

  it('不传 limit 时按默认上限 50 返回', async () => {
    const list = await searchFiles({ userId: 'u1' })
    expect(list).toHaveLength(50)
  })

  it('limit 超过 100 时被钳制在 100', async () => {
    const list = await searchFiles({ userId: 'u1', limit: 500 })
    expect(list).toHaveLength(100)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
