// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈停止原因 → 展示语义映射单测：封闭集逐档对账，page-limit / limitReached 必须成功态。
 */
import { describe, expect, it } from 'vitest'
import type {
  WechatMomentFieldAvailability,
  WechatMomentStopReason,
  WechatMomentView,
} from '@ihui/types'
import { describeMomentFetchStatus, formatMomentExtra, formatMomentFields } from '../moment-status'

/** 运行时封闭集（联合类型在编译期，遍历须有一份值列表）。 */
const ALL_REASONS: WechatMomentStopReason[] = [
  'page-limit',
  'scroll-stalled',
  'occluded',
  'no-more-data',
  'no-content',
  'error',
  'unsupported',
]

const base = { limitReached: false, occludedBy: null, fetched: 0 }

/** 编译期对账：ALL_REASONS 必须覆盖 WechatMomentStopReason 全档。 */
type UnhandledReason = Exclude<WechatMomentStopReason, (typeof ALL_REASONS)[number]>
const _coveredReasons: UnhandledReason extends never ? true : { missing: UnhandledReason } = true

describe('moment-status / 停止原因映射', () => {
  it('封闭集类型对账：ALL_REASONS 覆盖 WechatMomentStopReason 全档', () => {
    expect(_coveredReasons).toBe(true)
  })

  it('page-limit 归成功态，标题不出现失败或部分失败字样', () => {
    const meta = describeMomentFetchStatus({
      ...base,
      stopReason: 'page-limit',
      fetched: 12,
    })
    expect(meta.tone).toBe('success')
    expect(meta.title).toBe('已到页数上限，后续可能还有数据')
    expect(meta.title).not.toContain('失败')
    expect(meta.description).toContain('12')
  })

  it('limitReached 为 true 且 stopReason 为 null 时同样归成功态', () => {
    const meta = describeMomentFetchStatus({
      ...base,
      stopReason: null,
      limitReached: true,
      fetched: 8,
    })
    expect(meta.tone).toBe('success')
    expect(meta.title).toBe('已到页数上限，后续可能还有数据')
  })

  it('occluded 带遮挡窗口名，并提示把微信露出后再遍历', () => {
    const meta = describeMomentFetchStatus({
      ...base,
      stopReason: 'occluded',
      occludedBy: '钉钉',
    })
    expect(meta.tone).toBe('warning')
    expect(meta.description).toContain('钉钉')
    expect(meta.description).toContain('露出')
  })

  it('occluded 缺窗口名时走通用遮挡文案，不拼出 undefined', () => {
    const meta = describeMomentFetchStatus({
      ...base,
      stopReason: 'occluded',
      occludedBy: null,
    })
    expect(meta.tone).toBe('warning')
    expect(meta.description).not.toContain('undefined')
  })

  it('scroll-stalled 为滚轮停滞告警', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: 'scroll-stalled' })
    expect(meta.tone).toBe('warning')
    expect(meta.title).toBe('滚轮没有改变页面')
  })

  it('no-more-data 为成功到底', () => {
    const meta = describeMomentFetchStatus({
      ...base,
      stopReason: 'no-more-data',
      fetched: 5,
    })
    expect(meta.tone).toBe('success')
    expect(meta.title).toBe('已到朋友圈底部，没有更多')
  })

  it('no-content 为未识别正文告警', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: 'no-content' })
    expect(meta.tone).toBe('warning')
    expect(meta.title).toBe('未识别到正文')
  })

  it('error 为 danger', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: 'error' })
    expect(meta.tone).toBe('danger')
  })

  it('unsupported 为不支持告警', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: 'unsupported' })
    expect(meta.tone).toBe('warning')
    expect(meta.title).toBe('当前后端不支持')
  })

  it('无终止原因且有数据为成功「抓到 N 条」', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: null, fetched: 3 })
    expect(meta.tone).toBe('success')
    expect(meta.title).toBe('抓到 3 条')
  })

  it('无终止原因且无数据为告警兜底', () => {
    const meta = describeMomentFetchStatus({ ...base, stopReason: null, fetched: 0 })
    expect(meta.tone).toBe('warning')
  })

  it('封闭集每一档都产出非空标题与描述', () => {
    for (const reason of ALL_REASONS) {
      const meta = describeMomentFetchStatus({ ...base, stopReason: reason })
      expect(meta.title.length, reason).toBeGreaterThan(0)
      expect(meta.description.length, reason).toBeGreaterThan(0)
    }
  })
})

