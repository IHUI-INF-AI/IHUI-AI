// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SelfMediaAutomationScreen 自动化任务(mobile-rn 端 wrapper)
 *
 * 承载 web /self-media/automation。UI 全部委托共享屏 @ihui/rn-app,本 wrapper 只保留平台职责:
 * - 取数:GET /api/self-media/automation/tasks + /history(契约现读
 *   apps/api/src/routes/self-media-routes.ts:151-153 / :185-192,上游 ai-service
 *   apps/ai-service/app/routers/self_media.py:733-738 / :795-803;api 层原样透传裸 JSON)
 * - 写:POST toggle /config /trigger(self-media-routes.ts:160-183);
 *   上游 config 请求体是 snake_case(dry_run / title_template),本壳按真契约发
 * - 文案:静态 chrome 用 selfMedia.automationPage 页面 ns;时间/时长 Intl 格式化后注入
 * - 登录门:未登录不发注定 401 的查询(web useAuthGate 同口径)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getAutomationHistory,
  listAutomationTasks,
  toggleAutomationTask,
  triggerAutomationTask,
  updateAutomationTaskConfig,
  type AutomationTask,
} from '@ihui/api-client'
import {
  SelfMediaAutomationScreen as SharedSelfMediaAutomationScreen,
  type AutomationHistoryRowView,
  type AutomationRunStatus,
  type AutomationTaskRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'selfMedia.automationPage'

/** 与 web 一致:历史取最近 30 条(apps/ai-service/app/routers/self_media.py:797 默认 30) */
const HISTORY_LIMIT = 30

export function SelfMediaAutomationScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [tasks, setTasks] = useState<AutomationTask[]>([])
  const [history, setHistory] = useState<AutomationHistoryRowView[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHour, setEditHour] = useState('0')
  const [editMinute, setEditMinute] = useState('0')
  const [editDryRun, setEditDryRun] = useState(true)
  const [editTitleTemplate, setEditTitleTemplate] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  /** 触发时间/耗时格式化:与 web 同参(时区固定 Asia/Shanghai,page.tsx:294-327) */
  const dateTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      }),
    [locale],
  )
  const fmtDateTime = useCallback(
    (iso: string): string => {
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d)
    },
    [dateTimeFmt],
  )

  const fmtDuration = useCallback((ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }, [])

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [tasksRes, historyRes] = await Promise.all([
        listAutomationTasks(),
        getAutomationHistory({ limit: HISTORY_LIMIT }),
      ])
      if (!tasksRes.success || !tasksRes.data) {
        setError(tasksRes.error || t('common.loadFailed'))
        return
      }
      setTasks(tasksRes.data.items ?? [])
      const rows: AutomationHistoryRowView[] = (historyRes.success ? (historyRes.data?.items ?? []) : []).map(
        (h, idx) => ({
          key: `${h.task_id}-${idx}-${h.triggered_at}`,
          taskName:
            (tasksRes.data?.items ?? []).find((x) => x.id === h.task_id)?.name ?? h.task_id,
          status: h.status as AutomationRunStatus,
          timeText: fmtDateTime(h.triggered_at),
          durationText: fmtDuration(h.duration_ms),
          error: h.error ?? '',
          extraLines:
            h.extra && Object.keys(h.extra).length > 0
              ? Object.entries(h.extra)
                  .slice(0, 5)
                  .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
              : [],
        }),
      )
      setHistory(rows)
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fmtDateTime, fmtDuration, t, user])

  useEffect(() => {
    void load()
  }, [load])

  const taskRows: AutomationTaskRowView[] = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    description: task.description,
    running: task.running,
    enabled: Boolean(task.config?.enabled),
    executionTimeText: `${String(task.config?.hour ?? task.default_hour).padStart(2, '0')}:${String(
      task.config?.minute ?? task.default_minute,
    ).padStart(2, '0')}`,
    dryRun: Boolean(task.config?.dry_run),
    showTitleTemplate: task.id === 'wechat_daily',
    titleTemplate: task.config?.title_template ?? '',
    lastRunText: task.last_run
      ? `${fmtDateTime(task.last_run.triggered_at)} · ${fmtDuration(task.last_run.duration_ms)}`
      : '',
    lastRunStatus: task.last_run ? (task.last_run.status as AutomationRunStatus) : null,
  }))

  const schedulerNotes = useMemo(
    () => [
      t(`${NS}.note1`),
      t(`${NS}.note2`),
      t(`${NS}.note3`),
      t(`${NS}.note4`),
    ],
    [t],
  )

  const onToggle = async (row: AutomationTaskRowView) => {
    setTogglingId(row.id)
    try {
      const res = await toggleAutomationTask(row.id, !row.enabled)
      if (!res.success) setError(res.error || t('common.loadFailed'))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setTogglingId(null)
      await load()
    }
  }

  const onTrigger = async (row: AutomationTaskRowView) => {
    setTriggeringId(row.id)
    try {
      const res = await triggerAutomationTask(row.id)
      if (!res.success) setError(res.error || t('common.loadFailed'))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setTriggeringId(null)
      await load()
    }
  }

  const onStartEdit = (row: AutomationTaskRowView) => {
    setEditingId(row.id)
    const [hour, minute] = row.executionTimeText.split(':')
    setEditHour(String(Number(hour ?? 0)))
    setEditMinute(String(Number(minute ?? 0)))
    setEditDryRun(row.dryRun)
    setEditTitleTemplate(row.titleTemplate)
  }

  const onSaveConfig = async (row: AutomationTaskRowView) => {
    setSavingConfig(true)
    try {
      const hour = Math.min(23, Math.max(0, Number(editHour) || 0))
      const minute = Math.min(59, Math.max(0, Number(editMinute) || 0))
      const res = await updateAutomationTaskConfig(row.id, {
        hour,
        minute,
        dry_run: editDryRun,
        title_template: editTitleTemplate || undefined,
      })
      if (!res.success) {
        setError(res.error || t('common.loadFailed'))
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setSavingConfig(false)
    }
  }

  return (
    <SharedSelfMediaAutomationScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      refreshing={refreshing}
      error={error}
      tasks={taskRows}
      history={history}
      schedulerNotes={schedulerNotes}
      editingId={editingId}
      editHour={editHour}
      editMinute={editMinute}
      editDryRun={editDryRun}
      editTitleTemplate={editTitleTemplate}
      onEditHourChange={setEditHour}
      onEditMinuteChange={setEditMinute}
      onEditDryRunChange={setEditDryRun}
      onEditTitleTemplateChange={setEditTitleTemplate}
      savingConfig={savingConfig}
      togglingId={togglingId}
      triggeringId={triggeringId}
      onStartEdit={onStartEdit}
      onCancelEdit={() => setEditingId(null)}
      onSaveConfig={(row) => void onSaveConfig(row)}
      onToggle={(row) => void onToggle(row)}
      onTrigger={(row) => void onTrigger(row)}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
