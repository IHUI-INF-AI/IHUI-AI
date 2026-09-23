// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileQuestion, History, RefreshCw, X } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Tooltip, TooltipProvider } from '@/components/feedback'
import { cn } from '@/lib/utils'
import {
  formatPreviewReadTime,
  previewCopyText,
  type PreviewCopyKey,
  type PreviewTranslator,
  type PreviewValues,
} from './preview-degradation-copy'
import type { PreviewNoticeKind } from './use-preview-staleness'

/**
 * 预览降级标识与提示条(D90 / G-123)。三块都是"内容身份"的告知,不是错误弹窗:
 *  - PreviewSnapshotNotice:快照态(L1 徽章 + L2/L3 说明),压在正文上方
 *  - PreviewNoContentState:什么都拿不到(L4),并给"刷新"这一步动作
 *  - PreviewFileUpdatedBar:文件已更新,可选"刷新以查看最新内容",可关闭
 * 文案取词一律走 previewCopyText(有键取键、无键回落),缺词也不喷键名。
 */

export type PreviewCopy = (key: PreviewCopyKey, values?: Record<string, string | number>) => string

interface PreviewSnapshotNoticeProps {
  readonly isRecord: boolean
  readonly notice: PreviewNoticeKind
  readonly readAt: number | null
  readonly copy: PreviewCopy
}

/** 可见内容属于历史快照时的标识条:`isRecord` 为真才渲染,当前内容不打扰用户。 */
export function PreviewSnapshotNotice({
  isRecord,
  notice,
  readAt,
  copy,
}: PreviewSnapshotNoticeProps): React.ReactElement | null {
  if (!isRecord && notice === null) return null
  const noticeText =
    notice === 'cannot-read'
      ? copy('previewSnapshotNotice')
      : notice === 'incomplete'
        ? copy('previewIncompleteChange')
        : null
  return (
    <div
      data-preview-state="record"
      data-preview-notice={notice ?? 'snapshot'}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-card px-3 py-1.5"
    >
      <span className="inline-flex h-4 items-center gap-1 rounded-sm bg-muted px-1.5 text-[10px] font-semibold leading-none text-muted-foreground">
        <History className="h-3 w-3 shrink-0" />
        <span>{copy('previewSnapshotBadge')}</span>
      </span>
      {readAt !== null && (
        <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
          {copy('previewSnapshotReadAt', { time: formatPreviewReadTime(readAt) })}
        </span>
      )}
      {noticeText && (
        <p role="status" className="w-full text-xs leading-none text-muted-foreground">
          {noticeText}
        </p>
      )}
    </div>
  )
}

interface PreviewNoContentStateProps {
  readonly copy: PreviewCopy
  readonly onRefresh: () => void
  readonly refreshLabel: string
  readonly className?: string
}

/** 既读不到当前文件、也没有任何历史记录可展示 —— 必须带下一步动作,不能只说"不行"。 */
export function PreviewNoContentState({
  copy,
  onRefresh,
  refreshLabel,
  className,
}: PreviewNoContentStateProps): React.ReactElement {
  return (
    <div
      data-preview-state="no-content"
      className={cn('flex flex-col items-center gap-2 p-3 text-muted-foreground', className)}
    >
      <FileQuestion className="h-8 w-8" />
      <p role="status" className="text-sm">
        {copy('previewNoContent')}
      </p>
      <Button size="xs" variant="outline" onClick={onRefresh}>
        <RefreshCw className="h-3 w-3" />
        <span>{refreshLabel}</span>
      </Button>
    </div>
  )
}

interface PreviewFileUpdatedBarProps {
  readonly copy: PreviewCopy
  readonly closeLabel: string
  readonly onApply: () => void
  readonly onDismiss: () => void
}

/** 关闭只是收起提示,内容仍是快照 —— 快照徽章由 PreviewSnapshotNotice 继续持有。 */
export function PreviewFileUpdatedBar({
  copy,
  closeLabel,
  onApply,
  onDismiss,
}: PreviewFileUpdatedBarProps): React.ReactElement {
  return (
    <div
      data-preview-state="file-updated"
      className="flex items-center justify-between gap-2 bg-card px-3 py-1"
    >
      <span className="inline-flex h-4 items-center gap-1 text-xs font-medium leading-none">
        <RefreshCw className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span>{copy('previewFileUpdated')}</span>
      </span>
      <span className="flex items-center gap-1">
        <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={onApply}>
          <span>{copy('previewFileUpdatedAction')}</span>
        </Button>
        {/* TooltipProvider 在本仓是按页挂载的(见 app/(main)/**),提示条可能出现在任何
            预览宿主里,故自带一层,避免宿主没挂 provider 时整块预览抛错白屏 */}
        <TooltipProvider>
          <Tooltip content={closeLabel}>
            <Button size="icon-2xs" variant="ghost" aria-label={closeLabel} onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </TooltipProvider>
      </span>
    </div>
  )
}

/** 组件侧的取词适配器:调用点只需一个 `copy(key)`。 */
export function usePreviewCopy(t?: PreviewTranslator): PreviewCopy {
  return React.useCallback(
    (key: PreviewCopyKey, values?: PreviewValues) => previewCopyText(t, key, values),
    [t],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
