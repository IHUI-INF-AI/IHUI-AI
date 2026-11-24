// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  performAction: vi.fn(),
  assertAccountForUser: vi.fn(),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { performAction: mocks.performAction },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))

import { fetchMoments } from '../wechat-hub/operations'

describe('fetchMoments', () => {
  it('把桥返回的朋友圈归一化，并将页数夹到 30', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [
          {
            id: 'sns-1',
            authorName: '张三',
            content: '今天下雪了',
            mediaUrls: ['https://cdn.example.com/a.jpg'],
            createdAt: 1_760_000_000,
            source: 'ocr',
            page: 1,
          },
        ],
        fetched: 1,
        pages: 3,
        source: 'ocr',
        partial: true,
      },
      reason: 'OCR 只读可见页',
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 100 })

    expect(mocks.performAction).toHaveBeenCalledWith('user-1', 'account-1', 'moment.fetch', {
      maxPages: 30,
      id: 0,
    })
    expect(result).toMatchObject({
      fetched: 1,
      pages: 3,
      source: 'ocr',
      partial: true,
      reason: 'OCR 只读可见页',
    })
    expect(result.moments[0]).toMatchObject({
      id: 'sns-1',
      authorName: '张三',
      content: '今天下雪了',
      mediaUrls: ['https://cdn.example.com/a.jpg'],
      createdAt: 1_760_000_000,
      source: 'ocr',
      page: 1,
    })
  })

  it('桥不支持时返回 0 条和真实原因，不伪造动态', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: false,
      status: 'unsupported',
      data: {},
      reason: '当前后端不支持该动作',
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 2 })

    expect(result.moments).toEqual([])
    expect(result.fetched).toBe(0)
    expect(result.reason).toBe('当前后端不支持该动作')
    expect(result.result.status).toBe('unsupported')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
