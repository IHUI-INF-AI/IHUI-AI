// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: F-18 回归夹具。

/**
 * F-18 回归(2026-11-08):回收站(deleted_at 非空)的文件不得出现在
 * /files/search 列表、/files/recent 列表与全局搜索的文件结果里。
 *
 * 改前必红口径(按行断言,不看状态码):
 *  - f-recycled 这条 deleted_at 已置位的记录被 searchFiles/findRecentFiles/globalSearch 返回;
 *  - 旧代码结果集为 ['f-recycled','f-visible'],期望只有 ['f-visible']。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

const fixture = vi.hoisted(() => {
  const visible = {
    id: 'f-visible',
    name: '季度报告.pdf',
    uploaded_by: 'u1',
    user_id: 'u1',
    project_id: 'p1',
    deleted_at: null as Date | null,
    deleted_by: null as string | null,
    created_at: new Date('2026-11-08T10:00:00.000Z'),
    mime_type: 'application/pdf',
    size: 1024,
    path: '/uploads/f-visible',
  }
  const recycled = {
    ...visible,
    id: 'f-recycled',
    name: '季度报告-旧版.pdf',
    deleted_at: new Date('2026-11-08T09:00:00.000Z'),
    deleted_by: 'u1',
    created_at: new Date('2026-11-08T11:00:00.000Z'),
  }
  const foreign = {
    ...visible,
    id: 'f-foreign',
    uploaded_by: 'u2',
    user_id: 'u2',
  }
  return { visible, recycled, foreign }
})

const fake = vi.hoisted(() => ({ mod: undefined as unknown }))

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
  const { visible, recycled, foreign } = fixture
  const built = createFakeDb({ files: [visible, recycled, foreign], projects: [], users: [] })
  fake.mod = built
  return { db: built.db, dbRead: built.dbRead }
})

import { searchFiles, findRecentFiles } from '../file-queries.js'
import { globalSearch } from '../search-queries.js'

beforeEach(() => {
  vi.clearAllMocks()
})

const ids = (rows: Array<{ id: string }>): string[] => rows.map((r) => r.id).sort()

describe('F-18 回收站文件不得泄漏进搜索/最近列表', () => {
  it('searchFiles 只返回未删除的本人文件', async () => {
    const rows = await searchFiles({ userId: 'u1' })
    expect(ids(rows)).toEqual(['f-visible'])
  })

  it('findRecentFiles 只返回未删除的本人文件', async () => {
    const rows = await findRecentFiles('u1', 20)
    expect(ids(rows)).toEqual(['f-visible'])
  })

  it('globalSearch(type=file) 的文件结果不含回收站记录', async () => {
    const result = await globalSearch('u1', '报告', 'file', 20)
    expect(ids(result.files)).toEqual(['f-visible'])
  })
})
