/**
 * useNotificationWebSocket WS 连接/断线/重连测试
 *
 * 覆盖:
 * - 连接建立
 * - 消息接收回调
 * - 断线检测
 * - token 变化重连
 * - unmount 断开连接
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

interface ClientMock {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  callbacks: {
    onOpen?: () => void
    onClose?: () => void
    onMessage?: (data: unknown) => void
  }
}

const { mockCreateClient, mockGetToken, clients } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetToken: vi.fn(() => 'test-token'),
  clients: [] as ClientMock[],
}))

vi.mock('@ihui/api-client', () => ({
  createNotificationClient: mockCreateClient,
}))

vi.mock('../src/lib/token', () => ({
  getToken: mockGetToken,
}))

vi.mock('../src/lib/config', () => ({
  API_BASE_URL: 'http://localhost:3000',
}))

import { useNotificationWebSocket } from '../src/hooks/use-websocket'

mockCreateClient.mockImplementation(
  (_config: unknown, callbacks: ClientMock['callbacks']): ClientMock => {
    const client: ClientMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      callbacks: callbacks ?? {},
    }
    clients.push(client)
    return client
  },
)

describe('useNotificationWebSocket WS 连接/断线/重连', () => {
  beforeEach(() => {
    clients.length = 0
    vi.clearAllMocks()
    mockGetToken.mockReturnValue('test-token')
  })

  it('有 token 时建立连接', () => {
    renderHook(() => useNotificationWebSocket('test-token'))
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(clients[0].connect).toHaveBeenCalled()
  })

  it('无 token 时不建立连接', () => {
    renderHook(() => useNotificationWebSocket(null))
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('连接建立后 onOpen 回调设置 connected=true', () => {
    const { result } = renderHook(() => useNotificationWebSocket('test-token'))
    expect(result.current.connected).toBe(false)

    act(() => {
      clients[0].callbacks.onOpen?.()
    })

    expect(result.current.connected).toBe(true)
  })

  it('断线时 onClose 回调设置 connected=false', () => {
    const { result } = renderHook(() => useNotificationWebSocket('test-token'))

    act(() => {
      clients[0].callbacks.onOpen?.()
    })
    expect(result.current.connected).toBe(true)

    act(() => {
      clients[0].callbacks.onClose?.()
    })

    expect(result.current.connected).toBe(false)
  })

  it('消息接收:onMessage 回调更新 lastMessage', () => {
    const { result } = renderHook(() => useNotificationWebSocket('test-token'))

    act(() => {
      clients[0].callbacks.onMessage?.({ type: 'test', data: 'hello' })
    })

    expect(result.current.lastMessage).toEqual({ type: 'test', data: 'hello' })
  })

  it('unmount 时断开连接', () => {
    const { unmount } = renderHook(() => useNotificationWebSocket('test-token'))
    const client = clients[0]

    unmount()

    expect(client.disconnect).toHaveBeenCalled()
  })

  it('token 从 null 变为有值时建立连接', () => {
    const { rerender } = renderHook(
      ({ token }) => useNotificationWebSocket(token),
      { initialProps: { token: null as string | null } },
    )

    expect(mockCreateClient).not.toHaveBeenCalled()

    rerender({ token: 'new-token' })

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(clients[0].connect).toHaveBeenCalled()
  })

  it('token 变化时断开旧连接建立新连接', () => {
    const { rerender } = renderHook(
      ({ token }) => useNotificationWebSocket(token),
      { initialProps: { token: 'token-1' } },
    )

    const oldClient = clients[0]
    expect(oldClient.connect).toHaveBeenCalled()

    rerender({ token: 'token-2' })

    expect(oldClient.disconnect).toHaveBeenCalled()
    expect(clients[1].connect).toHaveBeenCalled()
  })
})
