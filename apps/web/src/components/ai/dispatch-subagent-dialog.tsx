// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * DispatchSubagentDialog - 派发 Subagent 对话框(2026-07-22 立,2026-07-23 超越 v3)。
 *
 * 落地 AGENTS.md §11 多 Subagent 并行开发强制规则的派单格式:
 *   ## 任务目标 / 受影响文件 / 禁止修改 / 验证命令 / 约束边界 / 交付物
 *
 * 超越 v3:
 *  - 4 标签页:派发 / 智能规划 / 自定义角色 / Agent 演化
 *  - 智能规划:LLM 推荐编排模式 + DAG + 预估
 *  - 自定义角色:CRUD + LLM 自动生成(超越固定 5 角色)
 *  - Agent 演化:prompt 版本历史 + LLM 复盘 + 补丁应用
 *
 * UI:
 *  - shadcn Dialog(max-w-2xl,紧凑 text-xs 表单)
 *  - 禁 rounded-full / divide-y / 蓝色发光边框
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/common'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
} from '@ihui/ui-react'

import { Tooltip } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'
import { activeDispatchesKey, swarmTopologyKey } from '@/hooks/use-subagent-dispatch'
import type { SubagentRole, OrchestrationMode, SubagentDispatch } from '@ihui/shared/subagents'

interface DispatchSubagentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 可选:关联 agent 主表 id,派单运行轨迹持久化到 agent_tasks(2026-08-06 新增) */
  agentId?: string
}

const ROLE_OPTIONS: Array<{ value: SubagentRole; labelKey: string }> = [
  { value: 'researcher', labelKey: 'roles.researcher' },
  { value: 'coder', labelKey: 'roles.coder' },
  { value: 'reviewer', labelKey: 'roles.reviewer' },
  { value: 'architect', labelKey: 'roles.architect' },
  { value: 'debugger', labelKey: 'roles.debugger' },
]

const ORCHESTRATION_OPTIONS: Array<{
  value: OrchestrationMode
  labelKey: string
  descKey: string
}> = [
  { value: 'parallel', labelKey: 'orch.parallel', descKey: 'orchDesc.parallel' },
  { value: 'pipeline', labelKey: 'orch.pipeline', descKey: 'orchDesc.pipeline' },
  { value: 'decomposed', labelKey: 'orch.decomposed', descKey: 'orchDesc.decomposed' },
  { value: 'debate', labelKey: 'orch.debate', descKey: 'orchDesc.debate' },
  { value: 'vote', labelKey: 'orch.vote', descKey: 'orchDesc.vote' },
  {
    value: 'critique',
    labelKey: 'orch.critique',
    descKey: 'orchDesc.critique',
  },
  {
    value: 'with_communication',
    labelKey: 'orch.withCommunication',
    descKey: 'orchDesc.withCommunication',
  },
]

