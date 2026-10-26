// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 2026-10-26 立:desktop 端跨端任务接收(与 web `use-task-receiver` 同款契约,框架无关版)。
//
// desktop 是 Tauri 薄壳,本地没有 React 前端(窗口直接加载线上站点),所以这里不写 React hook,
// 而是写**框架无关**的接收器类:设备注册/心跳、按 `toDevice` 过滤的 WS 接收、断线增量补拉、
// `pendingApprovals` / `answerApproval`,与 web 端共用 `packages/shared` 的契约与审批判据。
// 既可直接在 Tauri webview 里 `invoke` 时复用,也可被未来本地覆盖层挂载。

import type {
  TaskDispatch,
  TaskResult,
  TaskWsMessage,
  TaskDeviceType,
} from '@ihui/shared/tasks/dispatch'
import { delegationApprovalAudienceOf } from '@ihui/shared/tasks/delegation-approval'

const DEVICE_ID_STORAGE_KEY = 'ihui-device-id'
const LAST_SEEN_TS_KEY = 'task-last-seen-ts'
const HEARTBEAT_INTERVAL_MS = 30_000

export interface TaskReceiverOptions {
  /** API baseURL,例如 https://aizhs.top/api */
  apiBaseUrl: string
  /** WebSocket 通知地址,例如 wss://aizhs.top/ws/notifications */
  wsUrl: string
  /** 本设备类型,desktop 固定 'desktop' */
  deviceType: TaskDeviceType
  /** 设备展示名前缀,缺省 `Desktop-` */
  deviceNamePrefix?: string
  /** 注入 fetch(便于测试/非浏览器环境),缺省全局 fetch */
  fetchImpl?: typeof fetch
  /** 注入 WebSocket 构造器,缺省全局 WebSocket */
  wsImpl?: typeof WebSocket
  /** localStorage 注入(默认全局 localStorage);测试可传替代 */
  storage?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
  /** 连接态变化回调 */
  onConnectionChange?: (connected: boolean) => void
  /** 任务列表变化回调 */
  onTasksChange?: (tasks: TaskDispatch[]) => void
}

export interface AnswerApprovalResult {
  ok: boolean
  message: string
}

/** 与 web `useTaskReceiver` 对等的返回值形状(去 React 化)。 */
export interface TaskReceiverState {
  tasks: TaskDispatch[]
  isConnected: boolean
  deviceId: string
  pendingApprovals: TaskDispatch[]
}

function nowMs(): number {
  return Date.now()
}

