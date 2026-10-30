// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  fetchAgentPlanTasks,
  fetchAgentPlanVersionDiff,
  fetchAgentPlanVersions,
  getAgentPlan,
  type AgentPlanDetail,
  type PlanTaskView,
  type PlanVersionsResult,
} from '@ihui/api-client'
import {
  AgentPlanProgressScreen as SharedAgentPlanProgressScreen,
  type AgentPlanProgressDetailView,
  type AgentPlanTaskRowView,
  type AgentPlanVersionRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'agentPlanProgressPage'

/** 与 web STATUS_LABEL 同表(apps/web/app/(main)/agent-plan/progress/page.tsx:49-57),值=本页 ns 键 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'statusDraft',
  pending_approval: 'statusPendingApproval',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  executing: 'statusExecuting',
  done: 'statusDone',
  failed: 'statusFailed',
}

/** 与 web TASK_STATUS_LABEL 同表(page.tsx:59-63) */
const TASK_STATUS_KEYS: Record<string, string> = {
  pending: 'taskStatusPending',
  done: 'taskStatusDone',
  blocked: 'taskStatusBlocked',
}

/**
 * RN 端「Agent Plan 任务进度」薄壳 —— 承载 web /agent-plan/progress。
 *
 * 取数(与 web 同参同序,page.tsx:115-141):GET /api/agent-plan/{id} 详情、
 * GET /api/agent-plan/{id}/tasks 任务勾选态、GET /api/agent-plan/{id}/versions 版本历史;
 * 版本切换时懒加载 GET /api/agent-plan/{id}/versions/diff?from_version=1&to_version=v(page.tsx:148-163)。
 * 端点封装:@ihui/api-client 的 getAgentPlan(既有 agent-plan.ts)与本席新增 agent-plan-progress.ts;
 * 后端 apps/ai-service/app/routers/agent_plan.py:259/353/290/308,信封 {code,message,data}。
 * 口径差:web 的「最近查看」localStorage 伪列表未承载(RN 无同义存储),其余分区同构。
 */
export function AgentPlanProgressScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()

  const [planIdInput, setPlanIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AgentPlanDetail | null>(null)
  const [tasks, setTasks] = useState<PlanTaskView[]>([])
  const [summary, setSummary] = useState({ done: 0, total: 0, blocked: 0 })
  const [versions, setVersions] = useState<PlanVersionsResult | null>(null)
  const [selectedVersion, setSelectedVersion] = useState(1)
  const [diff, setDiff] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  const fmtDate = useCallback(
    (value: string | null | undefined): string => {
      if (!value) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return value
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const statusText = useCallback(
    (status: string): string => {
      const key = STATUS_LABEL_KEYS[status]
      return key ? t(`${NS}.${key}`) : status
    },
    [t],
  )

  const open = useCallback(async () => {
    const pid = planIdInput.trim()
    if (!pid) return
    setLoading(true)
    setError(null)
    setDiff('')
    setDiffError(null)
    try {
      const [d, tRes, vRes] = await Promise.all([
        getAgentPlan(pid),
        fetchAgentPlanTasks(pid),
        fetchAgentPlanVersions(pid),
      ])
      if (!d.success || !d.data) {
        setDetail(null)
        setTasks([])
        setVersions(null)
        setError(d.error ?? t(`${NS}.error`))
        return
      }
      setDetail(d.data)
      if (tRes.success && tRes.data) {
        setTasks(tRes.data.tasks ?? [])
        setSummary({
          done: tRes.data.summary?.done ?? 0,
          total: tRes.data.summary?.total ?? 0,
          blocked: tRes.data.summary?.blocked ?? 0,
        })
      } else {
        setTasks([])
        setSummary({ done: 0, total: 0, blocked: 0 })
      }
      if (vRes.success && vRes.data) {
        setVersions(vRes.data)
        setSelectedVersion(vRes.data.current_version ?? 1)
      } else {
        setVersions(null)
      }
    } catch {
      setDetail(null)
      setError(t(`${NS}.error`))
    } finally {
      setLoading(false)
    }
  }, [planIdInput, t])

  const selectVersion = useCallback(
    async (version: number) => {
      if (!detail || version === selectedVersion) return
      setSelectedVersion(version)
      setDiff('')
      setDiffError(null)
      setDiffLoading(true)
      try {
        const res = await fetchAgentPlanVersionDiff(detail.plan_id, 1, version)
        if (!res.success || !res.data) {
          setDiffError(res.error ?? t(`${NS}.error`))
          return
        }
        setDiff(res.data.diff || '')
      } catch {
        setDiffError(t(`${NS}.error`))
      } finally {
        setDiffLoading(false)
      }
    },
    [detail, selectedVersion, t],
  )

  const detailView = useMemo<AgentPlanProgressDetailView | null>(() => {
    if (!detail) return null
    return {
      planId: detail.plan_id,
      goal: detail.goal,
      statusText: statusText(detail.status),
      version: detail.version ?? 1,
      createdAt: fmtDate(detail.created_at),
      updatedAt: detail.updated_at ? fmtDate(detail.updated_at) : null,
      resultText: detail.result ? JSON.stringify(detail.result, null, 2) : null,
    }
  }, [detail, statusText, fmtDate])

  const taskRows = useMemo<AgentPlanTaskRowView[]>(
    () =>
      tasks.map((task) => ({
        id: task.task_id,
        order: task.order,
        title: task.title,
        status: task.status,
        statusText: TASK_STATUS_KEYS[task.status]
          ? t(`${NS}.${TASK_STATUS_KEYS[task.status]}`)
          : task.status,
      })),
    [tasks, t],
  )

  const versionRows = useMemo<AgentPlanVersionRowView[]>(
    () =>
      (versions?.versions ?? []).map((v) => ({
        version: v.version,
        channel: v.channel ?? '',
        reason: v.reason ?? '',
        createdAt: fmtDate(v.created_at),
      })),
    [versions, fmtDate],
  )

  return (
    <SharedAgentPlanProgressScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      planIdInput={planIdInput}
      onPlanIdChange={setPlanIdInput}
      onOpen={() => void open()}
      loading={loading}
      error={error}
      detail={detailView}
      tasks={taskRows}
      done={summary.done}
      total={summary.total}
      blocked={summary.blocked}
      versions={versionRows}
      currentVersion={versions?.current_version ?? 1}
      selectedVersion={selectedVersion}
      onSelectVersion={(version) => void selectVersion(version)}
      diff={diff}
      diffLoading={diffLoading}
      diffError={diffError}
      onCloseDetail={() => {
        setDetail(null)
        setTasks([])
        setVersions(null)
        setDiff('')
        setDiffError(null)
        setError(null)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
