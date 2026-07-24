'use client'

/**
 * Task Receiver React hook(web 端,从 desktop 版迁移 2026-07-24)。
 *
 * 监听 WebSocket task-dispatch / task-result / task-progress / task-cancelled 消息,
 * 把移动端下发的任务累积到本地数组,供 TaskReceiverPage 渲染。
 *
 * 与 desktop 版的差异:
 * - 复用 web 端 `useWebSocket()`(自动从 useAuthStore 取 token,连接 /ws/notifications)
 * - HTTP 调用改用 `fetchApi` from `@/lib/api`(自动注入 token + baseURL + 解包 { code, message, data })
 * - 设备类型 `web`(desktop 版为 `desktop`)
 *
 * 设备寻址闭环:启动时生成持久化 deviceId(localStorage `ihui-device-id`),
 * token 有效时调 POST /api/tasks/register-device 注册 + 30s 心跳保活,
 * hook unmount 或 token 失效时调 DELETE /api/tasks/devices/:deviceId 注销,
 * 收到 task-dispatch 后按 toDevice 过滤(只处理给自己的任务)。
 *
 * 断网恢复闭环:lastSeenTs 持久化到 localStorage(`task-last-seen-ts`),
 * WS 重连(connected: false→true)时调 GET /api/tasks?since=<lastSeenTs> 补拉断线期间错过的任务,
 * 收到 task-cancelled 消息时把对应任务状态置为 cancelled。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskDispatch, TaskResult, TaskWsMessage } from '@ihui/shared'
import { useWebSocket } from '@/hooks/use-websocket'
import { fetchApi } from '@/lib/api'

const DEVICE_ID_STORAGE_KEY = 'ihui-device-id'
/** 最近一次见到任务的 updatedAt 时间戳(ms),用于 WS 重连后增量补拉 */
const LAST_SEEN_TS_KEY = 'task-last-seen-ts'
const HEARTBEAT_INTERVAL_MS = 30_000

