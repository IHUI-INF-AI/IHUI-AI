/**
 * miniapp-taro WebSocket 接入 @ihui/api-client 协议测试。
 *
 * 背景:原自写 websocketManager 已下线,改为依赖注入方案 ——
 * `createNotificationClient({ baseUrl, tokenProvider }, handlers, { webSocketFactory: taroWebSocketFactory })`。
 * 本测试覆盖 Taro WebSocket 适配器(taroWebSocketFactory)的行为,以及与
 * @ihui/api-client 真实 createNotificationClient 的集成。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// === 用 vi.hoisted 提升 mock 状态容器(vi.mock 工厂被 hoist,不能引用外部变量) ===
const mocks = vi.hoisted(() => {
  return {
    openCallback: null as (() => void) | null,
    messageCallback: null as ((res: { data: string | unknown }) => void) | null,
    errorCallback: null as ((err: unknown) => void) | null,
    closeCallback: null as (() => void) | null,
    sentMessages: [] as string[],
    createdSocketArgs: [] as string[],
    closedTasks: 0,
  }
})

vi.mock('@tarojs/taro', () => {
  const connectSocket = (opts: { url: string }) => {
    mocks.createdSocketArgs.push(opts.url)
    const task = {
      onOpen: (cb: () => void) => {
        mocks.openCallback = cb
      },
      onMessage: (cb: (res: { data: string | unknown }) => void) => {
        mocks.messageCallback = cb
      },
      onError: (cb: (err: unknown) => void) => {
        mocks.errorCallback = cb
      },
      onClose: (cb: () => void) => {
        mocks.closeCallback = cb
      },
      send: (o: { data: string; fail?: (err: unknown) => void }) => {
        mocks.sentMessages.push(o.data)
      },
      close: () => {
        mocks.closedTasks += 1
      },
    }
    return Promise.resolve(task)
  }
  return {
    default: { connectSocket },
    connectSocket,
  }
})

// === 加载被测模块(必须在 vi.mock 之后) ===
import { taroWebSocketFactory } from '../taro-websocket-adapter'
import { createNotificationClient } from '@ihui/api-client'

/** Taro.connectSocket 返回 Promise,适配器在 .then 中注册 SocketTask 回调;flush 后回调才注册到位 */
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('taroWebSocketFactory — Taro WebSocket 适配器', () => {
  beforeEach(() => {
    mocks.openCallback = null
    mocks.messageCallback = null
    mocks.errorCallback = null
    mocks.closeCallback = null
    mocks.sentMessages.length = 0
    mocks.createdSocketArgs.length = 0
    mocks.closedTasks = 0
  })

  it('返回符合 WebSocketLike 形状的对象(含 readyState/send/close/四个回调),初始 readyState=0', () => {
    const ws = taroWebSocketFactory('ws://test/ws')
    expect(ws).toBeDefined()
    expect(typeof ws.send).toBe('function')
    expect(typeof ws.close).toBe('function')
    expect('onopen' in ws).toBe(true)
    expect('onmessage' in ws).toBe(true)
    expect('onclose' in ws).toBe(true)
    expect('onerror' in ws).toBe(true)
    expect(ws.readyState).toBe(0)
  })

  it('内部调用 Taro.connectSocket({ url }) 建立连接', async () => {
    taroWebSocketFactory('ws://test/abc?token=t')
    await flushMicrotasks()
    expect(mocks.createdSocketArgs).toContain('ws://test/abc?token=t')
  })

  it('SocketTask.onOpen 触发时调用 adapter.onopen 并将 readyState 置为 1(OPEN)', async () => {
    const onOpen = vi.fn()
    const ws = taroWebSocketFactory('ws://t3')
    ws.onopen = onOpen
    await flushMicrotasks()
    expect(mocks.openCallback).not.toBeNull()
    mocks.openCallback!()
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(ws.readyState).toBe(1)
  })

  it('SocketTask.onMessage 触发时调用 adapter.onmessage,传 { data: res.data }', async () => {
    const onMessage = vi.fn()
    const ws = taroWebSocketFactory('ws://t4')
    ws.onmessage = onMessage
    await flushMicrotasks()
    expect(mocks.messageCallback).not.toBeNull()
    const payload = { id: 'n1', title: '测试通知' }
    mocks.messageCallback!({ data: payload })
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith({ data: payload })
  })

  it('SocketTask.onError 触发时调用 adapter.onerror 并将 readyState 置为 3(CLOSED)', async () => {
    const onError = vi.fn()
    const ws = taroWebSocketFactory('ws://t5')
    ws.onerror = onError
    await flushMicrotasks()
    expect(mocks.errorCallback).not.toBeNull()
    const err = new Error('boom')
    mocks.errorCallback!(err)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(err)
    expect(ws.readyState).toBe(3)
  })

  it('SocketTask.onClose 触发时调用 adapter.onclose 并将 readyState 置为 3(CLOSED)', async () => {
    const onClose = vi.fn()
    const ws = taroWebSocketFactory('ws://t6')
    ws.onclose = onClose
    await flushMicrotasks()
    expect(mocks.closeCallback).not.toBeNull()
    mocks.closeCallback!()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(ws.readyState).toBe(3)
  })

  it('adapter.send(data) 调用 task.send({ data })', async () => {
    const ws = taroWebSocketFactory('ws://t7')
    await flushMicrotasks()
    ws.send('ping')
    expect(mocks.sentMessages).toContain('ping')
    expect(mocks.sentMessages[mocks.sentMessages.length - 1]).toBe('ping')
  })

  it('adapter.close() 调用 task.close({})', async () => {
    const ws = taroWebSocketFactory('ws://t8')
    await flushMicrotasks()
    ws.close()
    expect(mocks.closedTasks).toBe(1)
  })

  it('集成:createNotificationClient 注入 taroWebSocketFactory 后 connect,onOpen 回调触发', async () => {
    const onOpen = vi.fn()
    const client = createNotificationClient(
      { baseUrl: 'http://localhost:3000/api', tokenProvider: () => 'test-token' },
      { onOpen },
      { webSocketFactory: taroWebSocketFactory },
    )
    client.connect()
    await flushMicrotasks()
    expect(mocks.openCallback).not.toBeNull()
    mocks.openCallback!()
    expect(onOpen).toHaveBeenCalledTimes(1)
    client.disconnect()
  })
})
