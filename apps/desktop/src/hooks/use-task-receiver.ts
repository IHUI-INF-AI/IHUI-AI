/**
 * Task Receiver React hook(desktop 端,2026-07-23 立)。
 *
 * 监听 WebSocket task-dispatch / task-result / task-progress 消息,
 * 把移动端下发的任务累积到本地数组,供 TaskReceiverPage 渲染。
 *
 * 基于 use-agent-control-bridge 模式:复用 useNotificationWebSocket 建连,
 * 过滤 data.type 为 task-* 的消息,按 taskId upsert 状态。
 *
 * 设备寻址闭环(2026-07-23 升级,P1):
 * - 启动时生成持久化 deviceId(localStorage `ihui-device-id`)
 * - token 有效时调 POST /tasks/register-device 注册 + 30s 心跳保活
 * - hook unmount 或 token 失效时调 DELETE /tasks/devices/:deviceId 注销
 * - 收到 task-dispatch 后按 toDevice 过滤(只处理给自己的任务)
 */
import { useEffect, useRef, useState } from 'react'
import type { TaskDispatch, TaskResult, TaskWsMessage } from '@ihui/shared'
import { useNotificationWebSocket } from './use-websocket'

const API_BASE_URL = 'http://127.0.0.1:8802'
const DEVICE_ID_STORAGE_KEY = 'ihui-device-id'
const HEARTBEAT_INTERVAL_MS = 30_000

export interface UseTaskReceiverReturn {
  /** 已接收的任务列表(按到达时间倒序) */
  tasks: TaskDispatch[]
  /** WebSocket 连接状态 */
  isConnected: boolean
  /** 当前设备持久化 ID(供 UI 显示 + 对外标识) */
  deviceId: string
}

/** 生成或读取持久化 deviceId,兼容非 secure context(crypto.randomUUID 降级) */
function loadOrCreateDeviceId(): string {
  try {
    const stored = window.localStorage?.getItem(DEVICE_ID_STORAGE_KEY)
    if (stored) return stored
    let id: string
    try {
      id = crypto.randomUUID()
    } catch {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    }
    try {
      window.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, id)
    } catch {
      /* localStorage 不可用时仍返回内存 ID */
    }
    return id
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
  }
}

export function useTaskReceiver(token: string | null): UseTaskReceiverReturn {
  const { connected, lastMessage } = useNotificationWebSocket(token)
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const seenIds = useRef(new Set<string>())
  const [deviceId] = useState<string>(loadOrCreateDeviceId)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 注册 + 心跳:token 有效时启动,token 失效或 unmount 时注销
  useEffect(() => {
    if (!token) return

    const deviceName = `Desktop-${deviceId.slice(0, 8)}`

    const register = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/register-device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ deviceId, name: deviceName, type: 'desktop' }),
        })
        if (!res.ok) {
          console.error('[use-task-receiver] register failed:', res.status, res.statusText)
        }
      } catch (err) {
        console.error('[use-task-receiver] register error:', err)
      }
    }

    void register()
    heartbeatRef.current = setInterval(register, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      // 注销:异步调用,失败静默(WS 消息接收不受影响)
      void (async () => {
        try {
          await fetch(`${API_BASE_URL}/api/tasks/devices/${deviceId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        } catch (err) {
          console.error('[use-task-receiver] unregister error:', err)
        }
      })()
    }
  }, [token, deviceId])

  // 消息接收 + toDevice 过滤 + upsert
  useEffect(() => {
    if (!lastMessage) return
    const msg = lastMessage.data as unknown as TaskWsMessage
    const kind = msg.type
    if (kind !== 'task-dispatch' && kind !== 'task-result' && kind !== 'task-progress') return
    const taskId = msg.taskId
    if (!taskId) return

    setTasks((prev) => {
      if (kind === 'task-dispatch') {
        const task = msg.payload as TaskDispatch
        // 设备寻址过滤:只处理给自己的任务(toDevice === 自己 || 'all')
        if (task.toDevice !== deviceId && task.toDevice !== 'all') {
          return prev
        }
        if (seenIds.current.has(task.id)) {
          return prev.map((x) => (x.id === task.id ? task : x))
        }
        seenIds.current.add(task.id)
        if (seenIds.current.size > 200) {
          const arr = Array.from(seenIds.current)
          seenIds.current = new Set(arr.slice(-100))
        }
        return [task, ...prev]
      }
      const result = msg.payload as TaskResult
      return prev.map((x) => (x.id === taskId ? { ...x, status: result.status, result } : x))
    })
  }, [lastMessage, deviceId])

  return { tasks, isConnected: connected, deviceId }
}
