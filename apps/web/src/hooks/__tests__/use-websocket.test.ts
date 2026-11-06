// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { isAIResponse, useWebSocket, type WSNotification } from '../use-websocket'

const wsMocks = vi.hoisted(() => ({
  clients: [] as Array<{
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    handlers: {
      onOpen?: () => void
      onClose?: () => void
      onMessage?: (message: unknown) => void
    }
  }>,
}))

vi.mock('@ihui/api-client', () => ({
  createNotificationClient: vi.fn((_config: unknown, handlers: unknown) => {
    const client = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      handlers: handlers as {
        onOpen?: () => void
        onClose?: () => void
        onMessage?: (message: unknown) => void
      },
    }
    wsMocks.clients.push(client)
    return client
  }),
}))

vi.mock('@/stores/auth', () => {
  const useAuthStore = (selector: (s: { token: string | null }) => unknown) =>
    selector({ token: 'tok-1' })
  return { useAuthStore: Object.assign(useAuthStore, { getState: () => ({ token: 'tok-1' }) }) }
})

vi.mock('@/hooks/use-conversation-broadcast-sync', () => ({
  useConversationBroadcastSync: vi.fn(),
}))

vi.mock('@/lib/api-base-url', () => ({ resolveWsApiBaseUrl: () => 'http://test.local' }))

/**
 * isAIResponse 类型守卫测试。
 *
 * Plan A 回调链路的回归守门:确保 ai_response 推送的载荷结构
 * (type/conversationId/clientMessageId/message)被正确识别,
 * 防止字段名漂移导致 chat/page.tsx 静默丢弃 AI 回复推送。
 */
describe('isAIResponse 类型守卫', () => {
  it('识别完整的 ai_response 推送', () => {
    const n: WSNotification = {
      type: 'notification',
      data: {
        type: 'ai_response',
        conversationId: 'conv-1',
        clientMessageId: 'placeholder-uuid',
        message: { id: 'db-id', role: 'assistant', content: 'hello', createdAt: '2026-01-01' },
      },
    }
    expect(isAIResponse(n)).toBe(true)
  })

  it('识别无 clientMessageId 的 ai_response(多端同步场景)', () => {
    const n: WSNotification = {
      type: 'notification',
      data: {
        type: 'ai_response',
        conversationId: 'conv-1',
        message: { id: 'db-id', role: 'assistant', content: 'hello' },
      },
    }
    expect(isAIResponse(n)).toBe(true)
  })

  it('拒绝 null', () => {
    expect(isAIResponse(null)).toBe(false)
  })

  it('拒绝非 ai_response 类型', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'chat_message', message: { id: '1', role: 'user', content: 'x' } },
    }
    expect(isAIResponse(n)).toBe(false)
  })

  it('拒绝缺少 message 的 ai_response', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'ai_response', conversationId: 'conv-1' },
    }
    expect(isAIResponse(n)).toBe(false)
  })

  it('接受 message 为空对象的 ai_response(守卫只检查 message 真值)', () => {
    const n: WSNotification = {
      type: 'notification',
      data: { type: 'ai_response', conversationId: 'conv-1', message: {} as never },
    }
    // message 存在但无 id 字段 — 守卫只检查 !!message,空对象通过
    // 可接受:消费方读 message.id 替换占位,空 id 不会破坏 store
    expect(isAIResponse(n)).toBe(true)
  })
})

describe('useWebSocket - 单连接(引用计数)', () => {
  beforeEach(() => {
    wsMocks.clients.length = 0
  })

  it('多个消费方只建立一条 /ws/notifications 连接', () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())

    expect(wsMocks.clients).toHaveLength(1)
    expect(wsMocks.clients[0]!.connect).toHaveBeenCalledTimes(1)

    first.unmount()
    second.unmount()
  })

  it('一条连接的消息广播给全部消费方', () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())
    expect(wsMocks.clients).toHaveLength(1)

    act(() => {
      wsMocks.clients[0]!.handlers.onMessage?.({
        type: 'notification',
        data: { type: 'notification', id: 'b-1', title: '广播' },
      })
    })

    expect(first.result.current.lastMessage?.data.id).toBe('b-1')
    expect(second.result.current.lastMessage?.data.id).toBe('b-1')

    first.unmount()
    second.unmount()
  })

  it('最后一个消费方卸载后才断开连接', () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())
    expect(wsMocks.clients).toHaveLength(1)

    first.unmount()
    expect(wsMocks.clients[0]!.disconnect).not.toHaveBeenCalled()

    second.unmount()
    expect(wsMocks.clients[0]!.disconnect).toHaveBeenCalledTimes(1)
  })

  it('连接状态由底层唯一条连接推送到全部消费方', () => {
    const first = renderHook(() => useWebSocket())
    const second = renderHook(() => useWebSocket())

    act(() => {
      wsMocks.clients[0]!.handlers.onOpen?.()
    })
    expect(first.result.current.connected).toBe(true)
    expect(second.result.current.connected).toBe(true)

    act(() => {
      wsMocks.clients[0]!.handlers.onClose?.()
    })
    expect(first.result.current.connected).toBe(false)
    expect(second.result.current.connected).toBe(false)

    first.unmount()
    second.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
