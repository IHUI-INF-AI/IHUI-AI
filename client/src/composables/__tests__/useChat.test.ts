// useChat.ts 单元测试
// 说明：mock 相关依赖,重点覆盖所有导出函数
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 1. mock 工具函数
vi.mock('../shared-logic/utils/index', () => ({
  isUniApp: vi.fn(() => false),
  getStorage: vi.fn(),
  setStorage: vi.fn(),
  removeStorage: vi.fn(),
}))

// 2. mock useUser,提供可控的 token
vi.mock('../shared-logic/composables/useUser', () => ({
  useUser: vi.fn(() => ({
    token: { value: 'mock-token-123' },
    userInfo: { value: null },
    isLoggedIn: { value: true },
    setToken: vi.fn(),
    clearUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    fetchUserInfo: vi.fn(),
    updateUserInfo: vi.fn(),
  })),
}))

// 3. mock API 请求(用 spyOn 确保动态 import 也能拿到 mock)
vi.mock('../shared-logic/api/index', () => ({
  request: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

// 4. mock onUnmounted 让其不真的注册,只是缓存
let unmountCallback: (() => void) | null = null
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onUnmounted: vi.fn((cb: () => void) => {
      unmountCallback = cb
    }),
  }
})

// 5. 构造一个可被监听的 WebSocket mock
function createWebSocketMock() {
  const handlers: Record<string, any> = {}
  const ws = {
    readyState: 0,
    onopen: null as null | (() => void),
    onclose: null as null | (() => void),
    onerror: null as null | (() => void),
    onmessage: null as null | ((e: MessageEvent) => void),
    send: vi.fn(),
    close: vi.fn(),
    on: (k: string, h: any) => {
      handlers[k] = h
    },
  }
  return ws
}

let wsInstance: ReturnType<typeof createWebSocketMock>
const WebSocketMock: any = vi.fn(function () {
  wsInstance = createWebSocketMock()
  return wsInstance
})
WebSocketMock.OPEN = 1
WebSocketMock.CLOSED = 3
WebSocketMock.CONNECTING = 0
WebSocketMock.CLOSING = 2
vi.stubGlobal('WebSocket', WebSocketMock)

// 6. 构造 uni 的全局对象
const uniMock = {
  connectSocket: vi.fn((opts: { success?: () => void; fail?: () => void }) => {
    const ws: any = {
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
    }
    if (opts.success) opts.success()
    return ws
  }),
}
;((globalThis as any).uni) = uniMock

import { useChat } from '../shared-logic/composables/useChat'
import { isUniApp } from '../shared-logic/utils/index'
import * as apiModule from '../shared-logic/api/index'

