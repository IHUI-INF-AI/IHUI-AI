// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈归档查询（2026-11-25）：
 *  - 库可用 ⇒ storage='database'，reason 为 null；
 *  - 库不可用 ⇒ 降级桥，storage='bridge'，reason 写明 DB 原因；
 *  - 库与桥都不可用 ⇒ storage='none'、total 0，reason 双侧说明，绝不抛 500 伪装成功。
 * 单测不连库：moments-store 整层 mock，manager 只透传 readMomentArchive。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readMomentArchive: vi.fn(),
  assertAccountForUser: vi.fn(),
  listMomentsArchive: vi.fn(),
  countMomentsArchive: vi.fn(),
  upsertMoments: vi.fn(),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { readMomentArchive: mocks.readMomentArchive },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))
vi.mock('../wechat-hub/moments-store.js', () => ({
  listMomentsArchive: mocks.listMomentsArchive,
  countMomentsArchive: mocks.countMomentsArchive,
  upsertMoments: mocks.upsertMoments,
}))

import { listMomentArchive } from '../wechat-hub/operations'

const DB_ROWS = [
  {
    id: 'row-1',
    authorId: 'wxid-1',
    authorName: '张三',
    authorResolved: true,
    content: '库内第一条',
    mediaUrls: ['https://cdn.example.com/a.jpg'],
    createdAt: 1_760_000_000,
    source: 'ocr',
    firstSeenAt: '2026-11-25T01:00:00.000Z',
    lastSeenAt: '2026-11-25T02:00:00.000Z',
    seenCount: 3,
    page: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAccountForUser.mockResolvedValue(undefined)
})

describe('listMomentArchive', () => {
  it('库可用时读库，storage=database 且 reason 为 null', async () => {
    mocks.listMomentsArchive.mockResolvedValue(DB_ROWS)
    mocks.countMomentsArchive.mockResolvedValue(7)

    const result = await listMomentArchive('user-1', 'account-1', { limit: 50 })

    expect(result.storage).toBe('database')
    expect(result.total).toBe(7)
    expect(result.limit).toBe(50)
    expect(result.reason).toBeNull()
    expect(result.moments).toEqual(DB_ROWS)
    expect(mocks.readMomentArchive).not.toHaveBeenCalled()
  })

  it('库不可用时降级读桥，storage=bridge 且 reason 写明 DB 原因', async () => {
    mocks.listMomentsArchive.mockRejectedValue(new Error('connect ECONNREFUSED 8810'))
    mocks.countMomentsArchive.mockRejectedValue(new Error('connect ECONNREFUSED 8810'))
    mocks.readMomentArchive.mockResolvedValue({
      ok: true,
      total: 2,
      moments: [
        {
          id: 'bridge-1',
          authorId: 'wxid-2',
          authorName: '李四',
          authorResolved: false,
          content: '桥里第一条',
          mediaUrls: [],
          mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\bridge-1',
          mediaDownloaded: true,
          createdAt: 1_760_000_100,
          source: 'wcfhttp',
          lastSeenAt: '2026-11-25T03:00:00.000Z',
          seenCount: 1,
        },
      ],
      reason: null,
    })

    const result = await listMomentArchive('user-1', 'account-1', { limit: 20 })

    expect(result.storage).toBe('bridge')
    expect(result.total).toBe(2)
    expect(result.limit).toBe(20)
    expect(result.reason).toContain('ECONNREFUSED 8810')
    expect(result.moments[0]).toMatchObject({
      id: 'bridge-1',
      authorName: '李四',
      content: '桥里第一条',
      mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\bridge-1',
      mediaDownloaded: true,
    })
  })

  it('库与桥都不可用时 storage=none、total 0，reason 双侧说明', async () => {
    mocks.listMomentsArchive.mockRejectedValue(new Error('db down'))
    mocks.countMomentsArchive.mockRejectedValue(new Error('db down'))
    mocks.readMomentArchive.mockResolvedValue({
      ok: false,
      total: 0,
      moments: [],
      reason: 'HTTP 500: bridge boom',
    })

    const result = await listMomentArchive('user-1', 'account-1', { limit: 50 })

    expect(result.storage).toBe('none')
    expect(result.total).toBe(0)
    expect(result.moments).toEqual([])
    expect(result.reason).toContain('db down')
    expect(result.reason).toContain('HTTP 500: bridge boom')
  })

  it('limit 缺省走服务层默认 50', async () => {
    mocks.listMomentsArchive.mockResolvedValue([])
    mocks.countMomentsArchive.mockResolvedValue(0)

    const result = await listMomentArchive('user-1', 'account-1', {})

    expect(result.limit).toBe(50)
    expect(result.storage).toBe('database')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
