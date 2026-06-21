/**
 * 实时统计服务（使用WebSocket）
 */

import { websocketService } from '@/utils/websocket'
import { ref, onMounted, onUnmounted } from 'vue'

export interface RealtimeStats {
  currentQPS: number
  currentConcurrency: number
  todayCalls: number
  todayCost: number
  errorRate: number
  avgResponseTime: number
  timestamp: string
}

/**
 * 使用实时统计
 */
export function useRealtimeStatistics() {
  const stats = ref<RealtimeStats>({
    currentQPS: 0,
    currentConcurrency: 0,
    todayCalls: 0,
    todayCost: 0,
    errorRate: 0,
    avgResponseTime: 0,
    timestamp: new Date().toISOString(),
  })

  const isConnected = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  // 监听统计更新
  const handleStatsUpdate = (data: any) => {
    const message = data as { type: string; data: any }
    if (message.type === 'statistics.update' && message.data) {
      const statsData = message.data as RealtimeStats
      stats.value = {
        ...statsData,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // 连接WebSocket
  const connect = async () => {
    try {
      const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'wss://api.clawbot.com/ws'
      await websocketService.connect(wsUrl)
      isConnected.value = true
      error.value = null

      // 订阅统计更新
      unsubscribe = websocketService.on('statistics.update', handleStatsUpdate)

      // 请求初始统计
      websocketService.send('statistics.subscribe', { channels: ['realtime'] })
    } catch (err: any) {
      error.value = (err as { message?: string })?.message || '连接失败'
      isConnected.value = false
      // WebSocket连接失败时静默处理，不影响功能
    }
  }

  // 断开连接
  const disconnect = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    websocketService.disconnect()
    isConnected.value = false
  }

  // 自动重连
  const reconnect = () => {
    if (!isConnected.value) {
      void connect()
    }
  }

  onMounted(() => {
    void connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    stats,
    isConnected,
    error,
    connect,
    disconnect,
    reconnect,
  }
}
