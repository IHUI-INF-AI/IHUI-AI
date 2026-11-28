// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 设备管理共享屏 —— 手机派单的唯一实现(2026-11-26 从 RN 独占屏下沉到 packages/app)。
 *
 * 为什么下沉:同一件事原来只有 RN 有屏、小程序没有入口,Web 又是另一套(next-intl + 表格)。
 * 现在 RN / 小程序共用这一份,视觉与交互只写一次;Web 保持表格形态(桌面信息密度优先)。
 *
 * 契约单源 @ihui/api-client 用户令牌面:
 *   listDevices() / revokeDevice(id) / issuePairCode() / delegateSession(sessionId, deviceId, payload) /
 *   getDeviceTasks(id) / cancelDeviceTask(id) / retryDeviceTask(id) /
 *   getDeviceTaskApproval(id) / decideDeviceTaskApproval(id, decision)
 *
 * 平台特定一律走 props 注入(导航/提示/确认框),缺腿由 `assertRequiredPort` 当场喊出来:
 * 这是 AGENTS.md §0.3「拿不准就不给动作」的落地 —— 撤销设备这种不可逆动作绝不能因为
 * 宿主没接线就静默执行。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  Check,
  ClipboardList,
  KeyRound,
  MonitorSmartphone,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react-native'
import {
  cancelDeviceTask,
  decideDeviceTaskApproval,
  delegateSession,
  getDeviceTaskApproval,
  getDeviceTasks,
  issuePairCode,
  listConversations,
  listDevices,
  retryDeviceTask,
  revokeDevice,
  type ConversationDetail,
  type DeviceRow,
  type DeviceTaskRow,
} from '@ihui/api-client'

import { BackChevron } from '../../components/BackChevron'
import { assertRequiredPort } from '../../host/ports'
import type { DeviceTaskExecutionPayload, DeviceTaskFileDiff, OnToast } from '@ihui/types'
import { getTokens, type AppThemeMode } from '../../theme/tokens'
import { createStyles } from './devices-styles'

/** 屏体端口:文案、时区语言、主题档、返回、轻提示、不可逆动作确认。 */
export interface DevicesScreenProps {
  /** 半句文案取用:key 形如 `devices.title`,缺键由宿主 i18n 兜底 */
  t: (key: string, values?: Record<string, string | number>) => string
  /** `Intl.DateTimeFormat` 用的语言标签(zh-CN / en-US …),不传回退 zh-CN */
  locale?: string
  colorScheme?: AppThemeMode
  onBack?: () => void
  /**
   * 自绘页头距屏幕顶的留白(px)。小程序自定义导航栏下必须传状态栏高度,
   * 否则返回键与标题会被胶囊/状态栏压住;RN 端由原生导航壳提供,不传即 0。
   */
  headerInsetTop?: number
  /** 轻提示(成功/失败一句话);必填 —— 缺了会在 dev 直接 throw,prod 显错误态 */
  onToast: OnToast
  /** 不可逆动作确认(撤销设备)。返回 true 才真的执行;必填,理由同 onToast */
  onConfirm: (title: string, message: string, confirmText: string) => Promise<boolean>
}

/** 任务状态 → i18n 键(与 RN 旧屏 / Web devices 页同序) */
const TASK_STATUS_KEY: Record<DeviceTaskRow['status'], string> = {
  queued: 'devices.statusQueued',
  claimed: 'devices.statusClaimed',
  running: 'devices.statusRunning',
  completed: 'devices.statusCompleted',
  failed: 'devices.statusFailed',
  expired: 'devices.statusExpired',
}