/** 生成或读取持久化 deviceId(crypto.randomUUID 降级)。 */
function loadOrCreateDeviceId(storage: TaskReceiverOptions['storage']): string {
  try {
    const stored = storage?.getItem(DEVICE_ID_STORAGE_KEY)
    if (stored) return stored
  } catch {
    /* ignore */
  }
  let id: string
  try {
    id = crypto.randomUUID()
  } catch {
    id = nowMs().toString(36) + Math.random().toString(36).slice(2)
  }
  try {
    storage?.setItem(DEVICE_ID_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  return id
}

function loadLastSeenTs(storage: TaskReceiverOptions['storage']): number {
  try {
    const raw = storage?.getItem(LAST_SEEN_TS_KEY)
    const n = raw ? Number.parseInt(raw, 10) : NaN
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function saveLastSeenTs(storage: TaskReceiverOptions['storage'], ts: number): void {
  try {
    storage?.setItem(LAST_SEEN_TS_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

/** 把增量补拉的任务 upsert 进本地数组(尊重 toDevice 过滤 + seenIds 去重)。 */
export function upsertIncremental(
  prev: TaskDispatch[],
  incoming: TaskDispatch[],
  deviceId: string,
  seenIds: Set<string>,
): TaskDispatch[] {
  const byId = new Map<string, TaskDispatch>()
  for (const t of prev) byId.set(t.id, t)
  let changed = false
  for (const task of incoming) {
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

/**
 * 框架无关的跨端任务接收器。镜像 web `useTaskReceiver` 的全部闭环:
 * 设备注册/心跳、WS 接收 + toDevice 过滤、断线增量补拉、审批跟人(pendingApprovals / answerApproval)。
 */
export class DesktopTaskReceiver {
  private readonly opts: TaskReceiverOptions
  private readonly fetchImpl: typeof fetch
  private readonly wsImpl: typeof WebSocket
  private readonly storage: TaskReceiverOptions['storage']

  readonly deviceId: string
  private tasks: TaskDispatch[] = []
  private readonly seenIds = new Set<string>()
  private lastSeenTs: number
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private ws: WebSocket | null = null
  private connected = false
  private token: string | null = null
  private wasConnected = false

  constructor(opts: TaskReceiverOptions) {
    this.opts = opts
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.wsImpl = opts.wsImpl ?? WebSocket
    this.storage = opts.storage
    this.deviceId = loadOrCreateDeviceId(this.storage)
    this.lastSeenTs = loadLastSeenTs(this.storage)
  }

  /** 启动:带 token 注册 + 起心跳 + 连 WS。token 为空时只准备 deviceId,不联网。 */
  start(token: string | null): void {
    this.token = token
    if (!token) return
    void this.register()
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => void this.register(), HEARTBEAT_INTERVAL_MS)
    this.connectWs(token)
  }

  /** 停止:清心跳 + 断 WS + 注销设备。 */
  stop(): void {
    this.stopHeartbeat()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    if (this.token) {
      void this.fetchImpl(`${this.opts.apiBaseUrl}/tasks/devices/${this.deviceId}`, {
        method: 'DELETE',
      }).catch(() => undefined)
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private get deviceName(): string {
    return `${this.opts.deviceNamePrefix ?? 'Desktop-'}${this.deviceId.slice(0, 8)}`
  }

  private async register(): Promise<void> {
    if (!this.token) return
    try {
      await this.fetchImpl(`${this.opts.apiBaseUrl}/tasks/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          name: this.deviceName,
          type: this.opts.deviceType,
        }),
      })
    } catch {
      /* 注册失败不阻断接收 */
    }
  }

  private connectWs(token: string): void {
    const url = `${this.opts.wsUrl}?token=${encodeURIComponent(token)}`
    let ws: WebSocket
    try {
      ws = new this.wsImpl(url)
    } catch {
      return
    }
    this.ws = ws
    ws.onopen = () => this.setConnected(true)
    ws.onclose = () => this.setConnected(false)
    ws.onerror = () => this.setConnected(false)
    ws.onmessage = (ev: MessageEvent) => this.handleMessage(ev.data)
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) return
    this.connected = connected
    // 重连(false→true)时增量补拉
    if (connected && !this.wasConnected && this.lastSeenTs > 0) {
      void this.refillSince(this.lastSeenTs)
    }
    this.wasConnected = connected
    this.opts.onConnectionChange?.(connected)
  }

  private async refillSince(since: number): Promise<void> {
    if (!this.token) return
    try {
      const res = await this.fetchImpl(`${this.opts.apiBaseUrl}/tasks?since=${since}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) return
      const data = (await res.json()) as TaskDispatch[] | { tasks: TaskDispatch[] }
      const list = Array.isArray(data) ? data : (data.tasks ?? [])
      if (list.length === 0) return
      this.setTasks((prev) => {
        const next = upsertIncremental(prev, list, this.deviceId, this.seenIds)
        const maxTs = list.reduce((m, t) => Math.max(m, Date.parse(t.updatedAt) || 0), since)
        if (maxTs > this.lastSeenTs) {
          this.lastSeenTs = maxTs
          saveLastSeenTs(this.storage, maxTs)
        }
        return next
      })
    } catch {
      /* 忽略补拉失败 */
    }
  }

  private handleMessage(data: unknown): void {
    let msg: TaskWsMessage
    try {
      msg = typeof data === 'string' ? (JSON.parse(data) as TaskWsMessage) : (data as TaskWsMessage)
    } catch {
      return
    }
    const kind = msg.type
    if (
      kind !== 'task-dispatch' &&
      kind !== 'task-result' &&
      kind !== 'task-progress' &&
      kind !== 'task-cancelled' &&
      kind !== 'task-approval'
    ) {
      return
    }
    if (!msg.taskId) return

    this.setTasks((prev) => {
      if (kind === 'task-dispatch') {
        const task = msg.payload as TaskDispatch
        if (task.toDevice !== this.deviceId && task.toDevice !== 'all') return prev
        if (this.seenIds.has(task.id)) {
          return prev.map((x) => (x.id === task.id ? task : x))
        }
        this.seenIds.add(task.id)
        if (this.seenIds.size > 200) {
          this.seenIds = new Set(Array.from(this.seenIds).slice(-100))
        }
        this.bumpLastSeen(task.updatedAt)
        return [task, ...prev]
      }
      if (kind === 'task-cancelled') {
        const cancelled = msg.payload as TaskDispatch
        this.bumpLastSeen(cancelled.updatedAt)
        return prev.map((x) =>
          x.id === msg.taskId ? { ...x, status: 'cancelled', updatedAt: cancelled.updatedAt } : x,
        )
      }
      if (kind === 'task-approval') {
        // 审批跟人:**不做 toDevice 过滤**,但只在 audience=[origin,target] 内的设备可见。
        const approvalTask = msg.payload as TaskDispatch
        if (!approvalTask.approval) return prev
        if (!delegationApprovalAudienceOf(approvalTask.approval).includes(this.deviceId)) {
          return prev
        }
        this.bumpLastSeen(approvalTask.updatedAt)
        return prev.some((x) => x.id === approvalTask.id)
          ? prev.map((x) => (x.id === approvalTask.id ? approvalTask : x))
          : [approvalTask, ...prev]
      }
      const result = msg.payload as TaskResult
      this.bumpLastSeen(result.finishedAt)
      return prev.map((x) => (x.id === msg.taskId ? { ...x, status: result.status, result } : x))
    })
  }

  private bumpLastSeen(iso: string): void {
    const ts = Date.parse(iso)
    if (Number.isFinite(ts) && ts > this.lastSeenTs) {
      this.lastSeenTs = ts
      saveLastSeenTs(this.storage, ts)
    }
  }

  private setTasks(updater: (prev: TaskDispatch[]) => TaskDispatch[]): void {
    this.tasks = updater(this.tasks)
    this.opts.onTasksChange?.(this.tasks)
  }

  // ---- 对外只读状态 ----

  getState(): TaskReceiverState {
    return {
      tasks: this.tasks,
      isConnected: this.connected,
      deviceId: this.deviceId,
      pendingApprovals: this.pendingApprovals(),
    }
  }

  /** 待我拍板的委派:票 awaiting ∧ 本设备在 audience 内。 */
  pendingApprovals(): TaskDispatch[] {
    return this.tasks.filter(
      (t) =>
        t.approval &&
        t.approval.state === 'awaiting' &&
        delegationApprovalAudienceOf(t.approval).includes(this.deviceId),
    )
  }

  /** 回答审批票(先答者胜由服务端裁定,本端只提交并如实回传)。 */
  async answerApproval(taskId: string, decision: boolean): Promise<AnswerApprovalResult> {
    const task = this.tasks.find((x) => x.id === taskId)
    if (!task?.approval) {
      return { ok: false, message: '该委派没有待审的票' }
    }
    if (!this.token) {
      return { ok: false, message: '未登录,无法提交审批' }
    }
    try {
      const res = await this.fetchImpl(`${this.opts.apiBaseUrl}/tasks/${taskId}/approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ decision, seq: task.approval.seq, deviceId: this.deviceId }),
      })
      if (!res.ok) {
        return { ok: false, message: `审批提交失败(${res.status})` }
      }
      const data = (await res.json()) as { verdict?: string; reason?: string }
      if (data.verdict && data.verdict !== 'applied') {
        return { ok: false, message: data.reason || `未生效(${data.verdict})` }
      }
      return { ok: true, message: decision ? '已放行' : '已拒绝' }
    } catch (err) {
      return {
        ok: false,
        message: `审批提交异常: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  /** 下载指定任务的附件(base64 → Blob → 触发下载)。 */
  downloadAttachment(taskId: string): AnswerApprovalResult {
    const task = this.tasks.find((x) => x.id === taskId)
    if (!task) return { ok: false, message: 'Task not found' }
    const fp = task.filePayload
    if (!fp) return { ok: false, message: 'No attachment on this task' }
    try {
      const binary = atob(fp.content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: fp.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fp.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return { ok: true, message: `Downloaded ${fp.filename}` }
    } catch (err) {
      return {
        ok: false,
        message: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
}
