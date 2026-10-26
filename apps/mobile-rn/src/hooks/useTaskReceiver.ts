// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TaskDispatch, TaskResult, TaskWsMessage } from '@ihui/shared/tasks/dispatch'
// 2026-10-26 立:审批跟人判据 —— 审批卡只推给提问方(origin)与执行方(target),
// 同一用户的第三台设备看得见任务在跑,但拿不到答票权。
import { delegationApprovalAudienceOf } from '@ihui/shared/tasks/delegation-approval'
// mobile-rn 通知 WS 薄包装(已注入 WS_BASE_URL + tokenProvider)。
import { useNotificationWebSocket } from './use-websocket'
// 复用 api-client 的 fetchApi:已通过 initApi() 注入 API_BASE_URL + UA + 自动续期。
import { fetchApi } from '@ihui/api-client'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  /**
   * 待我拍板的委派(2026-10-26 立)。**审批跟人**:仅当本设备是提问方或执行方时才出现,
   * 且票仍在 `awaiting`。同一用户的第三台设备此处恒为空集(它无权替人拍板)。
   */
  pendingApprovals: TaskDispatch[]
  /**
   * 回答一张审批票。**先答者胜由服务端判据裁定**,本端只提交并如实回传裁定结果 ——
   * 双端同时点也不会执行两次(后到者被判 duplicate)。
   */
  answerApproval: (taskId: string, decision: boolean) => Promise<{ ok: boolean; message: string }>
}

