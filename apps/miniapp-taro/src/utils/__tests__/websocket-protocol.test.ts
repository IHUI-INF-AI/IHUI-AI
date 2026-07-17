/**
 * miniapp-taro WebSocket 协议对齐测试
 *
 * 背景:2026-07-17 发现 websocket.ts 自写协议与 API 端 ws-notifications.ts 完全不匹配
 * (心跳发 JSON {event:'ping'},消息格式 {event:string},发送冗余 join_system_room)。
 * 本测试锁定:WS 协议必须与 API 端对齐(字符串 ping/pong + {type:'notification',data} 格式)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// === 用 vi.hoisted 提升 mock 状态容器(vi.mock 工厂被 hoist,不能引用外部变量) ===
const mocks = vi.hoisted(() => {
  return {
    openCallback: null as (() => void) | null,
    messageCallback: null as ((res: { data: string | unknown }) => void) | null,
    sentMessages: [] as string[],
    createdTasks: [] as unknown[],
  }
})

vi.mock('@tarojs/taro', () => {
  const connectSocket = () => {
    const task = {
      readyState: 1,
      onOpen: (cb: () => void) => { mocks.openCallback = cb },
      onMessage: (cb: (res: { data: string | unknown }) => void) => { mocks.messageCallback = cb },
      onError: () => {},
      onClose: () => {},
      send: (opts: { data: string; fail?: (err: unknown) => void }) => { mocks.sentMessages.push(opts.data) },
      close: () => { (task as { readyState: number }).readyState = 3 },
    }
    mocks.createdTasks.push(task)
    return Promise.resolve(task)
  }
  return {
    default: { connectSocket },
    connectSocket,
  }
})

// === 加载被测模块 ===
import websocketManager from '../websocket'

describe('miniapp-taro WebSocket 协议对齐', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    mocks.sentMessages.length = 0
    mocks.createdTasks.length = 0
    websocketManager.connect('ws://test/ws/notifications?token=test-token', {
      onMessage: () => {},
    })
  })

  afterAll(() => {
    websocketManager.close()
    vi.useRealTimers()
  })

  it('connect 后应通过 Taro.connectSocket 建立连接', () => {
    expect(mocks.createdTasks.length).toBeGreaterThanOrEqual(1)
  })

  it('onOpen 触发后应启动心跳,心跳发送字符串 ping(非 JSON)', () => {
    expect(mocks.openCallback).not.toBeNull()
    mocks.openCallback!()
    vi.advanceTimersByTime(31000)
    expect(mocks.sentMessages).toContain('ping')
    const pingMessages = mocks.sentMessages.filter((m) => m.includes('ping'))
    expect(pingMessages.some((m) => m === 'ping')).toBe(true)
    expect(pingMessages.some((m) => m.startsWith('{'))).toBe(false)
  })

  it('收到字符串 pong 应静默跳过(不触发 onMessage,不报错)', () => {
    const onMessage = vi.fn()
    websocketManager.connect('ws://test2/ws/notifications?token=t2', { onMessage })
    mocks.openCallback!()
    expect(mocks.messageCallback).not.toBeNull()
    expect(() => mocks.messageCallback!({ data: 'pong' })).not.toThrow()
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('收到 { type: "notification", data: {...} } 应触发 onMessage 回调传整个 parsed 对象', () => {
    const onMessage = vi.fn()
    websocketManager.connect('ws://test3/ws/notifications?token=t3', { onMessage })
    mocks.openCallback!()
    const notification = { type: 'notification', data: { id: 'n1', title: '测试通知' } }
    mocks.messageCallback!({ data: JSON.stringify(notification) })
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith(notification)
  })

  it('收到非 notification 类型的 JSON 消息应静默跳过', () => {
    const onMessage = vi.fn()
    websocketManager.connect('ws://test4/ws/notifications?token=t4', { onMessage })
    mocks.openCallback!()
    mocks.messageCallback!({ data: JSON.stringify({ type: 'other', data: 'something' }) })
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('send 方法对字符串参数应原样发送(不 JSON.stringify)', () => {
    mocks.sentMessages.length = 0
    websocketManager.send('ping')
    expect(mocks.sentMessages).toContain('ping')
    expect(mocks.sentMessages[mocks.sentMessages.length - 1]).toBe('ping')
  })

  it('send 方法对对象参数应 JSON.stringify', () => {
    mocks.sentMessages.length = 0
    websocketManager.send({ type: 'test' })
    expect(mocks.sentMessages).toContain(JSON.stringify({ type: 'test' }))
  })

  it('不应发送 join_system_room 或其他冗余业务事件', () => {
    mocks.sentMessages.length = 0
    mocks.openCallback!()
    vi.advanceTimersByTime(31000)
    const redundantEvents = mocks.sentMessages.filter((m) =>
      m.includes('join_system_room') || m.includes('join_room') || m.includes('subscribe')
    )
    expect(redundantEvents).toEqual([])
  })

  it('close 后应停止心跳并清理状态', () => {
    const wsm = (websocketManager as unknown as { heartbeatTimer: ReturnType<typeof setInterval> | null })
    websocketManager.close()
    expect(wsm.heartbeatTimer).toBeNull()
  })
})
