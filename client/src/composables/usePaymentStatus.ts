import { t } from '@/utils/i18n'

/**
 * 支付状态管理 Composable
 * 提供统一的支付状态查询、WebSocket推送、回调处理等功能
 */

import { ref, onUnmounted } from 'vue'
import { useWebSocket, type WebSocketMessage, WebSocketStatus } from '@/composables/useWebSocket'
import { getOrderDetail, type Order } from '@/api/payment/orders'
import { logger } from '@/utils/logger'

export interface PaymentStatus {
  orderNo: string
  status: 'pending' | 'processing' | 'paid' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  message?: string
  paidAt?: string
  amount?: number
}

export interface PaymentStatusOptions {
  orderNo: string
  orderId?: string
  enableWebSocket?: boolean // 是否启用WebSocket（默认true）
  enablePolling?: boolean // 是否启用轮询（默认true，作为备用）
  pollingInterval?: number // 轮询间隔（默认3000ms）
  timeout?: number // 超时时间（默认5分钟）
  onStatusChange?: (status: PaymentStatus) => void // 状态变化回调
  onSuccess?: (order: Order) => void // 支付成功回调
  onFailure?: (error: string) => void // 支付失败回调
  onTimeout?: () => void // 支付超时回调
}

/**
 * 使用支付状态管理
 */
