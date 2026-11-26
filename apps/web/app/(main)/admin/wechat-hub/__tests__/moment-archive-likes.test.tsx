// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归档面板：点赞昵称去重后展示名单与超额人数，评论超 2 条用「共 N 条」提示完整条数。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MomentArchivePanel from '../MomentArchivePanel'
import { wechatHubApi } from '../wechat-hub-api'

vi.mock('../wechat-hub-api', () => ({
  wechatHubApi: {
    fetchMomentArchive: vi.fn(),
  },
}))

vi.mock('../MomentLocalMedia', () => ({
  default: () => null,
}))

const baseItem = {
  authorId: 'wxid_a',
  authorName: '张三',
  authorResolved: true,
  content: '周末聚餐',
  mediaUrls: [],
  createdAt: 1_760_000_000_000,
  source: 'db',
  firstSeenAt: '2026-11-25T00:00:00.000Z',
  lastSeenAt: '2026-11-25T01:00:00.000Z',
  seenCount: 1,
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MomentArchivePanel accountId="account-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(wechatHubApi.fetchMomentArchive).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('MomentArchivePanel 点赞去重与评论计数', () => {
  it('点赞按昵称去重后展示名单，评论超 2 条显示共 N 条', async () => {
    vi.mocked(wechatHubApi.fetchMomentArchive).mockResolvedValue({
      storage: 'database',
      total: 1,
      limit: 50,
      offset: 0,
      reason: null,
      moments: [
        {
          ...baseItem,
          id: 'row-1',
          momentKey: 'sns-1',
          likeUsers: ['阿花', '阿花', ' 大强 ', '大强', '', 'wxid_c'],
          commentsData: [
            { commentId: 'c1', nickname: '阿花', content: '第一条' },
            { commentId: 'c2', nickname: '大强', content: '第二条' },
            { commentId: 'c3', nickname: '小强', content: '第三条' },
          ],
        },
      ],
    })

    renderPanel()

    await waitFor(() =>
      expect(
        screen.getByText('被抓到 1 次 · 点赞 3 人：阿花、大强、wxid_c · 评论 3 条'),
      ).toBeTruthy(),
    )
    expect(screen.getByText('阿花：第一条')).toBeTruthy()
    expect(screen.getByText('大强：第二条')).toBeTruthy()
    expect(screen.getByText('共 3 条')).toBeTruthy()
  })

  it('点赞超过 6 人时只列 6 个，等 N 人用去重后总人数', async () => {
    const names = ['用户一', '用户二', '用户三', '用户四', '用户五', '用户六', '用户七']
    vi.mocked(wechatHubApi.fetchMomentArchive).mockResolvedValue({
      storage: 'database',
      total: 1,
      limit: 50,
      offset: 0,
      reason: null,
      moments: [
        {
          ...baseItem,
          id: 'row-2',
          momentKey: 'sns-2',
          likeUsers: [...names, '用户一'],
        },
      ],
    })

    renderPanel()

    await waitFor(() =>
      expect(
        screen.getByText(
          '被抓到 1 次 · 点赞 7 人：用户一、用户二、用户三、用户四、用户五、用户六 等 7 人',
        ),
      ).toBeTruthy(),
    )
  })
})
