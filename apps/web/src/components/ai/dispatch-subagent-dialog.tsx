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
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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

import { fetchApi } from '@/lib/api'
import { activeDispatchesKey, swarmTopologyKey } from '@/hooks/use-subagent-dispatch'
import type {
  SubagentRole,
  OrchestrationMode,
  SubagentDispatch,
} from '@ihui/types/subagent-dispatch'

interface DispatchSubagentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS: Array<{ value: SubagentRole; label: string }> = [
  { value: 'researcher', label: '研究助手(researcher)' },
  { value: 'coder', label: '代码助手(coder)' },
  { value: 'reviewer', label: '审查助手(reviewer)' },
  { value: 'architect', label: '架构师(architect)' },
  { value: 'debugger', label: '调试助手(debugger)' },
]

const ORCHESTRATION_OPTIONS: Array<{
  value: OrchestrationMode
  label: string
  desc: string
}> = [
  { value: 'parallel', label: '并行(parallel)', desc: '多个 agent 并行处理同一任务' },
  { value: 'pipeline', label: '串行(pipeline)', desc: '多个 agent 串行传递结果' },
  { value: 'decomposed', label: '分解式(decomposed)', desc: '任务分解为 DAG 子步骤执行' },
  { value: 'debate', label: '辩论(debate)', desc: '5 个 agent 独立处理 → LLM 仲裁选最佳 + 合并' },
  { value: 'vote', label: '投票(vote)', desc: '5 个 agent 独立处理 → 互相投票(1-5 分)选最佳' },
  { value: 'critique', label: '批判(critique)', desc: '多 agent 互相批判优化(3 轮:生成→批判→修订)' },
  { value: 'with_communication', label: '协作通信(with_communication)', desc: 'agent 间 Redis 消息总线通信(3 轮协作)' },
]

