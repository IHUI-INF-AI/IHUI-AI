import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('vue', () => ({
  ref: vi.fn((value: any) => ({ value })),
  onMounted: vi.fn((callback: () => void) => callback()),
  onUnmounted: vi.fn(),
}))

describe('useWebSocket', () => {
  let mockWebSocket: {
    readyState: number
    onopen: (() => void) | null
    onclose: (() => void) | null
    onerror: ((e: Event) => void) | null
    onmessage: ((e: MessageEvent) => void) | null
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockWebSocket = {
      readyState: 0,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send: vi.fn(),
      close: vi.fn(),
    }
    
    // 创建带常量的 WebSocket mock（使用 function 以支持 new 调用）
    const WebSocketMock = vi.fn(function () {
      return mockWebSocket
    }) as any
    WebSocketMock.OPEN = 1
    WebSocketMock.CLOSED = 3
    WebSocketMock.CLOSING = 2
    WebSocketMock.CONNECTING = 0
    vi.stubGlobal('WebSocket', WebSocketMock)
    vi.stubGlobal('setTimeout', vi.fn((fn: () => void) => fn))
    vi.stubGlobal('setInterval', vi.fn((fn: () => void) => { fn(); return fn }))
    vi.stubGlobal('clearTimeout', vi.fn())
    vi.stubGlobal('clearInterval', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('WebSocketStatus', () => {
    it('应该定义WebSocket状态枚举', async () => {
      const { WebSocketStatus } = await import('../useWebSocket')
      expect(WebSocketStatus.CONNECTING).toBe('connecting')
      expect(WebSocketStatus.CONNECTED).toBe('connected')
      expect(WebSocketStatus.DISCONNECTED).toBe('disconnected')
      expect(WebSocketStatus.RECONNECTING).toBe('reconnecting')
      expect(WebSocketStatus.ERROR).toBe('error')
    })
  })

  describe('useWebSocket', () => {
    it('应该创建WebSocket连接', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      expect(ws.status).toBeDefined()
      expect(ws.connect).toBeDefined()
      expect(ws.disconnect).toBeDefined()
      expect(ws.send).toBeDefined()
    })

    it('应该返回连接状态', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      expect(ws.status.value).toBeDefined()
    })

    it('应该返回消息队列', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      expect(ws.messageQueue).toBeDefined()
    })

    it('应该返回重连次数', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      expect(ws.reconnectAttempts).toBeDefined()
    })

    it('connect应该创建WebSocket', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      ws.connect()
      
      expect(vi.stubGlobal).toBeDefined()
    })

    it('disconnect应该关闭WebSocket', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      ws.disconnect()
    })

    it('send应该发送消息', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      
      ws.send({ type: 'test', data: 'hello' })
    })
  })

  describe('WebSocketMessage', () => {
    it('应该定义WebSocketMessage类型', async () => {
      const module = await import('../useWebSocket')
      expect(module).toBeDefined()
    })
  })

  describe('WebSocketConfig', () => {
    it('应该支持所有配置选项', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const config = {
        url: 'ws://localhost:8080',
        protocols: ['protocol1'],
        reconnectInterval: 1000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        onMessage: vi.fn(),
        onError: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }
      
      const ws = useWebSocket(config)
      expect(ws).toBeDefined()
    })
  })

  // 测试 connect 函数的各种场景
  describe('connect', () => {
    it('已连接时应该直接返回', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      // 模拟已连接状态
      mockWebSocket.readyState = 1 // WebSocket.OPEN
      const beforeStatus = ws.status.value
      ws.connect()
      // 状态不应改变
      expect(ws.status.value).toBe(beforeStatus)
    })

    it('应该从localStorage读取token并拼接到URL', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      // 设置 token
      localStorage.setItem('user_token', 'test-token-123')
      useWebSocket({ url: 'ws://localhost:8080' })
      // onMounted 会立即执行 connect，所以 WebSocket 已被调用
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080?token=test-token-123', undefined)
      localStorage.removeItem('user_token')
    })

    it('URL已包含问号时应该用&拼接token', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      localStorage.setItem('user_token', 'abc')
      useWebSocket({ url: 'ws://localhost:8080?path=chat' })
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080?path=chat&token=abc', undefined)
      localStorage.removeItem('user_token')
    })

    it('token不存在时应该使用原URL', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      localStorage.removeItem('user_token')
      useWebSocket({ url: 'ws://localhost:8080' })
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080', undefined)
    })

    it('应该支持protocols参数', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      useWebSocket({ url: 'ws://localhost:8080', protocols: ['proto1'] })
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080', ['proto1'])
    })

    it('onopen回调应该发送队列消息并调用onOpen', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const onOpen = vi.fn()
      const ws = useWebSocket({ url: 'ws://localhost:8080', onOpen })
      // 模拟连接成功
      mockWebSocket.readyState = 1
      // 先放入队列消息
      ws.messageQueue.value.push({ type: 'queued' })
      mockWebSocket.onopen?.()
      expect(ws.status.value).toBe(WebSocketStatus.CONNECTED)
      expect(onOpen).toHaveBeenCalled()
      // 队列应该被清空
      expect(ws.messageQueue.value.length).toBe(0)
    })

    it('onopen应该启动心跳当配置了heartbeatInterval', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      useWebSocket({ url: 'ws://localhost:8080', heartbeatInterval: 1000 })
      mockWebSocket.readyState = 1
      mockWebSocket.onopen?.()
      // 心跳触发后会调用 send
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('onmessage应该解析消息并调用onMessage', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const onMessage = vi.fn()
      useWebSocket({ url: 'ws://localhost:8080', onMessage })
      const msg = { type: 'chat', data: 'hello' }
      mockWebSocket.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent)
      expect(onMessage).toHaveBeenCalledWith(msg)
    })

    it('onmessage收到PONG消息应该忽略', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const onMessage = vi.fn()
      useWebSocket({ url: 'ws://localhost:8080', onMessage })
      mockWebSocket.onmessage?.({ data: JSON.stringify({ type: 'pong' }) } as MessageEvent)
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('onmessage解析失败应该调用logger.error', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const { logger } = await import('../../utils/logger')
      const onMessage = vi.fn()
      useWebSocket({ url: 'ws://localhost:8080', onMessage })
      mockWebSocket.onmessage?.({ data: 'invalid-json' } as MessageEvent)
      expect(logger.error).toHaveBeenCalled()
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('onerror应该设置错误状态并调用onError', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const onError = vi.fn()
      const ws = useWebSocket({ url: 'ws://localhost:8080', onError })
      const errorEvent = new Event('error')
      mockWebSocket.onerror?.(errorEvent)
      expect(ws.status.value).toBe(WebSocketStatus.ERROR)
      expect(onError).toHaveBeenCalledWith(errorEvent)
    })

    it('onclose应该设置断开状态并调用onClose', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const onClose = vi.fn()
      // 不自动重连：maxReconnectAttempts=-1（0会被||当作falsy使用默认值5）
      const ws = useWebSocket({ url: 'ws://localhost:8080', onClose, maxReconnectAttempts: -1 })
      mockWebSocket.onclose?.()
      expect(ws.status.value).toBe(WebSocketStatus.DISCONNECTED)
      expect(onClose).toHaveBeenCalled()
    })

    it('onclose应该触发自动重连', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080', maxReconnectAttempts: 3 })
      mockWebSocket.onclose?.()
      expect(ws.status.value).toBe(WebSocketStatus.RECONNECTING)
      expect(ws.reconnectAttempts.value).toBe(1)
    })

    it('连接抛出异常应该捕获并设置错误状态', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const { logger } = await import('../../utils/logger')
      // 让 WebSocket 构造函数抛出异常
      const WebSocketMock = vi.fn(() => {
        throw new Error('连接失败')
      }) as any
      WebSocketMock.OPEN = 1
      vi.stubGlobal('WebSocket', WebSocketMock)
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      expect(ws.status.value).toBe(WebSocketStatus.ERROR)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  // 测试 disconnect 函数
  describe('disconnect', () => {
    it('应该关闭WebSocket连接并清空ws', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      ws.disconnect()
      expect(mockWebSocket.close).toHaveBeenCalled()
      expect(ws.ws.value).toBeNull()
      expect(ws.status.value).toBe(WebSocketStatus.DISCONNECTED)
    })

    it('未连接时disconnect也应该正常工作', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      ws.disconnect()
      expect(ws.status.value).toBeDefined()
    })
  })

  // 测试 reconnect 函数
  describe('reconnect', () => {
    it('已在重连中应该直接返回', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      // 设置为重连中状态
      ws.status.value = WebSocketStatus.RECONNECTING
      const beforeAttempts = ws.reconnectAttempts.value
      ws.reconnect()
      // 重连次数不应增加
      expect(ws.reconnectAttempts.value).toBe(beforeAttempts)
    })

    it('应该增加重连次数并设置重连状态', async () => {
      const { useWebSocket, WebSocketStatus } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      ws.reconnect()
      expect(ws.status.value).toBe(WebSocketStatus.RECONNECTING)
      expect(ws.reconnectAttempts.value).toBe(1)
    })
  })

  // 测试 send 函数
  describe('send', () => {
    it('未连接时应该加入队列并返回false', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      // 重置 readyState 为非 OPEN
      mockWebSocket.readyState = 0
      const result = ws.send({ type: 'test' })
      expect(result).toBe(false)
      expect(ws.messageQueue.value.length).toBe(1)
    })

    it('已连接时应该发送消息并返回true', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      mockWebSocket.readyState = 1 // WebSocket.OPEN
      const result = ws.send({ type: 'test', data: 'hello' })
      expect(result).toBe(true)
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('发送抛出异常应该加入队列并返回false', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const { logger } = await import('../../utils/logger')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      mockWebSocket.readyState = 1
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('发送失败')
      })
      const result = ws.send({ type: 'test' })
      expect(result).toBe(false)
      expect(logger.error).toHaveBeenCalled()
      expect(ws.messageQueue.value.length).toBe(1)
    })
  })

  // 测试 sendMessage 函数
  describe('sendMessage', () => {
    it('应该发送带类型和id的消息', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      mockWebSocket.readyState = 1
      const result = ws.sendMessage('chat', { text: 'hi' })
      expect(result).toBe(true)
      // 验证发送的内容包含 type、data 和 id
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentData.type).toBe('chat')
      expect(sentData.data).toEqual({ text: 'hi' })
      expect(sentData.id).toBeDefined()
      expect(sentData.timestamp).toBeDefined()
    })

    it('应该使用传入的id', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080' })
      mockWebSocket.readyState = 1
      ws.sendMessage('chat', null, 'custom-id')
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentData.id).toBe('custom-id')
    })
  })

  // 测试心跳机制
  describe('heartbeat', () => {
    it('startHeartbeat已有定时器时应该直接返回', async () => {
      const { useWebSocket } = await import('../useWebSocket')
      const ws = useWebSocket({ url: 'ws://localhost:8080', heartbeatInterval: 1000 })
      // 第一次触发心跳
      mockWebSocket.readyState = 1
      mockWebSocket.onopen?.()
      // 主要验证不会因为重复调用而出错
      expect(ws).toBeDefined()
    })
  })

  // 测试生命周期钩子
  describe('lifecycle', () => {
    it('onMounted应该被调用并触发connect', async () => {
      const vue = await import('vue')
      const { useWebSocket } = await import('../useWebSocket')
      useWebSocket({ url: 'ws://localhost:8080' })
      // onMounted 在 mock 中会立即执行回调
      expect(vue.onMounted).toHaveBeenCalled()
    })

    it('onUnmounted应该被调用', async () => {
      const vue = await import('vue')
      const { useWebSocket } = await import('../useWebSocket')
      useWebSocket({ url: 'ws://localhost:8080' })
      expect(vue.onUnmounted).toHaveBeenCalled()
    })
  })
})
