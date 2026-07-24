'use client'

import * as React from 'react'
import { Loader2, Plus, Trash2, ChevronDown } from 'lucide-react'
import { Button, Input, Card, CardContent } from '@ihui/ui-react'
import type {
  SubagentDispatchInput,
  AgentRole,
  OrchestrationMode,
  DispatchPriority,
  DagNode,
  DagEdge,
} from '@ihui/shared/subagents/index'

const ROLE_OPTIONS: { value: AgentRole; label: string }[] = [
  { value: 'researcher', label: '研究员' },
  { value: 'coder', label: '编码员' },
  { value: 'reviewer', label: '评审员' },
  { value: 'architect', label: '架构师' },
  { value: 'debugger', label: '调试员' },
]

const ORCH_OPTIONS: { value: OrchestrationMode; label: string }[] = [
  { value: 'pipeline', label: '流水线' },
  { value: 'parallel', label: '并行' },
  { value: 'debate', label: '辩论' },
  { value: 'vote', label: '投票' },
  { value: 'critique', label: '批评' },
  { value: 'decomposed', label: '分解' },
  { value: 'with_communication', label: '带通信' },
]

const PRIORITY_OPTIONS: { value: DispatchPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '普通' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const labelClass = 'mb-1 block text-xs font-medium text-muted-foreground'

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

interface DispatchFormProps {
  onSubmit: (input: SubagentDispatchInput) => void
  isSubmitting: boolean
  error: string | null
}

export function DispatchForm({ onSubmit, isSubmitting, error }: DispatchFormProps) {
  const [goal, setGoal] = React.useState('')
  const [affectedFiles, setAffectedFiles] = React.useState('')
  const [forbidden, setForbidden] = React.useState('')
  const [verifyCommands, setVerifyCommands] = React.useState('')
  const [constraints, setConstraints] = React.useState('')
  const [deliverables, setDeliverables] = React.useState('')
  const [agentRole, setAgentRole] = React.useState<AgentRole | ''>('')
  const [orchestration, setOrchestration] = React.useState<OrchestrationMode | ''>('')
  const [priority, setPriority] = React.useState<DispatchPriority | ''>('')

  const [retryMax, setRetryMax] = React.useState('1')
  const [retryDelay, setRetryDelay] = React.useState('1000')
  const [quotaTimeout, setQuotaTimeout] = React.useState('300000')
  const [quotaTokens, setQuotaTokens] = React.useState('50000')
  const [quotaRetries, setQuotaRetries] = React.useState('2')

  const [dagNodes, setDagNodes] = React.useState<DagNode[]>([])
  const [dagEdges, setDagEdges] = React.useState<DagEdge[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: SubagentDispatchInput = {
      goal: goal.trim(),
      affectedFiles: linesToArray(affectedFiles),
      constraints: constraints.trim(),
      deliverables: deliverables.trim(),
      verifyCommands: linesToArray(verifyCommands),
    }
    if (forbidden.trim()) input.forbidden = linesToArray(forbidden)
    if (agentRole) input.agentRole = agentRole
    if (orchestration) input.orchestration = orchestration
    if (priority) input.priority = priority
    const maxAttempts = Number(retryMax)
    const delayMs = Number(retryDelay)
    if (maxAttempts > 0) input.retry = { maxAttempts, delayMs }
    const timeoutMs = Number(quotaTimeout)
    const tokenQuota = Number(quotaTokens)
    const maxRetries = Number(quotaRetries)
    if (timeoutMs > 0) input.quotas = { timeoutMs, tokenQuota, maxRetries }
    if (dagNodes.length > 0) {
      input.dag = { nodes: dagNodes, edges: dagEdges }
    }
    onSubmit(input)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>任务目标 *</label>
        <textarea
          className={textareaClass}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="一句话描述任务目标"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>受影响文件(每行一个)*</label>
          <textarea
            className={textareaClass}
            value={affectedFiles}
            onChange={(e) => setAffectedFiles(e.target.value)}
            placeholder={'g:\\IHUI-AI\\apps\\web\\src\\...'}
            required
          />
        </div>
        <div>
          <label className={labelClass}>禁止修改(每行一个)</label>
          <textarea
            className={textareaClass}
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
            placeholder="任何不在上述清单的文件"
          />
        </div>
        <div>
          <label className={labelClass}>验证命令(每行一个)</label>
          <textarea
            className={textareaClass}
            value={verifyCommands}
            onChange={(e) => setVerifyCommands(e.target.value)}
            placeholder="pnpm --filter @ihui/web typecheck"
          />
        </div>
        <div>
          <label className={labelClass}>约束边界 *</label>
          <textarea
            className={textareaClass}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="API 契约/类型/样式/行为约束"
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>交付物 *</label>
        <textarea
          className={textareaClass}
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          placeholder="完整代码 + 自验通过 + 一句话总结"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Agent 角色</label>
          <select
            className={selectClass}
            value={agentRole}
            onChange={(e) => setAgentRole(e.target.value as AgentRole | '')}
          >
            <option value="">默认</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>编排模式</label>
          <select
            className={selectClass}
            value={orchestration}
            onChange={(e) => setOrchestration(e.target.value as OrchestrationMode | '')}
          >
            <option value="">默认</option>
            {ORCH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>优先级</label>
          <select
            className={selectClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as DispatchPriority | '')}
          >
            <option value="">默认</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="rounded-md border">
        <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-2 text-sm font-medium hover:bg-accent">
          <ChevronDown className="h-4 w-4" />
          重试 / 资源配额
        </summary>
        <div className="grid gap-3 p-3 md:grid-cols-5">
          <div>
            <label className={labelClass}>重试次数</label>
            <Input type="number" min={1} max={3} value={retryMax} onChange={(e) => setRetryMax(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>重试延迟(ms)</label>
            <Input type="number" min={0} value={retryDelay} onChange={(e) => setRetryDelay(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>超时(ms)</label>
            <Input type="number" min={1000} value={quotaTimeout} onChange={(e) => setQuotaTimeout(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Token 配额</label>
            <Input type="number" min={1000} value={quotaTokens} onChange={(e) => setQuotaTokens(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>最大重试</label>
            <Input type="number" min={0} max={3} value={quotaRetries} onChange={(e) => setQuotaRetries(e.target.value)} />
          </div>
        </div>
      </details>

      <details className="rounded-md border">
        <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-2 text-sm font-medium hover:bg-accent">
          <ChevronDown className="h-4 w-4" />
          DAG 节点 / 边编辑器
        </summary>
        <div className="space-y-3 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">节点</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDagNodes((prev) => [
                    ...prev,
                    { id: `node-${prev.length + 1}`, agentRole: 'coder', task: '' },
                  ])
                }
              >
                <Plus className="h-3 w-3" />
                添加节点
              </Button>
            </div>
            {dagNodes.map((node, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                <Input
                  placeholder="id"
                  value={node.id}
                  onChange={(e) => {
                    const next = [...dagNodes]
                    next[idx] = { ...next[idx]!, id: e.target.value }
                    setDagNodes(next)
                  }}
                />
                <select
                  className={selectClass}
                  value={node.agentRole}
                  onChange={(e) => {
                    const next = [...dagNodes]
                    next[idx] = { ...next[idx]!, agentRole: e.target.value as AgentRole }
                    setDagNodes(next)
                  }}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="任务描述"
                  value={node.task}
                  onChange={(e) => {
                    const next = [...dagNodes]
                    next[idx] = { ...next[idx]!, task: e.target.value }
                    setDagNodes(next)
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDagNodes((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">边</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDagEdges((prev) => [...prev, { from: '', to: '' }])}
              >
                <Plus className="h-3 w-3" />
                添加边
              </Button>
            </div>
            {dagEdges.map((edge, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                <Input
                  placeholder="from"
                  value={edge.from}
                  onChange={(e) => {
                    const next = [...dagEdges]
                    next[idx] = { ...next[idx]!, from: e.target.value }
                    setDagEdges(next)
                  }}
                />
                <Input
                  placeholder="to"
                  value={edge.to}
                  onChange={(e) => {
                    const next = [...dagEdges]
                    next[idx] = { ...next[idx]!, to: e.target.value }
                    setDagEdges(next)
                  }}
                />
                <Input
                  placeholder="condition(可选)"
                  value={edge.condition ?? ''}
                  onChange={(e) => {
                    const next = [...dagEdges]
                    next[idx] = { ...next[idx]!, condition: e.target.value || undefined }
                    setDagEdges(next)
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDagEdges((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </details>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950">
          <CardContent className="p-3 text-sm text-rose-700 dark:text-rose-300">{error}</CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              派单中...
            </>
          ) : (
            '提交派单'
          )}
        </Button>
      </div>
    </form>
  )
}

export { ROLE_OPTIONS, ORCH_OPTIONS, PRIORITY_OPTIONS }
