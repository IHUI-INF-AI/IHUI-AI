// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

// 按轮变更集审查 Dialog(批次 4 web 腿):
// 列出当前会话的 turn change set → 展开逐文件 unified diff → 预演/实发回滚。
// 数据与 loading/error 全在 useTurnChangesStore;本组件只读状态、只派发动作。
// diff 排版复用 `InlineDiffViewer`(与 session-diff / chat 卡片同一套 monospace 配色),
// 端内不自写第三份 +/− 着色实现。

'use client'

import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, FileDiff, RotateCcw } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { InlineDiffViewer } from './inline-diff-viewer'
import { useTurnChangesStore } from '@/stores/turn-changes'
import type {
  TurnChangeFile,
  TurnChangeRewindResult,
  TurnChangeSummary,
} from '@/lib/turn-changes-api'

const STATUS_CLASS: Record<TurnChangeSummary['status'], string> = {
  open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  committed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

const REWIND_STATUS_CLASS: Record<TurnChangeSummary['rewindStatus'], string> = {
  available: 'bg-muted text-muted-foreground',
  rewinding: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rewound: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  conflict: 'bg-red-500/10 text-red-600 dark:text-red-400',
  unavailable: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

function FileRow({ file }: { file: TurnChangeFile }) {
  const t = useTranslations('chat.turnChangeReview')
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 bg-muted/40 px-2 py-1.5 text-label">
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          {t(`operation_${file.operation}`)}
        </span>
        <span className="truncate font-medium" title={file.path}>
          {file.path}
        </span>
        <span className="ml-auto shrink-0 tabular-nums text-emerald-600 dark:text-emerald-400">
          +{file.additions}
        </span>
        <span className="shrink-0 tabular-nums text-red-600 dark:text-red-400">
          −{file.deletions}
        </span>
      </div>
      {file.contentTruncated && (
        <p className="px-3 py-1 text-label text-muted-foreground">{t('truncated')}</p>
      )}
      {!file.rewindTracked && (
        <p className="px-3 py-1 text-label text-amber-600 dark:text-amber-400">
          {t('fileOutOfRange')}
        </p>
      )}
      {file.rewindAppliedAt && (
        <p className="px-3 py-1 text-label text-muted-foreground">
          {t('rewindAppliedAt', { time: new Date(file.rewindAppliedAt).toLocaleString() })}
        </p>
      )}
      {file.unifiedDiff ? (
        <InlineDiffViewer content={file.unifiedDiff} />
      ) : (
        <p className="px-3 py-2 text-label text-muted-foreground">{t('noDiff')}</p>
      )}
    </div>
  )
}

function PreviewResult({ result }: { result: TurnChangeRewindResult }) {
  const t = useTranslations('chat.turnChangeReview')
  const statusTitle = t(`rewindResult_${result.status}`)
  // 回滚结果在 api-client 是开放记录:上游旧版本可能缺 actions/conflicts,
  // UI 只做展示,不该因为一个可选字段缺席整块崩掉
  const conflicts = result.conflicts ?? []
  const actions = result.actions ?? []
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2 text-label">
      <p
        className={
          result.status === 'ok'
            ? 'font-medium text-emerald-600 dark:text-emerald-400'
            : 'font-medium text-amber-600 dark:text-amber-400'
        }
      >
        {statusTitle}
        {result.dryRun ? ` · ${t('dryRunBadge')}` : ''}
      </p>
      {result.status === 'unavailable' && (
        <p className="text-muted-foreground">{t('unavailableReason')}</p>
      )}
      {conflicts.length > 0 && (
        <p className="text-red-600 dark:text-red-400">
          {t('conflictPaths', { paths: conflicts.join(', ') })}
        </p>
      )}
      {actions.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {actions.map((a) => (
            <li key={`${a.operation}-${a.path}`} className="flex items-center gap-2">
              <span className="shrink-0 rounded-sm bg-background px-1.5 py-0.5 text-[10px]">
                {t(`previewAction_${a.action}`)}
              </span>
              <span className="truncate" title={a.path}>
                {a.path}
              </span>
              {a.conflict && (
                <span className="ml-auto shrink-0 text-red-600 dark:text-red-400">
                  {t('conflictBadge')}
                </span>
              )}
              {a.reason && (
                <span className="shrink-0 text-muted-foreground" title={a.reason}>
                  {t('actionReasonHint')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!result.dryRun && result.status === 'ok' && (
        <p className="text-muted-foreground">{t('confirmDone', { count: result.applied })}</p>
      )}
    </div>
  )
}

function TurnChangeItem({ item }: { item: TurnChangeSummary }) {
  const t = useTranslations('chat.turnChangeReview')
  const expanded = useTurnChangesStore((s) => s.expandedId === item.id)
  const toggle = useTurnChangesStore((s) => s.toggle)
  const detail = useTurnChangesStore((s) => s.details[item.id])
  const preview = useTurnChangesStore((s) => s.previews[item.id])
  const applying = useTurnChangesStore((s) => s.applyingId === item.id)
  const previewRewind = useTurnChangesStore((s) => s.previewRewind)
  const confirmRewind = useTurnChangesStore((s) => s.confirmRewind)

  const canConfirm =
    preview?.phase === 'ready' &&
    preview.result?.dryRun === true &&
    preview.result.status === 'ok' &&
    (preview.result.conflicts ?? []).length === 0

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-body hover:bg-accent/50"
        aria-expanded={expanded}
        onClick={() => void toggle(item.id)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <FileDiff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium" title={item.turnId}>
          {t('turnLabel', { turn: item.turnId.slice(0, 8) })}
        </span>
        <span className="shrink-0 text-label text-muted-foreground">
          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
        </span>
        <span
          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[item.status]}`}
        >
          {t(`status_${item.status}`)}
        </span>
        {item.rewindStatus !== 'available' && (
          <span
            className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${REWIND_STATUS_CLASS[item.rewindStatus]}`}
          >
            {t(`rewind_${item.rewindStatus}`)}
          </span>
        )}
        <span className="ml-auto shrink-0 text-label text-muted-foreground">
          {t('fileCount', { count: item.fileCount })}
        </span>
        <span className="shrink-0 tabular-nums text-emerald-600 dark:text-emerald-400">
          +{item.additions}
        </span>
        <span className="shrink-0 tabular-nums text-red-600 dark:text-red-400">
          −{item.deletions}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2">
          {detail?.phase === 'loading' && (
            <p className="py-2 text-center text-label text-muted-foreground">
              {t('detailLoading')}
            </p>
          )}
          {detail?.phase === 'error' && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-label">
              <span className="text-destructive">{detail.error || t('detailError')}</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="self-start"
                onClick={() => void toggle(item.id)}
              >
                {t('retry')}
              </Button>
            </div>
          )}
          {detail?.phase === 'ready' && detail.detail && (
            <>
              <div className="flex flex-col gap-2">
                {detail.detail.files.map((f) => (
                  <FileRow key={f.path} file={f} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={preview?.phase === 'loading' || applying}
                  onClick={() => void previewRewind(item.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {preview?.phase === 'loading' ? t('previewing') : t('preview')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={!canConfirm || applying}
                  title={!canConfirm ? t('confirmDisabled') : undefined}
                  onClick={() => void confirmRewind(item.id)}
                >
                  {applying ? t('confirming') : t('confirm')}
                </Button>
              </div>
              {!canConfirm && !preview && (
                <p className="text-label text-muted-foreground">{t('confirmDisabled')}</p>
              )}
              {preview?.phase === 'error' && (
                <p className="text-label text-destructive">{preview.error || t('previewError')}</p>
              )}
              {preview?.phase === 'ready' && preview.result && (
                <PreviewResult result={preview.result} />
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}

export function ChangeSetReviewDialog() {
  const t = useTranslations('chat.turnChangeReview')
  const open = useTurnChangesStore((s) => s.open)
  const close = useTurnChangesStore((s) => s.close)
  const items = useTurnChangesStore((s) => s.items)
  const listPhase = useTurnChangesStore((s) => s.listPhase)
  const listError = useTurnChangesStore((s) => s.listError)
  const reload = useTurnChangesStore((s) => s.reload)

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span>{t('title')}</span>
            <span className="ml-2 text-label font-normal text-muted-foreground">
              {t('turnCount', { count: items.length })}
            </span>
          </DialogTitle>
        </DialogHeader>

        {listPhase === 'loading' && (
          <p className="py-6 text-center text-body text-muted-foreground">{t('loading')}</p>
        )}

        {listPhase === 'error' && (
          <div className="flex flex-col items-center gap-2 py-6 text-body">
            <p className="text-destructive">{listError || t('loadError')}</p>
            <Button type="button" size="xs" variant="outline" onClick={() => void reload()}>
              {t('retry')}
            </Button>
          </div>
        )}

        {listPhase === 'ready' && items.length === 0 && (
          <p className="py-6 text-center text-body text-muted-foreground">{t('empty')}</p>
        )}

        {listPhase === 'ready' && items.length > 0 && (
          <ul className="-mx-1 flex max-h-[66vh] flex-col gap-1 overflow-y-auto px-1">
            {items.map((item) => (
              <TurnChangeItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
