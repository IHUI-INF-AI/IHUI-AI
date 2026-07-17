import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { NotificationProvider, useNotificationStore } from '../src/stores/notification'
import type { WSNotification } from '@ihui/api-client'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(NotificationProvider, null, children)
}

function makeWs(data: Record<string, unknown>): WSNotification {
  return { type: 'notification', data: { type: 'system', ...data } } as WSNotification
}

describe('notification store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty with 0 unread and hidden', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.visible).toBe(false)
  })

  it('addFromWs ignores null', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(null))
    expect(result.current.notifications).toHaveLength(0)
  })

  it('addFromWs ignores messages with wrong type', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs({ type: 'other', data: {} } as unknown as WSNotification))
    expect(result.current.notifications).toHaveLength(0)
  })

  it('addFromWs adds a valid notification as unread at the head', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '1', title: 'T1', content: 'C1' })))
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unreadCount).toBe(1)
    expect(result.current.notifications[0]?.title).toBe('T1')
    expect(result.current.notifications[0]?.isRead).toBe(false)
  })

  it('addFromWs derives "AI 回复" title for ai_response subtype when title missing', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '2', type: 'ai_response', content: 'c' })))
    expect(result.current.notifications[0]?.title).toBe('AI 回复')
  })

  it('addFromWs derives "新通知" title for unknown subtype when title missing', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '3', type: 'system' })))
    expect(result.current.notifications[0]?.title).toBe('新通知')
  })

  it('addFromWs extracts content from nested message.content when content missing', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '4', message: { content: 'nested-content' } })))
    expect(result.current.notifications[0]?.content).toBe('nested-content')
  })

  it('markAllRead sets all notifications read and unreadCount to 0', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '5' })))
    act(() => result.current.addFromWs(makeWs({ id: '6' })))
    act(() => result.current.markAllRead())
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.isRead)).toBe(true)
  })

  it('clearAll empties the list and resets unreadCount', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.addFromWs(makeWs({ id: '7' })))
    act(() => result.current.clearAll())
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it('setVisible toggles panel visibility', () => {
    const { result } = renderHook(() => useNotificationStore(), { wrapper })
    act(() => result.current.setVisible(true))
    expect(result.current.visible).toBe(true)
    act(() => result.current.setVisible(false))
    expect(result.current.visible).toBe(false)
  })
})
