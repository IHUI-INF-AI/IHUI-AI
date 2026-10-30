// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距④(2026-10-30 立):?turn= 深链锚点的判据层单测。
 * 覆盖 turn-deeplink 纯函数面:参数解析、目标存取(peek 不消费 / 会话绑定)、
 * around 窗口锚点消息挑选。loadHistory 分支是组件内异步编排,不在本文件射程。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearTurnDeepLink,
  parseTurnParam,
  peekTurnDeepLink,
  pickTurnAnchorMessageId,
  setTurnDeepLink,
} from '@/lib/turn-deeplink'

describe('parseTurnParam', () => {
  it('只接受非负整数字符串', () => {
    expect(parseTurnParam('7')).toBe(7)
    expect(parseTurnParam('0')).toBe(0)
    expect(parseTurnParam('123456789')).toBe(123456789)
  })
  it('坏参数一律 null(不触发窗口通道)', () => {
    expect(parseTurnParam(null)).toBeNull()
    expect(parseTurnParam('')).toBeNull()
    expect(parseTurnParam('abc')).toBeNull()
    expect(parseTurnParam('1.5')).toBeNull()
    expect(parseTurnParam('-1')).toBeNull()
    expect(parseTurnParam('NaN')).toBeNull()
    expect(parseTurnParam('Infinity')).toBeNull()
  })
})

describe('turn 深链目标存取', () => {
  beforeEach(() => {
    clearTurnDeepLink()
  })
  it('peek 命中同会话目标且不消费(可重放)', () => {
    setTurnDeepLink('conv-1', 7)
    expect(peekTurnDeepLink('conv-1')).toEqual({ conversationId: 'conv-1', turnOrdinal: 7 })
    expect(peekTurnDeepLink('conv-1')).toEqual({ conversationId: 'conv-1', turnOrdinal: 7 })
  })
  it('目标绑定会话:别的会话 peek 得 null,不跨会话误命中', () => {
    setTurnDeepLink('conv-1', 7)
    expect(peekTurnDeepLink('conv-2')).toBeNull()
  })
  it('clear 后 peek 为 null(404 降级与 URL 参数变化的清口)', () => {
    setTurnDeepLink('conv-1', 7)
    clearTurnDeepLink()
    expect(peekTurnDeepLink('conv-1')).toBeNull()
  })
})

describe('pickTurnAnchorMessageId', () => {
  const turns = [
    { turnOrdinal: 6, messages: [{ id: 'm-a' }, { id: 'm-b' }] },
    { turnOrdinal: 7, messages: [{ id: 'm-c' }, { id: 'm-d' }] },
    { turnOrdinal: 8, messages: [{ id: 'm-e' }] },
  ]
  it('锚点 turn 的首条消息(一轮开场行)为跳转凭据', () => {
    expect(pickTurnAnchorMessageId(turns, 7)).toBe('m-c')
  })
  it('锚点 turn 缺席 / 空 turn ⇒ null(不跳转、不猜位置)', () => {
    expect(pickTurnAnchorMessageId(turns, 99)).toBeNull()
    expect(pickTurnAnchorMessageId([{ turnOrdinal: 7, messages: [] }], 7)).toBeNull()
    expect(pickTurnAnchorMessageId([], 7)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
