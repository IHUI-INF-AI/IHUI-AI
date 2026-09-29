// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { RotateCcw } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { FALLBACK_REASON_QUOTA_EQUIVALENT, type FallbackEvent } from '@ihui/api-client'

export interface FallbackBannerProps {
  fallbackNotice: FallbackEvent
  onClearFallbackNotice?: () => void
  t: (key: string, values?: Record<string, string | number | Date>) => string
  /** D56① 额度恢复后续跑询问(缺省不展示,保持旧横幅形态) */
  resumePrompt?: ResumePromptState | null
  /** D56① 继续刚才中断的任务 */
  onResumeInterrupted?: () => void
  /** D56① 稍后再说(关闭续跑询问) */
  onDismissResume?: () => void
}

/** D56① 续跑询问状态(额度恢复后是否提示继续中断任务) */
export interface ResumePromptState {
  /** 为 true 才渲染续跑行 */
  visible: boolean
  /** 中断任务一句话描述(可选,如轮次摘要;缺省只显示通用询问) */
  taskLabel?: string
}

/**
 * P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色)。
 *
 * 2026-09-22 批次 60 配套:后端"同族等效替换"(reason=quota_equivalent)不能沿用
 * "原模型暂时不可用"这句 —— 真实原因是厂商账号额度用尽、换的是**另一个模型**而非
 * 同模型的备用通道,用户必须知道"本次由 X 作答"才不会按原模型的能力去理解回答质量。
 */
export function FallbackBanner({
  fallbackNotice,
  onClearFallbackNotice,
  t,
  resumePrompt,
  onResumeInterrupted,
  onDismissResume,
}: FallbackBannerProps) {
  const isQuotaEquivalent = fallbackNotice.reason === FALLBACK_REASON_QUOTA_EQUIVALENT
  const noticeText = isQuotaEquivalent
    ? t('fallbackNoticeQuota', {
        primary: fallbackNotice.primaryModel,
        backup: fallbackNotice.backupModel,
      })
    : t('fallbackNotice', {
        primary: fallbackNotice.primaryModel,
        backup: fallbackNotice.backupModel,
      })
  // D56① 英文过渡(词表释放后换中文键):packages/i18n 词表被占用,fallback 先用英文过渡
  // (见 D56 键清单 en 列),词表可用后换回中文;过渡串不得暗示必须充值。
  const pickText = (key: string, fallback: string): string => {
    const raw: string = t(key)
    return raw === key ? fallback : raw
  }
  const resumeTitle = pickText(
    'resumeRecoveredTitle',
    'Quota restored, resume the interrupted task?',
  )
  const resumeConfirm = pickText('resumeConfirm', 'Resume')
  const resumeDismiss = pickText('resumeDismiss', 'Later')
  const resumeFreeHint = pickText('resumeFreeHint', 'Free quota remains available')
  const showResume = resumePrompt?.visible === true
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        <span>{noticeText}</span>
        {onClearFallbackNotice && (
          <button
            type="button"
            onClick={onClearFallbackNotice}
            className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            aria-label="close"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {showResume && (
        <div
          data-testid="fallback-resume-prompt"
          className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <span className="flex min-w-0 items-center gap-2">
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{resumeTitle}</span>
              {resumePrompt?.taskLabel ? (
                <span className="block truncate text-xs opacity-80">
                  <span>{resumePrompt.taskLabel}</span>
                </span>
              ) : null}
              <span data-testid="fallback-resume-free-hint" className="block text-xs opacity-80">
                <span>{resumeFreeHint}</span>
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Button size="xs" data-testid="fallback-resume-confirm" onClick={onResumeInterrupted}>
              {resumeConfirm}
            </Button>
            <Button
              size="xs"
              variant="outline"
              data-testid="fallback-resume-dismiss"
              onClick={onDismissResume}
            >
              {resumeDismiss}
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
