// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G1 跨设备互联用户面「设备管理」屏(2026-10-30 立)。
//
// 契约单源 @ihui/api-client 用户令牌面(packages/api-client/src/endpoints/devices.ts):
//  - listDevices()      → ApiResult<DeviceRow[]>      GET  /api/devices
//  - revokeDevice(id)   → DELETE /api/devices/:id     置 revoked_at
//  - issuePairCode()    → POST /api/devices/pair-code 6 位码,TTL 5 分钟、单次使用
//  - delegateSession(sessionId, deviceId) → POST /api/chat/sessions/:id/delegate(离线允许入队)
//  - getDeviceTasks(id) → GET /api/devices/:id/tasks  该设备的待办/历史任务
// 会话数据源复用移动端既有 listConversations(与 ChatScreen/HomeScreen 同一接口)。
// 屏体形态对齐 ApiKeysScreen:自包含 RN 组件 + tokens 样式表,不依赖共享层插槽。
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ClipboardList, KeyRound, MonitorSmartphone, Send, Trash2 } from 'lucide-react-native'
import {
  delegateSession,
  getDeviceTasks,
  issuePairCode,
  listConversations,
  listDevices,
  revokeDevice,
  type ConversationDetail,
  type DeviceRow,
  type DeviceTaskRow,
} from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** ISO → 本地可读时间;无效值回 '—'(与 ApiKeysScreen 的 fmt 同口径) */
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

/** 任务状态 → i18n 键(键组织对齐 devices.status.*,与 notificationList.type.* 同型) */
const TASK_STATUS_KEY: Record<DeviceTaskRow['status'], string> = {
  queued: 'devices.statusQueued',
  claimed: 'devices.statusClaimed',
  running: 'devices.statusRunning',
  completed: 'devices.statusCompleted',
  failed: 'devices.statusFailed',
  expired: 'devices.statusExpired',
}

