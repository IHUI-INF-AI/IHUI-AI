// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈字段可得性透传单测：桥上报的合法 fields 原样透传；缺失或形状非法归 undefined，
 * 不用默认布尔值补造能力位。全部 mock，不连库。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  performAction: vi.fn(),
  assertAccountForUser: vi.fn(),
  upsertMoments: vi.fn(),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { performAction: mocks.performAction },
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))
vi.mock('../wechat-hub/moments-store.js', () => ({
  upsertMoments: mocks.upsertMoments,
  listMomentsArchive: vi.fn(),
  countMomentsArchive: vi.fn(),
}))

import { fetchMoments } from '../wechat-hub/operations'

const baseMoment = {
  id: 'sns-1',
  authorName: '张三',
  content: '一条动态',
  mediaUrls: [],
  createdAt: null,
  source: 'ocr',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAccountForUser.mockResolvedValue(undefined)
  mocks.upsertMoments.mockResolvedValue({ added: 0, updated: 0, total: 0 })
})

describe('fetchMoments 字段可得性透传', () => {
  it('桥上报合法 fields 时严格透传，布尔与 reason 原样保留', async () => {
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [baseMoment],
        fetched: 1,
        pages: 1,
        source: 'ocr',
        partial: false,
        fields: {
          media: true,
          likes: false,
          comments: false,
          authorIdentity: true,
          reason: '点赞、评论均不可得',
        },
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.fields).toEqual({
      media: true,
      likes: false,
      comments: false,
      authorIdentity: true,
      reason: '点赞、评论均不可得',
    })
  })

  it('桥未上报 fields 时结果缺省为 undefined，不补造默认能力位', async () => {
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [baseMoment],
        fetched: 1,
        pages: 1,
        source: 'ocr',
        partial: false,
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.fields).toBeUndefined()
  })

  it('fields 形状非法（布尔位非布尔）时归 undefined，不抛出', async () => {
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [baseMoment],
        fetched: 1,
        pages: 1,
        source: 'ocr',
        partial: false,
        fields: { media: 'yes', likes: false, comments: false, authorIdentity: true, reason: null },
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.fields).toBeUndefined()
  })

  it('DB sidecar 媒体统计透传，缓存未命中不算下载失败', async () => {
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        moments: [baseMoment],
        fetched: 1,
        pages: 1,
        source: 'db',
        partial: false,
        downloadMedia: true,
        localCacheOnly: true,
        downloadedMedia: 2,
        mediaCacheHits: 2,
        mediaCacheMisses: 5,
        mediaDownloadErrors: 0,
      },
      reason: null,
    })

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.downloadMedia).toBe(true)
    expect(result.localCacheOnly).toBe(true)
    expect(result.downloadedMedia).toBe(2)
    expect(result.mediaCacheHits).toBe(2)
    expect(result.mediaCacheMisses).toBe(5)
    expect(result.mediaDownloadErrors).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
