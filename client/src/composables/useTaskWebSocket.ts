import { t } from '@/utils/i18n'

/**
 * 任务WebSocket连接管理
 * 提供任务状态实时更新功能
 */

import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { TaskEvent, TaskEventType } from '@/api/system/tasks'

/**
 * WebSocket连接配置
 */
interface WebSocketConfig {
  url?: string
  autoConnect?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

/**
 * 任务WebSocket连接管理
 */
export function useTaskWebSocket(config: WebSocketConfig = {}) {
  // 从环境变量获取WebSocket URL并转换为socket.io所需的格式
  const getSocketUrl = () => {
    if (import.meta.env.DEV) {
      // 开发环境使用相对路径，利用Vite代理
      return `${window.location.protocol}//${window.location.host}`
    } else if (import.meta.env.VITE_WS_URL) {
      // 生产环境从VITE_WS_URL转换（ws:// → http://, wss:// → https://）
      return import.meta.env.VITE_WS_URL.replace(/^ws/, 'http')
    } else {
      return 'http://localhost:8888'
    }
  }

  const {
    url = getSocketUrl(),
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = config

  const socket = ref<Socket | null>(null)
  const connected = ref(false)
  const error = ref<string | null>(null)

  // 任务事件监听器
  const taskEventListeners = new Map<string, Set<(event: TaskEvent) => void>>()

  /**
   * 连接WebSocket
   */
  const connect = () => {
    if (socket.value?.connected) {
      return
    }

    try {
      socket.value = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      socket.value.on('connect', () => {
        connected.value = true
        error.value = null
        onConnect?.()
      })

      socket.value.on('disconnect', () => {
        connected.value = false
        onDisconnect?.()
      })

      socket.value.on('connect_error', (err: Error) => {
        error.value = err.message
        onError?.(err)
      })

      // 监听任务事件
      socket.value.on('task:created', (event: TaskEvent) => {
        notifyListeners('task:created', event)
      })

      socket.value.on('task:update', (event: TaskEvent) => {
        notifyListeners('task:update', event)
      })

      socket.value.on('task:cancelled', (event: TaskEvent) => {
        notifyListeners('task:cancelled', event)
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('api.use_task_web_socket.连接失败')
      onError?.(err instanceof Error ? err : new Error('连接失败'))
    }
  }

  /**
   * 断开WebSocket连接
   */
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      connected.value = false
    }
  }

  /**
   * 监听任务事件
   */
  const onTaskEvent = (
    eventType: TaskEventType,
    callback: (event: TaskEvent) => void,
    taskId?: string
  ) => {
    const key = taskId ? `${eventType}:${taskId}` : eventType
    if (!taskEventListeners.has(key)) {
      taskEventListeners.set(key, new Set())
    }
    taskEventListeners.get(key)!.add(callback)

    // 返回取消监听的函数
    return () => {
      const listeners = taskEventListeners.get(key)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          taskEventListeners.delete(key)
        }
      }
    }
  }

  /**
   * 通知监听器
   */
  const notifyListeners = (eventType: TaskEventType, event: TaskEvent) => {
    // 通知通用监听器
    const generalListeners = taskEventListeners.get(eventType)
    if (generalListeners) {
      generalListeners.forEach(callback => callback(event))
    }

    // 通知特定任务监听器
    const specificListeners = taskEventListeners.get(`${eventType}:${event.taskId}`)
    if (specificListeners) {
      specificListeners.forEach(callback => callback(event))
    }
  }

  /**
   * 加入用户房间（用于接收用户特定任务通知）
   */
  const joinUserRoom = (userId: string) => {
    if (socket.value?.connected) {
      socket.value.emit('join', `user:${userId}`)
    }
  }

  /**
   * 离开用户房间
   */
  const leaveUserRoom = (userId: string) => {
    if (socket.value?.connected) {
      socket.value.emit('leave', `user:${userId}`)
    }
  }

  // 自动连接
  if (autoConnect) {
    connect()
  }

  // 组件卸载时断开连接
  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    connected,
    error,
    connect,
    disconnect,
    onTaskEvent,
    joinUserRoom,
    leaveUserRoom,
  }
}
