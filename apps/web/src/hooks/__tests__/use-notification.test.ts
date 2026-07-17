// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { WSNotification } from '@/hooks/use-websocket'

const mockState = vi.hoisted(() => ({
  lastMessage: null as WSNotification | null,
}))

vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: () => ({ connected: true, lastMessage: mockState.lastMessage }),
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn().mockResolvedValue({ success: true }),
}))

import { useNotification } from '../use-notification'

function makeMessage(type: string, overrides: Record<string, unknown> = {}): WSNotification {
  return {
    type: 'notification',
    data: {
      type,
      id: 'msg-1',
      title: '测试通知',
      content: '内容',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  }
}

describe('useNotification - WebSocket 消息过滤', () => {
  beforeEach(() => {
    mockState.lastMessage = null
  })

  it('NON_NOTIFICATION_TYPES 应过滤 ai_response 和 chat_message', () => {
    const { result, rerender } = renderHook(() => useNotification())

    mockState.lastMessage = makeMessage('ai_response')
    rerender()
    expect(result.current.notifications).toHaveLength(0)

    mockState.lastMessage = makeMessage('chat_message')
    rerender()
    expect(result.current.notifications).toHaveLength(0)
  })

  it("收到 'ai_response' 类型 WS 消息时不创建通知", () => {
    const { result, rerender } = renderHook(() => useNotification())
    mockState.lastMessage = makeMessage('ai_response', { id: 'ai-1' })
    rerender()
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it("收到 'notification' 类型 WS 消息时创建通知", () => {
    const { result, rerender } = renderHook(() => useNotification())
    mockState.lastMessage = makeMessage('notification', { id: 'n1', title: '新消息' })
    rerender()
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0]!.title).toBe('新消息')
    expect(result.current.unreadCount).toBe(1)
  })
})

describe('useNotification - 桌面通知', () => {
  beforeEach(() => {
    mockState.lastMessage = null
    // 重置 Notification permission 状态
    Object.defineProperty(globalThis, 'Notification', {
      value: class MockNotification {
        static permission: NotificationPermission = 'default'
        static requestPermission = vi.fn(async (): Promise<NotificationPermission> => {
          MockNotification.permission = 'granted'
          return 'granted'
        })
        constructor(_title: string, _options?: NotificationOptions) {}
      },
      writable: true,
      configurable: true,
    })
    window.localStorage.clear()
  })

  it('初始状态:desktopPermission 为 default(Notification API 可用)', () => {
    const { result } = renderHook(() => useNotification())
    expect(result.current.desktopPermission).toBe('default')
  })

  it('requestDesktopPermission 返回 true 且更新 permission 为 granted', async () => {
    const { result } = renderHook(() => useNotification())
    const granted = await result.current.requestDesktopPermission()
    expect(granted).toBe(true)
    await waitFor(() => {
      expect(result.current.desktopPermission).toBe('granted')
    })
    expect(window.localStorage.getItem('ihui-desktop-notification-enabled')).toBe('1')
  })

  it('requestDesktopPermission 返回 false 时 localStorage 不写入', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: class MockNotification {
        static permission: NotificationPermission = 'denied'
        static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'denied')
        constructor(_title: string, _options?: NotificationOptions) {}
      },
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useNotification())
    const granted = await result.current.requestDesktopPermission()
    expect(granted).toBe(false)
    await waitFor(() => {
      expect(result.current.desktopPermission).toBe('denied')
    })
    expect(window.localStorage.getItem('ihui-desktop-notification-enabled')).toBeNull()
  })
})

describe('useNotification - 通知声音', () => {
  beforeEach(() => {
    mockState.lastMessage = null
    window.localStorage.clear()
  })

  it('初始状态 soundEnabled 为 false(localStorage 无标记)', () => {
    const { result } = renderHook(() => useNotification())
    expect(result.current.soundEnabled).toBe(false)
  })

  it('setSoundEnabled(true) 后 localStorage 写入 1 且 state 更新为 true', () => {
    const { result } = renderHook(() => useNotification())
    act(() => {
      result.current.setSoundEnabled(true)
    })
    expect(result.current.soundEnabled).toBe(true)
    expect(window.localStorage.getItem('ihui-notification-sound-enabled')).toBe('1')
  })

  it('setSoundEnabled(false) 后 localStorage 移除标记且 state 更新为 false', () => {
    window.localStorage.setItem('ihui-notification-sound-enabled', '1')
    const { result } = renderHook(() => useNotification())
    expect(result.current.soundEnabled).toBe(true)
    act(() => {
      result.current.setSoundEnabled(false)
    })
    expect(result.current.soundEnabled).toBe(false)
    expect(window.localStorage.getItem('ihui-notification-sound-enabled')).toBeNull()
  })
})
