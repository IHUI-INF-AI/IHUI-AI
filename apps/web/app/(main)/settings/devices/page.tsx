// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 设备管理页(G1 跨设备互联闭环 · 用户面 Web 入口,2026-10-30 立)
 *
 * 四块能力,全部走 @ihui/api-client 用户面方法(人 JWT):
 *   1. 设备列表:listDevices(名称/OS/能力/在线态/已撤销标记)+ 撤销(confirmDialog,§4 禁原生窗)
 *   2. 配对码:issuePairCode 生成 6 位码,大字展示 + 有效期倒计时(TTL 5 分钟;429=限速)
 *   3. 会话委派:会话列表复用 /api/chat/conversations(侧栏同源数据)+ 目标设备 → delegateSession
 *      (403=设备/会话不可用;503/DEVICE_DELEGATION_DISABLED=功能开关关闭)
 *   4. 任务列表:getDeviceTasks 按设备展示 queued/claimed/running/completed/failed/expired 徽标
 *
 * 契约注记:后端 GET /api/devices 过滤 revoked_at IS NULL,已撤销设备不会回列;
 * 撤销成功后以本地标记 + 重新拉列表双保险呈现(已撤销徽标为防御性渲染)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Monitor, RefreshCw, ShieldCheck } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import {
  cancelDeviceTask,
  decideDeviceTaskApproval,
  delegateSession,
  fetchApi,
  getDeviceTaskApproval,
  getDeviceTasks,
  issuePairCode,
  listDevices,
  retryDeviceTask,
  revokeDevice,
  subscribeUserBroadcast,
  type DeviceRow,
  type DeviceTaskRow,
  type UserBroadcastConfig,
} from '@ihui/api-client'

import { resolveWsApiBaseUrl } from '@/lib/api-base-url'
import { useAuthStore } from '@/stores/auth'

import { BackButton, AuthGatePrompt } from '@/components/common'
import { Alert, confirmDialog } from '@/components/feedback'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { cn } from '@/lib/utils'

/** 会话行(仅取委派选择器需要的字段;与侧栏 /api/chat/conversations 响应同形) */
interface ConversationRow {
  id: string
  title: string
}

/** 任务状态六档(与 RN 侧 DevicesScreen 的状态徽标同源同序;值面由 TASK_STATUS_CLASS 的
 *  Record 键穷举锁住,此数组只作类型源 ⇒ 直接写类型,不留"只用作类型"的值面) */
type TaskStatus = 'queued' | 'claimed' | 'running' | 'completed' | 'failed' | 'expired'

/** 任务状态 → 徽标配色(queued/expired 灰、claimed 蓝、running 琥珀、completed 绿、failed 红) */
const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  queued: 'bg-muted text-muted-foreground',
  claimed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  expired: 'bg-muted text-muted-foreground',
}

/** 任务状态 → i18n 字面量键(禁模板拼接 `t(\`devices.taskStatus_${status}\`)`) */
const TASK_STATUS_KEY: Record<TaskStatus, string> = {
  queued: 'devices.taskStatus_queued',
  claimed: 'devices.taskStatus_claimed',
  running: 'devices.taskStatus_running',
  completed: 'devices.taskStatus_completed',
  failed: 'devices.taskStatus_failed',
  expired: 'devices.taskStatus_expired',
}

/**
 * 任务执行进度单行文案(G2)。执行端写的 `lastEvent` 是自然语言(如"读取 src/app.ts"),
 * 比裸阶段枚举对人有意义,故优先;没写时退回 `阶段 · 百分比 · 轮次`。
 */
function describeTaskProgress(row: DeviceTaskRow): string {
  const p = row.progress
  if (!p) return '—'
  const last = p.lastEvent?.trim()
  if (last) return last
  const parts: string[] = [p.stage]
  if (typeof p.percent === 'number') parts.push(`${Math.round(p.percent)}%`)
  if (typeof p.iteration === 'number' && p.iteration > 0) parts.push(`#${p.iteration}`)
  return parts.join(' · ')
}

