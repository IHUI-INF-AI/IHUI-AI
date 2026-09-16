// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  STREAM_ANNOUNCE_INTERVAL_MS,
  buildStreamAnnouncement,
  shouldAnnounceProgress,
} from '../stream-announcer'

const t = (key: string, params?: Record<string, number>) =>
  key + (params ? `(${Object.values(params).join(',')})` : '')

/**
 * P3 #34 流式播报测试(2026-09-16 立)
 */
describe('buildStreamAnnouncement', () => {
  it('start 阶段播报开始(无参数)', () => {
    expect(buildStreamAnnouncement('start', 0, t)).toBe('streamAnnounceStart')
  })

  it('streaming 阶段报当前字数', () => {
    expect(buildStreamAnnouncement('streaming', 120, t)).toBe('streamAnnounceProgress(120)')
  })

  it('done 阶段报总字数', () => {
    expect(buildStreamAnnouncement('done', 456, t)).toBe('streamAnnounceDone(456)')
  })
})

describe('shouldAnnounceProgress(节流决策)', () => {
  it('默认间隔 3s', () => {
    expect(STREAM_ANNOUNCE_INTERVAL_MS).toBe(3000)
  })

  it('时间够且字数有增长 → 播报', () => {
    expect(shouldAnnounceProgress(3000, 100)).toBe(true)
  })

  it('时间不够 → 不播报(即使字数增长)', () => {
    expect(shouldAnnounceProgress(2999, 100)).toBe(false)
  })

  it('字数无增长 → 不播报(避免重复打扰)', () => {
    expect(shouldAnnounceProgress(10000, 0)).toBe(false)
    expect(shouldAnnounceProgress(10000, -5)).toBe(false)
  })

  it('自定义间隔生效', () => {
    expect(shouldAnnounceProgress(500, 10, 500)).toBe(true)
  })
})
