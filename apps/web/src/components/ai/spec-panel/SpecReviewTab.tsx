// Spec 模式面板:评审标签页
import { Loader2, CheckCircle, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecPanelApi } from './useSpecPanel'
import { STATUS_BADGE, STATUS_LABEL } from './constants'

export function SpecReviewTab({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">当前状态:</span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            STATUS_BADGE[p.currentStatus] || STATUS_BADGE.draft,
          )}
        >
          {STATUS_LABEL[p.currentStatus] || p.currentStatus}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(p.currentStatus === 'draft' || p.currentStatus === 'rejected') && (
          <button
            type="button"
            onClick={p.handleSubmitReview}
            disabled={p.reviewLoading}
            className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {p.reviewLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            <span>提交评审</span>
          </button>
        )}
        {p.currentStatus === 'pending_review' && (
          <>
            <button
              type="button"
              onClick={p.handleApprove}
              disabled={p.reviewLoading}
              className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-600/90 disabled:opacity-60"
            >
              {p.reviewLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              <span>通过</span>
            </button>
            <button
              type="button"
              onClick={p.handleReject}
              disabled={p.reviewLoading}
              className="flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              <Square className="h-3 w-3" />
              <span>拒绝</span>
            </button>
            <input
              type="text"
              value={p.reviewComment}
              onChange={(e) => p.setReviewComment(e.target.value)}
              placeholder={t('rejectReasonPlaceholder')}
              className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
            />
          </>
        )}
        {(p.currentStatus === 'approved' || p.currentStatus === 'rejected') && (
          <p className="text-xs text-muted-foreground">
            评审已结束,如需重新评审请先修改 spec 并重新生成
          </p>
        )}
      </div>
    </div>
  )
}
