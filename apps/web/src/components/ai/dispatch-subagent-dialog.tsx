'use client'

/**
 * DispatchSubagentDialog - 派发 Subagent 对话框(2026-07-22 立)。
 *
 * 落地 AGENTS.md §11 多 Subagent 并行开发强制规则的派单格式:
 *   ## 任务目标 / 受影响文件 / 禁止修改 / 验证命令 / 约束边界 / 交付物
 *
 * UI:
 *  - shadcn Dialog(max-w-2xl,紧凑 text-xs 表单)
 *  - Agent 角色下拉(5 默认 agent)
 *  - 编排模式下拉(7 编排模式,默认 parallel)
 *  - 受影响文件多行 textarea(每行一个绝对路径)
 *  - 禁止修改默认填充"任何不在上述清单的文件"
 *  - 派发后 toast 提示
 *
 * 受控模式:open + onOpenChange 由父组件(AISidePanel)管理,
 * 内部用受控表单 state,提交时调 useCreateDispatch mutation。
 */

import * as React from 'react'
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

import { useCreateDispatch } from '@/hooks/use-subagent-dispatch'
import type {
  SubagentRole,
  OrchestrationMode,
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

const ORCHESTRATION_OPTIONS: Array<{ value: OrchestrationMode; label: string }> = [
  { value: 'parallel', label: '并行(parallel)' },
  { value: 'pipeline', label: '串行(pipeline)' },
  { value: 'decomposed', label: '分解式(decomposed)' },
  { value: 'debate', label: '辩论(debate)' },
  { value: 'vote', label: '投票(vote)' },
  { value: 'critique', label: '批判(critique)' },
  { value: 'with_communication', label: '协作通信(with_communication)' },
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
  const createMutation = useCreateDispatch()

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
    }
  }, [open])

  const canSubmit =
    goal.trim().length > 0 &&
    affectedFilesText.trim().length > 0 &&
    constraints.trim().length > 0 &&
    deliverables.trim().length > 0 &&
    !createMutation.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    const result = await createMutation.mutateAsync({
      goal: goal.trim(),
      affectedFiles: linesToArray(affectedFilesText),
      forbidden: linesToArray(forbiddenText),
      verifyCommands: linesToArray(verifyCommandsText),
      constraints: constraints.trim(),
      deliverables: deliverables.trim(),
      agentRole,
      orchestration,
    })
    if (result.ok) {
      toast.success('已派发 Subagent', {
        description: '可在 Swarm 监控面板查看进度',
      })
      onOpenChange(false)
    } else {
      toast.error('派发失败', { description: result.error })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-3 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">派发 Subagent</DialogTitle>
        </DialogHeader>

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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {createMutation.isPending ? '派发中…' : '派发'}
          </Button>
        </DialogFooter>
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
