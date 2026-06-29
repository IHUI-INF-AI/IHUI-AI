import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { websocketService, createAuthWebSocket } from '../websocket'
import { logger } from '../logger'
import { getUserToken } from '../request'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../request', () => ({
  getUserToken: vi.fn(() => 'mock-token-123'),
}))

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: Error) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(public url: string) {}

  send = vi.fn()
  close = vi.fn()

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  simulateError(error: Error) {
    this.onerror?.(error)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('websocket', () => {
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    originalWebSocket = global.WebSocket
    
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket
    Object.defineProperty(global.WebSocket, 'CONNECTING', { value: 0 })
    Object.defineProperty(global.WebSocket, 'OPEN', { value: 1 })
    Object.defineProperty(global.WebSocket, 'CLOSING', { value: 2 })
    Object.defineProperty(global.WebSocket, 'CLOSED', { value: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
    global.WebSocket = originalWebSocket
    websocketService.disconnect()
  })

  describe('websocketService', () => {
    describe('status', () => {
      it('应该返回disconnected当没有连接', () => {
        websocketService.disconnect()
        expect(websocketService.status).toBe('disconnected')
      })
    })

    describe('connect', () => {
      it('应该成功连接', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        
        await expect(connectPromise).resolves.toBeUndefined()
      })

      it('应该带token连接', async () => {
        const connectPromise = websocketService.connect('ws://test.com', 'my-token')
        
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          expect(service.ws.url).toBe('ws://test.com?token=my-token')
          service.ws.simulateOpen()
        }
        
        await expect(connectPromise).resolves.toBeUndefined()
      })
    })

    describe('disconnect', () => {
      it('应该断开连接', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise

        websocketService.disconnect()
        
        if (service.ws) {
          expect(service.ws.close).toHaveBeenCalled()
        }
      })
    })

    describe('send', () => {
      it('应该发送消息', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise

        websocketService.send('test-type', { data: 'test' })
        
        if (service.ws) {
          expect(service.ws.send).toHaveBeenCalled()
          const sentData = JSON.parse(service.ws.send.mock.calls[0][0])
          expect(sentData.type).toBe('test-type')
          expect(sentData.data).toEqual({ data: 'test' })
          expect(sentData.timestamp).toBeDefined()
        }
      })

      it('应该警告当未连接时', () => {
        websocketService.disconnect()
        websocketService.send('test-type', { data: 'test' })
        
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('on', () => {
      it('应该订阅消息', async () => {
        const handler = vi.fn()
        
        websocketService.on('test-type', handler)
        
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        
        if (service.ws) {
          service.ws.simulateMessage({ type: 'test-type', data: 'test-data' })
        }
        
        expect(handler).toHaveBeenCalledWith('test-data')
      })

      it('应该返回取消订阅函数', async () => {
        const handler = vi.fn()
        
        const unsubscribe = websocketService.on('test-type', handler)
        unsubscribe()
        
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        
        if (service.ws) {
          service.ws.simulateMessage({ type: 'test-type', data: 'test-data' })
        }
        
        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('onStatusChange', () => {
      it('应该监听状态变化', async () => {
        const handler = vi.fn()
        
        websocketService.onStatusChange(handler)
        
        const connectPromise = websocketService.connect('ws://test.com')
        
        expect(handler).toHaveBeenCalledWith('connecting')
        
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        
        expect(handler).toHaveBeenCalledWith('connected')
      })
    })

    describe('attemptReconnect', () => {
      it('应该停止重连当达到最大次数', async () => {
        const service = websocketService as unknown as { 
          reconnectAttempts: number
          maxReconnectAttempts: number
          attemptReconnect: () => void
        }
        service.reconnectAttempts = 5
        service.maxReconnectAttempts = 5
        
        service.attemptReconnect()
        
        expect(logger.warn).toHaveBeenCalledWith('[WebSocket] Max reconnection attempts reached')
      })
    })

    describe('handleMessage', () => {
      it('应该处理无效JSON', async () => {
        const handler = vi.fn()

        websocketService.on('test-type', handler)

        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise

        if (service.ws && service.ws.onmessage) {
          service.ws.onmessage({ data: 'invalid-json' })
        }

        expect(logger.error).toHaveBeenCalled()
      })

      // 测试未注册类型时不调用 handler
      it('收到未注册类型消息时不应调用 handler', async () => {
        const handler = vi.fn()
        websocketService.on('known-type', handler)

        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise

        if (service.ws) {
          service.ws.simulateMessage({ type: 'unknown-type', data: 'x' })
        }

        expect(handler).not.toHaveBeenCalled()
      })
    })

    // 覆盖 status getter 各种 readyState
    describe('status getter', () => {
      it('CONNECTING 时返回 connecting', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.readyState = MockWebSocket.CONNECTING
          expect(websocketService.status).toBe('connecting')
          service.ws.simulateOpen()
        }
        await connectPromise
      })

      it('OPEN 时返回 connected', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        if (service.ws) {
          service.ws.readyState = MockWebSocket.OPEN
          expect(websocketService.status).toBe('connected')
        }
      })

      it('CLOSING 时返回 disconnected', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        if (service.ws) {
          service.ws.readyState = MockWebSocket.CLOSING
          expect(websocketService.status).toBe('disconnected')
        }
      })

      it('CLOSED 时返回 disconnected', async () => {
        const connectPromise = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) {
          service.ws.simulateOpen()
        }
        await connectPromise
        if (service.ws) {
          service.ws.readyState = MockWebSocket.CLOSED
          expect(websocketService.status).toBe('disconnected')
        }
      })

      it('未知 readyState 时返回 error', () => {
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        // 使用具备 close 方法的桩对象，避免 disconnect 抛错
        service.ws = { readyState: 999, close: vi.fn() } as unknown as MockWebSocket
        expect(websocketService.status).toBe('error')
      })
    })

    // 覆盖 connect 已连接时的早返回分支
    describe('connect 已连接分支', () => {
      it('已连接时再次调用 connect 应直接返回', async () => {
        const p1 = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) service.ws.simulateOpen()
        await p1

        await websocketService.connect('ws://test.com')
        expect(logger.warn).toHaveBeenCalledWith('[WebSocket] Already connected')
      })
    })

    // 覆盖 doConnect 抛错分支（new WebSocket 构造时抛出）
    describe('doConnect 异常分支', () => {
      it('new WebSocket 抛出时应 reject 并记录错误', async () => {
        // 使用 class 确保构造时抛错
        class FailingWS {
          constructor() {
            throw new Error('construct fail')
          }
        }
        // 模拟浏览器环境：把 WebSocket 静态属性加到 FailingWS 上，
        // 避免源文件里 WebSocket.OPEN 等引用拿到 undefined
        ;(FailingWS as unknown as Record<string, unknown>).CONNECTING = 0
        ;(FailingWS as unknown as Record<string, unknown>).OPEN = 1
        ;(FailingWS as unknown as Record<string, unknown>).CLOSING = 2
        ;(FailingWS as unknown as Record<string, unknown>).CLOSED = 3
        const original = global.WebSocket
        global.WebSocket = FailingWS as unknown as typeof WebSocket

        // 期望 connect 返回的 promise 被 reject
        await expect(websocketService.connect('ws://test.com')).rejects.toThrow('construct fail')
        expect(logger.error).toHaveBeenCalled()

        global.WebSocket = original
      })
    })

    // 覆盖 attemptReconnect 正常路径：累加计数 + 调度定时器 + 重新连接
    describe('attemptReconnect 正常流程', () => {
      it('未达最大次数时应累加计数并通过定时器重连', async () => {
        const p1 = websocketService.connect('ws://test.com', 'tk')
        const service = websocketService as unknown as { ws: MockWebSocket | null, reconnectAttempts: number }
        if (service.ws) service.ws.simulateOpen()
        await p1

        // 触发关闭，触发 attemptReconnect
        if (service.ws) service.ws.simulateClose()

        expect(service.reconnectAttempts).toBe(1)

        // 推进时间到重连延时（默认 3000ms）
        await vi.advanceTimersByTimeAsync(3000)

        // 关闭后第一个 ws 已被置 null；重连会创建新的 MockWebSocket
        // 我们检查重新创建了一个连接
        const service2 = websocketService as unknown as { ws: MockWebSocket | null }
        expect(service2.ws).not.toBeNull()
      })

      it('关闭事件应通知 disconnected 状态', async () => {
        const statusHandler = vi.fn()
        websocketService.onStatusChange(statusHandler)

        const p1 = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) service.ws.simulateOpen()
        await p1

        statusHandler.mockClear()
        if (service.ws) service.ws.simulateClose()
        expect(statusHandler).toHaveBeenCalledWith('disconnected')
      })
    })

    // 覆盖 disconnect 清理重连定时器分支
    describe('disconnect 清理定时器', () => {
      it('在重连定时器未触发前 disconnect 应清掉定时器', async () => {
        const p1 = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null, reconnectTimer: ReturnType<typeof setTimeout> | null }
        if (service.ws) service.ws.simulateOpen()
        await p1

        if (service.ws) service.ws.simulateClose()
        expect(service.reconnectTimer).not.toBeNull()

        websocketService.disconnect()
        expect(service.reconnectTimer).toBeNull()
      })
    })

    // 覆盖 on 多次订阅、onStatusChange 取消订阅
    describe('on 多次订阅与 onStatusChange 取消', () => {
      it('同类型多个 handler 都应被调用', async () => {
        const h1 = vi.fn()
        const h2 = vi.fn()
        websocketService.on('multi', h1)
        websocketService.on('multi', h2)

        const p = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) service.ws.simulateOpen()
        await p

        if (service.ws) service.ws.simulateMessage({ type: 'multi', data: 'd' })
        expect(h1).toHaveBeenCalledWith('d')
        expect(h2).toHaveBeenCalledWith('d')
      })

      it('onStatusChange 返回的取消函数应解除监听', async () => {
        const handler = vi.fn()
        const off = websocketService.onStatusChange(handler)

        const p = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) service.ws.simulateOpen()
        await p

        handler.mockClear()
        off()

        if (service.ws) service.ws.simulateClose()
        expect(handler).not.toHaveBeenCalled()
      })

      it('on 返回的取消函数对未注册类型不应报错', () => {
        const handler = vi.fn()
        const off = websocketService.on('never-registered', handler)
        // 取消订阅时 handlers 已被清空（不存在的 key）
        // 这里实际不会进入内部 if(handlers) 分支，验证不抛错
        expect(() => off()).not.toThrow()
      })
    })

    // 覆盖 onerror 触发 reject 的分支（doConnect 中 ws.onerror）
    describe('onerror 分支', () => {
      it('ws.onerror 触发时 connect promise 应 reject', async () => {
        const p = websocketService.connect('ws://test.com')
        const service = websocketService as unknown as { ws: MockWebSocket | null }
        if (service.ws) service.ws.simulateError(new Error('boom'))
        await expect(p).rejects.toThrow('boom')
      })
    })
  })
})

// createAuthWebSocket 是顶层独立函数，独立 describe
describe('createAuthWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有 token 时应在 URL 末尾添加 ?token=xxx', () => {
    vi.mocked(getUserToken).mockReturnValue('abc')
    const ws = createAuthWebSocket('ws://example.com/socket')
    expect(ws.url).toBe('ws://example.com/socket?token=abc')
  })

  it('URL 已带 query 时应使用 & 连接 token', () => {
    vi.mocked(getUserToken).mockReturnValue('xyz')
    const ws = createAuthWebSocket('ws://example.com/socket?room=1')
    expect(ws.url).toBe('ws://example.com/socket?room=1&token=xyz')
  })

  it('无 token 时应使用原 URL', () => {
    vi.mocked(getUserToken).mockReturnValue(null)
    const ws = createAuthWebSocket('ws://example.com/socket')
    expect(ws.url).toBe('ws://example.com/socket')
  })

  it('token 为空字符串时应使用原 URL', () => {
    vi.mocked(getUserToken).mockReturnValue('')
    const ws = createAuthWebSocket('ws://example.com/socket')
    expect(ws.url).toBe('ws://example.com/socket')
  })
})
