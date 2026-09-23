// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
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

const ROLE_OPTIONS: { value: AgentRole; labelKey: string }[] = [
  { value: 'researcher', labelKey: 'subRoles.researcher' },
  { value: 'coder', labelKey: 'subRoles.coder' },
  { value: 'reviewer', labelKey: 'subRoles.reviewer' },
  { value: 'architect', labelKey: 'roles.architect' },
  { value: 'debugger', labelKey: 'subRoles.debugger' },
]

const ORCH_OPTIONS: { value: OrchestrationMode; labelKey: string }[] = [
  { value: 'pipeline', labelKey: 'subOrch.pipeline' },
  { value: 'parallel', labelKey: 'orch.parallel' },
  { value: 'debate', labelKey: 'orch.debate' },
  { value: 'vote', labelKey: 'orch.vote' },
  { value: 'critique', labelKey: 'subOrch.critique' },
  { value: 'decomposed', labelKey: 'subOrch.decomposed' },
  { value: 'with_communication', labelKey: 'subOrch.withCommunication' },
]

const PRIORITY_OPTIONS: { value: DispatchPriority; labelKey: string }[] = [
  { value: 'low', labelKey: 'priority.low' },
  { value: 'normal', labelKey: 'priority.normal' },
  { value: 'high', labelKey: 'priority.high' },
  { value: 'urgent', labelKey: 'priority.urgent' },
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
  const t = useTranslations('dispatchDialog')
  const fid = React.useId()
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
        <label htmlFor={`${fid}-goal`} className={labelClass}>
          {t('fields.goal')} *
        </label>
        <textarea
          id={`${fid}-goal`}
          className={textareaClass}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t('goalPlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
        <div>
          <label htmlFor={`${fid}-affected`} className={labelClass}>
            {t('fields.affectedFilesPerLine')}*
          </label>
          <textarea
            id={`${fid}-affected`}
            className={textareaClass}
            value={affectedFiles}
            onChange={(e) => setAffectedFiles(e.target.value)}
            placeholder={'g:\\IHUI-AI\\apps\\web\\src\\...'}
            required
          />
        </div>
        <div>
          <label htmlFor={`${fid}-forbidden`} className={labelClass}>
            {t('fields.forbiddenPerLine')}
          </label>
          <textarea
            id={`${fid}-forbidden`}
            className={textareaClass}
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
            placeholder={t('defaultForbidden')}
          />
        </div>
        <div>
          <label htmlFor={`${fid}-verify`} className={labelClass}>
            {t('fields.verifyCommands')}
          </label>
          <textarea
            id={`${fid}-verify`}
            className={textareaClass}
            value={verifyCommands}
            onChange={(e) => setVerifyCommands(e.target.value)}
            placeholder="pnpm --filter @ihui/web typecheck"
          />
        </div>
        <div>
          <label htmlFor={`${fid}-constraints`} className={labelClass}>
            {t('fields.constraints')} *
          </label>
          <textarea
            id={`${fid}-constraints`}
            className={textareaClass}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder={t('constraintsPlaceholder')}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${fid}-deliverables`} className={labelClass}>
          {t('fields.deliverables')} *
        </label>
        <textarea
          id={`${fid}-deliverables`}
          className={textareaClass}
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          placeholder={t('deliverablesPlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
        <div>
          <label htmlFor={`${fid}-role`} className={labelClass}>
            {t('fields.agentRole')}
          </label>
          <select
            id={`${fid}-role`}
            className={selectClass}
            value={agentRole}
            onChange={(e) => setAgentRole(e.target.value as AgentRole | '')}
          >
            <option value="">{t('formDefaultOption')}</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${fid}-orch`} className={labelClass}>
            {t('fields.orchestration')}
          </label>
          <select
            id={`${fid}-orch`}
            className={selectClass}
            value={orchestration}
            onChange={(e) => setOrchestration(e.target.value as OrchestrationMode | '')}
          >
            <option value="">{t('formDefaultOption')}</option>
            {ORCH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${fid}-priority`} className={labelClass}>
            {t('fields.priority')}
          </label>
          <select
            id={`${fid}-priority`}
            className={selectClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as DispatchPriority | '')}
          >
            <option value="">{t('formDefaultOption')}</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="rounded-md border">
        <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-2 text-sm font-medium hover:bg-accent">
          <ChevronDown className="h-4 w-4" />
          {t('retryQuotaSummary')}
        </summary>
        <div className="grid grid-cols-1 gap-3 p-3 min-[768px]:grid-cols-5">
          <div>
            <label htmlFor={`${fid}-retryMax`} className={labelClass}>
              {t('fields.retryCount')}
            </label>
            <Input
              id={`${fid}-retryMax`}
              type="number"
              min={1}
              max={3}
              value={retryMax}
              onChange={(e) => setRetryMax(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${fid}-retryDelay`} className={labelClass}>
              {t('fields.retryDelayMs')}
            </label>
            <Input
              id={`${fid}-retryDelay`}
              type="number"
              min={0}
              value={retryDelay}
              onChange={(e) => setRetryDelay(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${fid}-quotaTimeout`} className={labelClass}>
              {t('fields.timeoutMs')}
            </label>
            <Input
              id={`${fid}-quotaTimeout`}
              type="number"
              min={1000}
              value={quotaTimeout}
              onChange={(e) => setQuotaTimeout(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${fid}-quotaTokens`} className={labelClass}>
              {t('fields.tokenQuotaForm')}
            </label>
            <Input
              id={`${fid}-quotaTokens`}
              type="number"
              min={1000}
              value={quotaTokens}
              onChange={(e) => setQuotaTokens(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${fid}-quotaRetries`} className={labelClass}>
              {t('fields.maxRetries')}
            </label>
            <Input
              id={`${fid}-quotaRetries`}
              type="number"
              min={0}
              max={3}
              value={quotaRetries}
              onChange={(e) => setQuotaRetries(e.target.value)}
            />
          </div>
        </div>
      </details>

      <details className="rounded-md border">
        <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-2 text-sm font-medium hover:bg-accent">
          <ChevronDown className="h-4 w-4" />
          {t('dagEditorTitle')}
        </summary>
        <div className="space-y-3 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t('dagNodes')}</span>
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
                {t('addNodeButton')}
              </Button>
            </div>
            {dagNodes.map((node, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 min-[768px]:grid-cols-[1fr_1fr_2fr_auto]"
              >
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
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder={t('fields.taskDesc')}
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
              <span className="text-xs font-medium text-muted-foreground">{t('dagEdges')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDagEdges((prev) => [...prev, { from: '', to: '' }])}
              >
                <Plus className="h-3 w-3" />
                {t('addEdgeButton')}
              </Button>
            </div>
            {dagEdges.map((edge, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 min-[768px]:grid-cols-[1fr_1fr_2fr_auto]"
              >
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
                  placeholder={t('formConditionPlaceholder')}
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
          <CardContent className="min-[640px]:p-3 p-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('formSubmitting')}</span>
            </>
          ) : (
            t('formSubmit')
          )}
        </Button>
      </div>
    </form>
  )
}

export { ROLE_OPTIONS, ORCH_OPTIONS, PRIORITY_OPTIONS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
