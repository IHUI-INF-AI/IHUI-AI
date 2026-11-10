// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻共享屏(RN / web 同源渲染)。
 *
 * 宿主职责:数据编排、toast/appAlert、ConfirmDialog、NavBar、/chat 深链;
 * 共享屏职责:列表、内联新建/编辑表单、历史展开、动作触发。
 * 内部零平台判断(无 Platform.OS / window / navigator / 原生弹窗)。
 *
 * 能力并集:编辑、prompt、会话深链、结构化 rrule(频率/时间/周天)+ 原始 rrule 输入
 * 同时保留 —— 不允许为了复用让任何一端丢能力。
 */
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronDown,
  ChevronUp,
  History,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

export type PatrolType = 'ci' | 'dependency' | 'log' | 'deadlink' | 'workspace' | 'custom'
export type PatrolStatus = 'active' | 'paused'
export type PatrolRunStatus = 'ok' | 'issue' | 'error'
export type RruleFrequency = 'hourly' | 'daily' | 'weekly'

export interface PatrolLastResultView {
  status: PatrolRunStatus
  summary: string
  conversationId?: string | null
  finishedAt?: string | null
}

export interface PatrolTaskView {
  id: string
  name: string
  patrolType: PatrolType
  target?: string | null
  prompt?: string | null
  rrule: string
  status: PatrolStatus
  nextRunAt?: string | null
  lastResult?: PatrolLastResultView | null
}

export interface PatrolRunView {
  id: string
  status: PatrolRunStatus
  summary: string
  conversationId?: string | null
  createdAt: string
}

export interface PatrolFormValues {
  name: string
  patrolType: PatrolType
  target: string
  prompt: string
  rrule: string
}

export interface PatrolConfirmOptions {
  title: string
  message: string
  destructive?: boolean
}

