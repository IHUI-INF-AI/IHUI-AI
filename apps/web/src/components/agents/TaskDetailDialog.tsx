// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Trash2, ArrowRightCircle } from 'lucide-react'
import { Button, Input, Label, cn } from '@ihui/ui-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { useToast } from '@/hooks/use-toast'
import { CenteredText } from '@/components/common/CenteredText'
import { TruncatedText } from '@/components/common/TruncatedText'
import { transitionKanbanTask, deleteKanbanTask, fetchWorkspaceLock } from '@/lib/agent-kanban-api'
import type { KanbanApiError, WorkspaceLockInfo } from '@/lib/agent-kanban-api'
import type { AgentTaskStatus, KanbanTask } from '@ihui/types'
import {
  STATUS_BADGE_CLASS,
  LEGAL_TRANSITIONS,
  getPriorityLevel,
  PRIORITY_DOT_CLASS,
  formatRelativeTime,
  formatDuration,
} from './KanbanTaskCard'
// D27(2026-09-20 立):交付审查视图 — 交付清单解析/跨会话回溯合并 + 交付面板复用
import { fetchApi } from '@/lib/api'
import { extractSessionDeliverables, mergeFilesChanged } from '@/types/agent-delivery'
import type { TaskDeliverables } from '@/types/agent-delivery'
import { DeliveryReviewPanel, DeliveryFileChangeList } from './DeliveryReviewPanel'

const ALL_STATUSES: AgentTaskStatus[] = [
  'triage',
  'todo',
  'ready',
  'in_progress',
  'blocked',
  'done',
]

/** D27:详情弹窗 tab 键(概览/交付清单/代码变更) */
const DETAIL_TABS = ['overview', 'delivery', 'changes'] as const
type DetailTab = (typeof DETAIL_TABS)[number]
/** D27:tab 键 → i18n key 映射 */
const DETAIL_TAB_I18N: Record<DetailTab, string> = {
  overview: 'tabOverview',
  delivery: 'tabDelivery',
  changes: 'tabChanges',
}

