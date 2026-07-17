import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { NotificationProvider, useNotificationStore } from '../src/stores/notification'
import type { WSNotification } from '@ihui/api-client'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
)

function renderStore() {
  return renderHook(() => useNotificationStore(), { wrapper })
}

function buildMsg(
  data: Record<string, unknown> | null,
  type = 'notification',
): WSNotification | null {
  return { type, data } as unknown as WSNotification | null as WSNotification | null
}

describe('stores/notification / NotificationProvider', () => {
  beforeEach(() => {
    // 重置 wrapper 的内部状态通过重新渲染实现(renderHook 每次新建)
  })

  it('初始状态:未连接、无通知、未读数为 0', () => {
    const { result } = renderStore()
    expect(result.current.connected).toBe(false)
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.visible).toBe(false)
  })

  it('addFromWs(null) 忽略,不修改状态', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(null)
    })
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('addFromWs 非 notification 类型忽略', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(buildMsg({ type: 'notification' }, 'other_type'))
    })
    expect(result.current.notifications).toEqual([])
  })

  it('addFromWs 缺少 data 忽略', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(buildMsg(null))
    })
    expect(result.current.notifications).toEqual([])
  })

  it('addFromWs 正常消息添加到列表头部', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(
        buildMsg({
          type: 'system',
          id: 'msg-1',
          title: '系统通知',
          content: 'Hello',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      )
    })
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0]).toMatchObject({
      id: 'msg-1',
      type: 'system',
      title: '系统通知',
      content: 'Hello',
      isRead: false,
    })
    expect(result.current.unreadCount).toBe(1)
  })

  it('addFromWs 缺失 title/content 时使用默认值', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(buildMsg({ type: 'system' }))
    })
    expect(result.current.notifications[0]!.title).toBe('新通知')
    expect(result.current.notifications[0]!.content).toBe('')
    act(() => {
      result.current.addFromWs(buildMsg({ type: 'ai_response' }))
    })
    expect(result.current.notifications[0]!.title).toBe('AI 回复')
  })

  it('markAllRead 把所有通知设为已读,unreadCount 归零', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(buildMsg({ type: 'a', id: '1' }))
      result.current.addFromWs(buildMsg({ type: 'b', id: '2' }))
    })
    expect(result.current.unreadCount).toBe(2)
    act(() => {
      result.current.markAllRead()
    })
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.isRead)).toBe(true)
  })

  it('clearAll 清空通知列表', () => {
    const { result } = renderStore()
    act(() => {
      result.current.addFromWs(buildMsg({ type: 'a', id: '1' }))
      result.current.addFromWs(buildMsg({ type: 'b', id: '2' }))
    })
    expect(result.current.notifications).toHaveLength(2)
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('addFromWs 最多保留 100 条(超出截断)', () => {
    const { result } = renderStore()
    act(() => {
      for (let i = 0; i < 105; i++) {
        result.current.addFromWs(buildMsg({ type: 'a', id: `id-${i}` }))
      }
    })
    expect(result.current.notifications).toHaveLength(100)
    expect(result.current.notifications[0]!.id).toBe('id-104')
  })

  it('setConnected / setVisible 切换状态', () => {
    const { result } = renderStore()
    act(() => {
      result.current.setConnected(true)
      result.current.setVisible(true)
    })
    expect(result.current.connected).toBe(true)
    expect(result.current.visible).toBe(true)
  })

  it('useNotificationStore 在 Provider 外调用抛错', () => {
    expect(() => renderHook(() => useNotificationStore())).toThrow(
      'useNotificationStore must be used within NotificationProvider',
    )
  })
})