export default function DevicesScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

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

  // —— 委派会话(选中设备 → 拉会话列表 → 逐条委派) ——
  const [delegateFor, setDelegateFor] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationDetail[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [delegating, setDelegating] = useState<string | null>(null)

  // —— 任务状态(按设备展开) ——
  const [tasksFor, setTasksFor] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DeviceTaskRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listDevices()
      if (!res.success) setLoadError(res.error || t('devices.loadFailed'))
      else setDevices(res.data ?? [])
    } catch {
      setLoadError(t('devices.loadFailed'))
    } finally {
      setLoading(false)
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

  const onRevoke = (device: DeviceRow) => {
    appAlert(t('devices.revokeTitle'), t('devices.revokeConfirm', { name: device.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('devices.revoke'),
        style: 'destructive',
        onPress: () => {
          setRevoking(device.id)
          void (async () => {
            try {
              const res = await revokeDevice(device.id)
              if (!res.success) appAlert(t('common.error'), res.error || t('devices.revokeFailed'))
              else void load()
            } catch {
              appAlert(t('common.error'), t('devices.revokeFailed'))
            } finally {
              setRevoking(null)
            }
          })()
        },
      },
    ])
  }

  const toggleDelegate = async (deviceId: string) => {
    if (delegateFor === deviceId) {
      setDelegateFor(null)
      return
    }
    setDelegateFor(deviceId)
    setConversations([])
    setConvLoading(true)
    try {
      const res = await listConversations({ page: 1, pageSize: 50 })
      setConversations(res.success ? (res.data?.conversations ?? []) : [])
    } catch {
      setConversations([])
    } finally {
      setConvLoading(false)
    }
  }

  const onDelegate = async (conversationId: string, deviceId: string, deviceName: string) => {
    setDelegating(conversationId)
    try {
      const res = await delegateSession(conversationId, deviceId)
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('devices.delegateFailed'))
        return
      }
      setDelegateFor(null)
      appAlert(t('devices.delegateDoneTitle'), t('devices.delegateDone', { name: deviceName }))
    } catch {
      appAlert(t('common.error'), t('devices.delegateFailed'))
    } finally {
      setDelegating(null)
    }
  }

  const toggleTasks = async (deviceId: string) => {
    if (tasksFor === deviceId) {
      setTasksFor(null)
      return
    }
    setTasksFor(deviceId)
    setTasks([])
    setTasksError(null)
    setTasksLoading(true)
    try {
      const res = await getDeviceTasks(deviceId)
      if (!res.success) setTasksError(res.error || t('devices.tasksFailed'))
      else setTasks(res.data ?? [])
    } catch {
      setTasksError(t('devices.tasksFailed'))
    } finally {
      setTasksLoading(false)
    }
  }

  const styles = makeStyles()
  const pairExpired = pair !== null && pairRemaining <= 0

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('devices.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body}>
        {/* 配对码卡片:大字展示 6 位码 + 剩余有效期(过期后提示重新生成) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <KeyRound size={16} color={tokens.text.secondary} />
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
              <ActivityIndicator color={tokens.brand.ctaForeground} />
            ) : (
              <Text style={styles.buttonText}>
                {pair ? t('devices.pairRegenerate') : t('devices.pairGenerate')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 设备列表:名称 / OS / 最后在线 / 在线徽章 / 撤销 / 委派 / 任务 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MonitorSmartphone size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('devices.listTitle')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
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
                          { color: online ? tokens.success.DEFAULT : tokens.text.tertiary },
                        ]}
                      >
                        {online ? t('devices.online') : t('devices.offline')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {device.os || '—'} · {t('devices.lastSeen')}: {fmt(device.lastSeenAt, locale)}
                  </Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => void toggleDelegate(device.id)}
                      disabled={delegating !== null}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <Send size={13} color={tokens.text.primary} />
                        <Text style={styles.link}>{t('devices.delegate')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void toggleTasks(device.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <ClipboardList size={13} color={tokens.text.primary} />
                        <Text style={styles.link}>{t('devices.tasks')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onRevoke(device)}
                      disabled={revoking === device.id}
                      activeOpacity={0.7}
                    >
                      <View style={styles.actionRow}>
                        <Trash2 size={13} color={tokens.danger.DEFAULT} />
                        <Text style={styles.dangerLink}>{t('devices.revoke')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* 委派面板:复用既有会话列表,点条目即 delegateSession(离线允许入队) */}
                  {delegateFor === device.id ? (
                    <View style={styles.panel}>
                      <Text style={styles.panelTitle}>
                        {t('devices.delegatePickHint', { name: device.name })}
                      </Text>
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
                              {t('devices.taskCreatedAt')}: {fmt(task.createdAt, locale)}
                              {task.finishedAt
                                ? ` · ${t('devices.taskFinishedAt')}: ${fmt(task.finishedAt, locale)}`
                                : ''}
                            </Text>
                            {task.error ? <Text style={styles.error}>{task.error}</Text> : null}
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

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    button: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    disabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tokens.text.primary },
    pairBox: { alignItems: 'center', gap: 4, paddingVertical: rnSpacing.sm },
    pairCode: {
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: 8,
      color: tokens.brand.cta,
      fontVariant: ['tabular-nums'],
    },
    pairCodeExpired: { color: tokens.text.tertiary },
    deviceRow: {
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    deviceName: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.light,
    },
    badgeOn: { borderColor: tokens.success.DEFAULT },
    badgeOff: { borderColor: tokens.border.medium },
    badgeText: { fontSize: 10, fontWeight: '600', color: tokens.text.secondary },
    meta: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.lg, marginTop: 2 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    link: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    dangerLink: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    panel: {
      marginTop: rnSpacing.xs,
      padding: 10,
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
      borderWidth: 1,
      borderColor: tokens.border.light,
      gap: rnSpacing.xs,
    },
    panelTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    convRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: 6,
    },
    convTitle: { flex: 1, fontSize: 13, color: tokens.text.primary },
    taskRow: { gap: 2, paddingVertical: 6 },
    taskSession: {
      flex: 1,
      fontFamily: 'monospace',
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