export interface TaskDetailDialogProps {
  task: KanbanTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskChanged: () => void
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onTaskChanged,
}: TaskDetailDialogProps) {
  const t = useTranslations('agents.kanban')
  const tc = useTranslations('common')
  // D27:交付审查视图文案(独立命名空间,五语言同构)
  const td = useTranslations('deliveryReview')
  const locale = useLocale()
  const { success, error, warning } = useToast()

  const [transitionTo, setTransitionTo] = React.useState<AgentTaskStatus | ''>('')
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  // 2-2 锁徽标实时校验:弹窗打开时查一次工作区锁,展示当前真实持有者
  const [lockInfo, setLockInfo] = React.useState<WorkspaceLockInfo | null>(null)
  // D27(2026-09-20 立):tab 状态(概览/交付清单/代码变更,打开时重置为概览)
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview')
  // D27:会话级端点拉取的交付清单(交付/代码变更 tab 激活且有 sessionId 时拉一次)
  const [remoteDeliverables, setRemoteDeliverables] = React.useState<TaskDeliverables | null>(null)
  const [deliverablesLoading, setDeliverablesLoading] = React.useState(false)
  // D27:防重拉标记(同一次弹窗会话内只拉一次端点,关闭时重置)
  const deliverablesFetchedRef = React.useRef(false)

  const legalTargets = task ? LEGAL_TRANSITIONS[task.status] : []
  const reasonRequired = transitionTo === 'blocked'
  const canConfirm = transitionTo !== '' && (!reasonRequired || reason.trim().length > 0)

  React.useEffect(() => {
    if (open) {
      setTransitionTo('')
      setReason('')
      setSubmitting(false)
      setDeleting(false)
      // D27:tab 与交付数据一并在打开时重置(不同任务打开不留旧 tab 状态)
      setActiveTab('overview')
      setRemoteDeliverables(null)
      setDeliverablesLoading(false)
      deliverablesFetchedRef.current = false
    }
  }, [open, task?.id])

  // 打开弹窗且任务有工作区时,实时查询锁状态(失败静默回退到任务行的 lockedBy 审计字段)
  React.useEffect(() => {
    if (!open || !task?.workspacePath) {
      setLockInfo(null)
      return
    }
    let cancelled = false
    fetchWorkspaceLock(task.workspacePath)
      .then((info) => {
        if (!cancelled) setLockInfo(info)
      })
      .catch(() => {
        if (!cancelled) setLockInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, task?.id, task?.workspacePath])

  // D27(2026-09-20 立):会话 ID 从任务 payload 宽松提取(非 string 视为未关联会话)。
  // 交付/代码变更 tab 首次激活时拉一次会话级交付端点(跨端契约:
  // GET /api/v1/ai/agents/sessions/:sessionId/deliverables,信封 {success,data})。
  // 本地 task.result.deliverables 不触发请求(优先本地,端点仅兜底/跨会话合并)。
  const sessionId =
    typeof task?.payload?.sessionId === 'string' && task.payload.sessionId.length > 0
      ? task.payload.sessionId
      : null
  React.useEffect(() => {
    if (!open) {
      deliverablesFetchedRef.current = false
      return
    }
    if (!sessionId || deliverablesFetchedRef.current) return
    if (activeTab !== 'delivery' && activeTab !== 'changes') return
    deliverablesFetchedRef.current = true
    let cancelled = false
    setDeliverablesLoading(true)
    void (async () => {
      try {
        const res = await fetchApi<unknown>(
          `/api/v1/ai/agents/sessions/${encodeURIComponent(sessionId)}/deliverables`,
        )
        if (cancelled) return
        // 宽松守卫解析:信封 data 直接交 extractSessionDeliverables(形如 TaskDeliverables
        // 或 {deliverables:…} 包装均可;解析失败/失败信封一律 null 走空态兜底)
        setRemoteDeliverables(res.success ? extractSessionDeliverables(res.data) : null)
      } catch {
        if (!cancelled) setRemoteDeliverables(null)
      } finally {
        if (!cancelled) setDeliverablesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, sessionId, activeTab])

  const handleConfirm = async () => {
    if (!task || transitionTo === '') return
    setSubmitting(true)
    try {
      const result = await transitionKanbanTask(
        task.id,
        transitionTo as AgentTaskStatus,
        reason.trim() || undefined,
      )
      if (result.allowed) {
        success(t('confirm'))
        onTaskChanged()
        onOpenChange(false)
      } else {
        error(result.reason || tc('errorTitle'))
      }
    } catch (e) {
      const err = e as KanbanApiError
      // 2-2 工作区锁冲突(409):后端消息含持有者信息,用 warning 区别于一般错误
      if (err.status === 409) {
        warning(t('lockConflict'), err.message)
      } else {
        error(err.message || tc('unknownError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    try {
      await deleteKanbanTask(task.id)
      success(t('delete'))
      onTaskChanged()
      onOpenChange(false)
    } catch (e) {
      error(e instanceof Error ? e.message : tc('unknownError'))
    } finally {
      setDeleting(false)
    }
  }

  if (!task) return null

  // D27:本地交付清单(dispatch 落库路径 task.result.deliverables,宽松守卫解析;
  // result 缺失或字段不符均为 null → delivery tab 回退会话级端点数据)
  const localDeliverables = task.result
    ? extractSessionDeliverables(task.result.deliverables)
    : null
  // D27:代码变更 tab 跨会话回溯合并(本地 + 端点,generatedAt 新在前 + 同路径去重)
  const mergedChanges = mergeFilesChanged(localDeliverables, remoteDeliverables)

  const level = getPriorityLevel(task.priority)
  const hasDuration = task.startedAt && (task.completedAt || task.status === 'in_progress')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_CLASS[level])}
              aria-hidden
            />
            <span className="truncate">{task.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{task.id}</DialogDescription>
        </DialogHeader>

        {/* D27(2026-09-20 立):tab 导航条(概览/交付清单/代码变更),样式对齐 ai-side-panel-tools */}
        <div role="tablist" aria-label={td('title')} className="flex gap-1 border-b pb-1.5">
          {DETAIL_TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`task-detail-tab-${key}`}
              aria-selected={activeTab === key}
              aria-controls="task-detail-panel"
              data-testid={`task-detail-tab-${key}`}
              onClick={() => setActiveTab(key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                activeTab === key
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              {td(DETAIL_TAB_I18N[key])}
            </button>
          ))}
        </div>

        {/* D27:tab 内容区 — 概览常驻挂载(保留状态流转表单态,非激活时 hidden),
            交付清单/代码变更条件渲染(不出空 DOM);概览面板 testid 固定(仅承载概览内容) */}
        <div
          role="tabpanel"
          id="task-detail-panel"
          aria-labelledby={`task-detail-tab-${activeTab}`}
          data-testid="task-detail-panel-overview"
          className={cn('space-y-3 text-sm', activeTab !== 'overview' && 'hidden')}
        >
          <div className="space-y-3 text-sm">
            {/* 状态 + 优先级 */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_BADGE_CLASS[task.status],
                )}
              >
                {t(task.status)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('priority')}: {t(level)}
              </span>
              <span className="text-xs text-muted-foreground">P{task.priority}</span>
            </div>

            {/* 描述 */}
            {task.description && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                {task.description}
              </div>
            )}

            {/* 元信息 */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <dt className="text-muted-foreground">{t('created')}</dt>
                <dd>{formatRelativeTime(task.createdAt, locale)}</dd>
              </div>
              {/* 2-2 工作区与锁信息 */}
              {task.workspacePath && (
                <div>
                  <dt className="text-muted-foreground">{t('workspace')}</dt>
                  <dd>
                    <TruncatedText value={task.workspacePath} className="text-xs" mono />
                  </dd>
                </div>
              )}
              {/* 2-2 锁徽标实时校验:优先展示 fetchWorkspaceLock 的实时结果,回退任务行审计字段 */}
              {(lockInfo || task.lockedBy) && (
                <div>
                  <dt
                    className={
                      lockInfo?.held
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-muted-foreground'
                    }
                  >
                    {lockInfo ? t('lockStatus') : t('locked')}
                  </dt>
                  <dd
                    className={cn(
                      'truncate',
                      lockInfo
                        ? lockInfo.held
                          ? 'text-orange-600/80 dark:text-orange-400/80'
                          : 'text-emerald-600/80 dark:text-emerald-400/80'
                        : 'text-orange-600/80 dark:text-orange-400/80',
                    )}
                  >
                    {lockInfo
                      ? lockInfo.held
                        ? lockInfo.acquiredAt
                          ? `${lockInfo.holder || '—'} · ${formatRelativeTime(lockInfo.acquiredAt, locale)}`
                          : lockInfo.holder || '—'
                        : t('lockFree')
                      : task.lockedBy}
                  </dd>
                </div>
              )}
              {task.startedAt && (
                <div>
                  <dt className="text-muted-foreground">{t('worker')}</dt>
                  <dd className="truncate">{task.workerId || '—'}</dd>
                </div>
              )}
              {hasDuration && task.startedAt && (
                <div>
                  <dt className="text-muted-foreground">{t('duration')}</dt>
                  <dd>
                    {formatDuration(task.startedAt, task.completedAt || new Date().toISOString())}
                  </dd>
                </div>
              )}
              {task.dependencies && task.dependencies.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t('dependencies')}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {task.dependencies.map((dep) => (
                      <span
                        key={dep}
                        className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono"
                      >
                        {dep.slice(0, 8)}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {task.errorMessage && (
                <div className="col-span-2">
                  <dt className="text-destructive">{t('error')}</dt>
                  <dd className="text-destructive/80">{task.errorMessage}</dd>
                </div>
              )}
            </dl>

            {/* 状态流转 */}
            {legalTargets?.length > 0 && (
              <div className="space-y-2 rounded-md border border-border p-2.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  <ArrowRightCircle className="h-3.5 w-3.5" />
                  <CenteredText>{t('transition')}</CenteredText>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATUSES.map((status) => {
                    const isLegal = legalTargets.includes(status)
                    const isSelected = transitionTo === status
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={!isLegal}
                        onClick={() => setTransitionTo(status)}
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors',
                          isSelected
                            ? STATUS_BADGE_CLASS[status]
                            : isLegal
                              ? 'border border-border bg-background hover:bg-accent'
                              : 'cursor-not-allowed border border-border/50 bg-muted/30 text-muted-foreground/40',
                        )}
                      >
                        {t(status)}
                      </button>
                    )
                  })}
                </div>
                {reasonRequired && (
                  <div className="space-y-1">
                    <Label htmlFor="transition-reason" className="text-xs">
                      {t('reason')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="transition-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t('reasonRequired')}
                      maxLength={500}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* D27:交付清单 tab — 条件渲染(不出空 DOM);本地 task.result.deliverables 优先,
            缺省回退会话级端点数据(拉取中展示加载态) */}
        {activeTab === 'delivery' && (
          <div data-testid="task-detail-panel-delivery">
            <DeliveryReviewPanel
              deliverables={localDeliverables ?? remoteDeliverables}
              loading={deliverablesLoading}
            />
          </div>
        )}

        {/* D27:代码变更 tab — 条件渲染(不出空 DOM);跨会话回溯合并(本地+端点,
            generatedAt 新在前 + 同路径去重),复用 DeliveryFileChangeList 保证视觉一致 */}
        {activeTab === 'changes' && (
          <div data-testid="task-detail-panel-changes" className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground/80">{td('filesChanged')}</span>
              <span className="tabular-nums text-muted-foreground/70">
                ({mergedChanges.length})
              </span>
            </div>
            {mergedChanges.length === 0 ? (
              <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                {deliverablesLoading ? td('loading') : td('filesEmpty')}
              </div>
            ) : (
              <DeliveryFileChangeList files={mergedChanges} />
            )}
          </div>
        )}

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 min-[640px]:flex-nowrap">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || submitting}
            className="shrink-0"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Trash2 className="h-4 w-4 shrink-0" />
            )}
            <span className="whitespace-nowrap">{t('delete')}</span>
          </Button>
          <div className="flex flex-nowrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || deleting}
              className="shrink-0"
            >
              <span className="whitespace-nowrap">{t('cancel')}</span>
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || submitting || deleting}
              className="shrink-0"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
              <span className="whitespace-nowrap">{t('confirm')}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