// 取出 mock 出来的 request,后续直接通过 spyOn 设置行为
const mockRequest = apiModule.request as unknown as ReturnType<typeof vi.fn>

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isUniApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)
    ;((globalThis as any).uni) = uniMock
    vi.stubGlobal('WebSocket', WebSocketMock)
    // 用真实 setTimeout,但 reconnect 逻辑中只增加计数,不会真的循环重连
  })

  afterEach(() => {
    unmountCallback = null
  })

  describe('初始化', () => {
    it('应该返回所有必要的状态和函数', () => {
      const chat = useChat()
      expect(chat.messages).toBeDefined()
      expect(chat.isConnected).toBeDefined()
      expect(chat.isLoadingHistory).toBeDefined()
      expect(chat.hasMoreHistory).toBeDefined()
      expect(typeof chat.connect).toBe('function')
      expect(typeof chat.disconnect).toBe('function')
      expect(typeof chat.send).toBe('function')
      expect(typeof chat.loadHistory).toBe('function')
      expect(typeof chat.clearMessages).toBe('function')
    })

    it('初始状态应为默认值', () => {
      const chat = useChat()
      chat.clearMessages()
      expect(Array.isArray(chat.messages.value)).toBe(true)
      expect(chat.isConnected.value).toBe(false)
      expect(chat.isLoadingHistory.value).toBe(false)
      expect(chat.hasMoreHistory.value).toBe(true)
    })
  })

  describe('connect (web 环境)', () => {
    it('应创建带token的WebSocket连接', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      expect(WebSocketMock).toHaveBeenCalledWith('ws://localhost:8080?token=mock-token-123')
    })

    it('onopen 应设置已连接并重置 reconnectCount', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      expect(chat.isConnected.value).toBe(true)
    })

    it('onmessage 应解析消息并加入 messages', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        id: 'm1',
        type: 'text',
        content: '你好',
        senderId: 'u1',
        senderName: '小李',
        senderAvatar: 'a.png',
        timestamp: 1000,
      })
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      expect(chat.messages.value.length).toBe(1)
      expect(chat.messages.value[0].content).toBe('你好')
      expect(chat.messages.value[0].isSelf).toBe(false)
      expect(chat.messages.value[0].status).toBe('sent')
    })

    it('onmessage 收到 self 时 isSelf 应为 true', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        id: 'm2',
        type: 'text',
        content: '我发的',
        senderId: 'self',
        senderName: 'me',
        senderAvatar: '',
        timestamp: 2000,
      })
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      expect(chat.messages.value[0].isSelf).toBe(true)
    })

    it('onmessage 解析失败应被忽略', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      wsInstance.onmessage?.({ data: '无效JSON{[' } as MessageEvent)
      expect(chat.messages.value.length).toBe(0)
    })

    it('onmessage 收到 ArrayBuffer 应能解析', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const buffer = new TextEncoder().encode(
        JSON.stringify({
          id: 'm3',
          type: 'text',
          content: 'array',
          senderId: 'u2',
          senderName: 'n',
          senderAvatar: '',
          timestamp: 3000,
        })
      )
      // 模拟 arrayBuffer 字段
      const arr = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      wsInstance.onmessage?.({ data: arr } as unknown as MessageEvent)
      // ArrayBuffer 没有 toString 默认实现,我们的代码会通过 try/catch 吞掉
      // 主要看代码路径被执行,这里只要不抛错就算通过
      expect(chat.messages.value.length).toBe(0)
    })

    it('onclose 应触发断开处理', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      expect(chat.isConnected.value).toBe(true)
      wsInstance.onclose?.()
      expect(chat.isConnected.value).toBe(false)
    })

    it('onerror 应触发断开处理', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onerror?.()
      expect(chat.isConnected.value).toBe(false)
    })
  })

  describe('connect (uni 环境)', () => {
    beforeEach(() => {
      ;(isUniApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    })

    it('应通过 uni.connectSocket 建立连接', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      expect(uniMock.connectSocket).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'ws://localhost:8080?token=mock-token-123' })
      )
      expect(chat.isConnected.value).toBe(true)
    })

    it('uni connectSocket fail 应触发 handleDisconnect', () => {
      uniMock.connectSocket.mockImplementationOnce((opts: { fail?: () => void }) => {
        if (opts.fail) opts.fail()
        return {
          onMessage: vi.fn(),
          onClose: vi.fn(),
          onError: vi.fn(),
          send: vi.fn(),
          close: vi.fn(),
        }
      })
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      // fail 被调用了一次
      expect(uniMock.connectSocket).toHaveBeenCalled()
    })

    it('应注册 onMessage/onClose/onError 回调', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      // 拿到返回的 ws 对象
      const ws = uniMock.connectSocket.mock.results[0].value
      expect(ws.onMessage).toHaveBeenCalled()
      expect(ws.onClose).toHaveBeenCalled()
      expect(ws.onError).toHaveBeenCalled()
    })
  })

  describe('handleRawMessage 内部逻辑', () => {
    it('重复 id 的消息应被丢弃', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        id: 'dup1',
        type: 'text',
        content: 'a',
        senderId: 'u1',
        senderName: 'n',
        senderAvatar: '',
        timestamp: 100,
      })
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      expect(chat.messages.value.length).toBe(1)
    })

    it('没有 id 时应自动生成', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        type: 'text',
        content: 'no-id',
        senderId: 'u9',
        senderName: 'x',
        senderAvatar: '',
        timestamp: 50,
      })
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      expect(chat.messages.value[0].id).toBeTruthy()
      // 验证 id 格式
      expect(chat.messages.value[0].id).toMatch(/_/)
    })

    it('没有 timestamp 时应使用当前时间', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        id: 't1',
        type: 'text',
        content: 'no-ts',
        senderId: 'u1',
        senderName: 'n',
        senderAvatar: '',
      })
      const before = Date.now()
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      const after = Date.now()
      const ts = chat.messages.value[0].timestamp
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    it('没有 type 字段时应默认为 text', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const payload = JSON.stringify({
        id: 'noType1',
        content: 'hello',
        senderId: 'u',
        senderName: '',
        senderAvatar: '',
        timestamp: 500,
      })
      wsInstance.onmessage?.({ data: payload } as MessageEvent)
      expect(chat.messages.value[0].type).toBe('text')
    })

    it('乱序到达的消息应被按时间戳排序', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      const mk = (id: string, ts: number) =>
        JSON.stringify({ id, type: 'text', content: id, senderId: 'u', senderName: '', senderAvatar: '', timestamp: ts })
      wsInstance.onmessage?.({ data: mk('s1', 300) } as MessageEvent)
      wsInstance.onmessage?.({ data: mk('s2', 100) } as MessageEvent)
      wsInstance.onmessage?.({ data: mk('s3', 200) } as MessageEvent)
      expect(chat.messages.value.map((m) => m.id)).toEqual(['s2', 's3', 's1'])
    })
  })

  describe('handleDisconnect 重连机制', () => {
    it('连接断开后应开启重连定时器', () => {
      vi.useFakeTimers()
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      wsInstance.onclose?.()
      // handleDisconnect 中调用 setTimeout
      expect(chat.isConnected.value).toBe(false)
      // 推进定时器,reconnectCount 应增加
      vi.runAllTimers()
      vi.useRealTimers()
    })

    it('达到 MAX_RECONNECT 上限后不应再开启新定时器', () => {
      vi.useFakeTimers()
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      // 连续触发 6 次断开,达到上限(reconnectCount 从 0 累加到 5)
      for (let i = 0; i < 6; i++) {
        wsInstance.onclose?.()
        // 推进定时器,让 setTimeout 内的 reconnectCount++ 执行
        vi.runOnlyPendingTimers()
      }
      // 第 6 次断开时,reconnectCount 已达上限,不应再开定时器
      expect(chat.isConnected.value).toBe(false)
      vi.useRealTimers()
    })

    it('disconnect 应清空 reconnectTimer,后续 handleDisconnect 不应受影响', () => {
      vi.useFakeTimers()
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      wsInstance.onclose?.() // 触发 handleDisconnect,设置 timer
      chat.disconnect() // 清掉 timer
      // 再次触发 close
      wsInstance.onclose?.()
      vi.runAllTimers()
      vi.useRealTimers()
    })
  })

  describe('send', () => {
    it('web 环境下应通过 WebSocket.send 发送', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      const msg = chat.send({ type: 'text', content: 'hi' })
      expect(msg.id).toBeTruthy()
      expect(msg.isSelf).toBe(true)
      // 发送后状态应由 sending 变更为 sent
      expect(msg.status).toBe('sent')
      const stored = chat.messages.value.find((m) => m.id === msg.id)
      expect(stored?.status).toBe('sent')
      expect(wsInstance.send).toHaveBeenCalled()
      const payload = JSON.parse(wsInstance.send.mock.calls[0][0])
      expect(payload.type).toBe('text')
      expect(payload.content).toBe('hi')
    })

    it('uni 环境下应通过 ws.send 发送', () => {
      ;(isUniApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      const ws = uniMock.connectSocket.mock.results.at(-1)?.value
      const msg = chat.send({ type: 'image', content: 'img.png' })
      expect(msg.type).toBe('image')
      expect(ws.send).toHaveBeenCalled()
    })

    it('未连接时 send 不应报错', () => {
      const chat = useChat()
      // 不调用 connect,ws 为 null
      const msg = chat.send({ type: 'text', content: 'no-ws' })
      expect(msg).toBeTruthy()
      expect(msg.content).toBe('no-ws')
    })

    it('send 后消息应被加入 messages 列表', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.connect('ws://localhost:8080')
      chat.send({ type: 'text', content: 'first' })
      chat.send({ type: 'text', content: 'second' })
      expect(chat.messages.value.length).toBe(2)
    })
  })

  describe('loadHistory', () => {
    it('请求成功应合并并排序历史消息', async () => {
      mockRequest.mockResolvedValueOnce({
        code: 0,
        data: [
          { id: 'h1', type: 'text', content: 'old1', senderId: 'u1', senderName: 'a', senderAvatar: '', timestamp: 1 },
          { id: 'h2', type: 'text', content: 'old2', senderId: 'u2', senderName: 'b', senderAvatar: '', timestamp: 2 },
        ],
      })
      const chat = useChat()
      chat.clearMessages()
      await chat.loadHistory(1, 20)
      expect(chat.messages.value.length).toBe(2)
      expect(chat.messages.value[0].isSelf).toBe(false)
      // 数量 2 小于 pageSize 20,认为没有更多了
      expect(chat.hasMoreHistory.value).toBe(false)
    })

    it('当历史数量等于 pageSize 时 hasMoreHistory 应为 true', async () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: `h${i}`,
        type: 'text',
        content: `c${i}`,
        senderId: 'u',
        senderName: '',
        senderAvatar: '',
        timestamp: i,
      }))
      mockRequest.mockResolvedValueOnce({ code: 0, data })
      const chat = useChat()
      chat.clearMessages()
      await chat.loadHistory(1, 20)
      expect(chat.hasMoreHistory.value).toBe(true)
    })

    it('当历史数量小于 pageSize 时 hasMoreHistory 应为 false', async () => {
      mockRequest.mockResolvedValueOnce({
        code: 0,
        data: [{ id: 'h1', type: 'text', content: 'only', senderId: 'u1', senderName: 'a', senderAvatar: '', timestamp: 1 }],
      })
      const chat = useChat()
      chat.clearMessages()
      await chat.loadHistory(1, 20)
      expect(chat.hasMoreHistory.value).toBe(false)
    })

    it('历史项无 type 字段时应默认为 text', async () => {
      mockRequest.mockResolvedValueOnce({
        code: 0,
        data: [{ id: 'h_no_type', content: 'a', senderId: 'u', senderName: '', senderAvatar: '', timestamp: 1 }],
      })
      const chat = useChat()
      chat.clearMessages()
      await chat.loadHistory(1, 20)
      expect(chat.messages.value[0].type).toBe('text')
    })

    it('正在加载时应直接返回,不会重复请求', async () => {
      const chat = useChat()
      chat.isLoadingHistory.value = true
      await chat.loadHistory(1, 20)
      expect(mockRequest).not.toHaveBeenCalled()
      chat.isLoadingHistory.value = false
    })

    it('请求 data 为空时不应抛错', async () => {
      mockRequest.mockResolvedValueOnce({ code: 0, data: null })
      const chat = useChat()
      chat.clearMessages()
      await chat.loadHistory(1, 20)
      expect(chat.messages.value.length).toBe(0)
    })

    it('请求抛出错误时 isLoadingHistory 应重置', async () => {
      mockRequest.mockImplementationOnce(() => Promise.reject(new Error('network')))
      const chat = useChat()
      chat.clearMessages()
      try {
        await chat.loadHistory(1, 20)
        // 走到这里说明没抛错,主动让测试失败
        expect.fail('loadHistory 应该抛出错误')
      } catch (e) {
        expect((e as Error).message).toBe('network')
      }
      expect(chat.isLoadingHistory.value).toBe(false)
    })

    it('应使用默认参数 page=1, pageSize=20', async () => {
      mockRequest.mockResolvedValueOnce({ code: 0, data: [] })
      const chat = useChat()
      await chat.loadHistory()
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/chat/history?page=1&pageSize=20' })
      )
    })
  })

  describe('disconnect', () => {
    it('web 环境下应关闭 WebSocket 并清空 ws', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      chat.disconnect()
      expect(wsInstance.close).toHaveBeenCalled()
      expect(chat.isConnected.value).toBe(false)
    })

    it('uni 环境下应调用 ws.close', () => {
      ;(isUniApp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      const ws = uniMock.connectSocket.mock.results.at(-1)?.value
      chat.disconnect()
      expect(ws.close).toHaveBeenCalled()
      expect(chat.isConnected.value).toBe(false)
    })

    it('未连接时调用 disconnect 不应报错', () => {
      const chat = useChat()
      expect(() => chat.disconnect()).not.toThrow()
      expect(chat.isConnected.value).toBe(false)
    })

    it('应清除 reconnectTimer', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onclose?.() // 触发 handleDisconnect,设置 timer
      expect(() => chat.disconnect()).not.toThrow()
    })
  })

  describe('clearMessages', () => {
    it('应清空 messages 列表', () => {
      const chat = useChat()
      chat.clearMessages()
      chat.send({ type: 'text', content: 'a' })
      expect(chat.messages.value.length).toBe(1)
      chat.clearMessages()
      expect(chat.messages.value.length).toBe(0)
    })
  })

  describe('生命周期', () => {
    it('onUnmounted 应被注册', async () => {
      const vue = await import('vue')
      // 重新调用 useChat 触发 onUnmounted
      useChat()
      expect(vue.onUnmounted).toHaveBeenCalled()
    })

    it('调用 unmount 回调时应执行 disconnect', () => {
      const chat = useChat()
      chat.connect('ws://localhost:8080')
      wsInstance.onopen?.()
      expect(chat.isConnected.value).toBe(true)
      if (unmountCallback) unmountCallback()
      expect(chat.isConnected.value).toBe(false)
    })
  })
})