/** ISO → 本地可读时间;无效值回 '—' */
function fmt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** 剩余秒 → mm:ss(配对码倒计时展示) */
function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function DevicesScreen({
  t,
  locale = 'zh-CN',
  colorScheme = 'light',
  onBack,
  headerInsetTop = 0,
  onToast,
  onConfirm,
}: DevicesScreenProps) {
  assertRequiredPort('onToast', onToast)
  assertRequiredPort('onConfirm', onConfirm)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // —— 设备列表 ——
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  // —— 配对码(TTL 5 分钟,前端只做剩余倒计时展示,过期即清回可重新生成) ——
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(null)
  const [pairRemaining, setPairRemaining] = useState(0)
  const [pairing, setPairing] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)

  // —— 委派会话(选中设备 → 拉会话列表 → 带指令派单) ——
  const [delegateFor, setDelegateFor] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationDetail[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [delegating, setDelegating] = useState<string | null>(null)
  const [delegatePrompt, setDelegatePrompt] = useState('')
  const [promptFocused, setPromptFocused] = useState(false)
  // G4:改动先审(执行端跑完把文件级 diff 推上来,逐文件收下/回退)
  const [reviewDiff, setReviewDiff] = useState(false)
  const [review, setReview] = useState<{
    taskId: string
    files: DeviceTaskFileDiff[]
    truncated: boolean
    selected: Record<string, boolean>
    expanded: string | null
  } | null>(null)
  // 同一屏三条异步链路共用一个请求序号,后到的旧响应一律丢弃(与 RN 旧屏同法)
  const reqSeqRef = useRef(0)

  // —— 任务状态(按设备展开) ——
  const [tasksFor, setTasksFor] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DeviceTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [taskBusy, setTaskBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const seq = (reqSeqRef.current += 1)
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listDevices()
      if (seq !== reqSeqRef.current) return
      if (!res.success) setLoadError(res.error || t('devices.loadFailed'))
      else setDevices(res.data ?? [])
    } catch {
      if (seq !== reqSeqRef.current) return
      setLoadError(t('devices.loadFailed'))
    } finally {
      if (seq === reqSeqRef.current) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // 配对码倒计时:每秒重算剩余;归零后保留码值但标记过期,由用户重新签发
  useEffect(() => {
    if (!pair) return
    const tick = () =>
      setPairRemaining(Math.max(0, Math.round((pair.expiresAt - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pair])

  const onPair = async () => {
    setPairing(true)
    setPairError(null)
    try {
      const res = await issuePairCode()
      if (!res.success || !res.data) {
        setPairError(res.error || t('devices.pairFailed'))
        return
      }
      const expiresAt = new Date(res.data.expires_at).getTime()
      setPair({ code: res.data.code, expiresAt })
    } catch {
      setPairError(t('devices.pairFailed'))
    } finally {
      setPairing(false)
    }
  }

  const onRevoke = async (device: DeviceRow) => {
    const ok = await onConfirm(
      t('settings.devices.revokeConfirmTitle'),
      t('devices.revokeConfirm', { name: device.name }),
      t('devices.revoke'),
    )
    if (!ok) return
    setRevoking(device.id)
    try {
      const res = await revokeDevice(device.id)
      if (!res.success) onToast(res.error || t('devices.revokeFailed'))
      else void load()
    } catch {
      onToast(t('devices.revokeFailed'))
    } finally {
      setRevoking(null)
    }
  }

  const toggleDelegate = async (deviceId: string) => {
    if (delegateFor === deviceId) {
      setDelegateFor(null)
      return
    }
    const seq = (reqSeqRef.current += 1)
    setDelegateFor(deviceId)
    setConversations([])
    setConvLoading(true)
    try {
      const res = await listConversations({ page: 1, pageSize: 50 })
      if (seq !== reqSeqRef.current) return
      setConversations(res.success ? (res.data?.conversations ?? []) : [])
    } catch {
      if (seq !== reqSeqRef.current) return
      setConversations([])
    } finally {
      if (seq === reqSeqRef.current) setConvLoading(false)
    }
  }

  const onDelegate = async (conversationId: string, deviceId: string, deviceName: string) => {
    setDelegating(conversationId)
    try {
      // 载荷显式带 mode;reviewDiff 只对 execute 生效(plan 的审批位留给批方案)
      const payload: Partial<DeviceTaskExecutionPayload> = {
        mode: 'execute',
        ...(delegatePrompt.trim() ? { prompt: delegatePrompt.trim() } : {}),
        ...(reviewDiff ? { reviewDiff: true } : {}),
      }
      const res = await delegateSession(conversationId, deviceId, payload)
      if (!res.success) {
        onToast(res.error || t('devices.delegateFailed'))
        return
      }
      setDelegateFor(null)
      setDelegatePrompt('')
      onToast(t('devices.delegateDone', { name: deviceName }))
    } catch {
      onToast(t('devices.delegateFailed'))
    } finally {
      setDelegating(null)
    }
  }

  /** 取消只对 queued/claimed/running 生效,重排只对 failed/expired 生效(服务端把关) */
  const onTaskAction = async (taskId: string, action: 'cancel' | 'retry') => {
    const deviceId = tasksFor
    if (!deviceId) return
    setTaskBusy(taskId)
    try {
      const res =
        action === 'cancel' ? await cancelDeviceTask(taskId) : await retryDeviceTask(taskId)
      if (!res.success) {
        onToast(res.error || t('devices.tasksFailed'))
        return
      }
      const refreshed = await getDeviceTasks(deviceId)
      if (refreshed.success) setTasks(refreshed.data ?? [])
    } catch {
      onToast(t('devices.tasksFailed'))
    } finally {
      setTaskBusy(null)
    }
  }

  /**
   * 审批(G3 plan / G4 diff)。
   * 不传 decision = 先看:plan 弹正文;diff 展开文件表(默认全勾)。
   * 传 decision = 真的收下/退回;diff 的「收下选中」把勾选清单一起交服务端,
   * 未勾选且可回退的文件由执行端回退。
   */
  const onApproval = async (
    task: DeviceTaskRow,
    decision?: 'approved' | 'rejected',
    acceptedPaths?: string[],
  ) => {
    const deviceId = tasksFor
    if (!deviceId) return
    setTaskBusy(task.id)
    try {
      if (!decision) {
        const res = await getDeviceTaskApproval(task.id)
        if (!res.success) {
          onToast(res.error || t('devices.tasksFailed'))
          return
        }
        const request = res.data?.request
        if (request?.kind === 'diff' && request.diff) {
          const files = request.diff.files
          setReview({
            taskId: task.id,
            files,
            truncated: request.diff.truncated,
            selected: Object.fromEntries(files.map((f) => [f.path, true])) as Record<
              string,
              boolean
            >,
            expanded: null,
          })
          return
        }
        const plan = res.data?.plan ?? task.approvalRequest?.preview ?? t('devices.approvalEmpty')
        onToast(`${t('devices.approvalTitle')}\n${plan}`)
        return
      }
      const res = await decideDeviceTaskApproval(task.id, decision, acceptedPaths)
      if (!res.success) {
        onToast(res.error || t('devices.tasksFailed'))
        return
      }
      setReview(null)
      const refreshed = await getDeviceTasks(deviceId)
      if (refreshed.success) setTasks(refreshed.data ?? [])
    } catch {
      onToast(t('devices.tasksFailed'))
    } finally {
      setTaskBusy(null)
    }
  }

  const toggleTasks = async (deviceId: string) => {
    if (tasksFor === deviceId) {
      setTasksFor(null)
      return
    }
    const seq = (reqSeqRef.current += 1)
    setTasksFor(deviceId)
    setTasks([])
    setTasksError(null)
    setTasksLoading(true)
    try {
      const res = await getDeviceTasks(deviceId)
      if (seq !== reqSeqRef.current) return
      if (!res.success) setTasksError(res.error || t('devices.tasksFailed'))
      else setTasks(res.data ?? [])
    } catch {
      if (seq !== reqSeqRef.current) return
      setTasksError(t('devices.tasksFailed'))
    } finally {
      if (seq === reqSeqRef.current) setTasksLoading(false)
    }
  }

  const pairExpired = pair !== null && pairRemaining <= 0
  /** 列表里一台在线的都没有 —— 这才是"派出去没人接"的真原因,得先说清楚 */
  const noOnlineDevice = devices.length > 0 && devices.every((d) => d.online !== true)

  return (
    <View style={styles.container}>
      <View style={[styles.header, headerInsetTop > 0 ? { paddingTop: headerInsetTop + 8 } : null]}>
        {onBack ? (
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        ) : null}
        <Text style={styles.headerTitle}>{t('devices.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {/* 无在线设备:说清"为什么派不出去",并给出可执行的那一步 */}
        {noOnlineDevice ? <Text style={styles.hint}>{t('devices.noOnlineHint')}</Text> : null}

        {/* 配对码卡片:大字展示 6 位码 + 剩余有效期(过期后提示重新生成) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <KeyRound size={16} color={tk.text.secondary} />
            <Text style={styles.cardTitle}>{t('devices.pairTitle')}</Text>
          </View>
          <Text style={styles.muted}>{t('devices.pairHint')}</Text>
          {pair ? (
            <View style={styles.pairBox}>
              <Text style={[styles.pairCode, pairExpired && styles.pairCodeExpired]}>
                {pair.code}
              </Text>
              <Text style={styles.meta}>
                {pairExpired
                  ? t('devices.pairExpired')
                  : t('devices.pairExpiresIn', { time: mmss(pairRemaining) })}
              </Text>
            </View>
          ) : null}
          {pairError ? <Text style={styles.error}>{pairError}</Text> : null}
          <TouchableOpacity
            style={[styles.button, pairing && styles.disabled]}
            onPress={() => void onPair()}
            disabled={pairing}
            activeOpacity={0.7}
          >
            {pairing ? (
              <ActivityIndicator color={tk.brand.ctaForeground} />
            ) : (
              <Text style={styles.buttonText}>
                {pair ? t('devices.pairRegenerate') : t('devices.pairGenerate')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 设备列表:名称 / OS / 最后在线 / 在线徽章 / 撤销 / 派单 / 任务 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MonitorSmartphone size={16} color={tk.text.secondary} />
            <Text style={styles.cardTitle}>{t('devices.listTitle')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator style={styles.loading} color={tk.text.secondary} />
          ) : loadError ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{loadError}</Text>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => void load()}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineText}>{t('devices.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : devices.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>{t('devices.emptyTitle')}</Text>
              <Text style={styles.muted}>{t('devices.emptyHint')}</Text>
            </View>
          ) : (
            devices.map((device) => {
              const online = device.online === true
              return (
                <View key={device.id} style={styles.deviceRow}>
                  <View style={styles.rowHead}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <View style={[styles.badge, online ? styles.badgeOn : styles.badgeOff]}>
                      <Text
                        style={[
                          styles.badgeText,
                          { color: online ? tk.success.deep : tk.text.secondary },
                        ]}
                      >
                        {online ? t('devices.online') : t('devices.offline')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {device.os || '—'} · {t('devices.lastSeen')}: {fmt(device.lastSeenAt, locale)}
                  </Text>
                  {/* 这台不在线:说了"派过去会排队、它上线就跑",而不是让人等一个没动静的任务 */}
                  {!online ? <Text style={styles.hint}>{t('devices.offlineHint')}</Text> : null}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => void toggleDelegate(device.id)}
                      disabled={delegating !== null}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <Send size={13} color={tk.text.primary} />
                        <Text style={styles.link}>{t('devices.delegate')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void toggleTasks(device.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <ClipboardList size={13} color={tk.text.primary} />
                        <Text style={styles.link}>{t('devices.tasks')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void onRevoke(device)}
                      disabled={revoking === device.id}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <Trash2 size={13} color={tk.danger.DEFAULT} />
                        <Text style={styles.dangerLink}>{t('devices.revoke')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* 派单面板:一条指令 + 复用既有会话列表,点条目即 delegateSession */}
                  {delegateFor === device.id ? (
                    <View style={styles.panel}>
                      <Text style={styles.panelTitle}>
                        {t('devices.delegatePickHint', { name: device.name })}
                      </Text>
                      {!online ? (
                        <Text style={styles.hint}>{t('devices.delegateOfflineHint')}</Text>
                      ) : null}
                      <TextInput
                        style={[styles.input, promptFocused ? styles.inputFocused : null]}
                        value={delegatePrompt}
                        onChangeText={setDelegatePrompt}
                        onFocus={() => setPromptFocused(true)}
                        onBlur={() => setPromptFocused(false)}
                        placeholder={t('devices.delegatePromptPlaceholder')}
                        placeholderTextColor={tk.text.secondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {/* G4:改动先审 —— 执行端跑完把文件级 diff 推上来,人逐文件收下/回退 */}
                      <TouchableOpacity
                        style={styles.checkRow}
                        activeOpacity={0.7}
                        onPress={() => setReviewDiff((v) => !v)}
                      >
                        <View style={[styles.checkBox, reviewDiff ? styles.checkBoxOn : null]}>
                          {reviewDiff ? <Check size={12} color={tk.brand.ctaForeground} /> : null}
                        </View>
                        <View style={styles.checkTextWrap}>
                          <Text style={styles.checkLabel}>{t('devices.reviewDiffToggle')}</Text>
                          <Text style={styles.meta}>{t('devices.reviewDiffHint')}</Text>
                        </View>
                      </TouchableOpacity>
                      {convLoading ? (
                        <Text style={styles.muted}>{t('devices.delegateLoading')}</Text>
                      ) : conversations.length === 0 ? (
                        <Text style={styles.muted}>{t('devices.delegateEmpty')}</Text>
                      ) : (
                        conversations.map((conv) => (
                          <TouchableOpacity
                            key={conv.id}
                            style={styles.convRow}
                            disabled={delegating !== null}
                            onPress={() => void onDelegate(conv.id, device.id, device.name)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.convTitle} numberOfLines={1}>
                              {conv.title || t('devices.untitledConversation')}
                            </Text>
                            <Text style={styles.meta}>
                              {delegating === conv.id
                                ? t('devices.delegateBusy')
                                : fmt(conv.lastMessageAt ?? conv.updatedAt, locale)}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  ) : null}

                  {/* 任务面板:该设备的待办/历史(queued/claimed/running/completed/failed/expired) */}
                  {tasksFor === device.id ? (
                    <View style={styles.panel}>
                      <Text style={styles.panelTitle}>{t('devices.tasksTitle')}</Text>
                      {tasksLoading ? (
                        <Text style={styles.muted}>{t('devices.tasksLoading')}</Text>
                      ) : tasksError ? (
                        <Text style={styles.error}>{tasksError}</Text>
                      ) : tasks.length === 0 ? (
                        <Text style={styles.muted}>{t('devices.tasksEmpty')}</Text>
                      ) : (
                        tasks.map((task) => (
                          <View key={task.id} style={styles.taskRow}>
                            <View style={styles.rowHead}>
                              <Text style={styles.taskSession} numberOfLines={1}>
                                {task.sessionId}
                              </Text>
                              <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                  {t(TASK_STATUS_KEY[task.status])}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.meta}>
                              {t('settings.devices.taskColCreated')}: {fmt(task.createdAt, locale)}
                              {task.finishedAt
                                ? ` · ${t('settings.devices.taskColFinished')}: ${fmt(task.finishedAt, locale)}`
                                : ''}
                            </Text>
                            {task.progress ? (
                              <Text style={styles.meta} numberOfLines={1}>
                                {task.progress.lastEvent?.trim() ||
                                  `${task.progress.stage} · ${Math.round(task.progress.percent)}%`}
                              </Text>
                            ) : null}
                            {task.error ? <Text style={styles.error}>{task.error}</Text> : null}
                            {taskBusy === task.id ? null : task.progress?.stage ===
                              'awaiting_approval' ? (
                              task.approvalRequest?.kind === 'diff' ? (
                                review && review.taskId === task.id ? (
                                  <View style={styles.reviewPanel}>
                                    <Text style={styles.panelTitle}>{t('devices.diffTitle')}</Text>
                                    <Text style={styles.muted}>{t('devices.diffHint')}</Text>
                                    {review.truncated ? (
                                      <Text style={styles.muted}>{t('devices.diffTruncated')}</Text>
                                    ) : null}
                                    {review.files.map((file) => {
                                      const checked = review.selected[file.path] === true
                                      const open = review.expanded === file.path
                                      return (
                                        <View key={file.path} style={styles.diffFile}>
                                          <TouchableOpacity
                                            style={styles.diffFileHead}
                                            activeOpacity={0.7}
                                            onPress={() =>
                                              setReview((prev) =>
                                                prev && prev.taskId === task.id
                                                  ? {
                                                      ...prev,
                                                      selected: {
                                                        ...prev.selected,
                                                        [file.path]: !checked,
                                                      },
                                                    }
                                                  : prev,
                                              )
                                            }
                                          >
                                            <View
                                              style={[
                                                styles.checkBox,
                                                checked ? styles.checkBoxOn : null,
                                              ]}
                                            >
                                              {checked ? (
                                                <Check size={12} color={tk.brand.ctaForeground} />
                                              ) : null}
                                            </View>
                                            <View style={styles.diffFileMeta}>
                                              <Text style={styles.diffPath} numberOfLines={1}>
                                                {file.path}
                                              </Text>
                                              <Text style={styles.meta}>
                                                {t(`devices.diffStatus_${file.status}`)} · +
                                                {file.additions} −{file.deletions}
                                                {file.revertable
                                                  ? ''
                                                  : ` · ${t('devices.diffNotRevertable')}`}
                                              </Text>
                                            </View>
                                          </TouchableOpacity>
                                          {file.patch ? (
                                            <TouchableOpacity
                                              activeOpacity={0.7}
                                              onPress={() =>
                                                setReview((prev) =>
                                                  prev && prev.taskId === task.id
                                                    ? {
                                                        ...prev,
                                                        expanded: open ? null : file.path,
                                                      }
                                                    : prev,
                                                )
                                              }
                                            >
                                              <Text style={styles.link}>
                                                {open
                                                  ? t('devices.diffHidePatch')
                                                  : t('devices.diffShowPatch')}
                                              </Text>
                                            </TouchableOpacity>
                                          ) : null}
                                          {open && file.patch ? (
                                            <ScrollView horizontal style={styles.patchScroll}>
                                              <Text style={styles.patchText} selectable>
                                                {file.patch}
                                              </Text>
                                            </ScrollView>
                                          ) : null}
                                        </View>
                                      )
                                    })}
                                    <View style={styles.actions}>
                                      <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                          const paths = review.files
                                            .filter((f) => review.selected[f.path])
                                            .map((f) => f.path)
                                          void onApproval(task, 'approved', paths)
                                        }}
                                      >
                                        <View style={styles.actionRow}>
                                          <Check size={13} color={tk.text.primary} />
                                          <Text style={styles.link}>
                                            {t('devices.diffAcceptSelected', {
                                              count: review.files.filter(
                                                (f) => review.selected[f.path],
                                              ).length,
                                            })}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => void onApproval(task, 'rejected')}
                                      >
                                        <View style={styles.actionRow}>
                                          <XCircle size={13} color={tk.danger.deepText} />
                                          <Text style={styles.dangerLink}>
                                            {t('devices.diffRejectAll')}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => void onApproval(task)}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.actionRow}>
                                      <ClipboardList size={13} color={tk.text.primary} />
                                      <Text style={styles.link}>{t('devices.diffReviewOpen')}</Text>
                                    </View>
                                  </TouchableOpacity>
                                )
                              ) : (
                                <View style={styles.actionRow}>
                                  <TouchableOpacity
                                    onPress={() => void onApproval(task)}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.actionRow}>
                                      <ClipboardList size={13} color={tk.text.primary} />
                                      <Text style={styles.link}>{t('devices.approvalView')}</Text>
                                    </View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => void onApproval(task, 'approved')}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.actionRow}>
                                      <Check size={13} color={tk.text.primary} />
                                      <Text style={styles.link}>
                                        {t('devices.approvalApprove')}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => void onApproval(task, 'rejected')}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.actionRow}>
                                      <XCircle size={13} color={tk.text.primary} />
                                      <Text style={styles.link}>{t('devices.approvalReject')}</Text>
                                    </View>
                                  </TouchableOpacity>
                                </View>
                              )
                            ) : task.status === 'queued' ||
                              task.status === 'claimed' ||
                              task.status === 'running' ? (
                              <TouchableOpacity
                                onPress={() => void onTaskAction(task.id, 'cancel')}
                                activeOpacity={0.7}
                              >
                                <View style={styles.actionRow}>
                                  <XCircle size={13} color={tk.text.primary} />
                                  <Text style={styles.link}>{t('devices.taskCancel')}</Text>
                                </View>
                              </TouchableOpacity>
                            ) : task.status === 'failed' || task.status === 'expired' ? (
                              <TouchableOpacity
                                onPress={() => void onTaskAction(task.id, 'retry')}
                                activeOpacity={0.7}
                              >
                                <View style={styles.actionRow}>
                                  <RotateCcw size={13} color={tk.text.primary} />
                                  <Text style={styles.link}>{t('devices.retry')}</Text>
                                </View>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default DevicesScreen

/** 供宿主壳复用的样式构造(小程序壳里若需覆盖个别档位) */
export { createStyles as createDevicesStyles }
export type { DevicesStyles } from './devices-styles'
