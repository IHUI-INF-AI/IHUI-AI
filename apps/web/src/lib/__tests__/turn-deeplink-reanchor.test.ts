// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距⑤遗留边界1+2(2026-10-30 立):?turn= 深链的"换 turn 重锚广播 + 窗格归属"判据层单测。
 * 覆盖 turn-deeplink 的订阅面:值变才广播(同值幂等不重放)、URL 权威 clear 广播、
 * 404 consume 静默、peek/版本号按窗格归属隔离。effect 重跑接线在组件测试面
 * (chat-pane-body-turn-deeplink.test.tsx)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearTurnDeepLink,
  consumeTurnDeepLink,
  getTurnDeepLinkVersionForPane,
  peekTurnDeepLink,
  setTurnDeepLink,
  subscribeTurnDeepLink,
} from '@/lib/turn-deeplink'

describe('turn 深链目标广播(换 turn 重锚的触发判据)', () => {
  beforeEach(() => {
    clearTurnDeepLink()
  })

  it('同会话换 turn ⇒ 广播 ⇒ 承载窗格快照版本号变化(重锚)', () => {
    setTurnDeepLink('conv-1', 5)
    const listener = vi.fn()
    const unsubscribe = subscribeTurnDeepLink(listener)
    const v5 = getTurnDeepLinkVersionForPane(null)
    setTurnDeepLink('conv-1', 7)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getTurnDeepLinkVersionForPane(null)).not.toBe(v5)
    expect(peekTurnDeepLink('conv-1')).toEqual({ conversationId: 'conv-1', turnOrdinal: 7 })
    unsubscribe()
  })

  it('同值幂等 set 不广播(URL 权威随 searchParams 重跑,参数没变不重锚)', () => {
    setTurnDeepLink('conv-1', 7)
    const listener = vi.fn()
    const unsubscribe = subscribeTurnDeepLink(listener)
    const before = getTurnDeepLinkVersionForPane(null)
    setTurnDeepLink('conv-1', 7)
    expect(listener).not.toHaveBeenCalled()
    expect(getTurnDeepLinkVersionForPane(null)).toBe(before)
    unsubscribe()
  })

  it('URL 权威 clear 广播(参数缺席 ⇒ 目标变化 ⇒ 重跑回常规路径);空目标再 clear 不广播', () => {
    setTurnDeepLink('conv-1', 7)
    const listener = vi.fn()
    const unsubscribe = subscribeTurnDeepLink(listener)
    clearTurnDeepLink()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(peekTurnDeepLink('conv-1')).toBeNull()
    clearTurnDeepLink()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('consumeTurnDeepLink 静默消费(404 降级就地落常规路径,不多放一枪 effect 重放)', () => {
    setTurnDeepLink('conv-1', 7)
    const listener = vi.fn()
    const unsubscribe = subscribeTurnDeepLink(listener)
    consumeTurnDeepLink()
    expect(listener).not.toHaveBeenCalled()
    expect(peekTurnDeepLink('conv-1')).toBeNull()
    unsubscribe()
  })

  it('退订后不再收广播', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTurnDeepLink(listener)
    unsubscribe()
    setTurnDeepLink('conv-1', 3)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('turn 深链窗格归属(多窗格投递的寻址判据)', () => {
  beforeEach(() => {
    clearTurnDeepLink()
  })

  it('默认 set 不带窗格 ⇒ 归属根窗格(paneId null),根快照随版本走、别窗格恒 0', () => {
    setTurnDeepLink('conv-1', 7)
    expect(peekTurnDeepLink('conv-1')).not.toBeNull()
    expect(peekTurnDeepLink('conv-1', 'pane-a')).toBeNull()
    const rootVersion = getTurnDeepLinkVersionForPane(null)
    expect(rootVersion).not.toBe(0)
    expect(getTurnDeepLinkVersionForPane('pane-a')).toBe(0)
  })

  it('目标归属 pane-a ⇒ 只有 pane-a 的 peek/快照命中,根与别的窗格都不动', () => {
    setTurnDeepLink('conv-1', 7, 'pane-a')
    expect(peekTurnDeepLink('conv-1')).toBeNull()
    expect(peekTurnDeepLink('conv-1', 'pane-b')).toBeNull()
    expect(peekTurnDeepLink('conv-1', 'pane-a')).toEqual({
      conversationId: 'conv-1',
      turnOrdinal: 7,
    })
    expect(getTurnDeepLinkVersionForPane(null)).toBe(0)
    expect(getTurnDeepLinkVersionForPane('pane-b')).toBe(0)
    const versionA = getTurnDeepLinkVersionForPane('pane-a')
    expect(versionA).not.toBe(0)
    // pane-a 的目标再变 ⇒ 仍只有 pane-a 的快照动
    setTurnDeepLink('conv-1', 9, 'pane-a')
    expect(getTurnDeepLinkVersionForPane('pane-a')).not.toBe(versionA)
    expect(getTurnDeepLinkVersionForPane(null)).toBe(0)
    expect(getTurnDeepLinkVersionForPane('pane-b')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