const PRIORITY_OPTIONS: Array<{ value: 'low' | 'normal' | 'high' | 'urgent'; label: string; color: string }> = [
  { value: 'low', label: '低', color: 'bg-muted text-muted-foreground' },
  { value: 'normal', label: '普通', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  { value: 'high', label: '高', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  { value: 'urgent', label: '紧急', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
]

const DEFAULT_FORBIDDEN = '任何不在上述清单的文件'

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
}: DispatchSubagentDialogProps) {
  const [activeTab, setActiveTab] = React.useState('dispatch')

  React.useEffect(() => {
    if (open) setActiveTab('dispatch')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">派发 Subagent</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="dispatch" className="flex-1 text-xs">派发</TabsTrigger>
            <TabsTrigger value="auto-plan" className="flex-1 text-xs">智能规划</TabsTrigger>
            <TabsTrigger value="roles" className="flex-1 text-xs">自定义角色</TabsTrigger>
            <TabsTrigger value="evolution" className="flex-1 text-xs">Agent 演化</TabsTrigger>
          </TabsList>
          <TabsContent value="dispatch">
            <DispatchForm onOpenChange={onOpenChange} />
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

function DispatchForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()

  const [goal, setGoal] = React.useState('')
  const [agentRole, setAgentRole] = React.useState<SubagentRole>('coder')
  const [orchestration, setOrchestration] = React.useState<OrchestrationMode>('parallel')
  const [affectedFilesText, setAffectedFilesText] = React.useState('')
  const [forbiddenText, setForbiddenText] = React.useState(DEFAULT_FORBIDDEN)
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
    { id: 'node1', agentRole: 'researcher', task: '调研需求' },
  ])
  const [dagEdges, setDagEdges] = React.useState<DagEdgeInput[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [successDispatchId, setSuccessDispatchId] = React.useState<string | null>(null)

  const orchestrationDesc = ORCHESTRATION_OPTIONS.find((o) => o.value === orchestration)?.desc

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
    setDagEdges([...dagEdges, { from: dagNodes[0]!.id, to: dagNodes[1]!.id, condition: '' }])
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
      if (enableQuotas) body.quotas = { timeoutMs, tokenQuota, maxRetries: quotaRetries }
      if (enableDag && dagNodes.length > 0) {
        body.dag = {
          nodes: dagNodes.map((n) => ({ id: n.id, agentRole: n.agentRole, task: n.task })),
          edges: dagEdges.map((e) => ({
            from: e.from, to: e.to,
            ...(e.condition.trim() ? { condition: e.condition.trim() } : {}),
          })),
        }
        body.orchestration = 'parallel'
      }
      const r = await fetchApi<{ dispatch: SubagentDispatch }>('/api/subagents/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!r.success) {
        if (r.status === 429) toast.error('并发派单数已达上限', { description: '请等待或用 urgent 优先级抢占' })
        else if (r.status === 400) toast.error('参数错误', { description: r.error })
        else toast.error('派发失败', { description: r.error })
        return
      }
      if (!r.data?.dispatch) { toast.error('派发失败', { description: '响应数据缺失' }); return }
      setSuccessDispatchId(r.data.dispatch.id)
      toast.success('已派发 Subagent', { description: `优先级:${priority}` })
      void queryClient.invalidateQueries({ queryKey: activeDispatchesKey })
      void queryClient.invalidateQueries({ queryKey: swarmTopologyKey })
    } catch (e) {
      toast.error('派发失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successDispatchId) {
    return (
      <div className="space-y-3 py-4 text-xs">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
          <div className="font-medium text-emerald-700 dark:text-emerald-400">派发成功</div>
          <div className="mt-1 text-muted-foreground">
            Dispatch ID:
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{successDispatchId}</code>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button size="sm" onClick={() => setSuccessDispatchId(null)} className="bg-emerald-600 text-white hover:bg-emerald-700">再派一个</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs">
      <Field label="任务目标" required>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2}
          placeholder="一句话描述任务目标"
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Agent 角色">
          <Select value={agentRole} onValueChange={(v) => setAgentRole(v as SubagentRole)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="编排模式">
          <Select value={orchestration} onValueChange={(v) => setOrchestration(v as OrchestrationMode)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ORCHESTRATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      {orchestrationDesc && (
        <div className="rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">{orchestrationDesc}</div>
      )}
      <Field label="优先级">
        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map((o) => (
            <button key={o.value} type="button" onClick={() => setPriority(o.value)}
              className={'flex-1 rounded-sm border px-2 py-1 text-[11px] font-medium transition-colors ' +
                (priority === o.value ? `border-foreground/20 ${o.color}` : 'border-border bg-background text-muted-foreground hover:bg-muted')}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="受影响文件(每行一个绝对路径)" required>
        <textarea value={affectedFilesText} onChange={(e) => setAffectedFilesText(e.target.value)} rows={3}
          placeholder={'d:\\path\\to\\file1\nd:\\path\\to\\file2'}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="禁止修改">
        <textarea value={forbiddenText} onChange={(e) => setForbiddenText(e.target.value)} rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="验证命令(每行一个)">
        <textarea value={verifyCommandsText} onChange={(e) => setVerifyCommandsText(e.target.value)} rows={2}
          placeholder={'pnpm --filter @ihui/api typecheck'}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="约束边界" required>
        <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="交付物" required>
        <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={2}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      {/* DAG 编辑器 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <input type="checkbox" checked={enableDag} onChange={(e) => setEnableDag(e.target.checked)} className="h-3 w-3 rounded-sm" />
          <span>DAG 依赖图</span>
        </label>
        {enableDag && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">节点</span>
                <button type="button" onClick={addDagNode} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">+ 节点</button>
              </div>
              {dagNodes.map((node) => (
                <div key={node.id} className="flex items-center gap-1.5">
                  <code className="w-16 shrink-0 truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]" title={node.id}>{node.id.slice(0, 8)}</code>
                  <select value={node.agentRole} onChange={(e) => updateDagNode(node.id, 'agentRole', e.target.value)} className="h-6 w-24 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring">
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label.split('(')[0]}</option>)}
                  </select>
                  <input type="text" value={node.task} onChange={(e) => updateDagNode(node.id, 'task', e.target.value)} placeholder="任务描述" className="h-6 flex-1 rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" />
                  <button type="button" onClick={() => removeDagNode(node.id)} className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10">×</button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">边(条件可选)</span>
                <button type="button" onClick={addDagEdge} disabled={dagNodes.length < 2} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-40">+ 边</button>
              </div>
              {dagEdges.map((edge, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <select value={edge.from} onChange={(e) => updateDagEdge(idx, 'from', e.target.value)} className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring">
                    {dagNodes.map((n) => <option key={n.id} value={n.id}>{n.id.slice(0, 8)}</option>)}
                  </select>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <select value={edge.to} onChange={(e) => updateDagEdge(idx, 'to', e.target.value)} className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring">
                    {dagNodes.map((n) => <option key={n.id} value={n.id}>{n.id.slice(0, 8)}</option>)}
                  </select>
                  <input type="text" value={edge.condition} onChange={(e) => updateDagEdge(idx, 'condition', e.target.value)} placeholder="条件" className="h-6 flex-1 rounded-sm border border-input bg-transparent px-1.5 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" />
                  <button type="button" onClick={() => removeDagEdge(idx)} className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 重试 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <span className="text-xs font-medium text-foreground">失败重试</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">重试次数</span>
            <div className="flex gap-0.5">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setMaxAttempts(n)}
                  className={'h-6 w-6 rounded-sm border text-[11px] font-medium transition-colors ' +
                    (maxAttempts === n ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-border bg-background text-muted-foreground hover:bg-muted')}>{n}</button>
              ))}
            </div>
          </div>
          {maxAttempts > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">间隔</span>
              <input type="number" min={0} step={100} value={delayMs} onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value || '0', 10)))} className="h-6 w-16 rounded-sm border border-input bg-transparent px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-[11px] text-muted-foreground">ms</span>
            </div>
          )}
        </div>
      </div>
      {/* 配额 */}
      <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <input type="checkbox" checked={enableQuotas} onChange={(e) => setEnableQuotas(e.target.checked)} className="h-3 w-3 rounded-sm" />
          <span>资源配额</span>
        </label>
        {enableQuotas && (
          <div className="grid grid-cols-3 gap-2">
            <div><div className="text-[10px] text-muted-foreground">超时(ms)</div>
              <input type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => setTimeoutMs(Math.max(1000, parseInt(e.target.value || '0', 10)))} className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><div className="text-[10px] text-muted-foreground">Token 上限</div>
              <input type="number" min={1000} step={1000} value={tokenQuota} onChange={(e) => setTokenQuota(Math.max(1000, parseInt(e.target.value || '0', 10)))} className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><div className="text-[10px] text-muted-foreground">最大重试</div>
              <input type="number" min={0} max={3} value={quotaRetries} onChange={(e) => setQuotaRetries(Math.min(3, Math.max(0, parseInt(e.target.value || '0', 10))))} className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>取消</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="bg-emerald-600 text-white hover:bg-emerald-700">{isSubmitting ? '派发中…' : '派发'}</Button>
      </DialogFooter>
    </div>
  )
}

// ===========================================================================
// Tab 2: 智能规划(LLM 推荐编排)
// ===========================================================================

function AutoPlanPanel() {
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!r.success) { toast.error('智能规划失败', { description: r.error }); return }
      if (r.data) setResult(r.data)
      toast.success('智能规划完成')
    } catch (e) {
      toast.error('智能规划失败', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsPlanning(false)
    }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs">
      <Field label="任务描述" required>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3}
          placeholder="重构用户认证模块,支持 OAuth2"
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="约束(可选)">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">最大 agent 数:</span>
          <input type="number" min={1} max={20} value={maxAgents} onChange={(e) => setMaxAgents(e.target.value ? parseInt(e.target.value, 10) : '')}
            className="h-6 w-16 rounded-sm border border-input bg-transparent px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </Field>
      <Button size="sm" onClick={handlePlan} disabled={task.trim().length === 0 || isPlanning} className="w-full bg-violet-600 text-white hover:bg-violet-700">
        {isPlanning ? 'LLM 规划中…' : '智能规划'}
      </Button>
      {result && (
        <div className="space-y-2 rounded-md border border-border bg-card px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
              {result.orchestration}
            </span>
            <span className="text-[11px] text-muted-foreground">预估 {result.estimatedDuration} · {result.estimatedCost}</span>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-foreground">推荐 Agent 组合</div>
            {result.agents.map((agent, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <code className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{agent.role}</code>
                <span className="flex-1 text-muted-foreground">{agent.task}</span>
                {agent.depends_on.length > 0 && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">← {agent.depends_on.join(', ')}</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">推理:</span>{result.reasoning}
          </div>
          {result.topologyStats.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium text-muted-foreground">历史编排统计</div>
              {result.topologyStats.map((s, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  {s.orchestration}:成功率 {Math.round(s.successRate * 100)}%({s.sampleSize} 次)
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
  const [roles, setRoles] = React.useState<CustomRole[]>([])
  const [loading, setLoading] = React.useState(false)
  const [editingRole, setEditingRole] = React.useState<CustomRole | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  // 自动生成
  const [autoGenTask, setAutoGenTask] = React.useState('')
  const [isGenerating, setIsGenerating] = React.useState(false)

  const loadRoles = React.useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchApi<{ roles: CustomRole[] }>('/api/subagents/roles/custom')
      if (r.success && r.data) setRoles(r.data.roles)
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void loadRoles() }, [loadRoles])

  const handleDelete = async (id: string) => {
    try {
      const r = await fetchApi<{ deleted: boolean }>(`/api/subagents/roles/custom/${id}`, { method: 'DELETE' })
      if (r.success) { toast.success('已删除'); void loadRoles() }
      else toast.error('删除失败', { description: r.error })
    } catch (e) { toast.error('删除失败', { description: e instanceof Error ? e.message : String(e) }) }
  }

  const handleAutoGenerate = async () => {
    if (autoGenTask.trim().length === 0) return
    setIsGenerating(true)
    try {
      const r = await fetchApi<{ role: string; displayName: string; systemPrompt: string; skills: string[]; recommendedTasks: string[]; reasoning: string }>(
        '/api/subagents/roles/auto-generate',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: autoGenTask.trim() }) },
      )
      if (!r.success) { toast.error('自动生成失败', { description: r.error }); return }
      if (r.data) {
        setEditingRole(null)
        setShowForm(true)
        // 预填表单
        setRoles((prev) => prev) // no-op, form will handle
        toast.success('已生成角色定义', { description: r.data.displayName })
        // 传递到表单 - 用 editingRole 伪 null + 独立 state
        setAutoGenTask('')
        // 直接创建
        const createR = await fetchApi<{ role: CustomRole }>('/api/subagents/roles/custom', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: r.data.role, displayName: r.data.displayName,
            systemPrompt: r.data.systemPrompt, skills: r.data.skills, recommendedTasks: r.data.recommendedTasks,
          }),
        })
        if (createR.success) { toast.success('已保存自定义角色'); void loadRoles() }
      }
    } catch (e) { toast.error('自动生成失败', { description: e instanceof Error ? e.message : String(e) }) }
    finally { setIsGenerating(false) }
  }

  if (showForm) {
    return <CustomRoleForm existing={editingRole} onDone={() => { setShowForm(false); setEditingRole(null); void loadRoles() }} onCancel={() => { setShowForm(false); setEditingRole(null) }} />
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs">
      {/* 自动生成 */}
      <div className="space-y-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
        <div className="text-[11px] font-medium text-violet-700 dark:text-violet-400">LLM 自动生成角色</div>
        <textarea value={autoGenTask} onChange={(e) => setAutoGenTask(e.target.value)} rows={2}
          placeholder="描述任务,LLM 将生成定制角色(如:Drizzle ORM 迁移)"
          className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        <Button size="sm" onClick={handleAutoGenerate} disabled={autoGenTask.trim().length === 0 || isGenerating} className="w-full bg-violet-600 text-white hover:bg-violet-700">
          {isGenerating ? 'LLM 生成中…' : '自动生成并保存'}
        </Button>
      </div>
      {/* 角色列表 */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">自定义角色({roles.length})</span>
        <button type="button" onClick={() => { setEditingRole(null); setShowForm(true) }} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">+ 手动创建</button>
      </div>
      {loading ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">加载中…</div>
      ) : roles.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">暂无自定义角色</div>
      ) : (
        <div className="space-y-1.5">
          {roles.map((role) => (
            <div key={role.id} className="rounded-md border border-border bg-card px-2.5 py-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{role.displayName}</span>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{role.role}</code>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setEditingRole(role); setShowForm(true) }} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">编辑</button>
                  <button type="button" onClick={() => handleDelete(role.id)} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10">删除</button>
                </div>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{role.systemPrompt}</div>
              {role.skills.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {role.skills.map((s) => <span key={s} className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{s}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomRoleForm({ existing, onDone, onCancel }: { existing: CustomRole | null; onDone: () => void; onCancel: () => void }) {
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
        role: role.trim(), displayName: displayName.trim(), systemPrompt: systemPrompt.trim(),
        skills: linesToArray(skillsText.replace(/,/g, '\n')), recommendedTasks: linesToArray(tasksText.replace(/,/g, '\n')),
      }
      const url = existing ? `/api/subagents/roles/custom/${existing.id}` : '/api/subagents/roles/custom'
      const method = existing ? 'PUT' : 'POST'
      const r = await fetchApi<{ role: CustomRole }>(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (r.success) { toast.success(existing ? '已更新' : '已创建'); onDone() }
      else toast.error('保存失败', { description: r.error })
    } catch (e) { toast.error('保存失败', { description: e instanceof Error ? e.message : String(e) }) }
    finally { setIsSaving(false) }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs">
      <div className="text-[11px] font-medium text-foreground">{existing ? '编辑角色' : '创建角色'}</div>
      <Field label="角色技术名(kebab-case)" required>
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="drizzle-migration-expert" className="h-8 text-xs" disabled={!!existing} />
      </Field>
      <Field label="显示名" required>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Drizzle 迁移专家" className="h-8 text-xs" />
      </Field>
      <Field label="System Prompt" required>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4}
          className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
      </Field>
      <Field label="技能标签(逗号分隔)">
        <Input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="drizzle, postgresql, migration" className="h-8 text-xs" />
      </Field>
      <Field label="推荐任务类型(逗号分隔)">
        <Input value={tasksText} onChange={(e) => setTasksText(e.target.value)} placeholder="schema 变更, 数据迁移" className="h-8 text-xs" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>取消</Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave} className="bg-emerald-600 text-white hover:bg-emerald-700">{isSaving ? '保存中…' : '保存'}</Button>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 4: Agent 演化(版本历史 + LLM 复盘 + 补丁应用)
// ===========================================================================

function EvolutionPanel() {
  const [selectedRole, setSelectedRole] = React.useState<string>('coder')
  const [history, setHistory] = React.useState<EvolutionHistory | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [analysis, setAnalysis] = React.useState<EvolutionAnalysis | null>(null)
  const [applying, setApplying] = React.useState(false)

  const loadHistory = React.useCallback(async (role: string) => {
    setLoading(true)
    try {
      const r = await fetchApi<EvolutionHistory>(`/api/subagents/agents/${role}/evolution-history`)
      if (r.success && r.data) setHistory(r.data)
      else setHistory(null)
    } catch { setHistory(null) }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { void loadHistory(selectedRole) }, [selectedRole, loadHistory])

  const handleEvolve = async () => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const r = await fetchApi<EvolutionAnalysis>(`/api/subagents/agents/${selectedRole}/evolve`, { method: 'POST' })
      if (r.success && r.data) { setAnalysis(r.data); toast.success('演化分析完成') }
      else toast.error('演化分析失败', { description: r.error })
    } catch (e) { toast.error('演化分析失败', { description: e instanceof Error ? e.message : String(e) }) }
    finally { setAnalyzing(false) }
  }

  const handleApply = async () => {
    if (!analysis || analysis.patches.length === 0) return
    setApplying(true)
    try {
      const r = await fetchApi<{ version: EvolutionVersion }>(`/api/subagents/agents/${selectedRole}/apply-evolution`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patches: analysis.patches }),
      })
      if (r.success) { toast.success('已应用补丁', { description: r.data?.version.version }); setAnalysis(null); void loadHistory(selectedRole) }
      else toast.error('应用失败', { description: r.error })
    } catch (e) { toast.error('应用失败', { description: e instanceof Error ? e.message : String(e) }) }
    finally { setApplying(false) }
  }

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs">
      <Field label="选择 Agent 角色">
        <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setAnalysis(null) }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      {loading ? (
        <div className="py-4 text-center text-[11px] text-muted-foreground">加载中…</div>
      ) : history ? (
        <>
          {/* 当前 prompt */}
          <div className="rounded-md border border-border bg-card px-2.5 py-2">
            <div className="text-[11px] font-medium text-foreground">当前 Prompt(版本 {history.versions.length > 0 ? history.versions[history.versions.length - 1]!.version : '初始'})</div>
            <div className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{history.currentPrompt}</div>
          </div>

          {/* 版本历史 */}
          {history.versions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-foreground">演化版本({history.versions.length})</div>
              {history.versions.map((v) => (
                <div key={v.version} className="rounded-md border border-border bg-card px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{v.version}</code>
                    <span className="text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{v.prompt}</div>
                  {v.changes.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {v.changes.map((c, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground">
                          <span className="text-red-500">- {c.originalText.slice(0, 40)}</span>
                          {' → '}
                          <span className="text-green-600">+ {c.suggestedReplacement.slice(0, 40)}</span>
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
              <div className="text-[11px] font-medium text-foreground">最近任务({history.recentRecords.length})</div>
              {history.recentRecords.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-[10px]">
                  <span className={r.success ? 'text-green-600' : 'text-red-500'}>{r.success ? '✓' : '✗'}</span>
                  <span className="flex-1 truncate text-muted-foreground">{r.taskDescription}</span>
                  {r.retryCount > 0 && <span className="text-orange-500">重试 {r.retryCount}</span>}
                  <span className="text-muted-foreground/60">{Math.round(r.durationMs / 1000)}s</span>
                </div>
              ))}
            </div>
          )}

          {/* LLM 复盘 */}
          <Button size="sm" onClick={handleEvolve} disabled={analyzing} className="w-full bg-amber-600 text-white hover:bg-amber-700">
            {analyzing ? 'LLM 复盘中…' : '触发 LLM 演化分析'}
          </Button>

          {analysis && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                {analysis.needsEvolution ? `建议演化(${analysis.patches.length} 个补丁)` : '无需演化'}
              </div>
              <div className="text-[11px] text-muted-foreground">{analysis.summary}</div>
              {analysis.patches.map((p, i) => (
                <div key={i} className="rounded-sm border border-border bg-card px-2 py-1">
                  <div className="text-[10px] text-red-500">- {p.originalText}</div>
                  <div className="text-[10px] text-green-600">+ {p.suggestedReplacement}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">原因:{p.reason}</div>
                </div>
              ))}
              {analysis.needsEvolution && (
                <Button size="sm" onClick={handleApply} disabled={applying} className="w-full bg-amber-600 text-white hover:bg-amber-700">
                  {applying ? '应用中…' : '确认应用补丁'}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="py-4 text-center text-[11px] text-muted-foreground">暂无演化数据</div>
      )}
    </div>
  )
}

/** 紧凑表单字段(label + children) */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