const PRIORITY_OPTIONS: Array<{
  value: 'low' | 'normal' | 'high' | 'urgent'
  labelKey: string
  color: string
}> = [
  { value: 'low', labelKey: 'priority.low', color: 'bg-muted text-muted-foreground' },
  {
    value: 'normal',
    labelKey: 'priority.normal',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  {
    value: 'high',
    labelKey: 'priority.high',
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  },
  {
    value: 'urgent',
    labelKey: 'priority.urgent',
    color: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
]

// ---------- 前端镜像类型(对齐后端 service 导出) ----------

interface AutoPlanAgent {
  role: string
  task: string
  depends_on: string[]
}
interface AutoPlanResult {
  orchestration: OrchestrationMode
  agents: AutoPlanAgent[]
  estimatedDuration: string
  estimatedCost: string
  reasoning: string
  topologyStats: Array<{ orchestration: string; successRate: number; sampleSize: number }>
  generatedAt: string
}

interface CustomRole {
  id: string
  role: string
  displayName: string
  systemPrompt: string
  skills: string[]
  recommendedTasks: string[]
  createdAt: string
  updatedAt: string
}

interface PromptPatch {
  originalText: string
  suggestedReplacement: string
  reason: string
}
interface EvolutionVersion {
  version: string
  prompt: string
  changes: PromptPatch[]
  createdAt: string
}
interface AgentEvolutionRecord {
  dispatchId: string
  agentRole: string
  taskDescription: string
  result: string
  retryCount: number
  userFeedback: string | undefined
  success: boolean
  durationMs: number
  tokenUsage: number
  recordedAt: string
}
interface EvolutionHistory {
  agentRole: string
  currentPrompt: string
  versions: EvolutionVersion[]
  recentRecords: AgentEvolutionRecord[]
}
interface EvolutionAnalysis {
  agentRole: string
  scannedRecords: number
  needsEvolution: boolean
  patches: PromptPatch[]
  summary: string
  analyzedAt: string
}

interface DagNodeInput {
  id: string
  agentRole: SubagentRole
  task: string
}
interface DagEdgeInput {
  /** 稳定 uid,仅用于 React key(可变列表删除中间项时避免 DOM 复用错乱) */
  uid: string
  from: string
  to: string
  condition: string
}

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

export function DispatchSubagentDialog({
  open,
  onOpenChange,
  agentId,
}: DispatchSubagentDialogProps) {
  const tchat = useTranslations('aiChat')
  const t = useTranslations('dispatchDialog')
  const [activeTab, setActiveTab] = React.useState('dispatch')

  React.useEffect(() => {
    if (open) setActiveTab('dispatch')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-3">
        <DialogHeader>
          <DialogTitle className="text-base">{tchat('dispatchSubagent')}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="dispatch" className="flex-1 text-xs">
              {t('dispatchAction')}
            </TabsTrigger>
            <TabsTrigger value="auto-plan" className="flex-1 text-xs">
              {t('autoPlan')}
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-1 text-xs">
              {t('customRolesTab')}
            </TabsTrigger>
            <TabsTrigger value="evolution" className="flex-1 text-xs">
              {t('evolutionTab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dispatch">
            <DispatchForm onOpenChange={onOpenChange} agentId={agentId} />
          </TabsContent>
          <TabsContent value="auto-plan">
            <AutoPlanPanel />
          </TabsContent>
          <TabsContent value="roles">
            <CustomRolesPanel />
          </TabsContent>
          <TabsContent value="evolution">
            <EvolutionPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// Tab 1: 派发表单(原有功能)
// ===========================================================================

function DispatchForm({
  onOpenChange,
  agentId,
}: {
  onOpenChange: (open: boolean) => void
  agentId?: string
}) {
  const t = useTranslations('dispatchDialog')
  const tcommon = useTranslations('common')
  const queryClient = useQueryClient()

  const [goal, setGoal] = React.useState('')
  const [agentRole, setAgentRole] = React.useState<SubagentRole>('coder')
  const [orchestration, setOrchestration] = React.useState<OrchestrationMode>('parallel')
  const [affectedFilesText, setAffectedFilesText] = React.useState('')
  const [forbiddenText, setForbiddenText] = React.useState(() => t('defaultForbidden'))
  const [verifyCommandsText, setVerifyCommandsText] = React.useState('')
  const [constraints, setConstraints] = React.useState('')
  const [deliverables, setDeliverables] = React.useState('')
  const [maxAttempts, setMaxAttempts] = React.useState(1)
  const [delayMs, setDelayMs] = React.useState(1000)
  const [priority, setPriority] = React.useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [enableQuotas, setEnableQuotas] = React.useState(false)
  const [timeoutMs, setTimeoutMs] = React.useState(300000)
  const [tokenQuota, setTokenQuota] = React.useState(50000)
  const [quotaRetries, setQuotaRetries] = React.useState(2)
  const [enableDag, setEnableDag] = React.useState(false)
  const [dagNodes, setDagNodes] = React.useState<DagNodeInput[]>([
    { id: 'node1', agentRole: 'researcher', task: t('defaultDagNodeTask') },
  ])
  const [dagEdges, setDagEdges] = React.useState<DagEdgeInput[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [successDispatchId, setSuccessDispatchId] = React.useState<string | null>(null)

  const orchestrationDescKey = ORCHESTRATION_OPTIONS.find((o) => o.value === orchestration)?.descKey

  const canSubmit =
    goal.trim().length > 0 &&
    affectedFilesText.trim().length > 0 &&
    constraints.trim().length > 0 &&
    deliverables.trim().length > 0 &&
    !isSubmitting &&
    (!enableDag || dagNodes.length > 0)

  const addDagNode = () => {
    const newId = `node${dagNodes.length + 1}-${Math.random().toString(36).slice(2, 5)}`
    setDagNodes([...dagNodes, { id: newId, agentRole: 'coder', task: '' }])
  }
  const removeDagNode = (id: string) => {
    setDagNodes(dagNodes.filter((n) => n.id !== id))
    setDagEdges(dagEdges.filter((e) => e.from !== id && e.to !== id))
  }
  const updateDagNode = (id: string, field: 'agentRole' | 'task', value: string) => {
    setDagNodes(dagNodes.map((n) => (n.id === id ? { ...n, [field]: value } : n)))
  }
  const addDagEdge = () => {
    if (dagNodes.length < 2) return
    setDagEdges([
      ...dagEdges,
      {
        uid: Math.random().toString(36).slice(2, 10),
        from: dagNodes[0]!.id,
        to: dagNodes[1]!.id,
        condition: '',
      },
    ])
  }
  const removeDagEdge = (idx: number) => setDagEdges(dagEdges.filter((_, i) => i !== idx))
  const updateDagEdge = (idx: number, field: 'from' | 'to' | 'condition', value: string) => {
    setDagEdges(dagEdges.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        goal: goal.trim(),
        affectedFiles: linesToArray(affectedFilesText),
        forbidden: linesToArray(forbiddenText),
        verifyCommands: linesToArray(verifyCommandsText),
        constraints: constraints.trim(),
        deliverables: deliverables.trim(),
        agentRole,
        orchestration,
        priority,
        retry: maxAttempts > 1 ? { maxAttempts, delayMs } : undefined,
      }
      // 2026-08-06: 从 agents 详情页派发时带 agentId,派单运行轨迹落 agent_tasks
      if (agentId) body.agentId = agentId
      if (enableQuotas) body.quotas = { timeoutMs, tokenQuota, maxRetries: quotaRetries }
      if (enableDag && dagNodes.length > 0) {
        body.dag = {
          nodes: dagNodes.map((n) => ({ id: n.id, agentRole: n.agentRole, task: n.task })),
          edges: dagEdges.map((e) => ({
            from: e.from,
            to: e.to,
            ...(e.condition.trim() ? { condition: e.condition.trim() } : {}),
          })),
        }
        body.orchestration = 'parallel'
      }
      const r = await fetchApi<{ dispatch: SubagentDispatch }>('/api/subagents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) {
        if (r.status === 429)
          toast.error(t('toastConcurrencyLimit'), { description: t('toastConcurrencyLimitDesc') })
        else if (r.status === 400) toast.error(t('toastBadRequest'), { description: r.error })
        else toast.error(t('toastDispatchFailed'), { description: r.error })
        return
      }
      if (!r.data?.dispatch) {
        toast.error(t('toastDispatchFailed'), { description: t('toastResponseMissing') })
        return
      }
      setSuccessDispatchId(r.data.dispatch.id)
      toast.success(t('toastDispatched'), { description: t('toastPriorityDesc', { priority }) })
      void queryClient.invalidateQueries({ queryKey: activeDispatchesKey })
      void queryClient.invalidateQueries({ queryKey: swarmTopologyKey })
    } catch (e) {
      toast.error(t('toastDispatchFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successDispatchId) {
    return (
      <div className="space-y-3 py-4 text-xs">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
          <div className="font-medium text-emerald-700 dark:text-emerald-400">
            {t('dispatchSuccess')}
          </div>
          <div className="mt-1 text-muted-foreground">
            Dispatch ID:
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {successDispatchId}
            </code>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {tcommon('close')}
          </Button>
          <Button
            size="sm"
            onClick={() => setSuccessDispatchId(null)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {t('dispatchAnother')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2 pr-1 text-xs">
      <Field label={t('fields.goal')} required>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder={t('taskGoalPlaceholder')}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('fields.agentRole')}>
          <Select value={agentRole} onValueChange={(v) => setAgentRole(v as SubagentRole)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {t(o.labelKey)}({o.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('fields.orchestration')}>
          <Select
            value={orchestration}
            onValueChange={(v) => setOrchestration(v as OrchestrationMode)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORCHESTRATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {t(o.labelKey)}({o.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {orchestrationDescKey && (
        <div className="rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {t(orchestrationDescKey)}
        </div>
      )}
      <Field label={t('fields.priority')}>
        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPriority(o.value)}
              className={
                'flex-1 rounded-sm border px-2 py-1 text-[11px] font-medium transition-colors ' +
                (priority === o.value
                  ? `border-foreground/20 ${o.color}`
                  : 'border-border bg-background text-muted-foreground hover:bg-muted')
              }
            >
              {t(o.labelKey)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('fields.affectedFiles')} required>
        <textarea
          value={affectedFilesText}
          onChange={(e) => setAffectedFilesText(e.target.value)}
          rows={3}
          placeholder={'d:\\path\\to\\file1\nd:\\path\\to\\file2'}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.forbidden')}>
        <textarea
          value={forbiddenText}
          onChange={(e) => setForbiddenText(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.verifyCommands')}>
        <textarea
          value={verifyCommandsText}
          onChange={(e) => setVerifyCommandsText(e.target.value)}
          rows={2}
          placeholder={'pnpm --filter @ihui/api typecheck'}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.constraints')} required>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.deliverables')} required>
        <textarea
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      {/* DAG 编辑器 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={enableDag}
            onChange={(e) => setEnableDag(e.target.checked)}
            className="h-3 w-3 rounded-sm"
          />
          <span>{t('dagTitle')}</span>
        </label>
        {enableDag && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{t('dagNodes')}</span>
                <button
                  type="button"
                  onClick={addDagNode}
                  className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
                >
                  {t('dagAddNode')}
                </button>
              </div>
              {dagNodes.map((node) => (
                <div key={node.id} className="flex items-center gap-1.5">
                  <Tooltip content={node.id}>
                    <code className="w-16 shrink-0 truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                      {node.id.slice(0, 8)}
                    </code>
                  </Tooltip>
                  <select
                    value={node.agentRole}
                    onChange={(e) => updateDagNode(node.id, 'agentRole', e.target.value)}
                    className="h-6 w-24 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={node.task}
                    onChange={(e) => updateDagNode(node.id, 'task', e.target.value)}
                    placeholder={t('taskDescPlaceholder')}
                    className="h-6 flex-1 rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeDagNode(node.id)}
                    className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{t('dagEdgesOptional')}</span>
                <button
                  type="button"
                  onClick={addDagEdge}
                  disabled={dagNodes.length < 2}
                  className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-40"
                >
                  {t('dagAddEdge')}
                </button>
              </div>
              {dagEdges.map((edge, idx) => (
                <div key={edge.uid} className="flex items-center gap-1">
                  <select
                    value={edge.from}
                    onChange={(e) => updateDagEdge(idx, 'from', e.target.value)}
                    className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {dagNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <select
                    value={edge.to}
                    onChange={(e) => updateDagEdge(idx, 'to', e.target.value)}
                    className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {dagNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={edge.condition}
                    onChange={(e) => updateDagEdge(idx, 'condition', e.target.value)}
                    placeholder={t('conditionPlaceholder')}
                    className="h-6 flex-1 rounded-sm border border-input bg-transparent px-1.5 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeDagEdge(idx)}
                    className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 重试 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <span className="text-xs font-medium text-foreground">{t('retrySection')}</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{t('fields.retryCount')}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxAttempts(n)}
                  className={
                    'h-6 w-6 rounded-sm border text-[11px] font-medium transition-colors ' +
                    (maxAttempts === n
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted')
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {maxAttempts > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">{t('interval')}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value || '0', 10)))}
                className="h-6 w-16 rounded-sm border border-input bg-transparent px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-[11px] text-muted-foreground">ms</span>
            </div>
          )}
        </div>
      </div>
      {/* 配额 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={enableQuotas}
            onChange={(e) => setEnableQuotas(e.target.checked)}
            className="h-3 w-3 rounded-sm"
          />
          <span>{t('quotasSection')}</span>
        </label>
        {enableQuotas && (
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
            <div>
              <div className="text-[10px] text-muted-foreground">{t('fields.timeoutMs')}</div>
              <input
                type="number"
                min={1000}
                step={1000}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Math.max(1000, parseInt(e.target.value || '0', 10)))}
                className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">{t('fields.tokenQuota')}</div>
              <input
                type="number"
                min={1000}
                step={1000}
                value={tokenQuota}
                onChange={(e) => setTokenQuota(Math.max(1000, parseInt(e.target.value || '0', 10)))}
                className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">{t('fields.maxRetries')}</div>
              <input
                type="number"
                min={0}
                max={3}
                value={quotaRetries}
                onChange={(e) =>
                  setQuotaRetries(Math.min(3, Math.max(0, parseInt(e.target.value || '0', 10))))
                }
                className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2 min-[640px]:flex-nowrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
          className="shrink-0"
        >
          <span className="whitespace-nowrap">{tcommon('cancel')}</span>
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
        >
          <span className="whitespace-nowrap">
            {isSubmitting ? t('dispatching') : t('dispatchAction')}
          </span>
        </Button>
      </DialogFooter>
    </div>
  )
}

// ===========================================================================
// Tab 2: 智能规划(LLM 推荐编排)
// ===========================================================================

function AutoPlanPanel() {
  const t = useTranslations('dispatchDialog')
  const [task, setTask] = React.useState('')
  const [maxAgents, setMaxAgents] = React.useState<number | ''>('')
  const [isPlanning, setIsPlanning] = React.useState(false)
  const [result, setResult] = React.useState<AutoPlanResult | null>(null)

  const handlePlan = async () => {
    if (task.trim().length === 0) return
    setIsPlanning(true)
    try {
      const body: Record<string, unknown> = { task: task.trim() }
      if (maxAgents !== '') body.constraints = { maxAgents }
      const r = await fetchApi<AutoPlanResult>('/api/subagents/auto-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) {
        toast.error(t('autoPlanFailed'), { description: r.error })
        return
      }
      if (r.data) setResult(r.data)
      toast.success(t('autoPlanDone'))
    } catch (e) {
      toast.error(t('autoPlanFailed'), { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsPlanning(false)
    }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2 pr-1 text-xs">
      <Field label={t('fields.taskDesc')} required>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          placeholder={t('examplePlaceholder')}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.constraintsOptional')}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{t('maxAgentsLabel')}</span>
          <input
            type="number"
            min={1}
            max={20}
            value={maxAgents}
            onChange={(e) => setMaxAgents(e.target.value ? parseInt(e.target.value, 10) : '')}
            className="h-6 w-16 rounded-sm border border-input bg-transparent px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </Field>
      <Button
        size="sm"
        onClick={handlePlan}
        disabled={task.trim().length === 0 || isPlanning}
        className="w-full bg-violet-600 text-white hover:bg-violet-700"
      >
        {isPlanning ? t('llmPlanning') : t('autoPlan')}
      </Button>
      {result && (
        <div className="space-y-2 rounded-md border border-border bg-card px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
              {result.orchestration}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t('estimateSummary', {
                duration: result.estimatedDuration,
                cost: result.estimatedCost,
              })}
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-foreground">{t('recommendedAgents')}</div>
            {result.agents.map((agent, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <code className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {agent.role}
                </code>
                <span className="flex-1 min-w-0 text-muted-foreground">{agent.task}</span>
                {agent.depends_on.length > 0 && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">
                    ← {agent.depends_on.join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{t('reasoningLabel')}</span>
            {result.reasoning}
          </div>
          {result.topologyStats.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium text-muted-foreground">
                {t('topologyStatsTitle')}
              </div>
              {result.topologyStats.map((s, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  {t('topologyStatLine', {
                    orchestration: s.orchestration,
                    rate: Math.round(s.successRate * 100),
                    samples: s.sampleSize,
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Tab 3: 自定义角色管理(CRUD + LLM 自动生成)
// ===========================================================================

function CustomRolesPanel() {
  const t = useTranslations('dispatchDialog')
  const tcommon = useTranslations('common')
  const [roles, setRoles] = React.useState<CustomRole[]>([])
  const [loading, setLoading] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<CustomRole | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  // 自动生成
  const [autoGenTask, setAutoGenTask] = React.useState('')
  const [isGenerating, setIsGenerating] = React.useState(false)

  const loadRoles = React.useCallback(async (isCancelled?: () => boolean) => {
    setLoading(true)
    try {
      const r = await fetchApi<{ roles: CustomRole[] }>('/api/subagents/roles/custom')
      if (isCancelled?.()) return
      if (r.success && r.data) setRoles(r.data.roles)
    } catch {
      // 静默
    } finally {
      if (!isCancelled?.()) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void loadRoles(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadRoles])

  const handleDelete = async (id: string) => {
    try {
      const r = await fetchApi<{ deleted: boolean }>(`/api/subagents/roles/custom/${id}`, {
        method: 'DELETE',
      })
      if (r.success) {
        toast.success(t('roleDeleted'))
        void loadRoles()
      } else toast.error(t('roleDeleteFailed'), { description: r.error })
    } catch (e) {
      toast.error(t('roleDeleteFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const handleAutoGenerate = async () => {
    if (autoGenTask.trim().length === 0) return
    setIsGenerating(true)
    try {
      const r = await fetchApi<{
        role: string
        displayName: string
        systemPrompt: string
        skills: string[]
        recommendedTasks: string[]
        reasoning: string
      }>('/api/subagents/roles/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: autoGenTask.trim() }),
      })
      if (!r.success) {
        toast.error(t('roleAutoGenFailed'), { description: r.error })
        return
      }
      if (r.data) {
        setEditingRole(null)
        setShowForm(true)
        // 预填表单
        setRoles((prev) => prev) // no-op, form will handle
        toast.success(t('roleGenerated'), { description: r.data.displayName })
        // 传递到表单 - 用 editingRole 伪 null + 独立 state
        setAutoGenTask('')
        // 直接创建
        const createR = await fetchApi<{ role: CustomRole }>('/api/subagents/roles/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: r.data.role,
            displayName: r.data.displayName,
            systemPrompt: r.data.systemPrompt,
            skills: r.data.skills,
            recommendedTasks: r.data.recommendedTasks,
          }),
        })
        if (createR.success) {
          toast.success(t('roleSaved'))
          void loadRoles()
        }
      }
    } catch (e) {
      toast.error(t('roleAutoGenFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (showForm) {
    return (
      <CustomRoleForm
        existing={editingRole}
        onDone={() => {
          setShowForm(false)
          setEditingRole(null)
          void loadRoles()
        }}
        onCancel={() => {
          setShowForm(false)
          setEditingRole(null)
        }}
      />
    )
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2 pr-1 text-xs">
      {/* 自动生成 */}
      <div className="space-y-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
        <div className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
          {t('autoGenTitle')}
        </div>
        <textarea
          value={autoGenTask}
          onChange={(e) => setAutoGenTask(e.target.value)}
          rows={2}
          placeholder={t('roleDescPlaceholder')}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          size="sm"
          onClick={handleAutoGenerate}
          disabled={autoGenTask.trim().length === 0 || isGenerating}
          className="w-full bg-violet-600 text-white hover:bg-violet-700"
        >
          {isGenerating ? t('llmGenerating') : t('autoGenAndSave')}
        </Button>
      </div>
      {/* 角色列表 */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">
          {t('customRolesCount', { n: roles.length })}
        </span>
        <button
          type="button"
          onClick={() => {
            setEditingRole(null)
            setShowForm(true)
          }}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
        >
          {t('manualCreate')}
        </button>
      </div>
      {loading ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">
          {t('evolutionLoading')}
        </div>
      ) : roles.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">{t('rolesEmpty')}</div>
      ) : (
        <div className="space-y-1.5">
          {roles.map((role) => (
            <div key={role.id} className="rounded-md border border-border bg-card px-2.5 py-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{role.displayName}</span>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {role.role}
                  </code>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRole(role)
                      setShowForm(true)
                    }}
                    className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role.id)}
                    className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                  >
                    {tcommon('delete')}
                  </button>
                </div>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {role.systemPrompt}
              </div>
              {role.skills.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {role.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomRoleForm({
  existing,
  onDone,
  onCancel,
}: {
  existing: CustomRole | null
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations('dispatchDialog')
  const tcommon = useTranslations('common')
  const [role, setRole] = React.useState(existing?.role ?? '')
  const [displayName, setDisplayName] = React.useState(existing?.displayName ?? '')
  const [systemPrompt, setSystemPrompt] = React.useState(existing?.systemPrompt ?? '')
  const [skillsText, setSkillsText] = React.useState((existing?.skills ?? []).join(', '))
  const [tasksText, setTasksText] = React.useState((existing?.recommendedTasks ?? []).join(', '))
  const [isSaving, setIsSaving] = React.useState(false)

  const canSave = role.trim() && displayName.trim() && systemPrompt.trim() && !isSaving

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const body = {
        role: role.trim(),
        displayName: displayName.trim(),
        systemPrompt: systemPrompt.trim(),
        skills: linesToArray(skillsText.replace(/,/g, '\n')),
        recommendedTasks: linesToArray(tasksText.replace(/,/g, '\n')),
      }
      const url = existing
        ? `/api/subagents/roles/custom/${existing.id}`
        : '/api/subagents/roles/custom'
      const method = existing ? 'PUT' : 'POST'
      const r = await fetchApi<{ role: CustomRole }>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.success) {
        toast.success(existing ? t('roleUpdated') : t('roleCreated'))
        onDone()
      } else toast.error(t('roleSaveFailed'), { description: r.error })
    } catch (e) {
      toast.error(t('roleSaveFailed'), { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2 pr-1 text-xs">
      <div className="text-[11px] font-medium text-foreground">
        {existing ? t('editRole') : t('createRole')}
      </div>
      <Field label={t('fields.roleKey')} required>
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="drizzle-migration-expert"
          className="h-8 text-xs"
          disabled={!!existing}
        />
      </Field>
      <Field label={t('fields.displayName')} required>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('displayNameExample')}
          className="h-8 text-xs"
        />
      </Field>
      <Field label="System Prompt" required>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <Field label={t('fields.skills')}>
        <Input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="drizzle, postgresql, migration"
          className="h-8 text-xs"
        />
      </Field>
      <Field label={t('fields.recommendedTasks')}>
        <Input
          value={tasksText}
          onChange={(e) => setTasksText(e.target.value)}
          placeholder={t('recommendedTasksExample')}
          className="h-8 text-xs"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          {tcommon('cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isSaving ? t('saving') : tcommon('save')}
        </Button>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 4: Agent 演化(版本历史 + LLM 复盘 + 补丁应用)
// ===========================================================================

function EvolutionPanel() {
  const t = useTranslations('dispatchDialog')
  const [selectedRole, setSelectedRole] = React.useState<string>('coder')
  const [history, setHistory] = React.useState<EvolutionHistory | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [analysis, setAnalysis] = React.useState<EvolutionAnalysis | null>(null)
  const [applying, setApplying] = React.useState(false)

  const loadHistory = React.useCallback(async (role: string, isCancelled?: () => boolean) => {
    setLoading(true)
    try {
      const r = await fetchApi<EvolutionHistory>(`/api/subagents/agents/${role}/evolution-history`)
      if (isCancelled?.()) return
      if (r.success && r.data) setHistory(r.data)
      else setHistory(null)
    } catch {
      if (!isCancelled?.()) setHistory(null)
    } finally {
      if (!isCancelled?.()) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void loadHistory(selectedRole, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [selectedRole, loadHistory])

  const handleEvolve = async () => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const r = await fetchApi<EvolutionAnalysis>(`/api/subagents/agents/${selectedRole}/evolve`, {
        method: 'POST',
      })
      if (r.success && r.data) {
        setAnalysis(r.data)
        toast.success(t('evolutionAnalyzeSuccess'))
      } else toast.error(t('evolutionAnalyzeFailed'), { description: r.error })
    } catch (e) {
      toast.error(t('evolutionAnalyzeFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApply = async () => {
    if (!analysis || analysis.patches.length === 0) return
    setApplying(true)
    try {
      const r = await fetchApi<{ version: EvolutionVersion }>(
        `/api/subagents/agents/${selectedRole}/apply-evolution`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patches: analysis.patches }),
        },
      )
      if (r.success) {
        toast.success(t('evolutionApplySuccess'), { description: r.data?.version.version })
        setAnalysis(null)
        void loadHistory(selectedRole)
      } else toast.error(t('evolutionApplyFailed'), { description: r.error })
    } catch (e) {
      toast.error(t('evolutionApplyFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto py-2 pr-1 text-xs">
      <Field label={t('evolutionSelectRole')}>
        <Select
          value={selectedRole}
          onValueChange={(v) => {
            setSelectedRole(v)
            setAnalysis(null)
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {t(o.labelKey)}({o.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {loading ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">
          {t('evolutionLoading')}
        </div>
      ) : history ? (
        <>
          {/* 当前 prompt */}
          <div className="rounded-md border border-border bg-card px-2.5 py-2">
            <div className="text-[11px] font-medium text-foreground">
              {t('evolutionCurrentPrompt', {
                version:
                  history.versions.length > 0
                    ? history.versions[history.versions.length - 1]!.version
                    : t('evolutionInitialVersion'),
              })}
            </div>
            <div className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">
              {history.currentPrompt}
            </div>
          </div>

          {/* 版本历史 */}
          {history.versions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">
                {t('evolutionVersions', { n: history.versions.length })}
              </div>
              {history.versions.map((v) => (
                <div
                  key={v.version}
                  className="rounded-md border border-border bg-card px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                      {v.version}
                    </code>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(v.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {v.prompt}
                  </div>
                  {v.changes.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {v.changes.map((c, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground">
                          <span className="text-red-500">- {c.originalText.slice(0, 40)}</span>
                          {' → '}
                          <span className="text-green-600">
                            + {c.suggestedReplacement.slice(0, 40)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 最近任务记录 */}
          {history.recentRecords.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">
                {t('evolutionRecentRecords', { n: history.recentRecords.length })}
              </div>
              {history.recentRecords.slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-[10px]"
                >
                  <span className={r.success ? 'text-green-600' : 'text-red-500'}>
                    {r.success ? '✓' : '✗'}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">{r.taskDescription}</span>
                  {r.retryCount > 0 && (
                    <span className="text-orange-500">
                      {t('evolutionRetry', { n: r.retryCount })}
                    </span>
                  )}
                  <span className="text-muted-foreground/60">
                    {Math.round(r.durationMs / 1000)}s
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* LLM 复盘 */}
          <Button
            size="sm"
            onClick={handleEvolve}
            disabled={analyzing}
            className="w-full bg-amber-600 text-white hover:bg-amber-700"
          >
            {analyzing ? t('evolutionAnalyzing') : t('evolutionTrigger')}
          </Button>

          {analysis && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                {analysis.needsEvolution
                  ? t('evolutionSuggestEvolve', { n: analysis.patches.length })
                  : t('evolutionNoEvolve')}
              </div>
              <div className="text-[11px] text-muted-foreground">{analysis.summary}</div>
              {analysis.patches.map((p, i) => (
                <div key={i} className="rounded-sm border border-border bg-card px-2 py-1">
                  <div className="text-[10px] text-red-500">- {p.originalText}</div>
                  <div className="text-[10px] text-green-600">+ {p.suggestedReplacement}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {t('evolutionReason')} {p.reason}
                  </div>
                </div>
              ))}
              {analysis.needsEvolution && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full bg-amber-600 text-white hover:bg-amber-700"
                >
                  {applying ? t('evolutionApplying') : t('evolutionApply')}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="py-4 text-center text-[11px] text-muted-foreground">
          {t('evolutionEmpty')}
        </div>
      )}
    </div>
  )
}

/** 紧凑表单字段(label + children) */
function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-foreground">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export default DispatchSubagentDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
