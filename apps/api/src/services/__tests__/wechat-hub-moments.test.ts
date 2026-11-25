// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  performAction: vi.fn(),
  assertAccountForUser: vi.fn(),
  upsertMoments: vi.fn(),
  listMomentsArchive: vi.fn(),
  countMomentsArchive: vi.fn(),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { performAction: mocks.performAction },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))
vi.mock('../wechat-hub/moments-store.js', () => ({
  upsertMoments: mocks.upsertMoments,
  listMomentsArchive: mocks.listMomentsArchive,
  countMomentsArchive: mocks.countMomentsArchive,
}))

import { fetchMoments } from '../wechat-hub/operations'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.upsertMoments.mockResolvedValue({ added: 0, updated: 0, total: 0 })
})

describe('fetchMoments', () => {
  it('把桥返回的朋友圈归一化，并将页数夹到 30', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.upsertMoments.mockResolvedValue({ added: 1, updated: 0, total: 7 })
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
        archive: { added: 1, updated: 0, total: 7 },
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
      archive: { added: 1, updated: 0, total: 7 },
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
    expect(result.stopReason).toBe('unsupported')
  })

  it('透传桥上报的 stopReason、limitReached 与 occludedBy', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [
          {
            id: 'sns-9',
            authorName: '李四',
            content: '窗口被挡住了',
            mediaUrls: [],
            createdAt: null,
            source: 'ocr',
            page: 2,
          },
        ],
        fetched: 1,
        pages: 2,
        source: 'ocr',
        partial: true,
        stopReason: 'occluded',
        limitReached: false,
        occludedBy: '会议窗口',
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 3 })

    expect(result.stopReason).toBe('occluded')
    expect(result.limitReached).toBe(false)
    expect(result.occludedBy).toBe('会议窗口')
  })

  it('桥未报原因时，partial 且页数达到 maxPages 回退 page-limit', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [
          {
            id: 'sns-2',
            authorName: '王五',
            content: '滚动到上限',
            mediaUrls: [],
            createdAt: null,
            source: 'wcfhttp',
            page: 3,
          },
        ],
        fetched: 3,
        pages: 3,
        source: 'wcfhttp',
        partial: true,
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 3 })

    expect(result.stopReason).toBe('page-limit')
    expect(result.limitReached).toBe(true)
    expect(result.occludedBy).toBeNull()
  })

  it('桥未报原因且抓到 0 条时回退 no-content', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: { moments: [], fetched: 0, pages: 1, source: 'ocr', partial: false },
      reason: '页面无正文',
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 3 })

    expect(result.stopReason).toBe('no-content')
    expect(result.limitReached).toBe(false)
  })

  it('桥上报非法 stopReason 时归 null，不再套用枚举外取值', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [
          {
            id: 'sns-4',
            authorName: '赵六',
            content: '正常一条',
            mediaUrls: [],
            createdAt: null,
            source: 'ocr',
          },
        ],
        fetched: 1,
        pages: 1,
        source: 'ocr',
        partial: false,
        stopReason: 'bogus-reason',
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 3 })

    expect(result.stopReason).toBeNull()
    expect(result.limitReached).toBe(false)
  })

  it('归档写库失败只 warn，不影响本次抓取结果', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.upsertMoments.mockRejectedValue(new Error('connect ECONNREFUSED 8810'))
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [
          {
            id: 'sns-5',
            authorName: '孙七',
            content: '入库也不能挡抓取',
            mediaUrls: [],
            createdAt: null,
            source: 'ocr',
          },
        ],
        fetched: 1,
        pages: 1,
        source: 'ocr',
        partial: false,
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1', { maxPages: 3 })

    expect(result.moments).toHaveLength(1)
    expect(result.result.ok).toBe(true)
    expect(mocks.upsertMoments).toHaveBeenCalledOnce()
    expect(mocks.upsertMoments).toHaveBeenCalledWith(
      'account-1',
      expect.arrayContaining([
        expect.objectContaining({
          momentKey: 'sns-5',
          authorName: '孙七',
          content: '入库也不能挡抓取',
        }),
      ]),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
