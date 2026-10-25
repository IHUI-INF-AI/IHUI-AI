// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发布日历 —— 对齐 web `/publish/calendar`。
 *
 * 端点按 apps/api/src/routes/publish-routes.ts → ai-service publish.py 现读:
 *  - GET  /api/publish/tasks?limit=200                     ⇒ { items: Task[] }
 *  - POST /api/publish/tasks/:taskId/reschedule            ⇒ body { scheduled_at: ISO }
 *        (只允许 scheduled / pending 两种状态,其余后端 400)
 *
 * 移动端不做拖拽改期:按日期分组展示,详情弹层里用「本地时间文本 + 快捷档」改期。
 * taskId 必须是字符串 pub-xxx(列表里的 taskId),数字 id 传给改期接口会 404。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CalendarDays, Clock, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Task {
  id: number
  taskId?: string
  title: string
  status: string
  scheduledAt?: string | null
  createdAt?: string
  targets?: Array<{ platform: string }>
  platforms?: Array<{ platform: string; success: boolean }>
  error?: string | null
}

const STATUS_KEY: Record<string, string> = {
  pending: 'publishCalendar.statusPending',
  scheduled: 'publishCalendar.statusScheduled',
  running: 'publishCalendar.statusRunning',
  success: 'publishCalendar.statusSuccess',
  failed: 'publishCalendar.statusFailed',
  partial: 'publishCalendar.statusPartial',
  cancelled: 'publishCalendar.statusCancelled',
  skipped: 'publishCalendar.statusSkipped',
}

const RESCHEDULABLE = new Set(['pending', 'scheduled'])

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 本地时间 → `YYYY-MM-DD HH:mm`(与输入框同形) */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** `YYYY-MM-DD HH:mm`(本地) → Date;越界(如 2 月 31 日)按非法处理 */
function parseLocalInput(text: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  const date = new Date(y, mo - 1, d, h, mi, 0, 0)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  ) {
    return null
  }
  return date
}

