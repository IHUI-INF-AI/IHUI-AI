import { describe, it, expect, beforeEach, vi } from 'vitest'
import { monitoringWebSocket } from '../monitoring-websocket'
import { websocketService } from '../websocket'

// 保存注册的回调函数，便于测试触发
let statusHandler: ((status: unknown) => void) | null = null
let eventHandlers: Record<string, (data: unknown) => void> = {}

vi.mock('../websocket', () => ({
  websocketService: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    send: vi.fn(),
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      eventHandlers[event] = handler
      return () => {}
    }),
    onStatusChange: vi.fn((handler: (status: unknown) => void) => {
      statusHandler = handler
      return () => {}
    }),
  },
}))

describe('monitoringWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    statusHandler = null
    eventHandlers = {}
    // 重置单例状态
    monitoringWebSocket.disconnect()
  })

  it('应该成功连接', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring', 'test-token')
    expect(websocketService.connect).toHaveBeenCalledWith('ws://localhost:8080/monitoring', 'test-token')
  })

  it('应该正确设置心跳间隔', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    expect(monitoringWebSocket.isConnected()).toBe(true)
    monitoringWebSocket.disconnect()
  })

  it('应该请求快照', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    monitoringWebSocket.requestSnapshot()
    expect(websocketService.send).toHaveBeenCalledWith('monitoring:request_snapshot', expect.any(Object))
  })

  it('应该确认异常', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    monitoringWebSocket.acknowledgeAnomaly('anomaly-123')
    expect(websocketService.send).toHaveBeenCalledWith('monitoring:acknowledge_anomaly', expect.objectContaining({
      anomalyId: 'anomaly-123'
    }))
  })

  it('应该确认告警', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    monitoringWebSocket.acknowledgeAlert('alert-123')
    expect(websocketService.send).toHaveBeenCalledWith('monitoring:acknowledge_alert', expect.objectContaining({
      alertId: 'alert-123'
    }))
  })

  it('应该更新配置', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    monitoringWebSocket.updateConfig({ interval: 5000 })
    expect(websocketService.send).toHaveBeenCalledWith('monitoring:update_config', expect.any(Object))
  })

  it('应该断开连接', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    monitoringWebSocket.disconnect()
    expect(websocketService.disconnect).toHaveBeenCalled()
    expect(monitoringWebSocket.isConnected()).toBe(false)
  })

  // ===== 以下为补充测试，覆盖未覆盖的功能 =====

  it('已连接时再次连接应直接返回不重复连接', async () => {
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const firstCallCount = vi.mocked(websocketService.connect).mock.calls.length
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    // 第二次连接不应增加调用次数
    expect(vi.mocked(websocketService.connect).mock.calls.length).toBe(firstCallCount)
  })

  it('连接失败应调用onError并抛出错误', async () => {
    const error = new Error('连接失败')
    vi.mocked(websocketService.connect).mockRejectedValueOnce(error)
    const onError = vi.fn()
    monitoringWebSocket.setHandlers({ onError })
    await expect(monitoringWebSocket.connect('ws://localhost:8080/monitoring')).rejects.toThrow('连接失败')
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('应该正确转发指标数据到onMetric回调', async () => {
    const onMetric = vi.fn()
    monitoringWebSocket.setHandlers({ onMetric })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const metric = { id: 'metric-1', value: 100 }
    eventHandlers['monitoring:metric']?.(metric)
    expect(onMetric).toHaveBeenCalledWith(metric)
  })

  it('应该正确转发异常数据到onAnomaly回调', async () => {
    const onAnomaly = vi.fn()
    monitoringWebSocket.setHandlers({ onAnomaly })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const anomaly = { id: 'anomaly-1', level: 'high' }
    eventHandlers['monitoring:anomaly']?.(anomaly)
    expect(onAnomaly).toHaveBeenCalledWith(anomaly)
  })

  it('应该正确转发告警数据到onAlert回调', async () => {
    const onAlert = vi.fn()
    monitoringWebSocket.setHandlers({ onAlert })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const alert = { id: 'alert-1', severity: 'critical' }
    eventHandlers['monitoring:alert']?.(alert)
    expect(onAlert).toHaveBeenCalledWith(alert)
  })

  it('应该正确转发快照数据到onSnapshot回调', async () => {
    const onSnapshot = vi.fn()
    monitoringWebSocket.setHandlers({ onSnapshot })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const snapshot = { cpu: 50, memory: 70 }
    eventHandlers['monitoring:snapshot']?.(snapshot)
    expect(onSnapshot).toHaveBeenCalledWith(snapshot)
  })

  it('应该正确转发配置更新到onConfigUpdate回调', async () => {
    const onConfigUpdate = vi.fn()
    monitoringWebSocket.setHandlers({ onConfigUpdate })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    const config = { interval: 5000 }
    eventHandlers['monitoring:config_update']?.(config)
    expect(onConfigUpdate).toHaveBeenCalledWith(config)
  })

  it('应该转发状态变化到onStatusChange回调', async () => {
    const onStatusChange = vi.fn()
    monitoringWebSocket.setHandlers({ onStatusChange })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    statusHandler?.('connected')
    expect(onStatusChange).toHaveBeenCalledWith('connected')
  })

  it('状态变为disconnected应标记未连接并触发重连', async () => {
    vi.useFakeTimers()
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring', 'token')
    statusHandler?.('disconnected')
    expect(monitoringWebSocket.isConnected()).toBe(false)
    // 快进5秒触发重连
    vi.advanceTimersByTime(5000)
    expect(websocketService.connect).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('状态变为error应标记未连接并触发重连', async () => {
    vi.useFakeTimers()
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    statusHandler?.('error')
    expect(monitoringWebSocket.isConnected()).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(websocketService.connect).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('心跳应定时发送监控心跳消息', async () => {
    vi.useFakeTimers()
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    vi.mocked(websocketService.send).mockClear()
    // 快进30秒触发心跳
    vi.advanceTimersByTime(30000)
    expect(websocketService.send).toHaveBeenCalledWith('monitoring:heartbeat', expect.any(Object))
    vi.useRealTimers()
  })

  it('重连失败应再次调度重连', async () => {
    vi.useFakeTimers()
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    statusHandler?.('disconnected')
    // 第一次重连失败
    vi.mocked(websocketService.connect).mockRejectedValueOnce(new Error('重连失败'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(websocketService.connect).toHaveBeenCalled()
    // 第二次重连应再次调度
    vi.mocked(websocketService.connect).mockClear()
    vi.mocked(websocketService.connect).mockResolvedValueOnce(undefined)
    await vi.advanceTimersByTimeAsync(5000)
    expect(websocketService.connect).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('subscribe已映射事件应注册监听并返回取消函数', () => {
    const handler = vi.fn()
    const unsub = monitoringWebSocket.subscribe('onMetric', handler)
    expect(websocketService.on).toHaveBeenCalledWith('monitoring:metric', handler)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('subscribe未映射事件应返回空函数', () => {
    const unsub = monitoringWebSocket.subscribe('onError' as unknown as Parameters<typeof monitoringWebSocket.subscribe>[0], () => {})
    expect(typeof unsub).toBe('function')
    // 不应抛出错误
    expect(() => unsub()).not.toThrow()
  })

  it('未连接时请求快照应直接返回不发送', () => {
    monitoringWebSocket.requestSnapshot()
    expect(websocketService.send).not.toHaveBeenCalled()
  })

  it('未连接时确认异常应直接返回不发送', () => {
    monitoringWebSocket.acknowledgeAnomaly('anomaly-1')
    expect(websocketService.send).not.toHaveBeenCalled()
  })

  it('未连接时确认告警应直接返回不发送', () => {
    monitoringWebSocket.acknowledgeAlert('alert-1')
    expect(websocketService.send).not.toHaveBeenCalled()
  })

  it('未连接时更新配置应直接返回不发送', () => {
    monitoringWebSocket.updateConfig({ key: 'value' })
    expect(websocketService.send).not.toHaveBeenCalled()
  })

  it('断开连接应清理心跳和重连定时器', async () => {
    vi.useFakeTimers()
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    // 触发重连调度
    statusHandler?.('disconnected')
    monitoringWebSocket.disconnect()
    // 清理后快进时间不应再触发重连
    const callCount = vi.mocked(websocketService.connect).mock.calls.length
    vi.advanceTimersByTime(10000)
    expect(vi.mocked(websocketService.connect).mock.calls.length).toBe(callCount)
    // 心跳也不应再发送
    vi.mocked(websocketService.send).mockClear()
    vi.advanceTimersByTime(30000)
    expect(websocketService.send).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('setHandlers应合并现有处理器不覆盖其他', async () => {
    const onMetric = vi.fn()
    const onAlert = vi.fn()
    monitoringWebSocket.setHandlers({ onMetric })
    monitoringWebSocket.setHandlers({ onAlert })
    await monitoringWebSocket.connect('ws://localhost:8080/monitoring')
    // 两个处理器都应保留
    eventHandlers['monitoring:metric']?.({ id: 'm-1' })
    eventHandlers['monitoring:alert']?.({ id: 'a-1' })
    expect(onMetric).toHaveBeenCalledWith({ id: 'm-1' })
    expect(onAlert).toHaveBeenCalledWith({ id: 'a-1' })
  })
})
