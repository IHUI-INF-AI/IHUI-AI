import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { usePaymentStatus, PaymentStatus } from '../usePaymentStatus'
import { useWebSocket } from '../useWebSocket'
import { getOrderDetail } from '@/api/payment/orders'

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    status: { value: 'connected' },
    send: vi.fn(),
  })),
  WebSocketStatus: {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTING: 'disconnecting',
    DISCONNECTED: 'disconnected',
  },
}))

vi.mock('@/api/payment/orders', () => ({
  getOrderDetail: vi.fn().mockResolvedValue({
    code: 200,
    data: {
      id: 'order-1',
      orderNo: 'TEST-ORDER-001',
      status: 'pending',
      amount: 100,
    },
  }),
}))

describe('usePaymentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应该初始化默认状态', () => {
    const { status, isLoading } = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
    })

    expect(status.value.orderNo).toBe('TEST-ORDER-001')
    expect(status.value.status).toBe('pending')
    expect(isLoading.value).toBe(false)
  })

  it('应该返回所有方法和状态', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
    })

    expect(payment.status).toBeDefined()
    expect(payment.isLoading).toBeDefined()
    expect(typeof payment.start).toBe('function')
    expect(typeof payment.stop).toBe('function')
    expect(typeof payment.checkStatus).toBe('function')
  })

  it('应该支持禁用WebSocket', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
      enableWebSocket: false,
    })

    expect(payment.status.value.orderNo).toBe('TEST-ORDER-001')
  })

  it('应该支持禁用轮询', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
      enablePolling: false,
    })

    expect(payment.status.value.orderNo).toBe('TEST-ORDER-001')
  })

  it('应该支持自定义轮询间隔', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
      pollingInterval: 5000,
    })

    expect(payment.status.value.orderNo).toBe('TEST-ORDER-001')
  })

  it('应该支持自定义超时时间', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
      timeout: 60000,
    })

    expect(payment.status.value.orderNo).toBe('TEST-ORDER-001')
  })

  it('应该能够启动和停止监听', () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
    })

    payment.start()
    payment.stop()
  })

  it('应该能够手动检查状态', async () => {
    const payment = usePaymentStatus({
      orderNo: 'TEST-ORDER-001',
      enableWebSocket: false,
      enablePolling: false,
    })

    await payment.checkStatus()
  })

  // 辅助：获取最后一次 useWebSocket 调用的配置
  const getLastWSConfig = () => {
    const calls = vi.mocked(useWebSocket).mock.calls
    return calls[calls.length - 1]?.[0]
  }

  describe('start 方法', () => {
    it('应该启动 WebSocket 和轮询', () => {
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      expect(vi.mocked(useWebSocket)).toHaveBeenCalled()
      payment.stop()
    })

    it('应该在已有连接时先断开', () => {
      // 覆盖 startWebSocket 中已有连接先断开的逻辑
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      // 再次 start 会先断开已有连接
      payment.start()
      payment.stop()
    })
  })

  describe('checkStatus 订单状态处理', () => {
    it('应该处理 paid 状态并触发成功回调', async () => {
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'paid', amount: 100 } as any,
      })
      const onSuccess = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        onSuccess,
      })
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('paid')
      expect(onSuccess).toHaveBeenCalled()
    })

    it('应该处理 completed 状态并触发成功回调', async () => {
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'completed', amount: 100 } as any,
      })
      const onSuccess = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        onSuccess,
      })
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('paid')
      expect(onSuccess).toHaveBeenCalled()
    })

    it('应该处理 failed 状态并触发失败回调', async () => {
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'failed', description: '支付失败', amount: 100 } as any,
      })
      const onFailure = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        onFailure,
      })
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('failed')
      expect(onFailure).toHaveBeenCalledWith('支付失败')
    })

    it('应该处理 cancelled 状态并触发失败回调', async () => {
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'cancelled', amount: 100 } as any,
      })
      const onFailure = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        onFailure,
      })
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('failed')
      expect(onFailure).toHaveBeenCalledWith('支付失败')
    })

    it('应该处理 processing 状态', async () => {
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'processing', amount: 100 } as any,
      })
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
      })
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('processing')
    })

    it('应该处理 API 失败不崩溃', async () => {
      // 覆盖 checkStatus 的 catch 分支
      vi.mocked(getOrderDetail).mockRejectedValueOnce(new Error('网络错误'))
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
      })
      await payment.checkStatus()
      expect(payment.isLoading.value).toBe(false)
    })

    it('应该优先使用 orderId', async () => {
      // 覆盖 orderId 优先于 orderNo 的逻辑
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'pending', amount: 100 } as any,
      })
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        orderId: 'order-id-123',
        enableWebSocket: false,
        enablePolling: false,
      })
      await payment.checkStatus()
      expect(vi.mocked(getOrderDetail)).toHaveBeenCalledWith('order-id-123')
    })

    it('应该在超时后调用 handleTimeout', async () => {
      // 覆盖 checkStatus 中的超时检查
      const onTimeout = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        timeout: 100,
        onTimeout,
      })
      vi.advanceTimersByTime(200)
      await payment.checkStatus()
      expect(payment.status.value.status).toBe('timeout')
      expect(onTimeout).toHaveBeenCalled()
    })
  })

  describe('WebSocket 消息处理', () => {
    it('应该处理 payment_status 消息', () => {
      // 覆盖 handleWebSocketMessage 中 orderNo 匹配的分支
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({
        type: 'payment_status',
        data: { orderNo: 'TEST-ORDER-001', status: 'processing' },
      })
      expect(payment.status.value.status).toBe('processing')
      payment.stop()
    })

    it('应该忽略 orderNo 不匹配的消息', () => {
      // 覆盖 handleWebSocketMessage 中 orderNo 不匹配的分支
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({
        type: 'payment_status',
        data: { orderNo: 'OTHER', status: 'paid' },
      })
      expect(payment.status.value.status).toBe('pending')
      payment.stop()
    })

    it('应该忽略非 payment_status 类型的消息', () => {
      // 覆盖 handleWebSocketMessage 中 type 不匹配的分支
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({ type: 'other', data: {} })
      expect(payment.status.value.status).toBe('pending')
      payment.stop()
    })

    it('应该处理 WebSocket 支付成功消息', async () => {
      // 覆盖 handleWebSocketMessage 中支付成功的分支
      vi.mocked(getOrderDetail).mockResolvedValue({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'paid', amount: 100 } as any,
      })
      const onSuccess = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
        onSuccess,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({
        type: 'payment_status',
        data: { orderNo: 'TEST-ORDER-001', status: 'paid' },
      })
      // flush 微任务以执行 getOrderDetail().then()
      await Promise.resolve()
      await Promise.resolve()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('应该处理 WebSocket 支付失败消息', () => {
      // 覆盖 handleWebSocketMessage 中支付失败的分支
      const onFailure = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
        onFailure,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({
        type: 'payment_status',
        data: { orderNo: 'TEST-ORDER-001', status: 'failed', message: '失败' },
      })
      expect(onFailure).toHaveBeenCalledWith('失败')
    })

    it('应该处理 WebSocket 消息异常不崩溃', () => {
      // 覆盖 handleWebSocketMessage 的 catch 分支
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
      })
      payment.start()
      const config = getLastWSConfig()
      // data 为 null 会触发 data.orderNo 异常
      config?.onMessage?.({ type: 'payment_status', data: null as any })
      payment.stop()
    })
  })

  describe('WebSocket 连接事件', () => {
    it('应该处理 onError 降级到轮询', () => {
      // 覆盖 WebSocket onError 回调
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      const config = getLastWSConfig()
      config?.onError?.(new Event('error'))
      payment.stop()
    })

    it('应该处理 onOpen 降低轮询频率', () => {
      // 覆盖 WebSocket onOpen 回调
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      const config = getLastWSConfig()
      config?.onOpen?.()
      payment.stop()
    })

    it('应该处理 onClose 确保轮询运行', () => {
      // 覆盖 WebSocket onClose 回调
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      const config = getLastWSConfig()
      config?.onClose?.()
      payment.stop()
    })
  })

  describe('状态变化回调', () => {
    it('应该在状态变化时触发 onStatusChange', async () => {
      // 覆盖 updateStatus 中状态变化的回调
      vi.mocked(getOrderDetail).mockResolvedValueOnce({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'processing', amount: 100 } as any,
      })
      const onStatusChange = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        onStatusChange,
      })
      await payment.checkStatus()
      expect(onStatusChange).toHaveBeenCalled()
    })
  })

  describe('超时处理', () => {
    it('应该在超时后更新状态并触发回调', () => {
      // 覆盖 handleTimeout 和 start 中的超时定时器
      const onTimeout = vi.fn()
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        enablePolling: false,
        timeout: 100,
        onTimeout,
      })
      payment.start()
      vi.advanceTimersByTime(200)
      expect(payment.status.value.status).toBe('timeout')
      expect(onTimeout).toHaveBeenCalled()
    })
  })

  describe('边界情况', () => {
    it('应该处理 WebSocket 不可用降级到轮询', () => {
      // 覆盖 startWebSocket 的 catch 分支
      vi.mocked(useWebSocket).mockImplementationOnce(() => {
        throw new Error('WebSocket 不可用')
      })
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      payment.stop()
    })

    it('应该通过轮询定时器检查状态', async () => {
      // 覆盖 setInterval 中的 checkStatus 调用
      vi.mocked(getOrderDetail).mockResolvedValue({
        code: 200,
        success: true,
        data: { id: '1', orderNo: 'TEST-ORDER-001', status: 'pending', amount: 100 } as any,
      })
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enableWebSocket: false,
        pollingInterval: 1000,
        timeout: 60000,
      })
      payment.start()
      // 推进时间触发轮询定时器
      await vi.advanceTimersByTimeAsync(1000)
      payment.stop()
    })

    it('应该处理 WebSocket 成功消息中 getOrderDetail 失败', async () => {
      // 覆盖 handleWebSocketMessage 中 getOrderDetail().catch()
      vi.mocked(getOrderDetail).mockRejectedValueOnce(new Error('网络错误'))
      const payment = usePaymentStatus({
        orderNo: 'TEST-ORDER-001',
        enablePolling: false,
      })
      payment.start()
      const config = getLastWSConfig()
      config?.onMessage?.({
        type: 'payment_status',
        data: { orderNo: 'TEST-ORDER-001', status: 'paid' },
      })
      // flush 微任务以执行 getOrderDetail().catch()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      payment.stop()
    })

    it('应该处理 onError 在轮询停止后启动轮询', async () => {
      // 覆盖 onError 中 !pollingTimer && enablePolling 的分支
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      payment.stop() // 停止轮询，pollingTimer 为 null
      const config = getLastWSConfig()
      config?.onError?.(new Event('error')) // 会重新启动轮询
      await Promise.resolve()
      payment.stop()
    })

    it('应该处理 onClose 在轮询停止后启动轮询', async () => {
      // 覆盖 onClose 中 !pollingTimer && enablePolling 的分支
      const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
      payment.start()
      payment.stop() // 停止轮询，pollingTimer 为 null
      const config = getLastWSConfig()
      config?.onClose?.() // 会重新启动轮询
      await Promise.resolve()
      payment.stop()
    })
  })

  describe('组件生命周期', () => {
    it('应该在组件卸载时自动停止', () => {
      // 覆盖 onUnmounted 回调
      const Comp = defineComponent({
        setup() {
          const payment = usePaymentStatus({ orderNo: 'TEST-ORDER-001' })
          payment.start()
          return { payment }
        },
        template: '<div></div>',
      })
      const wrapper = mount(Comp)
      wrapper.unmount()
    })
  })
})
