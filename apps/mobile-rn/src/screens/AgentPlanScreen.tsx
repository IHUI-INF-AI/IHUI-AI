// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createAgentPlan,
  decideAgentPlan,
  type AgentPlanDetail,
  type AgentPlanResult,
} from '@ihui/api-client'
import {
  AgentPlanScreen as SharedAgentPlanScreen,
  type AgentPlanPhase,
  type AgentPlanResultView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'agentPlanPage'

/** 与 web agentPlan 命名空间状态键同表(apps/web/src/components/agent-plan/StatusBadge.tsx 语义),值=本页 ns 键 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'statusDraft',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  executing: 'statusExecuting',
  done: 'statusDone',
  failed: 'statusFailed',
}

function toResultView(result: AgentPlanResult | null): AgentPlanResultView | null {
  if (!result) return null
  return {
    stopReason: String(result.stop_reason ?? ''),
    iterations: String(result.iterations ?? 0),
    error: result.error ? String(result.error) : null,
    finalResponse: String(result.final_response ?? ''),
  }
}

/**
 * RN 端「Agent 计划模式」薄壳 —— 承载 web /agent-plan。
 *
 * 取数走与 web 同一封装 @ihui/api-client/endpoints/agent-plan:
 * POST /api/agent-plan 创建(apps/ai-service/app/routers/agent_plan.py:241)、
 * GET /api/agent-plan/{id} 查询(:259)、POST /api/agent-plan/{id}/decision 批准/拒绝(:399);
 * 信封 {code,message,data} 经 fetchApi 拆壳(ApiResult)。阶段机与 web AgentPlanStudio 同序。
 * 如实登记:apps/api 无 /api/agent-plan 前缀注册(web 由 next rewrites 直转 8803,
 * apps/web/next.config.ts:320),RN 通道依赖同一网关转发。
 */
export function AgentPlanScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [phase, setPhase] = useState<AgentPlanPhase>('input')
  const [goal, setGoal] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [model, setModel] = useState('')
  const [detail, setDetail] = useState<AgentPlanDetail | null>(null)
  const [editedMd, setEditedMd] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const humanize = useCallback(
    (status: string): string => {
      const key = STATUS_LABEL_KEYS[status]
      return key ? t(`${NS}.${key}`) : status
    },
    [t],
  )

  const handleGenerate = useCallback(async () => {
    if (!goal.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await createAgentPlan({
        goal: goal.trim(),
        session_id: sessionId.trim() || undefined,
        model: model.trim() || undefined,
      })
      if (!res.success || !res.data) {
        setError(res.error ?? t(`${NS}.loadFailed`))
        return
      }
      setDetail({
        plan_id: res.data.plan_id,
        goal: goal.trim(),
        status: 'draft',
        plan_md: res.data.plan_md,
        readonly_tools: res.data.readonly_tools,
        session_id: sessionId.trim() || null,
        created_at: '',
        updated_at: '',
        result: null,
      })
      setEditedMd(res.data.plan_md)
      setEditing(false)
      setPhase('plan')
    } catch {
      setError(t(`${NS}.loadFailed`))
    } finally {
      setBusy(false)
    }
  }, [goal, sessionId, model, busy, t])

  const handleDecision = useCallback(
    async (approve: boolean) => {
      if (!detail || busy) return
      setBusy(true)
      setError(null)
      try {
        const res = await decideAgentPlan(detail.plan_id, {
          approve,
          edited_plan_md: approve ? editedMd : undefined,
        })
        if (!res.success || !res.data) {
          setError(res.error ?? t(`${NS}.loadFailed`))
          return
        }
        setDetail({
          ...detail,
          status: res.data.status,
          result: res.data.result,
          plan_md: approve ? editedMd : detail.plan_md,
        })
        setEditing(false)
        setPhase('result')
      } catch {
        setError(t(`${NS}.loadFailed`))
      } finally {
        setBusy(false)
      }
    },
    [detail, busy, editedMd, t],
  )

  const handleReset = useCallback(() => {
    setPhase('input')
    setDetail(null)
    setEditedMd('')
    setEditing(false)
    setError(null)
  }, [])

  return (
    <SharedAgentPlanScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      phase={phase}
      goal={goal}
      sessionId={sessionId}
      model={model}
      onGoalChange={setGoal}
      onSessionIdChange={setSessionId}
      onModelChange={setModel}
      busy={busy}
      error={error}
      planId={detail?.plan_id ?? null}
      planMd={editing ? editedMd : (detail?.plan_md ?? '')}
      readonlyTools={detail?.readonly_tools ?? []}
      status={detail?.status ?? 'draft'}
      statusText={humanize(detail?.status ?? 'draft')}
      editing={editing}
      editedMd={editedMd}
      onEditedMdChange={setEditedMd}
      onToggleEdit={() => setEditing((v) => !v)}
      result={toResultView(detail?.result ?? null)}
      rejected={detail?.status === 'rejected'}
      onGenerate={() => void handleGenerate()}
      onApprove={() => void handleDecision(true)}
      onReject={() => void handleDecision(false)}
      onReset={handleReset}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
