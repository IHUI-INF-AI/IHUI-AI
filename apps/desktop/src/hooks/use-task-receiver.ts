/**
 * Task Receiver React hook(desktop 端,2026-07-23 立)。
 *
 * 监听 WebSocket task-dispatch / task-result / task-progress 消息,
 * 把移动端下发的任务累积到本地数组,供 TaskReceiverPage 渲染。
 *
 * 基于 use-agent-control-bridge 模式:复用 useNotificationWebSocket 建连,
 * 过滤 data.type 为 task-* 的消息,按 taskId upsert 状态。
 */
import { useEffect, useRef, useState } from 'react'
import type { TaskDispatch, TaskResult, TaskWsMessage } from '@ihui/shared'
import { useNotificationWebSocket } from './use-websocket'

export interface UseTaskReceiverReturn {
  /** 已接收的任务列表(按到达时间倒序) */
  tasks: TaskDispatch[]
  /** WebSocket 连接状态 */
  isConnected: boolean
}

export function useTaskReceiver(token: string | null): UseTaskReceiverReturn {
  const { connected, lastMessage } = useNotificationWebSocket(token)
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const seenIds = useRef(new Set<string>())

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
  }, [lastMessage])

  return { tasks, isConnected: connected }
}
