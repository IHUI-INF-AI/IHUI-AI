// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, X, Loader2, AlertCircle, FileText, MessageSquarePlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useChatStore } from '@/stores/chat'
import { buildPartialContent, computeHunkDiff, type DiffRow as HunkDiffRow } from '@/lib/hunk-diff'
import {
  createStagedSet,
  stageHunk,
  stageHunks,
  unstageAll,
  unstageHunk,
} from '@/lib/diff-staging'
import { DiffCommentPanel } from './diff-comment-panel'
import { HunkHeader, HunkToolbar } from './diff-hunk-controls'
import type { InlineDiffInfo } from './types'
import type { DiffApplyStatus } from '@/stores/chat'

/**
 * Inline Diff 卡片:edit_file/write_file 工具调用专用渲染。
 *
 * 2026-07-22 立 P3 深度层:聊天面板内直接查看代码 diff + Accept/Reject 应用改动。
 * 2026-09-18 W5:新增 hunk 级接受/拒绝与「应用所选」部分落盘;行级 diff 与 hunk 切分
 * 统一收敛到 `@/lib/hunk-diff`(LCS 同源、纯函数可单测),本文件不再自带内联实现。
 */
type DiffRow = HunkDiffRow

interface InlineDiffCardProps {
  diffInfo: InlineDiffInfo
  applyStatus?: DiffApplyStatus
  applyError?: string
  /** 点击 Accept:由父组件触发 API 调用并更新 applyStatus(整卡全量应用) */
  onApply?: () => void
  /** 点击 Reject:仅本地标记为 rejected,无 API 调用 */
  onReject?: () => void
  /** P3 #30(2026-09-16 立):来源工具调用 id,随评审意见记录便于回溯哪次改动 */
  toolCallId?: string
  /** W5(2026-09-18 立):部分应用 —— 只把「已接受」hunk 重组后的内容落盘 */
  onApplyPartial?: (newContent: string) => Promise<void>
}

/** 顶部状态徽章配置(labelKey 为 `ai.pane` 相对键,渲染处 `t(labelKey)` 取词) */
const STATUS_BADGE: Record<
  DiffApplyStatus,
  { labelKey: string; className: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  pending: { labelKey: 'diffStatus.pending', className: 'bg-muted text-muted-foreground' },
  applying: {
    labelKey: 'diffHunk.applyingSelected',
    className: 'bg-muted text-muted-foreground',
    icon: Loader2,
  },
  applied: {
    labelKey: 'diffStatus.applied',
    className: 'bg-green-500/15 text-green-600',
    icon: Check,
  },
  rejected: {
    labelKey: 'diffHunk.rejected',
    className: 'bg-muted text-muted-foreground',
    icon: X,
  },
  error: {
    labelKey: 'diffStatus.error',
    className: 'bg-red-500/15 text-red-600',
    icon: AlertCircle,
  },
}

