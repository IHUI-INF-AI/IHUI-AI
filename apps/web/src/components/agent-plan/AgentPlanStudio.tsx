// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@ihui/ui-react'
import { useToast } from '@/hooks/use-toast'
import {
  createAgentPlan,
  decideAgentPlan,
  type AgentPlanDetail,
  type CreateAgentPlanInput,
} from '@ihui/api-client'
import { AgentPlanInput } from './AgentPlanInput'
import { AgentPlanView } from './AgentPlanView'
import { AgentPlanResult } from './AgentPlanResult'

type Phase = 'input' | 'plan' | 'result'

/** 决策/生成接口失败分支类型(从端点返回推导,避免直接依赖 @ihui/types)。 */
type PlanApiFailure = Extract<Awaited<ReturnType<typeof createAgentPlan>>, { success: false }>

/** 把失败的 ApiResult 归一化为用户可见文案(404/409 映射专用 key,其余用后端 error)。 */
function toErrorMessage(t: (key: string) => string, res: PlanApiFailure): string {
  if (res.status === 404) return t('notFound')
  if (res.status === 409) return t('conflict')
  return res.error || t('generic')
}

export function AgentPlanStudio() {
  const t = useTranslations('agentPlan')
  const { error: toastError } = useToast()
  const [phase, setPhase] = useState<Phase>('input')
  const [detail, setDetail] = useState<AgentPlanDetail | null>(null)
  const [editedMd, setEditedMd] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleGenerate = async (input: CreateAgentPlanInput) => {
    setBusy(true)
    const res = await createAgentPlan(input)
    setBusy(false)
    if (!res.success) {
      toastError(toErrorMessage(t, res))
      return
    }
    const created: AgentPlanDetail = {
      plan_id: res.data.plan_id,
      goal: input.goal,
      status: 'draft',
      plan_md: res.data.plan_md,
      readonly_tools: res.data.readonly_tools,
      session_id: input.session_id ?? null,
      created_at: '',
      updated_at: '',
      result: null,
    }
    setDetail(created)
    setEditedMd(res.data.plan_md)
    setIsEditing(false)
    setPhase('plan')
  }

  const handleDecision = async (approve: boolean) => {
    if (!detail) return
    // decision 批准是同步阻塞(分钟级),busy 期间禁用按钮防重复提交
    setBusy(true)
    const res = await decideAgentPlan(detail.plan_id, {
      approve,
      edited_plan_md: approve ? editedMd : undefined,
    })
    setBusy(false)
    if (!res.success) {
      toastError(toErrorMessage(t, res))
      return
    }
    setDetail({ ...detail, status: res.data.status, result: res.data.result })
    setIsEditing(false)
    setPhase('result')
  }

  const handleReset = () => {
    setPhase('input')
    setDetail(null)
    setEditedMd('')
    setIsEditing(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {phase === 'input' && <AgentPlanInput busy={busy} onGenerate={handleGenerate} />}
          {phase === 'plan' && detail && (
            <AgentPlanView
              detail={detail}
              busy={busy}
              editedMd={editedMd}
              isEditing={isEditing}
              onEditedMdChange={setEditedMd}
              onToggleEdit={() => setIsEditing((v) => !v)}
              onApprove={() => handleDecision(true)}
              onReject={() => handleDecision(false)}
            />
          )}
          {phase === 'result' && detail && (
            <AgentPlanResult detail={detail} onReset={handleReset} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
