// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 归档读取层：数据库 metadata 里的本地媒体目录/落盘标记必须还原到 API 视图，
 * 缺省时不能凭空补出 mediaLocalDir 或 mediaDownloaded。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/index.js', () => ({
  dbRead: { select: vi.fn() },
  db: { insert: vi.fn() },
}))

import { dbRead } from '../../db/index.js'
import { listMomentsArchive } from '../wechat-hub/moments-store'

function row(metadata: Record<string, unknown>) {
  return {
    id: 'row-1',
    momentKey: 'sns-1',
    authorId: 'wxid_a',
    authorName: '张三',
    authorResolved: true,
    content: '周末聚餐',
    mediaUrls: ['https://example.com/a.jpg'],
    createdAt: 1_760_000_000,
    source: 'db',
    firstSeenAt: new Date('2026-11-25T00:00:00.000Z'),
    lastSeenAt: new Date('2026-11-25T01:00:00.000Z'),
    seenCount: 2,
    page: null,
    metadata,
  }
}

function mockSelect(rows: unknown[]) {
  const limit = vi.fn(async () => rows)
  const orderBy = vi.fn(() => ({ limit }))
  const where = vi.fn(() => ({ orderBy }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  vi.mocked(dbRead.select).mockImplementation(select as never)
}

beforeEach(() => {
  vi.mocked(dbRead.select).mockReset()
})

describe('朋友圈归档读取层媒体字段', () => {
  it('还原 mediaLocalDir / mediaDownloaded', async () => {
    mockSelect([
      row({
        mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\m-1',
        mediaDownloaded: true,
      }),
    ])
    const items = await listMomentsArchive('account-1', 50)
    expect(items[0]?.momentKey).toBe('sns-1')
    expect(items[0]?.mediaLocalDir).toBe('C:\\caches\\temp\\wechat-db-media\\m-1')
    expect(items[0]?.mediaDownloaded).toBe(true)
  })

  it('metadata 缺省时不补媒体字段', async () => {
    mockSelect([row({})])
    const items = await listMomentsArchive('account-1', 50)
    expect(items[0]?.mediaLocalDir).toBeUndefined()
    expect(items[0]?.mediaDownloaded).toBeUndefined()
  })
})