export function InlineDiffCard({
  diffInfo,
  applyStatus = 'pending',
  applyError,
  onApply,
  onReject,
  toolCallId,
  onApplyPartial,
}: InlineDiffCardProps) {
  const t = useTranslations('ai.pane')
  // P3 #30 diff 评论:commentTarget=null 表示评论面板关闭;{} 为文件级;带 line 为行级。
  const [commentTarget, setCommentTarget] = React.useState<{
    line?: number
    lineText?: string
  } | null>(null)
  // W5:被「拒绝」的 hunk id 集合(默认空 = 全部接受,状态最小化)
  const [rejectedHunks, setRejectedHunks] = React.useState<ReadonlySet<number>>(() => new Set())
  // D88:已暂存(锁定进交付批次)的 hunk id 集合,与 rejectedHunks(accepted 维度)正交
  const [stagedHunks, setStagedHunks] = React.useState<ReadonlySet<number>>(() => createStagedSet())
  const [partialBusy, setPartialBusy] = React.useState(false)
  // 本文件已暂存的待发送意见数(订阅整体数组引用 + useMemo 过滤,避免 selector 返回新数组)
  const allComments = useChatStore((s) => s.pendingDiffComments)
  const fileCommentCount = React.useMemo(
    () => allComments.filter((c) => c.filePath === diffInfo.file_path).length,
    [allComments, diffInfo.file_path],
  )
  const diff = React.useMemo(
    () => computeHunkDiff(diffInfo.old_content, diffInfo.new_content),
    [diffInfo.old_content, diffInfo.new_content],
  )
  const rows = diff.rows
  const hunks = diff.hunks

  // 统计 add/remove 行数
  const stats = React.useMemo(() => {
    let added = 0
    let removed = 0
    for (const r of rows) {
      if (r.op === 'insert') added++
      else if (r.op === 'delete') removed++
    }
    return { added, removed }
  }, [rows])

  const acceptedCount = hunks.length - rejectedHunks.size
  const acceptedIds = React.useMemo(() => {
    const set = new Set<number>()
    for (const h of hunks) if (!rejectedHunks.has(h.id)) set.add(h.id)
    return set
  }, [hunks, rejectedHunks])
  // 「应用所选」落盘内容:以原文为基线只替换已接受 hunk(纯函数,可单测)
  const selectedContent = React.useMemo(
    () => buildPartialContent(diffInfo.old_content, hunks, acceptedIds),
    [diffInfo.old_content, hunks, acceptedIds],
  )

  const toggleHunk = React.useCallback((hunkId: number) => {
    setRejectedHunks((prev) => {
      const next = new Set(prev)
      if (next.has(hunkId)) next.delete(hunkId)
      else next.add(hunkId)
      return next
    })
  }, [])
  // D88:暂存态切换(与 accepted 正交)。staged 仅锁定 hunk,不改变其 accepted 状态。
  const stageHunkById = React.useCallback((hunkId: number) => {
    setStagedHunks((prev) => stageHunk(prev, hunkId))
  }, [])
  const unstageHunkById = React.useCallback((hunkId: number) => {
    setStagedHunks((prev) => unstageHunk(prev, hunkId))
  }, [])
  // 文件级:把本文件全部 hunk 一起暂存 / 清空暂存(即「全部」级,无跨文件容器时落在此处)
  const stageFileHunks = React.useCallback(() => {
    setStagedHunks((prev) => stageHunks(prev, hunks.map((h) => h.id)))
  }, [hunks])
  const unstageFileHunks = React.useCallback(() => {
    setStagedHunks(unstageAll())
  }, [])
  const handleApplySelected = React.useCallback(() => {
    if (!onApplyPartial) return
    setPartialBusy(true)
    void onApplyPartial(selectedContent).finally(() => setPartialBusy(false))
  }, [onApplyPartial, selectedContent])

  /** P3 #30:行级评论触发(hover 行内图标 → 底部面板定位到该行) */
  const handleRowComment = React.useCallback((line: number, lineText: string) => {
    setCommentTarget({ line, lineText })
  }, [])

  const badge = STATUS_BADGE[applyStatus] ?? STATUS_BADGE.pending
  const BadgeIcon = badge.icon
  const isTerminal = applyStatus === 'applied' || applyStatus === 'rejected'
  const isApplying = applyStatus === 'applying'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 p-3">
        <div className="flex w-full items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CardTitle className="flex-1 break-all text-xs font-medium" title={diffInfo.file_path}>
            {diffInfo.file_path}
            {diffInfo.is_new_file && (
              <span className="ml-1.5 rounded-sm bg-blue-500/15 px-1 py-0.5 text-[10px] text-blue-600">
                {t('changes.newFile')}
              </span>
            )}
          </CardTitle>
          {/* P3 #30:本文件已有待发送意见数(让用户知道评论已暂存、将随下一条消息发给 AI) */}
          {fileCommentCount > 0 && (
            <span
              className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-600"
              data-testid="diff-comment-badge"
            >
              {t('diffComment.countBadge', { count: fileCommentCount })}
            </span>
          )}
          {/* D88:文件级(=全部 hunk)暂存 / 还原入口 */}
          {!isTerminal && hunks.length > 0 && (
            <>
              <button
                type="button"
                onClick={stageFileHunks}
                disabled={isApplying || partialBusy}
                className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="diff-stage-file"
              >
                {t('diffHunk.stageFile')}
              </button>
              <button
                type="button"
                onClick={unstageFileHunks}
                disabled={isApplying || partialBusy || stagedHunks.size === 0}
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="diff-unstage-file"
              >
                {t('diffHunk.unstageFile')}
              </button>
            </>
          )}
          <span className="shrink-0 rounded-sm bg-green-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-green-600">
            +{stats.added}
          </span>
          <span className="shrink-0 rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-red-600">
            -{stats.removed}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
              badge.className,
            )}
          >
            {BadgeIcon && <BadgeIcon className={cn('h-3 w-3', isApplying && 'animate-spin')} />}
            <span>{t(badge.labelKey)}</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-80 overflow-auto bg-zinc-950 font-mono text-xs">
          {rows.map((row, idx) => {
            const hunkId = diff.hunkIdByRow[idx] ?? null
            const hunk = hunkId === null ? null : hunks[hunkId]
            // hunk 首行前插入小标题(上一行不属于同一 hunk 即为首行)
            const isHunkStart = hunk !== null && diff.hunkIdByRow[idx - 1] !== hunkId
            return (
              <React.Fragment key={`row-${idx}`}>
                {isHunkStart && hunk && (
                  <HunkHeader
                    hunk={hunk}
                    total={hunks.length}
                    accepted={!rejectedHunks.has(hunk.id)}
                    staged={stagedHunks.has(hunk.id)}
                    disabled={isApplying || partialBusy || isTerminal}
                    onToggle={() => toggleHunk(hunk.id)}
                    onStage={() => stageHunkById(hunk.id)}
                    onUnstage={() => unstageHunkById(hunk.id)}
                  />
                )}
                <DiffRow
                  row={row}
                  activeLine={commentTarget?.line}
                  onComment={handleRowComment}
                  commentLabel={t('diffComment.rowAction')}
                />
              </React.Fragment>
            )
          })}
        </div>
      </CardContent>

      {/* W5:hunk 选择工具条 —— 部分应用的唯一落盘入口(整卡 Accept/Reject 仍在 footer 保留) */}
      {onApplyPartial && !isTerminal && hunks.length > 0 && (
        <HunkToolbar
          acceptedCount={acceptedCount}
          total={hunks.length}
          disabled={isApplying}
          applying={partialBusy}
          onApplySelected={handleApplySelected}
          onClearSelection={() => setRejectedHunks(new Set(hunks.map((h) => h.id)))}
          onReset={() => setRejectedHunks(new Set())}
        />
      )}

      {/* P3 #30:评论输入面板(行级/文件级共用)。用带背景的独立容器,不加分割线(遵循无边框分隔规范) */}
      {commentTarget !== null && (
        <div className="mx-3 mb-2 rounded-sm bg-muted/30 p-2" data-testid="diff-comment-dock">
          <div className="mb-1.5 flex items-center gap-1.5">
            <MessageSquarePlus className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="flex-1 text-[10px] text-muted-foreground">
              {typeof commentTarget.line === 'number'
                ? t('diffComment.targetLine', { line: commentTarget.line })
                : t('diffComment.targetFile')}
            </span>
            <button
              type="button"
              onClick={() => setCommentTarget(null)}
              className="shrink-0 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-accent/40 hover:text-foreground"
              data-testid="diff-comment-close"
            >
              {t('diffComment.close')}
            </button>
          </div>
          <DiffCommentPanel
            filePath={diffInfo.file_path}
            line={commentTarget.line}
            lineText={commentTarget.lineText}
            toolCallId={toolCallId}
            onSubmitted={() => setCommentTarget(null)}
          />
        </div>
      )}

      <CardFooter className="flex items-center gap-2 p-3">
        {isTerminal ? (
          <span className="text-xs text-muted-foreground">
            {applyStatus === 'applied' ? t('diffAppliedHint') : t('diffRejectedHint')}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{isApplying ? t('diffHunk.applyingSelected') : 'Accept'}</span>
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reject</span>
            </button>
          </>
        )}
        {/* P3 #30:文件级评论入口(整体性意见,不绑定具体行)。已终止态下仍可评论(返工需求常在拒绝后提出) */}
        {!isApplying && (
          <button
            type="button"
            onClick={() =>
              setCommentTarget((prev) => (prev && prev.line === undefined ? null : {}))
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            data-testid="diff-comment-file-action"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>{t('diffComment.action')}</span>
          </button>
        )}
        {applyStatus === 'error' && applyError && (
          <Tooltip content={applyError}>
            <span className="ml-auto truncate text-xs text-red-600">{applyError}</span>
          </Tooltip>
        )}
      </CardFooter>
    </Card>
  )
}

