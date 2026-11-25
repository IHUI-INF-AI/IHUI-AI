// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈摘要字段透传单测：timeText / imageCount / commentTexts 严格类型校验，
 * 合法才挂到视图与归档入参；缺失或脏值一律不挂，不用空串 / 0 占位。全部 mock，不连库。
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

function bridgeResult(moment: Record<string, unknown>) {
  return {
    ok: true,
    status: 'accepted' as const,
    data: {
      moments: [moment],
      fetched: 1,
      pages: 1,
      source: 'ocr',
      partial: false,
    },
    reason: null,
  }
}

function archivedMoment(): Record<string, unknown> | undefined {
  const row = mocks.upsertMoments.mock.calls.at(-1)?.[1]?.[0]
  return row as Record<string, unknown> | undefined
}

describe('fetchMoments 摘要字段严格透传', () => {
  it('合法 timeText / imageCount / commentTexts 原样挂到视图并随归档入参下发', async () => {
    mocks.performAction.mockResolvedValue(
      bridgeResult({
        ...baseMoment,
        timeText: '5分钟前',
        imageCount: 3,
        commentTexts: ['评论一', '评论二'],
      }),
    )

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.moments[0]).toMatchObject({
      timeText: '5分钟前',
      imageCount: 3,
      commentTexts: ['评论一', '评论二'],
    })
    expect(archivedMoment()).toMatchObject({
      timeText: '5分钟前',
      imageCount: 3,
      commentTexts: ['评论一', '评论二'],
    })
  })

  it('timeText 为空串时剔除，视图与归档入参都不挂该字段', async () => {
    mocks.performAction.mockResolvedValue(
      bridgeResult({ ...baseMoment, timeText: '', imageCount: 2, commentTexts: ['评论一'] }),
    )

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.moments[0]?.timeText).toBeUndefined()
    expect(archivedMoment()?.timeText).toBeUndefined()
  })

  it('imageCount 为负数 / 0 / 小数时剔除，不用 0 占位', async () => {
    mocks.performAction.mockResolvedValue(
      bridgeResult({ ...baseMoment, imageCount: -2, timeText: '昨天', commentTexts: ['评论一'] }),
    )

    const negative = await fetchMoments('user-1', 'account-1')
    expect(negative.moments[0]?.imageCount).toBeUndefined()
    expect(archivedMoment()?.imageCount).toBeUndefined()

    mocks.performAction.mockResolvedValue(
      bridgeResult({ ...baseMoment, imageCount: 0, timeText: '昨天', commentTexts: ['评论一'] }),
    )
    const zero = await fetchMoments('user-1', 'account-1')
    expect(zero.moments[0]?.imageCount).toBeUndefined()

    mocks.performAction.mockResolvedValue(
      bridgeResult({ ...baseMoment, imageCount: 1.5, timeText: '昨天', commentTexts: ['评论一'] }),
    )
    const fraction = await fetchMoments('user-1', 'account-1')
    expect(fraction.moments[0]?.imageCount).toBeUndefined()
  })

  it('commentTexts 含非字符串元素时只保留非空字符串，全脏则不挂', async () => {
    mocks.performAction.mockResolvedValue(
      bridgeResult({
        ...baseMoment,
        timeText: '5分钟前',
        imageCount: 2,
        commentTexts: ['有效评论', 123, null, ''],
      }),
    )

    const result = await fetchMoments('user-1', 'account-1')

    expect(result.moments[0]?.commentTexts).toEqual(['有效评论'])
    expect(archivedMoment()?.commentTexts).toEqual(['有效评论'])

    mocks.performAction.mockResolvedValue(
      bridgeResult({
        ...baseMoment,
        timeText: '5分钟前',
        imageCount: 2,
        commentTexts: [123, null, ''],
      }),
    )
    const dirtyOnly = await fetchMoments('user-1', 'account-1')
    expect(dirtyOnly.moments[0]?.commentTexts).toBeUndefined()
    expect(archivedMoment()?.commentTexts).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