export interface UseTaskReceiverReturn {
  /** 已接收的任务列表(按到达时间倒序) */
  tasks: TaskDispatch[]
  /** WebSocket 连接状态 */
  isConnected: boolean
  /** 当前设备持久化 ID(供 UI 显示 + 对外标识) */
  deviceId: string
  /** 下载指定任务的附件。返回下载结果文案供 UI 显示。 */
  downloadAttachment: (taskId: string) => { ok: boolean; message: string }
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

/** 读取持久化的 lastSeenTs,失败返回 0(首拉视为全量补) */
function loadLastSeenTs(): number {
  try {
    const raw = window.localStorage?.getItem(LAST_SEEN_TS_KEY)
    const n = raw ? Number.parseInt(raw, 10) : NaN
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** 持久化 lastSeenTs,失败静默 */
function saveLastSeenTs(ts: number): void {
  try {
    window.localStorage?.setItem(LAST_SEEN_TS_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

/** 统一 { code, message, data } 响应,fetchApi 已解包,返回 data 字段 */
async function apiData<T>(path: string): Promise<T | null> {
  const r = await fetchApi<T>(path)
  if (!r.success) return null
  return r.data
}

/** 把增量补拉的任务 upsert 进本地数组(尊重 toDevice 过滤 + seenIds 去重) */
function upsertIncremental(
  prev: TaskDispatch[],
  incoming: TaskDispatch[],
  deviceId: string,
  seenIds: Set<string>,
): TaskDispatch[] {
  const byId = new Map<string, TaskDispatch>()
  // 先放已有,保证顺序
  for (const t of prev) byId.set(t.id, t)
  let changed = false
  for (const task of incoming) {
    // 设备寻址过滤:只处理给自己的任务
    if (task.toDevice !== deviceId && task.toDevice !== 'all') continue
    const existing = byId.get(task.id)
    if (!existing) {
      // 新任务:前置插入(到达时间倒序)
      byId.set(task.id, task)
      seenIds.add(task.id)
      changed = true
    } else {
      // 已有:按 updatedAt 较新者覆盖
      if (Date.parse(task.updatedAt) > Date.parse(existing.updatedAt)) {
        byId.set(task.id, task)
        changed = true
      }
    }
  }
  if (!changed) return prev
  // 重建数组:新加入的在前,原有顺序保持
  const prevIds = new Set(prev.map((t) => t.id))
  const fresh = [...byId.values()].filter((t) => !prevIds.has(t.id))
  const updatedPrev = prev.map((t) => byId.get(t.id) ?? t)
  return [...fresh, ...updatedPrev]
}

export function useTaskReceiver(token: string | null): UseTaskReceiverReturn {
  const { connected, lastMessage } = useWebSocket()
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const seenIds = useRef(new Set<string>())
  const [deviceId] = useState<string>(loadOrCreateDeviceId)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeenTsRef = useRef<number>(loadLastSeenTs())
  // 记录上一次 connected 状态,用于检测 false→true 重连
  const prevConnectedRef = useRef<boolean>(false)

  // 注册 + 心跳:token 有效时启动,token 失效或 unmount 时注销
  useEffect(() => {
    if (!token) return

    const deviceName = `Web-${deviceId.slice(0, 8)}`

    const register = async () => {
      const r = await fetchApi('/api/tasks/register-device', {
        method: 'POST',
        body: JSON.stringify({ deviceId, name: deviceName, type: 'web' }),
      })
      if (!r.success) {
        console.error('[use-task-receiver] register failed:', r.error)
      }
    }

    void register()
    heartbeatRef.current = setInterval(() => {
      void register()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      // 注销:异步调用,失败静默(WS 消息接收不受影响)
      void fetchApi(`/api/tasks/devices/${deviceId}`, { method: 'DELETE' }).catch((err) => {
        console.error('[use-task-receiver] unregister error:', err)
      })
    }
  }, [token, deviceId])

  // WS 重连补拉:connected 从 false→true 时,GET /api/tasks?since=<lastSeenTs> 补拉断线期间错过的任务
  useEffect(() => {
    if (!token) {
      prevConnectedRef.current = false
      return
    }
    const wasConnected = prevConnectedRef.current
    prevConnectedRef.current = connected
    // 仅在重连(false→true)时触发补拉,首次连接 lastSeenTs=0 时会全量拉
    if (!connected || wasConnected) return
    if (lastSeenTsRef.current <= 0) return

    void (async () => {
      const since = lastSeenTsRef.current
      const data = await apiData<{ tasks: TaskDispatch[] } | TaskDispatch[]>(
        `/api/tasks?since=${since}`,
      )
      if (!data) return
      const list = Array.isArray(data) ? data : data.tasks ?? []
      if (list.length === 0) return
      setTasks((prev) => {
        const next = upsertIncremental(prev, list, deviceId, seenIds.current)
        // 更新 lastSeenTs 为补拉任务中的最大 updatedAt
        const maxTs = list.reduce(
          (max, t) => Math.max(max, Date.parse(t.updatedAt) || 0),
          since,
        )
        if (maxTs > lastSeenTsRef.current) {
          lastSeenTsRef.current = maxTs
          saveLastSeenTs(maxTs)
        }
        return next
      })
    })()
  }, [connected, token, deviceId])

  // 消息接收 + toDevice 过滤 + upsert + task-cancelled 处理
  useEffect(() => {
    if (!lastMessage) return
    const msg = lastMessage.data as unknown as TaskWsMessage
    const kind = msg.type
    if (
      kind !== 'task-dispatch' &&
      kind !== 'task-result' &&
      kind !== 'task-progress' &&
      kind !== 'task-cancelled'
    )
      return
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
        // 更新 lastSeenTs
        const ts = Date.parse(task.updatedAt)
        if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
          lastSeenTsRef.current = ts
          saveLastSeenTs(ts)
        }
        return [task, ...prev]
      }
      if (kind === 'task-cancelled') {
        // 把对应任务状态置为 cancelled;执行中任务据此中止(本 hook 无执行逻辑,仅更新状态)
        const cancelledTask = msg.payload as TaskDispatch
        const ts = Date.parse(cancelledTask.updatedAt)
        if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
          lastSeenTsRef.current = ts
          saveLastSeenTs(ts)
        }
        return prev.map((x) =>
          x.id === taskId
            ? { ...x, status: 'cancelled', updatedAt: cancelledTask.updatedAt }
            : x,
        )
      }
      const result = msg.payload as TaskResult
      const ts = Date.parse(result.finishedAt)
      if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
        lastSeenTsRef.current = ts
        saveLastSeenTs(ts)
      }
      return prev.map((x) => (x.id === taskId ? { ...x, status: result.status, result } : x))
    })
  }, [lastMessage, deviceId])

  /**
   * 下载指定任务的附件。
   * 流程:从本地 tasks 数组查找 task.filePayload → atob 解码 base64 → Uint8Array →
   * Blob(URL.createObjectURL)→ 创建 <a> 元素 + click() 触发浏览器下载。
   * 失败返回 ok=false + 错误文案,供 UI 提示。
   */
  const downloadAttachment = useCallback(
    (taskId: string): { ok: boolean; message: string } => {
      const task = tasks.find((x) => x.id === taskId)
      if (!task) {
        return { ok: false, message: 'Task not found' }
      }
      const fp = task.filePayload
      if (!fp) {
        return { ok: false, message: 'No attachment on this task' }
      }
      try {
        // atob 解码 base64 → 二进制字符串 → Uint8Array
        const binary = atob(fp.content)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        // Uint8Array → Blob → ObjectURL → 触发下载
        const blob = new Blob([bytes], { type: fp.mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fp.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // 释放 ObjectURL(浏览器异步下载已触发,可立即释放)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        return { ok: true, message: `Downloaded ${fp.filename}` }
      } catch (err) {
        return {
          ok: false,
          message: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    },
    [tasks],
  )

  return { tasks, isConnected: connected, deviceId, downloadAttachment }
}
