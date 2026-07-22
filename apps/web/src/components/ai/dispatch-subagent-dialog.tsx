'use client'

/**
 * DispatchSubagentDialog - 派发 Subagent 对话框(2026-07-22 立,2026-07-22 深化)。
 *
 * 落地 AGENTS.md §11 多 Subagent 并行开发强制规则的派单格式:
 *   ## 任务目标 / 受影响文件 / 禁止修改 / 验证命令 / 约束边界 / 交付物
 *
 * 深化:
 *  - 重试配置 UI(maxAttempts 按钮组 1-3 + delayMs 输入)
 *  - 编排模式说明(debate/vote 显示多 agent 仲裁/投票描述)
 *  - 提交成功后显示 dispatch ID + 查看统计链接
 *  - 直接调 fetchApi 提交(支持 retry 字段,绕过 store 类型约束)
 *  - 429 并发超限错误展示
 *
 * UI:
 *  - shadcn Dialog(max-w-2xl,紧凑 text-xs 表单)
 *  - Agent 角色下拉(5 默认 agent)
 *  - 编排模式下拉(7 编排模式,默认 parallel)
 *  - 受影响文件多行 textarea(每行一个绝对路径)
 *  - 禁止修改默认填充"任何不在上述清单的文件"
 *  - 派发后 toast 提示
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
  { value: 'critique', label: '批判(critique)', desc: '多 agent 互相批判优化(暂未实现)' },
  { value: 'with_communication', label: '协作通信(with_communication)', desc: 'agent 间通信协作(暂未实现)' },
]

const DEFAULT_FORBIDDEN = '任何不在上述清单的文件'

/** 把多行 textarea 文本拆成非空行数组 */
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
    !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const body = {
        goal: goal.trim(),
        affectedFiles: linesToArray(affectedFilesText),
        forbidden: linesToArray(forbiddenText),
        verifyCommands: linesToArray(verifyCommandsText),
        constraints: constraints.trim(),
        deliverables: deliverables.trim(),
        agentRole,
        orchestration,
        retry:
          maxAttempts > 1 ? { maxAttempts, delayMs } : undefined,
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
            description: '请等待现有派单完成或取消后再试',
          })
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
        description: '可在 Swarm 监控面板查看进度',
      })
      // 刷新 react-query 缓存(活跃列表 + 拓扑)
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

            {/* 重试配置(深化新增) */}
            <div className="space-y-1.5 rounded-md border border-border bg-card px-2.5 py-2">
              <label className="text-xs font-medium text-foreground">
                失败重试
              </label>
              <div className="flex items-center gap-3">
                {/* maxAttempts 按钮组 */}
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
                {/* delayMs 输入 */}
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
              {maxAttempts > 1 && (
                <div className="text-[10px] text-muted-foreground">
                  指数退避:第 N 次重试间隔 = {delayMs} × 2^(N-1) ms
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