export function usePaymentStatus(options: PaymentStatusOptions) {
  const status = ref<PaymentStatus>({
    orderNo: options.orderNo,
    status: 'pending',
  })
  const isLoading = ref(false)
  const paymentWebSocket = ref<ReturnType<typeof useWebSocket> | null>(null)
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  const startTime = Date.now()

  const pollingInterval = options.pollingInterval || 3000
  const timeout = options.timeout || 5 * 60 * 1000 // 5分钟
  const enableWebSocket = options.enableWebSocket !== false
  const enablePolling = options.enablePolling !== false

  /**
   * 启动支付状态监听
   */
  const start = () => {
    // 启动WebSocket（如果启用）
    if (enableWebSocket) {
      startWebSocket()
    }

    // 启动轮询（如果启用）
    if (enablePolling) {
      startPolling()
    }

    // 设置超时
    timeoutTimer = setTimeout(() => {
      handleTimeout()
    }, timeout)
  }

  /**
   * 启动WebSocket连接
   */
  const startWebSocket = () => {
    try {
      // 如果已有连接，先断开
      if (paymentWebSocket.value) {
        paymentWebSocket.value.disconnect()
        paymentWebSocket.value = null
      }

      const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8888'}/payment/status/${options.orderNo}`
      paymentWebSocket.value = useWebSocket({
        url: wsUrl,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        onMessage: (message: WebSocketMessage) => {
          handleWebSocketMessage(message)
        },
        onError: (error) => {
          logger.warn('Payment WebSocket connection error, degrading to polling mode:', error)
          // WebSocket失败时确保轮询在运行
          if (!pollingTimer && enablePolling) {
            startPolling()
          }
        },
        onOpen: () => {
          logger.info('Payment WebSocket connected')
          // WebSocket连接成功后，可以降低轮询频率或停止轮询
          if (pollingTimer) {
            // 降低轮询频率到10秒（作为备用）
            stopPolling()
            startPolling()
          }
        },
        onClose: () => {
          logger.info('Payment WebSocket closed')
          // 连接关闭时确保轮询在运行
          if (!pollingTimer && enablePolling) {
            startPolling()
          }
        },
      })
      paymentWebSocket.value.connect()
    } catch (error) {
      logger.warn('WebSocket unavailable, using polling mode:', error)
      // WebSocket不可用时确保轮询在运行
      if (!pollingTimer && enablePolling) {
        startPolling()
      }
    }
  }

  /**
   * 启动轮询
   */
  const startPolling = () => {
    if (pollingTimer) {
      return // 已经在轮询
    }

    // 立即检查一次
    void checkStatus()

    // 定时轮询（如果WebSocket已连接，使用更长的间隔作为备用）
    const isWebSocketConnected = paymentWebSocket.value?.status?.value === WebSocketStatus.CONNECTED
    const interval = isWebSocketConnected ? pollingInterval * 3 : pollingInterval
    pollingTimer = setInterval(() => {
      void checkStatus()
    }, interval)
  }

  /**
   * 停止轮询
   */
  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  /**
   * 检查支付状态
   */
  const checkStatus = async () => {
    // 检查是否超时
    if (Date.now() - startTime > timeout) {
      handleTimeout()
      return
    }

    try {
      isLoading.value = true

      // 优先使用订单详情API（更完整的信息）
      const orderId = options.orderId || options.orderNo
      const response = await getOrderDetail(orderId)

      if (response.success || response.code === 200) {
        const order = response.data as Order
        updateStatus({
          orderNo: options.orderNo,
          status:
            order.status === 'paid' || order.status === 'completed'
              ? 'paid'
              : order.status === 'failed' || order.status === 'cancelled'
                ? 'failed'
                : order.status === 'processing'
                  ? 'processing'
                  : 'pending',
          message: order.description,
          paidAt: order.payTime || order.completeTime,
          amount: order.amount,
        })

        // 支付成功
        if (order.status === 'paid' || order.status === 'completed') {
          stop()
          options.onSuccess?.(order)
        }
        // 支付失败
        else if (order.status === 'failed' || order.status === 'cancelled') {
          stop()
          options.onFailure?.(order.description || '支付失败')
        }
      }
    } catch (error) {
      logger.error('Failed to check payment status:', error)
      // 网络错误时不停止检查，继续轮询
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 处理WebSocket消息
   */
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    try {
      if (message.type === 'payment_status') {
        const data = message.data as {
          orderNo: string
          status: string
          message?: string
          paidAt?: string
          amount?: number
        }

        if (data.orderNo === options.orderNo) {
          updateStatus({
            orderNo: data.orderNo,
            status: data.status as PaymentStatus['status'],
            message: data.message,
            paidAt: data.paidAt,
            amount: data.amount,
          })

          // 支付成功
          if (data.status === 'paid' || data.status === 'completed') {
            stop()
            // 获取完整订单信息
            getOrderDetail(options.orderId || options.orderNo).then((response) => {
              if (response.success && response.data) {
                options.onSuccess?.(response.data as Order)
              }
            }).catch((e) => { console.error(e) })
          }
          // 支付失败
          else if (data.status === 'failed' || data.status === 'cancelled') {
            stop()
            options.onFailure?.(data.message || '支付失败')
          }
        }
      }
    } catch (error) {
      logger.error('Failed to process payment status message:', error)
    }
  }

  /**
   * 更新状态
   */
  const updateStatus = (newStatus: PaymentStatus) => {
    const oldStatus = status.value.status
    status.value = newStatus

    // 状态变化时触发回调
    if (oldStatus !== newStatus.status) {
      logger.info(`Payment status changed: ${oldStatus} -> ${newStatus.status}`, {
        orderNo: newStatus.orderNo,
        message: newStatus.message,
      })
      options.onStatusChange?.(newStatus)
    }
  }

  /**
   * 处理超时
   */
  const handleTimeout = () => {
    stop()
    updateStatus({
      orderNo: options.orderNo,
      status: 'timeout',
      message: t('api.use_payment_status.支付超时'),
    })
    options.onTimeout?.()
  }

  /**
   * 停止监听
   */
  const stop = () => {
    stopPolling()
    if (paymentWebSocket.value) {
      paymentWebSocket.value.disconnect()
      paymentWebSocket.value = null
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  // 组件卸载时自动停止
  onUnmounted(() => {
    stop()
  })

  return {
    status,
    isLoading,
    start,
    stop,
    checkStatus,
  }
}