/** 生成内存级设备 ID(降级路径,优先用 AsyncStorage 里持久化的那份) */
function generateDeviceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* 不可用则降级 */
  }
  return `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** 把增量补拉的任务 upsert 进本地数组(尊重 toDevice 过滤 + seenIds 去重) */
function upsertIncremental(
  prev: TaskDispatch[],
  incoming: TaskDispatch[],
  deviceId: string,
  seenIds: Set<string>,
): TaskDispatch[] {
  const byId = new Map<string, TaskDispatch>()
  for (const t of prev) byId.set(t.id, t)
  let changed = false
  for (const task of incoming) {
    // 设备寻址过滤:只处理给自己的任务
    if (task.toDevice !== deviceId && task.toDevice !== 'all') continue
    const existing = byId.get(task.id)
    if (!existing) {
      byId.set(task.id, task)
      seenIds.add(task.id)
      changed = true
    } else if (Date.parse(task.updatedAt) > Date.parse(existing.updatedAt)) {
      byId.set(task.id, task)
      changed = true
    }
  }
  if (!changed) return prev
  const prevIds = new Set(prev.map((t) => t.id))
  const fresh = [...byId.values()].filter((t) => !prevIds.has(t.id))
  const updatedPrev = prev.map((t) => byId.get(t.id) ?? t)
  return [...fresh, ...updatedPrev]
}

export function useTaskReceiver(token: string | null): UseTaskReceiverReturn {
  const { connected, lastMessage } = useNotificationWebSocket(token)
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const seenIds = useRef(new Set<string>())
  const [deviceId, setDeviceId] = useState<string>(generateDeviceId)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeenTsRef = useRef<number>(0)
  const prevConnectedRef = useRef<boolean>(false)
  const hydratedRef = useRef(false)

  // 设备 ID 持久化:优先读 AsyncStorage,没有则落地内存 id(web 用 localStorage,此处换 AsyncStorage)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY)
        if (stored) {
          setDeviceId(stored)
          return
        }
      } catch {
        /* 读失败:用内存 id */
      }
      try {
        await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
      } catch {
        /* 写失败静默 */
      }
    })()
  }, [deviceId])

  // lastSeenTs 持久化(重连补拉游标):启动时从 AsyncStorage 回填
  useEffect(() => {
    void AsyncStorage.getItem(LAST_SEEN_TS_KEY)
      .then((raw) => {
        const n = raw ? Number.parseInt(raw, 10) : NaN
        if (Number.isFinite(n) && n >= 0) lastSeenTsRef.current = n
      })
      .catch(() => {})
  }, [])

  const saveLastSeenTs = useCallback((ts: number) => {
    lastSeenTsRef.current = ts
    void AsyncStorage.setItem(LAST_SEEN_TS_KEY, String(ts)).catch(() => {})
  }, [])

  // 注册 + 心跳:token 有效时启动,token 失效或 unmount 时注销(设备类型 mobile)
  useEffect(() => {
    if (!token) return

    const deviceName = `Mobile-${deviceId.slice(0, 8)}`

    const register = async () => {
      const r = await fetchApi('/tasks/register-device', {
        method: 'POST',
        body: JSON.stringify({ deviceId, name: deviceName, type: 'mobile' }),
      })
      if (!r.success) {
        console.warn('[use-task-receiver] register failed:', r.error)
      }
    }

    void register()
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      void register()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      void fetchApi(`/tasks/devices/${deviceId}`, { method: 'DELETE' }).catch((err) => {
        console.warn('[use-task-receiver] unregister error:', err)
      })
    }
  }, [token, deviceId])

  // WS 重连补拉:connected 从 false→true 时,GET /tasks?since=<lastSeenTs> 补拉断线期间错过的任务
  useEffect(() => {
    if (!token) {
      prevConnectedRef.current = false
      return
    }
    const wasConnected = prevConnectedRef.current
    prevConnectedRef.current = connected
    if (!connected || wasConnected) return
    if (lastSeenTsRef.current <= 0) return

    let cancelled = false
    void (async () => {
      try {
        const since = lastSeenTsRef.current
        const r = await fetchApi<{ tasks: TaskDispatch[]; total: number }>(`/tasks?since=${since}`)
        if (cancelled || !r.success || !r.data) return
        const list = r.data.tasks ?? []
        if (list.length === 0) return
        setTasks((prev) => {
          const next = upsertIncremental(prev, list, deviceId, seenIds.current)
          const maxTs = list.reduce((max, t) => Math.max(max, Date.parse(t.updatedAt) || 0), since)
          if (maxTs > lastSeenTsRef.current) saveLastSeenTs(maxTs)
          return next
        })
      } catch {
        /* 忽略补拉任务错误 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [connected, token, deviceId, saveLastSeenTs])

  // 消息接收 + toDevice 过滤 + upsert + task-cancelled + task-approval 处理
  useEffect(() => {
    if (!lastMessage) return
    // 服务端把每条推送包成 { type:'notification', data: <原始消息> },与 web 端同款信封
    const raw = lastMessage as unknown as { type?: string; data?: unknown }
    const msg = ((raw?.type === 'notification' ? raw.data : raw) ?? null) as TaskWsMessage | null
    if (!msg) return
    const kind = msg.type
    if (
      kind !== 'task-dispatch' &&
      kind !== 'task-result' &&
      kind !== 'task-progress' &&
      kind !== 'task-cancelled' &&
      kind !== 'task-approval'
    )
      return
    const taskId = msg.taskId
    if (!taskId) return

    setTasks((prev) => {
      if (kind === 'task-dispatch') {
        const task = msg.payload as TaskDispatch
        if (task.toDevice !== deviceId && task.toDevice !== 'all') return prev
        if (seenIds.current.has(task.id)) {
          return prev.map((x) => (x.id === task.id ? task : x))
        }
        seenIds.current.add(task.id)
        if (seenIds.current.size > 200) {
          const arr = Array.from(seenIds.current)
          seenIds.current = new Set(arr.slice(-100))
        }
        const ts = Date.parse(task.updatedAt)
        if (Number.isFinite(ts) && ts > lastSeenTsRef.current) saveLastSeenTs(ts)
        return [task, ...prev]
      }
      if (kind === 'task-cancelled') {
        const cancelledTask = msg.payload as TaskDispatch
        const ts = Date.parse(cancelledTask.updatedAt)
        if (Number.isFinite(ts) && ts > lastSeenTsRef.current) saveLastSeenTs(ts)
        return prev.map((x) =>
          x.id === taskId
            ? { ...x, status: 'cancelled' as const, updatedAt: cancelledTask.updatedAt }
            : x,
        )
      }
      if (kind === 'task-approval') {
        // 审批票(2026-10-26):**不做 toDevice 过滤** —— 审批卡要同时出现在提问方与执行方两台设备上。
        // 但只有 audience = [origin, target] 内的设备能看到,第三台设备在此被挡掉。
        const approvalTask = msg.payload as TaskDispatch
        if (!approvalTask.approval) return prev
        if (!delegationApprovalAudienceOf(approvalTask.approval).includes(deviceId)) return prev
        const ats = Date.parse(approvalTask.updatedAt)
        if (Number.isFinite(ats) && ats > lastSeenTsRef.current) saveLastSeenTs(ats)
        return prev.some((x) => x.id === approvalTask.id)
          ? prev.map((x) => (x.id === approvalTask.id ? approvalTask : x))
          : [approvalTask, ...prev]
      }
      const result = msg.payload as TaskResult
      const ts = Date.parse(result.finishedAt)
      if (Number.isFinite(ts) && ts > lastSeenTsRef.current) saveLastSeenTs(ts)
      return prev.map((x) => (x.id === taskId ? { ...x, status: result.status, result } : x))
    })
  }, [lastMessage, deviceId, saveLastSeenTs])

  /** 待我拍板的委派:票仍在 awaiting ∧ 本设备在 audience 内 */
  const pendingApprovals = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.approval &&
          t.approval.state === 'awaiting' &&
          delegationApprovalAudienceOf(t.approval).includes(deviceId),
      ),
    [tasks, deviceId],
  )

  /** 回答审批票:提交 (decision, seq, deviceId),裁定由服务端判据给出 */
  const answerApproval = useCallback(
    async (taskId: string, decision: boolean): Promise<{ ok: boolean; message: string }> => {
      const task = tasks.find((x) => x.id === taskId)
      if (!task?.approval) {
        return { ok: false, message: '该委派没有待审的票' }
      }
      const r = await fetchApi<{ task: TaskDispatch; verdict: string; reason: string }>(
        `/tasks/${taskId}/approval`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision,
            seq: task.approval.seq,
            deviceId,
          }),
        },
      )
      if (!r.success) {
        return { ok: false, message: r.error ?? '审批提交失败' }
      }
      // 服务端回推的 task-approval 帧会更新列表,此处不本地乐观改状态 ——
      // 先答者胜必须以服务端那张票为准。
      const verdict = r.data?.verdict ?? ''
      if (verdict && verdict !== 'applied') {
        return { ok: false, message: r.data?.reason || `未生效(${verdict})` }
      }
      return { ok: true, message: decision ? '已放行' : '已拒绝' }
    },
    [tasks, deviceId],
  )

  return {
    tasks,
    isConnected: connected,
    deviceId,
    pendingApprovals,
    answerApproval,
  }
}
