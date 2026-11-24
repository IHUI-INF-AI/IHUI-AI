// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G2 结果推送的「查看会话」深链装车证明(2026-10-30)。
 *
 * 链路:automations/goal-loop.ts 终态通知 → createNotification(data.sessionId) →
 * setAutomationNotificationPusher(server.pushNotification) → WS `{type:'notification',data:行}` →
 * shared 的 transformWsNotification 把 data.data 透传为 payload → 侧栏映射成 NoticeItem.sessionId →
 * NotificationCenter 对 rawType==='automation' 且带 sessionId 的条目渲染「查看会话」。
 *
 * 判据:
 * ① 适配器只对普通对象载荷透传(数组/标量不带);sanity:非通知消息仍返回 null。
 * ② NotificationCenter:automation+sessionId 才出深链;点击深链不带发整条通知的 onItemClick。
 * ③ 其它 type / 缺 sessionId 一律不渲染深链(不制造假的深链入口)。
 * 断言一律用裸 DOM 匹配器(本仓 apps/web 未装 @testing-library/jest-dom)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { transformWsNotification } from '@ihui/shared/notifications/ws-notification-adapter'
import { NotificationCenter, type NoticeItem } from '../NotificationCenter'

vi.mock('next-intl', () => ({
  useTranslations:
    (_ns: string) =>
    (key: string) =>
      key,
}))

afterEach(cleanup)

const ITEM: NoticeItem = {
  id: 'ntf_1',
  title: '夜间巡检',
  description: '本轮达标:产出已归档',
  type: 'success',
  read: false,
  createdAt: '2026-10-30T23:05:00.000Z',
  rawType: 'automation',
  sessionId: 'auto_7fc2',
}

describe('G2 WS 载荷透传(shared 适配器)', () => {
  it('把 data.data 的 sessionId 原样透传为 payload', () => {
    const entry = transformWsNotification({
      type: 'notification',
      data: {
        id: 'ntf_1',
        type: 'automation',
        title: '夜间巡检',
        content: '本轮达标',
        createdAt: '2026-10-30T23:05:00.000Z',
        data: { automationId: 'auto_7fc2', sessionId: 'auto_7fc2', terminalReason: 'completed' },
      },
    })
    expect(entry).not.toBeNull()
    expect(entry!.type).toBe('automation')
    expect(entry!.payload).toEqual({
      automationId: 'auto_7fc2',
      sessionId: 'auto_7fc2',
      terminalReason: 'completed',
    })
  })

  it('载荷缺失或非普通对象时不带 payload(不让各端拿到半截形态)', () => {
    expect(
      transformWsNotification({
        type: 'notification',
        data: { id: 'n1', type: 'info', title: '公告' },
      })!.payload,
    ).toBeUndefined()
    expect(
      transformWsNotification({
        type: 'notification',
        data: { id: 'n2', type: 'automation', title: '巡检', data: ['not-an-object'] },
      })!.payload,
    ).toBeUndefined()
  })

  it('非 notification 消息仍返回 null(不因新增字段放宽闸门)', () => {
    expect(transformWsNotification({ type: 'agent.action', data: null })).toBeNull()
  })
})

describe('G2 NotificationCenter「查看会话」深链', () => {
  it('automation + sessionId 渲染深链;点击只回调 sessionId,不带发整条通知点击', () => {
    const onItemClick = vi.fn()
    const onSessionLinkClick = vi.fn()
    render(
      <NotificationCenter
        items={[ITEM]}
        onItemClick={onItemClick}
        onSessionLinkClick={onSessionLinkClick}
      />,
    )
    const link = screen.getByTestId('notice-session-link')
    expect(link.getAttribute('data-session-id')).toBe('auto_7fc2')
    expect(link.textContent).toBe('viewConversation')
    fireEvent.click(link)
    expect(onSessionLinkClick).toHaveBeenCalledWith('auto_7fc2')
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it('非 automation 类型不渲染深链(即使误带了 sessionId)', () => {
    render(
      <NotificationCenter
        items={[{ ...ITEM, rawType: 'info', id: 'ntf_2' }]}
        onSessionLinkClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('notice-session-link')).toBeNull()
  })

  it('automation 但缺 sessionId 时不渲染深链(不制造假的入口)', () => {
    render(
      <NotificationCenter
        items={[{ ...ITEM, sessionId: null, id: 'ntf_3' }]}
        onSessionLinkClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('notice-session-link')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
