// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

import { transformWsNotification } from '../ws-notification-adapter'

describe('XUI-022 transformWsNotification:无 id 通知不得互相覆盖', () => {
  it('同毫秒两条无 id 通知 ⇒ fallback id 唯一(去重不会把新通知当重复丢弃)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_800_000_000_000)
    try {
      const msg = {
        type: 'notification',
        data: { type: 'system', title: '新通知', content: '正文' },
      }
      const a = transformWsNotification(msg)
      const b = transformWsNotification(msg)
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      expect(a?.id).not.toBe(b?.id)
    } finally {
      vi.useRealTimers()
    }
  })

  it('服务端给了 id ⇒ 原样使用(重连重放靠 id 去重)', () => {
    const entry = transformWsNotification({
      type: 'notification',
      data: { id: 'n-1', type: 'system', title: '标题', content: '正文' },
    })
    expect(entry?.id).toBe('n-1')
  })

  it('非通知消息 ⇒ null', () => {
    expect(transformWsNotification({ type: 'chat', data: { type: 'system' } })).toBeNull()
    expect(transformWsNotification(null)).toBeNull()
  })

  it('data.type 非字符串 ⇒ 落到 notification,不把对象塞进 type', () => {
    const entry = transformWsNotification({
      type: 'notification',
      data: { type: { nested: true }, title: '标题', content: '正文' },
    } as unknown as Parameters<typeof transformWsNotification>[0])
    expect(entry?.type).toBe('notification')
  })

  /**
   * 2026-11-18:红点亮着、点开一行空白 —— 同一封 WS 通道还发任务/广告/语音信令等业务事件,
   * 它们没有标题也没有正文,旧规则用「新通知」兜底硬收进通知中心,于是出现空条目。
   */
  it('业务事件(既无标题也无正文)⇒ null(rawType 不冒充通知)', () => {
    // 载荷形状随业务而变(本仓真实事件各带自己的键),故以松散函数喂真实形态
    const ws = (data: Record<string, unknown>) =>
      transformWsNotification({
        type: 'notification',
        data,
      } as unknown as Parameters<typeof transformWsNotification>[0])
    // 任务下发/结果
    expect(ws({ type: 'task-dispatch', taskId: 't-1' })).toBeNull()
    // 激励广告到账
    expect(ws({ type: 'rewarded_ad', event: 'points_awarded', amount: 5, balance: 105 })).toBeNull()
    // 语音通话信令
    expect(ws({ type: 'webrtc_voice', event: 'ended', sessionId: 's-1' })).toBeNull()
    // agent 动作派发
    expect(
      ws({ type: 'agent.action', request: { id: 'r-1' }, assignment: { token: 'x' } }),
    ).toBeNull()
  })

  it('只要有一项可展示文本就仍然收下(仅标题 / 仅正文都不丢真实通知)', () => {
    const titleOnly = transformWsNotification({
      type: 'notification',
      data: { id: 'n-2', type: 'system', title: '异地登录提醒' },
    })
    expect(titleOnly).not.toBeNull()
    expect(titleOnly?.title).toBe('异地登录提醒')
    expect(titleOnly?.content).toBe('')

    const contentOnly = transformWsNotification({
      type: 'notification',
      data: { id: 'n-3', type: 'ai_response', message: { content: '任务已完成' } },
    })
    expect(contentOnly).not.toBeNull()
    expect(contentOnly?.title).toBe('AI 回复')
    expect(contentOnly?.content).toBe('任务已完成')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