/** 单行 diff 渲染(P3 #30:行号区右侧 hover 显示行级评论入口) */
function DiffRow({
  row,
  activeLine,
  onComment,
  commentLabel,
}: {
  row: DiffRow
  activeLine?: number
  onComment?: (line: number, lineText: string) => void
  commentLabel?: string
}) {
  const isAdd = row.op === 'insert'
  const isDel = row.op === 'delete'
  // 行级评论锚定新文件侧行号(返工针对的是新代码);纯删除行无新行号时退回旧行号
  const lineNo = row.newNum ?? row.oldNum
  // W5:行内容改为携带行尾符的 DiffLine,渲染只取 text(行尾符仅供重组使用)
  const lineText = (isAdd ? row.newLine?.text : row.oldLine?.text) ?? ''
  const isActive = activeLine !== undefined && activeLine === lineNo
  return (
    <div
      className={cn(
        'group flex',
        isAdd && 'bg-green-500/15',
        isDel && 'bg-red-500/15',
        isActive && 'ring-1 ring-inset ring-primary/60',
      )}
    >
      <span className="w-10 shrink-0 select-none px-2 text-right text-zinc-600">
        {row.oldNum ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none px-2 text-right text-zinc-600">
        {row.newNum ?? ''}
      </span>
      <span
        className={cn(
          'w-4 shrink-0 text-center',
          isAdd && 'text-green-400',
          isDel && 'text-red-400',
          !isAdd && !isDel && 'text-zinc-600',
        )}
      >
        {isAdd ? '+' : isDel ? '-' : ''}
      </span>
      <span className="whitespace-pre pr-2 text-zinc-300">{lineText}</span>
      {onComment && lineNo !== undefined && (
        <button
          type="button"
          onClick={() => onComment(lineNo, lineText)}
          aria-label={commentLabel}
          className="ml-auto mr-1 shrink-0 self-center rounded-sm p-0.5 text-zinc-600 opacity-0 transition-opacity hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100 focus-visible:opacity-100"
          data-testid={`diff-row-comment-${lineNo}`}
        >
          <MessageSquarePlus className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export default InlineDiffCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
