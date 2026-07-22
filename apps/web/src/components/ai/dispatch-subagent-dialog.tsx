'use client'

/**
 * DispatchSubagentDialog - 派发 Subagent 对话框(2026-07-22 立,2026-07-22 深化 v2)。
 *
 * 落地 AGENTS.md §11 多 Subagent 并行开发强制规则的派单格式:
 *   ## 任务目标 / 受影响文件 / 禁止修改 / 验证命令 / 约束边界 / 交付物
 *
 * 深化 v2:
 *  - DAG 编辑器(节点列表增删 + 边列表连接 + 条件表达式)
 *  - 优先级选择(low/normal/high/urgent)
 *  - 资源配额配置(超时/token/重试)
 *  - 7 编排模式全部可选(critique/with_communication 已实现)
 *  - 重试配置 UI + 提交成功显示 dispatch ID
 *  - 429 并发超限 / 400 循环依赖错误展示
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
} from '@ihui/ui'

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
  const queryClient = useQueryClient()

  // 表单 state
  const [goal, setGoal] = React.useState('')
  const [agentRole, setAgentRole] = React.useState<SubagentRole>('coder')
  const [orchestration, setOrchestration] =
    React.useState<OrchestrationMode>('parallel')
  const [affectedFilesText, setAffectedFilesText] = React.useState('')
  const [forbiddenText, setForbiddenText] = React.useState(DEFAULT_FORBIDDEN)
  const [verifyCommandsText, setVerifyCommandsText] = React.useState('')
  const [constraints, setConstraints] = React.useState('')
  const [deliverables, setDeliverables] = React.useState('')
  // 重试配置
  const [maxAttempts, setMaxAttempts] = React.useState(1)
  const [delayMs, setDelayMs] = React.useState(1000)
  // 优先级(深化 v2)
  const [priority, setPriority] = React.useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  // 配额(深化 v2)
  const [enableQuotas, setEnableQuotas] = React.useState(false)
  const [timeoutMs, setTimeoutMs] = React.useState(300000)
  const [tokenQuota, setTokenQuota] = React.useState(50000)
  const [quotaRetries, setQuotaRetries] = React.useState(2)
  // DAG 编辑器(深化 v2)
  const [enableDag, setEnableDag] = React.useState(false)
  const [dagNodes, setDagNodes] = React.useState<DagNodeInput[]>([
    { id: 'node1', agentRole: 'researcher', task: '调研需求' },
  ])
  const [dagEdges, setDagEdges] = React.useState<DagEdgeInput[]>([])
  // 提交状态
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [successDispatchId, setSuccessDispatchId] = React.useState<string | null>(null)

  // 重置表单(打开时)
  React.useEffect(() => {
    if (open) {
      setGoal('')
      setAgentRole('coder')
      setOrchestration('parallel')
      setAffectedFilesText('')
      setForbiddenText(DEFAULT_FORBIDDEN)
      setVerifyCommandsText('')
      setConstraints('')
      setDeliverables('')
      setMaxAttempts(1)
      setDelayMs(1000)
      setPriority('normal')
      setEnableQuotas(false)
      setTimeoutMs(300000)
      setTokenQuota(50000)
      setQuotaRetries(2)
      setEnableDag(false)
      setDagNodes([{ id: 'node1', agentRole: 'researcher', task: '调研需求' }])
      setDagEdges([])
      setSuccessDispatchId(null)
    }
  }, [open])

  const orchestrationDesc = ORCHESTRATION_OPTIONS.find(
    (o) => o.value === orchestration,
  )?.desc

  const canSubmit =
    goal.trim().length > 0 &&
    affectedFilesText.trim().length > 0 &&
    constraints.trim().length > 0 &&
    deliverables.trim().length > 0 &&
    !isSubmitting &&
    (!enableDag || dagNodes.length > 0)

  // DAG 节点增删
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

  // DAG 边增删
  const addDagEdge = () => {
    if (dagNodes.length < 2) return
    setDagEdges([
      ...dagEdges,
      { from: dagNodes[0]!.id, to: dagNodes[1]!.id, condition: '' },
    ])
  }
  const removeDagEdge = (idx: number) => {
    setDagEdges(dagEdges.filter((_, i) => i !== idx))
  }
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
      if (enableQuotas) {
        body.quotas = { timeoutMs, tokenQuota, maxRetries: quotaRetries }
      }
      if (enableDag && dagNodes.length > 0) {
        body.dag = {
          nodes: dagNodes.map((n) => ({ id: n.id, agentRole: n.agentRole, task: n.task })),
          edges: dagEdges.map((e) => ({
            from: e.from,
            to: e.to,
            ...(e.condition.trim() ? { condition: e.condition.trim() } : {}),
          })),
        }
        // DAG 模式强制使用 parallel orchestration
        body.orchestration = 'parallel'
      }
      const r = await fetchApi<{ dispatch: SubagentDispatch }>(
        '/api/subagents/dispatch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!r.success) {
        if (r.status === 429) {
          toast.error('并发派单数已达上限', {
            description: '请等待现有派单完成或取消后再试,或使用 urgent 优先级抢占',
          })
        } else if (r.status === 400) {
          toast.error('参数错误', { description: r.error })
        } else {
          toast.error('派发失败', { description: r.error })
        }
        return
      }
      if (!r.data?.dispatch) {
        toast.error('派发失败', { description: '响应数据缺失' })
        return
      }
      setSuccessDispatchId(r.data.dispatch.id)
      toast.success('已派发 Subagent', {
        description: `优先级:${priority} · 可在 Swarm 监控面板查看进度`,
      })
      void queryClient.invalidateQueries({ queryKey: activeDispatchesKey })
      void queryClient.invalidateQueries({ queryKey: swarmTopologyKey })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('派发失败', { description: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">派发 Subagent</DialogTitle>
        </DialogHeader>

        {successDispatchId ? (
          <div className="space-y-3 py-4 text-xs">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
              <div className="font-medium text-emerald-700 dark:text-emerald-400">
                派发成功
              </div>
              <div className="mt-1 text-muted-foreground">
                Dispatch ID:
                <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {successDispatchId}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>查看资源统计:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                GET /api/subagents/{successDispatchId}/stats
              </code>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                关闭
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSuccessDispatchId(null)
                }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                再派一个
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-xs">
            {/* 任务目标 */}
            <Field label="任务目标" required>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                placeholder="一句话描述任务目标"
                className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* Agent 角色 + 编排模式(并排) */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agent 角色">
                <Select
                  value={agentRole}
                  onValueChange={(v) => setAgentRole(v as SubagentRole)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="编排模式">
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
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* 编排模式说明 */}
            {orchestrationDesc && (
              <div className="rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                {orchestrationDesc}
              </div>
            )}

            {/* 优先级选择(深化 v2) */}
            <Field label="优先级">
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
                    {o.label}
                  </button>
                ))}
              </div>
              {priority === 'urgent' && (
                <div className="mt-1 text-[10px] text-orange-600 dark:text-orange-400">
                  紧急优先级可抢占低优先级派单
                </div>
              )}
            </Field>

            {/* 受影响文件 */}
            <Field label="受影响文件(每行一个绝对路径)" required>
              <textarea
                value={affectedFilesText}
                onChange={(e) => setAffectedFilesText(e.target.value)}
                rows={3}
                placeholder={'d:\\path\\to\\file1\nd:\\path\\to\\file2'}
                className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* 禁止修改 */}
            <Field label="禁止修改">
              <textarea
                value={forbiddenText}
                onChange={(e) => setForbiddenText(e.target.value)}
                rows={2}
                placeholder={DEFAULT_FORBIDDEN}
                className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* 验证命令 */}
            <Field label="验证命令(每行一个)">
              <textarea
                value={verifyCommandsText}
                onChange={(e) => setVerifyCommandsText(e.target.value)}
                rows={2}
                placeholder={'pnpm --filter @ihui/api typecheck\npnpm --filter @ihui/web typecheck'}
                className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* 约束边界 */}
            <Field label="约束边界" required>
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={2}
                placeholder="API 契约 / 类型 / 样式 / 行为约束"
                className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* 交付物 */}
            <Field label="交付物" required>
              <textarea
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                rows={2}
                placeholder="完整代码 + 自验通过 + 一句话总结"
                className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            {/* DAG 编辑器(深化 v2) */}
            <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={enableDag}
                  onChange={(e) => setEnableDag(e.target.checked)}
                  className="h-3 w-3 rounded-sm"
                />
                <span>DAG 依赖图</span>
              </label>
              {enableDag && (
                <div className="space-y-2">
                  {/* DAG 节点列表 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">节点(同层并行,跨层依赖)</span>
                      <button
                        type="button"
                        onClick={addDagNode}
                        className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
                      >
                        + 节点
                      </button>
                    </div>
                    {dagNodes.map((node) => (
                      <div key={node.id} className="flex items-center gap-1.5">
                        <code className="w-16 shrink-0 truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]" title={node.id}>
                          {node.id.slice(0, 8)}
                        </code>
                        <select
                          value={node.agentRole}
                          onChange={(e) => updateDagNode(node.id, 'agentRole', e.target.value)}
                          className="h-6 w-24 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label.split('(')[0]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={node.task}
                          onChange={(e) => updateDagNode(node.id, 'task', e.target.value)}
                          placeholder="任务描述"
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
                  {/* DAG 边列表 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">边(条件表达式可选)</span>
                      <button
                        type="button"
                        onClick={addDagEdge}
                        disabled={dagNodes.length < 2}
                        className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted disabled:opacity-40"
                      >
                        + 边
                      </button>
                    </div>
                    {dagEdges.map((edge, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <select
                          value={edge.from}
                          onChange={(e) => updateDagEdge(idx, 'from', e.target.value)}
                          className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {dagNodes.map((n) => (
                            <option key={n.id} value={n.id}>{n.id.slice(0, 8)}</option>
                          ))}
                        </select>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <select
                          value={edge.to}
                          onChange={(e) => updateDagEdge(idx, 'to', e.target.value)}
                          className="h-6 w-20 rounded-sm border border-input bg-transparent px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {dagNodes.map((n) => (
                            <option key={n.id} value={n.id}>{n.id.slice(0, 8)}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={edge.condition}
                          onChange={(e) => updateDagEdge(idx, 'condition', e.target.value)}
                          placeholder="条件(如 result.includes('ok'))"
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

            {/* 重试配置 */}
            <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
              <label className="text-xs font-medium text-foreground">
                失败重试
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">重试次数</span>
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
                    <span className="text-[11px] text-muted-foreground">重试间隔</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={delayMs}
                      onChange={(e) =>
                        setDelayMs(Math.max(0, parseInt(e.target.value || '0', 10)))
                      }
                      className="h-6 w-16 rounded-sm border border-input bg-transparent px-1.5 text-[11px] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-[11px] text-muted-foreground">ms</span>
                  </div>
                )}
              </div>
            </div>

            {/* 资源配额(深化 v2) */}
            <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={enableQuotas}
                  onChange={(e) => setEnableQuotas(e.target.checked)}
                  className="h-3 w-3 rounded-sm"
                />
                <span>资源配额</span>
              </label>
              {enableQuotas && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground">超时(ms)</div>
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
                    <div className="text-[10px] text-muted-foreground">Token 上限</div>
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
                    <div className="text-[10px] text-muted-foreground">最大重试</div>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      value={quotaRetries}
                      onChange={(e) => setQuotaRetries(Math.min(3, Math.max(0, parseInt(e.target.value || '0', 10))))}
                      className="h-6 w-full rounded-sm border border-input bg-transparent px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!successDispatchId && (
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting ? '派发中…' : '派发'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
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
