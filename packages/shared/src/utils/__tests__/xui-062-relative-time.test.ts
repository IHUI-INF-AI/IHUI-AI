// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// XUI-062: RN(Hermes) 无 Intl.RelativeTimeFormat,日/韩走英文兜底 —— 本地化缺失。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime } from '../date-utils'

/** 模拟 Hermes:整体替换 Intl,只抹掉 RelativeTimeFormat,其余格式化器保留 */
const hermesIntl = () => vi.stubGlobal('Intl', { ...Intl, RelativeTimeFormat: undefined })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('XUI-062 相对时间 ja/ko 兜底', () => {
  it('日语:分钟/天/刚刚 均输出日文短语', () => {
    hermesIntl()
    expect(formatRelativeTime(new Date('2026-11-07T23:58:00Z'), 'ja')).toBe('2 分前')
    expect(formatRelativeTime(new Date('2026-11-06T00:00:00Z'), 'ja')).toBe('2 日前')
    expect(formatRelativeTime(new Date('2026-11-07T23:59:30Z'), 'ja')).toBe('たった今')
  })

  it('韩语:分钟/天/刚刚 均输出韩文短语', () => {
    hermesIntl()
    expect(formatRelativeTime(new Date('2026-11-07T23:58:00Z'), 'ko')).toBe('2분 전')
    expect(formatRelativeTime(new Date('2026-11-06T00:00:00Z'), 'ko')).toBe('2일 전')
    expect(formatRelativeTime(new Date('2026-11-07T23:59:30Z'), 'ko')).toBe('방금 전')
  })

  it('zh/en 既有读数不回退', () => {
    hermesIntl()
    expect(formatRelativeTime(new Date('2026-11-07T23:58:00Z'), 'zh-CN')).toBe('2 分钟前')
    expect(formatRelativeTime(new Date('2026-11-07T23:58:00Z'), 'en')).toBe('2 min ago')
  })
})
