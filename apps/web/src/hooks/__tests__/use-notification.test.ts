// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
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
