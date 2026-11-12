// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 流式跟底判定单测(纯函数,零 DOM / 零 RN)。
 *
 * 钉四件事:
 * ① 回退即解除 —— 用户上翻后新内容不得再把视口拽回底部(这是"流式中滑不动"那条缺陷的判据);
 * ② 触底即恢复 —— 用户自己滑回底部才算恢复,内容撑高不算;
 * ③ 读不到 scrollTop 时必须返回 null(不猜 0)—— 猜 0 会把下一枚真事件误判成"位置前进",吞掉用户意图;
 * ④ 两种宿主事件形状(react-native 的 nativeEvent / Taro 的 detail)解析到同一个数。
 */
import { describe, expect, it } from 'vitest'
import {
  initialStreamFollowState,
  reduceStreamFollowOnReachBottom,
  reduceStreamFollowOnScroll,
  resetStreamFollowForNewRound,
  shouldStickToBottom,
  readScrollEventTop,
  STREAM_SCROLL_EPSILON_PX,
} from '../stream-follow'

describe('reduceStreamFollowOnScroll', () => {
  it('第一枚事件只建立基线,不改跟随态', () => {
    const s = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    expect(s).toEqual({ following: true, scrollTop: 500 })
  })

  it('回退超过容差 ⇒ 立即交还滚动权', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    s = reduceStreamFollowOnScroll(s, 200)
    expect(s.following).toBe(false)
    expect(s.scrollTop).toBe(200)
  })

  it('亚像素/噪声级回退不交权(容差内)', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 500)
    s = reduceStreamFollowOnScroll(s, 500 - STREAM_SCROLL_EPSILON_PX)
    expect(s.following).toBe(true)
  })

  it('位置前进(流式撑高后我们贴底)不改变跟随态', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 100)
    s = reduceStreamFollowOnScroll(s, 900)
    expect(s.following).toBe(true)
    expect(s.scrollTop).toBe(900)
  })

  it('已解除跟随后继续上翻仍是解除,不会被"前进"事件悄悄恢复', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 900)
    s = reduceStreamFollowOnScroll(s, 100)
    s = reduceStreamFollowOnScroll(s, 800)
    expect(s.following).toBe(false)
  })

  it('非法值(NaN / 负数 / Infinity)原样返回,不污染账目', () => {
    const base = reduceStreamFollowOnScroll(initialStreamFollowState(), 300)
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(reduceStreamFollowOnScroll(base, bad)).toBe(base)
    }
  })
})

describe('reduceStreamFollowOnReachBottom / shouldStickToBottom', () => {
  it('触底恢复跟随,且不改 scrollTop 账目', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 900)
    s = reduceStreamFollowOnScroll(s, 100)
    s = reduceStreamFollowOnReachBottom(s)
    expect(s.following).toBe(true)
    expect(s.scrollTop).toBe(100)
  })

  it('只有"跟随中 ∧ 流式中"才贴底', () => {
    const following = initialStreamFollowState()
    const detached = reduceStreamFollowOnScroll(
      reduceStreamFollowOnScroll(initialStreamFollowState(), 900),
      100,
    )
    expect(shouldStickToBottom(following, true)).toBe(true)
    expect(shouldStickToBottom(following, false)).toBe(false)
    expect(shouldStickToBottom(detached, true)).toBe(false)
  })

  it('新一轮复位丢掉上一轮的上翻账目', () => {
    let s = reduceStreamFollowOnScroll(initialStreamFollowState(), 900)
    s = reduceStreamFollowOnScroll(s, 100)
    expect(s.following).toBe(false)
    expect(resetStreamFollowForNewRound()).toEqual({ following: true, scrollTop: null })
  })
})

describe('readScrollEventTop', () => {
  it('react-native 形状:nativeEvent.contentOffset.y', () => {
    expect(readScrollEventTop({ nativeEvent: { contentOffset: { y: 321 } } })).toBe(321)
  })

  it('Taro 形状:detail.scrollTop', () => {
    expect(readScrollEventTop({ detail: { scrollTop: 654 } })).toBe(654)
  })

  it('扁平形状:顶层 scrollTop', () => {
    expect(readScrollEventTop({ scrollTop: 12 })).toBe(12)
  })

  it('读不到一律 null —— 不猜 0', () => {
    expect(readScrollEventTop(null)).toBeNull()
    expect(readScrollEventTop(undefined)).toBeNull()
    expect(readScrollEventTop({})).toBeNull()
    expect(readScrollEventTop({ nativeEvent: {} })).toBeNull()
    expect(readScrollEventTop({ detail: { scrollTop: '120' } })).toBeNull()
    expect(readScrollEventTop({ detail: { scrollTop: Number.NaN } })).toBeNull()
  })

  it('同时存在两种形状时以原生形状为准(RN 侧事件不会带 detail)', () => {
    expect(
      readScrollEventTop({ nativeEvent: { contentOffset: { y: 7 } }, detail: { scrollTop: 99 } }),
    ).toBe(7)
  })
})