export interface PatrolScreenProps {
  /** 宿主注入的翻译函数(键族统一为 patrol.*) */
  t: TFunction
  colorScheme?: 'light' | 'dark'
  tasks: PatrolTaskView[]
  loading: boolean
  error?: string | null
  /** 刷新:RN 下拉 / web 按钮共用;提供时挂载 RefreshControl */
  onRefresh?: () => void | Promise<void>
  /** 新建 / 编辑(第二参有值 = 编辑) */
  onSave: (values: PatrolFormValues, id?: string) => Promise<void>
  onRunNow: (id: string) => Promise<void>
  onToggleStatus: (id: string, next: PatrolStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onLoadRuns: (id: string) => Promise<PatrolRunView[]>
  /** 会话深链(RN: Chat 路由;web: /chat?conversationId=) */
  onOpenConversation?: (conversationId: string) => void
  /** 危险动作二次确认(必填:不允许静默删除) */
  onConfirm: (options: PatrolConfirmOptions) => Promise<boolean>
}

const TYPE_KEYS: Record<PatrolType, string> = {
  ci: 'patrol.typeCi',
  dependency: 'patrol.typeDependency',
  log: 'patrol.typeLog',
  deadlink: 'patrol.typeDeadlink',
  workspace: 'patrol.typeWorkspace',
  custom: 'patrol.typeCustom',
}

const TYPE_OPTIONS: readonly PatrolType[] = [
  'ci',
  'dependency',
  'log',
  'deadlink',
  'workspace',
  'custom',
]

const RESULT_KEYS: Record<PatrolRunStatus, string> = {
  ok: 'patrol.resultOk',
  issue: 'patrol.resultIssue',
  error: 'patrol.resultError',
}

const FREQ_KEYS: Record<RruleFrequency, string> = {
  hourly: 'patrol.form.freqHourly',
  daily: 'patrol.form.freqDaily',
  weekly: 'patrol.form.freqWeekly',
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

const DAY_KEYS: Record<(typeof DAY_CODES)[number], string> = {
  MO: 'patrol.weekdayMo',
  TU: 'patrol.weekdayTu',
  WE: 'patrol.weekdayWe',
  TH: 'patrol.weekdayTh',
  FR: 'patrol.weekdayFr',
  SA: 'patrol.weekdaySa',
  SU: 'patrol.weekdaySu',
}

export interface RruleFormParts {
  frequency: RruleFrequency
  time: string
  days: string[]
}

const DEFAULT_RRULE_PARTS: RruleFormParts = {
  frequency: 'daily',
  time: '09:00',
  days: ['MO', 'TU', 'WE', 'TH', 'FR'],
}

const DEFAULT_RRULE = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0'

/** 把 UI 表单态拼成后端 MVP 子集 rrule(与 web lib/rrule-form 同语义) */
function buildRruleFromParts(parts: RruleFormParts): string {
  const [h, m] = parts.time.split(':')
  const byHour = String(Number(h ?? '0'))
  const byMinute = String(Number(m ?? '0'))
  if (parts.frequency === 'hourly') return 'FREQ=HOURLY'
  if (parts.frequency === 'daily') return `FREQ=DAILY;BYHOUR=${byHour};BYMINUTE=${byMinute}`
  return `FREQ=WEEKLY;BYDAY=${parts.days.join(',')};BYHOUR=${byHour};BYMINUTE=${byMinute}`
}

/** rrule → UI 表单态;解析失败返回 null(调用方回默认值) */
function rruleToParts(rrule: string | null | undefined): RruleFormParts | null {
  if (!rrule) return null
  const kv: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const idx = seg.indexOf('=')
    if (idx > 0) kv[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
  }
  const freq = kv.FREQ?.toUpperCase()
  const time =
    kv.BYHOUR !== undefined || kv.BYMINUTE !== undefined
      ? `${String(Number(kv.BYHOUR ?? '0')).padStart(2, '0')}:${String(
          Number(kv.BYMINUTE ?? '0'),
        ).padStart(2, '0')}`
      : DEFAULT_RRULE_PARTS.time
  if (freq === 'HOURLY') return { frequency: 'hourly', time, days: DEFAULT_RRULE_PARTS.days }
  if (freq === 'DAILY') return { frequency: 'daily', time, days: DEFAULT_RRULE_PARTS.days }
  if (freq === 'WEEKLY' && kv.BYDAY) {
    return {
      frequency: 'weekly',
      time,
      days: kv.BYDAY.split(',')
        .map((d) => d.trim().toUpperCase())
        .filter(Boolean),
    }
  }
  return null
}

function describeRrule(rrule: string, t: TFunction): string {
  const parts = rruleToParts(rrule)
  if (!parts) return rrule
  if (parts.frequency === 'hourly') return t('patrol.form.freqHourly')
  return `${t(FREQ_KEYS[parts.frequency])} ${parts.time}`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function normalizeTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

interface FormState extends PatrolFormValues {
  /** 编辑中的任务 id;null = 新建 */
  id: string | null
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  patrolType: 'custom',
  target: '',
  prompt: '',
  rrule: DEFAULT_RRULE,
}

export function PatrolScreen({
  t,
  colorScheme = 'light',
  tasks,
  loading,
  error = null,
  onRefresh,
  onSave,
  onRunNow,
  onToggleStatus,
  onDelete,
  onLoadRuns,
  onOpenConversation,
  onConfirm,
}: PatrolScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [parts, setParts] = useState<RruleFormParts>(DEFAULT_RRULE_PARTS)
  const [timeDraft, setTimeDraft] = useState(DEFAULT_RRULE_PARTS.time)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const [historyId, setHistoryId] = useState<string | null>(null)
  const [runs, setRuns] = useState<PatrolRunView[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setParts(DEFAULT_RRULE_PARTS)
    setTimeDraft(DEFAULT_RRULE_PARTS.time)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (task: PatrolTaskView) => {
    const parsed = rruleToParts(task.rrule) ?? DEFAULT_RRULE_PARTS
    setForm({
      id: task.id,
      name: task.name,
      patrolType: task.patrolType,
      target: task.target ?? '',
      prompt: task.prompt ?? '',
      rrule: task.rrule,
    })
    setParts(parsed)
    setTimeDraft(parsed.time)
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setFormError(null)
  }

  const setFrequency = (frequency: RruleFrequency) => {
    const next = { ...parts, frequency }
    setParts(next)
    setForm((f) => ({ ...f, rrule: buildRruleFromParts(next) }))
  }

  const setTime = (value: string) => {
    setTimeDraft(value)
    const normalized = normalizeTime(value)
    if (!normalized) return
    const next = { ...parts, time: normalized }
    setParts(next)
    setForm((f) => ({ ...f, rrule: buildRruleFromParts(next) }))
  }

  const toggleDay = (code: string) => {
    const days = parts.days.includes(code)
      ? parts.days.filter((d) => d !== code)
      : [...parts.days, code]
    const next = { ...parts, days }
    setParts(next)
    setForm((f) => ({ ...f, rrule: buildRruleFromParts(next) }))
  }

  const setRawRrule = (value: string) => {
    setForm((f) => ({ ...f, rrule: value }))
    const parsed = rruleToParts(value)
    if (parsed) {
      setParts(parsed)
      setTimeDraft(parsed.time)
    }
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!form.name.trim()) {
      setFormError(t('patrol.form.errName'))
      return
    }
    const rrule = form.rrule.trim() || buildRruleFromParts(parts)
    if (!rrule) {
      setFormError(t('patrol.form.errRrule'))
      return
    }
    if (parts.frequency === 'weekly' && parts.days.length === 0) {
      setFormError(t('patrol.form.errDays'))
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await onSave(
        {
          name: form.name.trim(),
          patrolType: form.patrolType,
          target: form.target.trim(),
          prompt: form.prompt.trim(),
          rrule,
        },
        form.id ?? undefined,
      )
      setFormOpen(false)
      setForm(EMPTY_FORM)
      setParts(DEFAULT_RRULE_PARTS)
      setTimeDraft(DEFAULT_RRULE_PARTS.time)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('patrol.toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleRunNow = async (id: string) => {
    if (busyId) return
    setRowError(null)
    setBusyId(id)
    try {
      await onRunNow(id)
    } catch (e) {
      setRowError(e instanceof Error ? e.message : t('patrol.toast.runFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleStatus = async (task: PatrolTaskView) => {
    if (busyId) return
    setRowError(null)
    setBusyId(task.id)
    try {
      await onToggleStatus(task.id, task.status === 'active' ? 'paused' : 'active')
    } catch (e) {
      setRowError(e instanceof Error ? e.message : t('patrol.toast.updateFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (task: PatrolTaskView) => {
    if (busyId) return
    setRowError(null)
    const confirmed = await onConfirm({
      title: t('patrol.deleteConfirm.title'),
      message: t('patrol.deleteConfirm.content', { name: task.name }),
      destructive: true,
    })
    if (!confirmed) return
    setBusyId(task.id)
    try {
      await onDelete(task.id)
      if (historyId === task.id) {
        setHistoryId(null)
        setRuns([])
      }
    } catch (e) {
      setRowError(e instanceof Error ? e.message : t('patrol.toast.deleteFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleHistory = async (task: PatrolTaskView) => {
    if (historyId === task.id) {
      setHistoryId(null)
      setRuns([])
      setRunsError(null)
      return
    }
    setHistoryId(task.id)
    setRuns([])
    setRunsError(null)
    setRunsLoading(true)
    try {
      setRuns(await onLoadRuns(task.id))
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : t('patrol.toast.loadFailed'))
    } finally {
      setRunsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void handleRefresh()
              }}
            />
          ) : undefined
        }
      >
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={formOpen ? closeForm : openCreate}>
            <Plus size={14} color={tk.brand.ctaForeground} />
            <Text style={styles.primaryBtnText}>{t('patrol.create')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineBtn, (loading || refreshing) && styles.disabled]}
            disabled={loading || refreshing || !onRefresh}
            onPress={() => {
              void handleRefresh()
            }}
          >
            <RefreshCw size={14} color={tk.text.primary} />
            <Text style={styles.outlineBtnText}>{t('patrol.refresh')}</Text>
          </TouchableOpacity>
        </View>

        {formOpen ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {form.id ? t('patrol.form.editTitle') : t('patrol.form.createTitle')}
            </Text>
            <Text style={styles.muted}>{t('patrol.form.desc')}</Text>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <Text style={styles.label}>{t('patrol.form.name')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder={t('patrol.form.namePlaceholder')}
            />

            <Text style={styles.label}>{t('patrol.form.patrolType')}</Text>
            <View style={styles.chips}>
              {TYPE_OPTIONS.map((k) => {
                const active = form.patrolType === k
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.chip, active && styles.chipOn]}
                    onPress={() => setForm((f) => ({ ...f, patrolType: k }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {t(TYPE_KEYS[k])}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.label}>{t('patrol.form.target')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={form.target}
              onChangeText={(v) => setForm((f) => ({ ...f, target: v }))}
              placeholder={t('patrol.form.targetPlaceholder')}
            />

            <Text style={styles.label}>{t('patrol.form.prompt')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={form.prompt}
              onChangeText={(v) => setForm((f) => ({ ...f, prompt: v }))}
              placeholder={t('patrol.form.promptPlaceholder')}
              multiline
            />

            <Text style={styles.label}>{t('patrol.form.frequency')}</Text>
            <View style={styles.chips}>
              {(Object.keys(FREQ_KEYS) as RruleFrequency[]).map((k) => {
                const active = parts.frequency === k
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.chip, active && styles.chipOn]}
                    onPress={() => setFrequency(k)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {t(FREQ_KEYS[k])}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {parts.frequency !== 'hourly' ? (
              <>
                <Text style={styles.label}>{t('patrol.form.time')}</Text>
                <TextField
                  colorScheme={colorScheme}
                  style={styles.input}
                  value={timeDraft}
                  onChangeText={setTime}
                  placeholder="09:00"
                />
              </>
            ) : null}

            {parts.frequency === 'weekly' ? (
              <>
                <Text style={styles.label}>{t('patrol.form.weekdays')}</Text>
                <View style={styles.chips}>
                  {DAY_CODES.map((code) => {
                    const active = parts.days.includes(code)
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.chip, active && styles.chipOn]}
                        onPress={() => toggleDay(code)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextOn]}>
                          {t(DAY_KEYS[code])}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>{t('patrol.form.rrule')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={form.rrule}
              onChangeText={setRawRrule}
              placeholder={t('patrol.form.rrulePlaceholder')}
              autoCapitalize="characters"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.disabled]}
                disabled={saving}
                onPress={() => {
                  void handleSubmit()
                }}
              >
                {saving ? <ActivityIndicator size="small" color={tk.brand.ctaForeground} /> : null}
                <Text style={styles.primaryBtnText}>{t('patrol.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} disabled={saving} onPress={closeForm}>
                <Text style={styles.outlineBtnText}>{t('patrol.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {rowError ? <Text style={styles.error}>{rowError}</Text> : null}

        {loading && tasks.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color={tk.text.secondary} />
            <Text style={styles.muted}>{t('patrol.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.error}>{error}</Text>
            {onRefresh ? (
              <TouchableOpacity
                style={styles.outlineBtn}
                disabled={refreshing}
                onPress={() => {
                  void handleRefresh()
                }}
              >
                <Text style={styles.outlineBtnText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.muted}>{t('patrol.empty')}</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.taskName}>{task.name}</Text>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{t(TYPE_KEYS[task.patrolType])}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    task.status === 'active' ? styles.statusOn : styles.statusOff,
                  ]}
                >
                  <Text
                    style={[styles.statusText, task.status === 'active' && styles.statusTextOn]}
                  >
                    {t(task.status === 'active' ? 'patrol.statusActive' : 'patrol.statusPaused')}
                  </Text>
                </View>
              </View>

              <Text style={styles.muted}>
                {describeRrule(task.rrule, t)} · {t('patrol.nextRunAt')}:{' '}
                {formatDateTime(task.nextRunAt)}
              </Text>

              {task.lastResult ? (
                <View style={styles.resultRow}>
                  <View style={styles.chip}>
                    <Text style={[styles.chipText, resultColor(task.lastResult.status, tk)]}>
                      {t(RESULT_KEYS[task.lastResult.status] ?? 'patrol.resultOk')}
                    </Text>
                  </View>
                  <Text style={styles.resultSummary}>{task.lastResult.summary}</Text>
                  {task.lastResult.conversationId && onOpenConversation ? (
                    <TouchableOpacity
                      style={styles.inlineLink}
                      onPress={() => onOpenConversation(task.lastResult?.conversationId as string)}
                    >
                      <MessageSquare size={13} color={tk.text.primary} />
                      <Text style={styles.linkText}>{t('patrol.action.openConversation')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, busyId === task.id && styles.disabled]}
                  disabled={busyId === task.id}
                  onPress={() => {
                    void handleRunNow(task.id)
                  }}
                >
                  {busyId === task.id ? (
                    <ActivityIndicator size="small" color={tk.text.primary} />
                  ) : (
                    <Zap size={13} color={tk.text.primary} />
                  )}
                  <Text style={styles.actionText}>{t('patrol.action.runNow')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, busyId === task.id && styles.disabled]}
                  disabled={busyId === task.id}
                  onPress={() => {
                    void handleToggleStatus(task)
                  }}
                >
                  {task.status === 'active' ? (
                    <Pause size={13} color={tk.text.primary} />
                  ) : (
                    <Play size={13} color={tk.text.primary} />
                  )}
                  <Text style={styles.actionText}>
                    {t(task.status === 'active' ? 'patrol.action.pause' : 'patrol.action.resume')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  disabled={busyId === task.id}
                  onPress={() => {
                    void toggleHistory(task)
                  }}
                >
                  <History size={13} color={tk.text.primary} />
                  <Text style={styles.actionText}>{t('patrol.action.history')}</Text>
                  {historyId === task.id ? (
                    <ChevronUp size={13} color={tk.text.primary} />
                  ) : (
                    <ChevronDown size={13} color={tk.text.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  disabled={busyId === task.id}
                  onPress={() => openEdit(task)}
                >
                  <Pencil size={13} color={tk.text.primary} />
                  <Text style={styles.actionText}>{t('patrol.action.edit')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, busyId === task.id && styles.disabled]}
                  disabled={busyId === task.id}
                  onPress={() => {
                    void handleDelete(task)
                  }}
                >
                  <Trash2 size={13} color={tk.danger.DEFAULT} />
                  <Text style={[styles.actionText, styles.dangerText]}>
                    {t('patrol.action.delete')}
                  </Text>
                </TouchableOpacity>
              </View>

              {historyId === task.id ? (
                <View style={styles.historyBox}>
                  <Text style={styles.label}>{t('patrol.runs.title')}</Text>
                  {runsLoading ? (
                    <Text style={styles.muted}>{t('patrol.runs.loading')}</Text>
                  ) : runsError ? (
                    <Text style={styles.error}>{runsError}</Text>
                  ) : runs.length === 0 ? (
                    <Text style={styles.muted}>{t('patrol.runs.empty')}</Text>
                  ) : (
                    runs.map((run) => (
                      <View key={run.id} style={styles.runRow}>
                        <View style={styles.runHead}>
                          <View style={styles.chip}>
                            <Text style={[styles.chipText, resultColor(run.status, tk)]}>
                              {t(RESULT_KEYS[run.status] ?? 'patrol.resultOk')}
                            </Text>
                          </View>
                          <Text style={styles.muted}>{formatDateTime(run.createdAt)}</Text>
                          {run.status === 'issue' && run.conversationId && onOpenConversation ? (
                            <TouchableOpacity
                              style={styles.inlineLink}
                              onPress={() => onOpenConversation(run.conversationId as string)}
                            >
                              <MessageSquare size={12} color={tk.text.primary} />
                              <Text style={styles.linkText}>
                                {t('patrol.action.openConversation')}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Text style={styles.muted}>{run.summary}</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

function resultColor(status: PatrolRunStatus, tk: AppThemeTokens): { color: string } {
  if (status === 'ok') return { color: tk.success.DEFAULT }
  if (status === 'issue') return { color: tk.brandAccent.deep }
  return { color: tk.danger.DEFAULT }
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    scroll: { flex: 1 },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    primaryBtn: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    primaryBtnText: {
      fontSize: rnType.bodySm.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    outlineBtn: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    outlineBtnText: { fontSize: rnType.bodySm.size, color: tk.text.primary },
    disabled: { opacity: 0.5 },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    label: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
    muted: { fontSize: rnType.bodySm.size, color: tk.text.secondary, lineHeight: 19 },
    error: { fontSize: rnType.bodySm.size, color: tk.danger.DEFAULT },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    input: {
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tk.surface.bg,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    chipOn: { borderColor: tk.brandAccent.deep, backgroundColor: tk.brandAccent.light },
    chipText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    chipTextOn: { color: tk.brandAccent.foreground, fontWeight: '600' },
    formActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
    taskName: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    statusBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
    },
    statusOn: { borderColor: tk.success.DEFAULT },
    statusOff: { borderColor: tk.border.medium },
    statusText: { fontSize: rnType.badge.size, fontWeight: '600', color: tk.text.secondary },
    statusTextOn: { color: tk.success.DEFAULT },
    resultRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
    resultSummary: {
      flexShrink: 1,
      fontSize: rnType.bodySm.size,
      color: tk.text.secondary,
    },
    inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    linkText: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.lg,
      marginTop: rnSpacing.xs,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    actionText: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
    dangerText: { color: tk.danger.DEFAULT },
    historyBox: {
      marginTop: rnSpacing.sm,
      paddingTop: rnSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      gap: rnSpacing.xs,
    },
    runRow: {
      padding: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
      gap: rnSpacing.xs,
    },
    runHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