export default function PublishCalendarScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [panel, setPanel] = useState<Task | null>(null)
  const [scheduleText, setScheduleText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ items?: Task[] }>('/api/publish/tasks?limit=200')
      if (!res.success) throw new Error(res.error)
      setTasks(res.data?.items ?? [])
    } catch {
      setTasks([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fmtDate = (iso: string | null | undefined, withTime: boolean): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(d)
  }

  const taskTime = (task: Task): string => task.scheduledAt ?? task.createdAt ?? ''
  const taskId = (task: Task): string => task.taskId ?? String(task.id)

  // 按本地日期分组,组内按时间升序;无日期的任务归入最后一组
  const groups: Array<{ key: string; label: string; items: Task[] }> = []
  const index = new Map<string, number>()
  for (const task of tasks) {
    const iso = taskTime(task)
    const d = iso ? new Date(iso) : null
    const valid = d !== null && !Number.isNaN(d.getTime())
    const key = valid ? toLocalInput(d).slice(0, 10) : 'unknown'
    let gi = index.get(key)
    if (gi === undefined) {
      gi = groups.length
      index.set(key, gi)
      groups.push({
        key,
        label: valid ? fmtDate(iso, false) : t('publishCalendar.noDate'),
        items: [],
      })
    }
    groups[gi]?.items.push(task)
  }
  for (const g of groups) {
    g.items.sort((a, b) => {
      const ta = new Date(taskTime(a)).getTime()
      const tb = new Date(taskTime(b)).getTime()
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb)
    })
  }

  const openPanel = (task: Task) => {
    setPanel(task)
    const base = task.scheduledAt ? new Date(task.scheduledAt) : new Date()
    setScheduleText(toLocalInput(Number.isNaN(base.getTime()) ? new Date() : base))
  }

  const onReschedule = async () => {
    if (!panel) return
    const date = parseLocalInput(scheduleText)
    if (!date) {
      appAlert(t('publishCalendar.rescheduleInvalid'))
      return
    }
    setSaving(true)
    try {
      const res = await fetchApi(
        `/api/publish/tasks/${encodeURIComponent(taskId(panel))}/reschedule`,
        { method: 'POST', body: JSON.stringify({ scheduled_at: date.toISOString() }) },
      )
      if (!res.success) throw new Error(res.error)
      setPanel(null)
      appAlert(t('publishCalendar.rescheduleSuccess'))
      await load()
    } catch (e) {
      appAlert(t('publishCalendar.rescheduleFailed'), e instanceof Error ? e.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const quick = (hours: number) => {
    const d = new Date(Date.now() + hours * 3600 * 1000)
    d.setSeconds(0, 0)
    setScheduleText(toLocalInput(d))
  }

  const styles = makeStyles()
  const statusText = (status: string): string =>
    t(STATUS_KEY[status] ?? 'publishCalendar.statusUnknown')

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('publishCalendar.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('publishCalendar.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('publishCalendar.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.stateBox}>
            <CalendarDays size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('publishCalendar.empty')}</Text>
            <Text style={styles.hint}>{t('publishCalendar.emptyHint')}</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              {group.items.map((task) => (
                <TouchableOpacity
                  key={`${group.key}-${task.id}`}
                  style={styles.card}
                  onPress={() => openPanel(task)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <View
                      style={[
                        styles.pill,
                        task.status === 'success'
                          ? styles.pillSuccess
                          : task.status === 'failed'
                            ? styles.pillFailed
                            : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          task.status === 'success'
                            ? styles.pillTextSuccess
                            : task.status === 'failed'
                              ? styles.pillTextFailed
                              : null,
                        ]}
                      >
                        {statusText(task.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Clock size={11} color={tokens.text.tertiary} />
                    <Text style={styles.meta}>{fmtDate(taskTime(task), true)}</Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t('publishCalendar.platforms', {
                      count: task.targets?.length ?? task.platforms?.length ?? 0,
                    })}
                    {task.targets && task.targets.length > 0
                      ? ` · ${task.targets.map((tg) => tg.platform).join(' / ')}`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.mask} onPress={() => setPanel(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {panel?.title}
              </Text>
              <Pressable onPress={() => setPanel(null)} hitSlop={8}>
                <X size={18} color={tokens.text.secondary} />
              </Pressable>
            </View>
            {panel ? (
              <>
                <Text style={styles.muted}>
                  {t('publishCalendar.taskId')}: {taskId(panel)}
                </Text>
                <Text style={styles.muted}>
                  {t('publishCalendar.status')}: {statusText(panel.status)}
                </Text>
                <Text style={styles.muted}>
                  {t('publishCalendar.scheduledAt')}: {fmtDate(panel.scheduledAt, true)}
                </Text>
                <Text style={styles.muted}>
                  {t('publishCalendar.createdAt')}: {fmtDate(panel.createdAt, true)}
                </Text>
                {panel.error ? (
                  <Text style={styles.errorText} numberOfLines={3}>
                    {panel.error}
                  </Text>
                ) : null}
                {RESCHEDULABLE.has(panel.status) ? (
                  <View style={styles.rescheduleBox}>
                    <Text style={styles.cardTitle}>{t('publishCalendar.reschedule')}</Text>
                    <Text style={styles.hint}>{t('publishCalendar.rescheduleHint')}</Text>
                    <TextField
                      colorScheme={resolvedTheme}
                      value={scheduleText}
                      onChangeText={setScheduleText}
                      placeholder={t('publishCalendar.reschedulePlaceholder')}
                      style={styles.input}
                    />
                    <View style={styles.quickRow}>
                      <TouchableOpacity
                        style={styles.quickChip}
                        onPress={() => quick(1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickText}>{t('publishCalendar.quickOneHour')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickChip}
                        onPress={() => quick(24)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickText}>{t('publishCalendar.quickTomorrow')}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryBtn, saving && styles.disabled]}
                      onPress={() => void onReschedule()}
                      disabled={saving}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.primaryBtnText}>
                        {saving ? t('common.submitting') : t('publishCalendar.rescheduleConfirm')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.hint}>{t('publishCalendar.rescheduleNotAllowed')}</Text>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    group: { gap: rnSpacing.sm },
    groupTitle: { fontSize: 13, fontWeight: '700', color: tokens.text.primary },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 5,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    itemName: {
      flex: 1,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    pill: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tokens.surface.muted,
    },
    pillSuccess: { backgroundColor: tokens.success.light },
    pillFailed: { backgroundColor: tokens.danger.light },
    pillText: { fontSize: 10, color: tokens.text.secondary },
    pillTextSuccess: { color: tokens.success.deepText, fontWeight: '600' },
    pillTextFailed: { color: tokens.danger.DEFAULT, fontWeight: '600' },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary, lineHeight: 16 },
    errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tokens.overlay.modal,
    },
    sheet: {
      maxHeight: '85%',
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sheetTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    rescheduleBox: { gap: rnSpacing.sm, marginTop: rnSpacing.xs },
    input: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tokens.surface.bg,
    },
    quickRow: { flexDirection: 'row', gap: rnSpacing.sm },
    quickChip: {
      paddingHorizontal: 10,
      height: 28,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tokens.border.light,
    },
    quickText: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    primaryBtn: {
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    disabled: { opacity: 0.5 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