describe('moment-status / 字段可得性文案', () => {
  const complete: WechatMomentFieldAvailability = {
    media: true,
    likes: true,
    comments: true,
    authorIdentity: true,
    reason: null,
  }

  it('桥未上报 fields 时返回 null，不补造完整度结论', () => {
    expect(formatMomentFields(null)).toBeNull()
    expect(formatMomentFields(undefined)).toBeNull()
  })

  it('四项齐全时逐档展示可得，不带缺失说明', () => {
    const text = formatMomentFields(complete)
    expect(text).toBe('字段可得性：图片可得、点赞可得、评论可得、作者身份可得')
  })

  it('缺失档位展示不可得，并带上桥给的 reason', () => {
    const partial: WechatMomentFieldAvailability = {
      media: true,
      likes: false,
      comments: false,
      authorIdentity: false,
      reason: '点赞、评论、作者身份均不可得',
    }
    const text = formatMomentFields(partial)
    expect(text).toContain('图片可得')
    expect(text).toContain('点赞不可得')
    expect(text).toContain('评论不可得')
    expect(text).toContain('作者身份不可得')
    expect(text).toContain('点赞、评论、作者身份均不可得')
  })
})

describe('moment-status / 单条动态摘要', () => {
  function moment(overrides: Partial<WechatMomentView>): WechatMomentView {
    return {
      id: 'sns-1',
      authorId: null,
      authorName: '张三',
      content: '一条动态',
      mediaUrls: [],
      createdAt: null,
      source: 'ocr',
      ...overrides,
    }
  }

  it('三项齐全时按图片 · 时间 · 评论顺序拼接', () => {
    const text = formatMomentExtra(
      moment({
        imageCount: 3,
        timeText: '5分钟前',
        commentTexts: ['第一条评论', '第二条评论'],
      }),
    )
    expect(text).toBe('3 张图片 · 5分钟前 · 2 条评论')
  })

  it('只有图片时只展示图片数量', () => {
    expect(formatMomentExtra(moment({ imageCount: 3 }))).toBe('3 张图片')
  })

  it('只有时间时只展示相对时间原文', () => {
    expect(formatMomentExtra(moment({ timeText: '昨天' }))).toBe('昨天')
  })

  it('只有评论时只展示评论条数', () => {
    expect(formatMomentExtra(moment({ commentTexts: ['这条写得好'] }))).toBe('1 条评论')
  })

  it('三项都缺失时返回 null，不补造占位文案', () => {
    expect(formatMomentExtra(moment({}))).toBeNull()
    expect(formatMomentExtra(null)).toBeNull()
    expect(formatMomentExtra(undefined)).toBeNull()
  })

  it('脏值一律不显示：空串时间、非正整数图片、含非字符串评论都被过滤', () => {
    const text = formatMomentExtra(
      moment({
        timeText: '   ',
        imageCount: -2,
        commentTexts: [123, '', null, undefined] as unknown as string[],
      }),
    )
    expect(text).toBeNull()
  })

  it('混排时只保留合法项，脏值被剔除后不影响其余展示', () => {
    const text = formatMomentExtra(
      moment({
        imageCount: 0,
        timeText: '5分钟前',
        commentTexts: ['有效评论', 456, ''] as unknown as string[],
      }),
    )
    expect(text).toBe('5分钟前 · 1 条评论')
  })
})