/** lastSeenAt → 相对时间文案(与 foldable-section 同阈值,词键收在本页 devices 命名空间) */
function formatLastSeen(
  iso: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const diff = Date.now() - ms
  if (diff < 10_000) return t('devices.lastSeenJustNow')
  if (diff < 60_000) return t('devices.lastSeenSecondsAgo', { n: Math.floor(diff / 1000) })
  if (diff < 3_600_000) return t('devices.lastSeenMinutesAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('devices.lastSeenHoursAgo', { n: Math.floor(diff / 3_600_000) })
  return t('devices.lastSeenDaysAgo', { n: Math.floor(diff / 86_400_000) })
}

/** 能力描述(自由 jsonb)→ 摘要文本:优先 roles 数组,否则键名列表 */
function formatCapabilities(caps: DeviceRow['capabilities']): string {
  if (!caps || typeof caps !== 'object') return ''
  const roles = (caps as Record<string, unknown>).roles
  if (Array.isArray(roles) && roles.length > 0) return roles.map(String).join(', ')
  const keys = Object.keys(caps)
  return keys.length > 0 ? keys.join(', ') : ''
}

/** 剩余秒数 → m:ss 倒计时文本 */
function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, secondsLeft)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function DevicesPage() {
  const t = useTranslations('settings')
  // 登录态门(与 /settings/activity 同型):未就绪不发注定 401 的请求
  const { ready, allow } = useAuthGate()

  // ---------- 设备列表 ----------
  const [devices, setDevices] = React.useState<DeviceRow[]>([])
  const [devicesLoading, setDevicesLoading] = React.useState(true)
  const [devicesError, setDevicesError] = React.useState('')

  const loadDevices = React.useCallback(async () => {
    setDevicesLoading(true)
    setDevicesError('')
    try {
      const res = await listDevices()
      if (res.success && res.data) {
        setDevices(res.data)
      } else {
        setDevicesError(res.error || t('devices.loadFailed'))
      }
    } catch {
      setDevicesError(t('devices.loadFailed'))
    } finally {
      setDevicesLoading(false)
    }
  }, [t])

  // ---------- 配对码 ----------
  const [pairCode, setPairCode] = React.useState<{ code: string; expiresAtMs: number } | null>(null)
  const [pairLoading, setPairLoading] = React.useState(false)
  const [pairError, setPairError] = React.useState<'rate' | 'failed' | ''>('')
  const [nowTick, setNowTick] = React.useState(Date.now())

  const handleIssuePairCode = React.useCallback(async () => {
    setPairLoading(true)
    setPairError('')
    try {
      const res = await issuePairCode()
      if (res.success && res.data) {
        const expiresAtMs = Date.parse(res.data.expires_at)
        setPairCode({
          code: res.data.code,
          expiresAtMs: Number.isNaN(expiresAtMs) ? 0 : expiresAtMs,
        })
      } else {
        setPairCode(null)
        setPairError(res.status === 429 ? 'rate' : 'failed')
      }
    } catch {
      setPairCode(null)
      setPairError('failed')
    } finally {
      setPairLoading(false)
    }
  }, [])

  // 倒计时秒针(有码才挂表;到期停表)
  React.useEffect(() => {
    if (!pairCode) return
    const timer = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pairCode])

  // ---------- 会话委派 ----------
  const [conversations, setConversations] = React.useState<ConversationRow[]>([])
  const [delegateSessionId, setDelegateSessionId] = React.useState('')
  const [delegateDeviceId, setDelegateDeviceId] = React.useState('')
  const [delegatePrompt, setDelegatePrompt] = React.useState('')
  const [delegateSubmitting, setDelegateSubmitting] = React.useState(false)
  const [delegateResult, setDelegateResult] = React.useState<{ ok: boolean; msg: string } | null>(
    null,
  )

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetchApi<{ conversations: ConversationRow[] }>(
        '/api/chat/conversations?page=1',
      )
      if (res.success && res.data) setConversations(res.data.conversations ?? [])
    } catch {
      // 会话列表取不到不阻断页面:委派区显示空选项即可
    }
  }, [])

  const handleDelegate = React.useCallback(async () => {
    if (!delegateSessionId || !delegateDeviceId) return
    setDelegateSubmitting(true)
    setDelegateResult(null)
    try {
      // G2:带上执行载荷。留空 = 服务端取该会话最后一条 user 消息 —— 不再是"派个空会话过去"。
      const res = await delegateSession(
        delegateSessionId,
        delegateDeviceId,
        delegatePrompt.trim() ? { prompt: delegatePrompt.trim(), mode: 'execute' } : undefined,
      )
      if (res.success) {
        // success 分支 data 必为 {task_id,status}(收窄后可在 else 分支读 errorCode/status)
        setDelegateResult({
          ok: true,
          msg: t('devices.delegateSuccess', { taskId: res.data.task_id }),
        })
      } else if (res.status === 503 || res.errorCode === 'DEVICE_DELEGATION_DISABLED') {
        setDelegateResult({ ok: false, msg: t('devices.delegateDisabled') })
      } else if (res.status === 403) {
        setDelegateResult({ ok: false, msg: t('devices.delegateForbidden') })
      } else {
        setDelegateResult({ ok: false, msg: res.error || t('devices.delegateFailed') })
      }
    } catch {
      setDelegateResult({ ok: false, msg: t('devices.delegateFailed') })
    } finally {
      setDelegateSubmitting(false)
    }
  }, [delegateSessionId, delegateDeviceId, delegatePrompt, t])

  // ---------- 任务列表 ----------
  const [tasksDeviceId, setTasksDeviceId] = React.useState('')
  const [tasks, setTasks] = React.useState<DeviceTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = React.useState(false)
  const [tasksError, setTasksError] = React.useState('')

  const loadTasks = React.useCallback(
    async (deviceId: string) => {
      if (!deviceId) {
        setTasks([])
        return
      }
      setTasksLoading(true)
      setTasksError('')
      try {
        const res = await getDeviceTasks(deviceId)
        if (res.success && res.data) {
          setTasks(res.data)
        } else {
          setTasks([])
          setTasksError(res.error || t('devices.tasksLoadFailed'))
        }
      } catch {
        setTasks([])
        setTasksError(t('devices.tasksLoadFailed'))
      } finally {
        setTasksLoading(false)
      }
    },
    [t],
  )

  React.useEffect(() => {
    if (!allow) return
    void loadDevices()
    void loadConversations()
  }, [allow, loadDevices, loadConversations])

  // ---------- 任务取消 / 重排(G2) ----------
  const [taskActionBusy, setTaskActionBusy] = React.useState<string | null>(null)

  const runTaskAction = React.useCallback(
    async (taskId: string, action: 'cancel' | 'retry') => {
      setTaskActionBusy(taskId)
      setTasksError('')
      try {
        const res =
          action === 'cancel' ? await cancelDeviceTask(taskId) : await retryDeviceTask(taskId)
        if (!res.success) setTasksError(res.error || t('devices.tasksLoadFailed'))
        await loadTasks(tasksDeviceId)
      } catch {
        setTasksError(t('devices.tasksLoadFailed'))
      } finally {
        setTaskActionBusy(null)
      }
    },
    [loadTasks, t, tasksDeviceId],
  )

  // ---------- plan 档审批(G3):看计划正文,批了执行端才继续 ----------
  const [approvalPanel, setApprovalPanel] = React.useState<{
    taskId: string
    plan: string | null
    preview: string | null
  } | null>(null)
  const [approvalBusy, setApprovalBusy] = React.useState(false)

  const openApproval = React.useCallback(
    async (task: DeviceTaskRow) => {
      setTasksError('')
      setApprovalBusy(true)
      try {
        const res = await getDeviceTaskApproval(task.id)
        setApprovalPanel({
          taskId: task.id,
          plan: res.success ? (res.data?.plan ?? null) : null,
          preview: task.approvalRequest?.preview ?? null,
        })
        if (!res.success) setTasksError(res.error || t('devices.tasksLoadFailed'))
      } catch {
        // 正文取不到也要能批:退回摘要,不让人卡在"看不到就不敢批"
        setApprovalPanel({
          taskId: task.id,
          plan: null,
          preview: task.approvalRequest?.preview ?? null,
        })
      } finally {
        setApprovalBusy(false)
      }
    },
    [t],
  )

  const runDecide = React.useCallback(
    async (taskId: string, decision: 'approved' | 'rejected') => {
      setApprovalBusy(true)
      setTasksError('')
      try {
        const res = await decideDeviceTaskApproval(taskId, decision)
        if (!res.success) setTasksError(res.error || t('devices.tasksLoadFailed'))
        setApprovalPanel(null)
        await loadTasks(tasksDeviceId)
      } catch {
        setTasksError(t('devices.tasksLoadFailed'))
      } finally {
        setApprovalBusy(false)
      }
    },
    [loadTasks, t, tasksDeviceId],
  )

  // ---------- 任务状态广播(G2):任一端派单/取消/重排/完成,本端就地改行 ----------
  React.useEffect(() => {
    if (!allow || typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: resolveWsApiBaseUrl(),
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'device:task': (evt) => {
        const d = evt.data
        setTasks((prev) =>
          prev.map((row) =>
            row.id === d.taskId
              ? {
                  ...row,
                  status: d.status,
                  progress: d.progress ?? row.progress,
                  error: d.error ?? row.error,
                  finishedAt:
                    d.status === 'completed' || d.status === 'failed' || d.status === 'expired'
                      ? (row.finishedAt ?? d.updatedAt)
                      : row.finishedAt,
                }
              : row,
          ),
        )
      },
    })
    return () => {
      sub.close()
    }
  }, [allow])

  const handleRevoke = React.useCallback(
    async (device: DeviceRow) => {
      // §4 禁原生提示窗:走项目自有 confirmDialog 服务
      const ok = await confirmDialog({
        title: t('devices.revokeConfirmTitle'),
        content: t('devices.revokeConfirmContent', { name: device.name }),
        confirmText: t('devices.revoke'),
        cancelText: t('devices.cancel'),
        variant: 'danger',
      })
      if (!ok) return
      try {
        const res = await revokeDevice(device.id)
        if (res.success) {
          // 本地即刻打撤销标 + 重拉列表(后端列表已过滤 revoked,双保险)
          setDevices((prev) =>
            prev.map((d) =>
              d.id === device.id ? { ...d, revokedAt: new Date().toISOString() } : d,
            ),
          )
          void loadDevices()
        } else {
          setDevicesError(res.error || t('devices.revokeFailed'))
        }
      } catch {
        setDevicesError(t('devices.revokeFailed'))
      }
    },
    [t, loadDevices],
  )

  const pairSecondsLeft = pairCode ? Math.floor((pairCode.expiresAtMs - nowTick) / 1000) : 0
  const pairExpired = pairCode !== null && pairSecondsLeft <= 0

  if (!ready) {
    return (
      <div className="px-4 space-y-4 py-4">
        <BackButton />
        <p className="py-8 text-center text-body text-muted-foreground">{t('devices.loading')}</p>
      </div>
    )
  }
  if (!allow) {
    return (
      <div className="px-4 space-y-4 py-4">
        <BackButton />
        <AuthGatePrompt message={t('devices.loginRequired')} />
      </div>
    )
  }

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />

      {/* ===== 设备列表 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            {t('devices.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-label text-muted-foreground">{t('devices.desc')}</p>
          {devicesError && (
            <Alert variant="danger" title={devicesError} closable className="mb-3" />
          )}
          {devicesLoading ? (
            <p className="py-8 text-center text-body text-muted-foreground">
              {t('devices.loading')}
            </p>
          ) : devices.length === 0 ? (
            <p className="py-8 text-center text-body text-muted-foreground">{t('devices.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('devices.colName')}</TableHead>
                    <TableHead>{t('devices.colOs')}</TableHead>
                    <TableHead>{t('devices.colCapabilities')}</TableHead>
                    <TableHead>{t('devices.colOnline')}</TableHead>
                    <TableHead>{t('devices.colLastSeen')}</TableHead>
                    <TableHead>{t('devices.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} data-testid={`device-row-${device.id}`}>
                      <TableCell className="text-label font-medium">
                        <span className="inline-flex items-center gap-2">
                          {device.name}
                          {device.revokedAt && (
                            <Badge variant="outline" className="text-red-600">
                              {t('devices.revokedBadge')}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-label">{device.os || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-label">
                        {formatCapabilities(device.capabilities) || t('devices.capabilitiesEmpty')}
                      </TableCell>
                      <TableCell>
                        {device.online ? (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          >
                            {t('devices.online')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-muted text-muted-foreground"
                          >
                            {t('devices.offline')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-label text-muted-foreground">
                        {formatLastSeen(device.lastSeenAt, t)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!device.revokedAt}
                          data-testid={`revoke-device-${device.id}`}
                          onClick={() => void handleRevoke(device)}
                        >
                          {t('devices.revoke')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== 配对码 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {t('devices.pairTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-label text-muted-foreground">{t('devices.pairHint')}</p>
          {pairError === 'rate' && (
            <Alert
              variant="warning"
              title={t('devices.pairRateLimited')}
              closable
              className="mb-3"
            />
          )}
          {pairError === 'failed' && (
            <Alert variant="danger" title={t('devices.pairFailed')} closable className="mb-3" />
          )}
          {pairCode ? (
            <div className="space-y-3">
              <div
                data-testid="pair-code-display"
                className={cn(
                  'rounded-lg border p-4 text-center font-mono text-4xl font-bold tracking-[0.5em]',
                  pairExpired ? 'text-muted-foreground' : 'text-primary',
                )}
              >
                {pairCode.code}
              </div>
              <div className="flex items-center justify-between">
                <span
                  data-testid="pair-code-countdown"
                  className={cn(
                    'text-label',
                    pairExpired ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {pairExpired
                    ? t('devices.pairExpired')
                    : t('devices.pairExpiresIn', { time: formatCountdown(pairSecondsLeft) })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="pair-code-regenerate"
                  onClick={() => void handleIssuePairCode()}
                  disabled={pairLoading}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {t('devices.pairRegenerate')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              data-testid="pair-code-generate"
              onClick={() => void handleIssuePairCode()}
              disabled={pairLoading}
            >
              {pairLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t('devices.pairGenerate')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ===== 会话委派 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            {t('devices.delegateTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-label text-muted-foreground">{t('devices.delegateHint')}</p>
          {delegateResult && (
            <Alert
              variant={delegateResult.ok ? 'success' : 'danger'}
              title={delegateResult.msg}
              closable
            />
          )}
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            <label className="block text-label">
              <span className="mb-1 block text-muted-foreground">
                {t('devices.delegateSessionLabel')}
              </span>
              <select
                data-testid="delegate-session-select"
                className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-body"
                value={delegateSessionId}
                onChange={(e) => setDelegateSessionId(e.target.value)}
              >
                <option value="">{t('devices.delegateSessionPlaceholder')}</option>
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-label">
              <span className="mb-1 block text-muted-foreground">
                {t('devices.delegateDeviceLabel')}
              </span>
              <select
                data-testid="delegate-device-select"
                className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-body"
                value={delegateDeviceId}
                onChange={(e) => setDelegateDeviceId(e.target.value)}
              >
                <option value="">{t('devices.delegateDevicePlaceholder')}</option>
                {devices
                  .filter((d) => !d.revokedAt)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="block text-label">
            <span className="mb-1 block text-muted-foreground">
              {t('devices.delegatePromptLabel')}
            </span>
            <input
              data-testid="delegate-prompt"
              type="text"
              className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-body"
              value={delegatePrompt}
              placeholder={t('devices.delegatePromptPlaceholder')}
              onChange={(e) => setDelegatePrompt(e.target.value)}
            />
          </label>
          <Button
            data-testid="delegate-submit"
            disabled={!delegateSessionId || !delegateDeviceId || delegateSubmitting}
            onClick={() => void handleDelegate()}
          >
            {delegateSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {t('devices.delegateSubmit')}
          </Button>
        </CardContent>
      </Card>

      {/* ===== 任务列表 ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            {t('devices.tasksTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <label className="block flex-1 text-label">
              <span className="mb-1 block text-muted-foreground">
                {t('devices.delegateDeviceLabel')}
              </span>
              <select
                data-testid="tasks-device-select"
                className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-body"
                value={tasksDeviceId}
                onChange={(e) => {
                  setTasksDeviceId(e.target.value)
                  void loadTasks(e.target.value)
                }}
              >
                <option value="">{t('devices.tasksDevicePlaceholder')}</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              data-testid="tasks-refresh"
              disabled={!tasksDeviceId || tasksLoading}
              onClick={() => void loadTasks(tasksDeviceId)}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t('devices.tasksRefresh')}
            </Button>
          </div>
          {tasksError && <Alert variant="danger" title={tasksError} closable />}
          {tasksLoading ? (
            <p className="py-6 text-center text-body text-muted-foreground">
              {t('devices.loading')}
            </p>
          ) : tasksDeviceId && tasks.length === 0 && !tasksError ? (
            <p className="py-6 text-center text-body text-muted-foreground">
              {t('devices.tasksEmpty')}
            </p>
          ) : tasks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('devices.colName')}</TableHead>
                    <TableHead>{t('devices.taskColStatus')}</TableHead>
                    <TableHead>{t('devices.taskColProgress')}</TableHead>
                    <TableHead>{t('devices.taskColCreated')}</TableHead>
                    <TableHead>{t('devices.taskColFinished')}</TableHead>
                    <TableHead>{t('devices.taskColError')}</TableHead>
                    <TableHead>{t('devices.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} data-testid={`task-row-${task.id}`}>
                      <TableCell className="font-mono text-label">{task.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('border-transparent', TASK_STATUS_CLASS[task.status])}
                        >
                          {t(TASK_STATUS_KEY[task.status])}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-label text-muted-foreground">
                        {describeTaskProgress(task)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-label text-muted-foreground">
                        {formatLastSeen(task.createdAt, t)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-label text-muted-foreground">
                        {task.finishedAt ? formatLastSeen(task.finishedAt, t) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-label text-destructive">
                        {task.error || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {task.progress?.stage === 'awaiting_approval' ? (
                            <Button
                              size="sm"
                              data-testid={`task-approve-${task.id}`}
                              disabled={taskActionBusy === task.id || approvalBusy}
                              onClick={() => void openApproval(task)}
                            >
                              {t('devices.approvalView')}
                            </Button>
                          ) : null}
                          {task.status === 'queued' ||
                          task.status === 'claimed' ||
                          task.status === 'running' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`task-cancel-${task.id}`}
                              disabled={taskActionBusy === task.id}
                              onClick={() => void runTaskAction(task.id, 'cancel')}
                            >
                              {t('devices.taskCancel')}
                            </Button>
                          ) : task.status === 'failed' || task.status === 'expired' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`task-retry-${task.id}`}
                              disabled={taskActionBusy === task.id}
                              onClick={() => void runTaskAction(task.id, 'retry')}
                            >
                              {t('devices.taskRetry')}
                            </Button>
                          ) : task.progress?.stage === 'awaiting_approval' ? null : (
                            <span className="text-label text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {approvalPanel ? (
            <div
              className="mt-3 space-y-2 rounded-lg border border-stroke-subtle p-3"
              data-testid="approval-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-label font-medium text-foreground">
                  {t('devices.approvalTitle')}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setApprovalPanel(null)}>
                  {t('devices.approvalClose')}
                </Button>
              </div>
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-label text-muted-foreground">
                {approvalPanel.plan ?? approvalPanel.preview ?? '—'}
              </pre>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  data-testid="approval-approve"
                  disabled={approvalBusy}
                  onClick={() => void runDecide(approvalPanel.taskId, 'approved')}
                >
                  {t('devices.approvalApprove')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="approval-reject"
                  disabled={approvalBusy}
                  onClick={() => void runDecide(approvalPanel.taskId, 'rejected')}
                >
                  {t('devices.approvalReject')}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
