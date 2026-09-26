// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { Download, FileQuestion, FileWarning, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * 富预览失败态卡(V3 #70)。
 *
 * 立门理由:旧的 CSV 预览失败时渲染的是一条**和"没有预览"长得一模一样**的下载链接,
 * 用户分不清"文件坏了"与"这端压根没做预览"。票面要求"明确错误卡文案,不得白屏、
 * 不得吞异常" —— 这一型的问题是**两种故障在界面上同形**,所以每态各给一条文案 + 一个出口。
 */

/** 失败判据(封闭集):新增一态必须同时补文案与测试,不得折进 'failed'。 */
export type FilePreviewFailure =
  | 'tooLarge'
  | 'typeMismatch'
  | 'corrupt'
  | 'empty'
  | 'unsupported'
  | 'failed'

export interface PreviewErrorCardProps {
  readonly failure: FilePreviewFailure
  /** 归一化扩展名(用于把"到底是哪个后缀"说清楚,不猜)。 */
  readonly ext?: string
  /** 原始 href:错误态**始终**保留下载出口。 */
  readonly href: string
  /** 额外细节(如 HTTP 状态),只作诊断展示,不作为唯一信号。 */
  readonly detail?: string
  readonly className?: string
}

/** 图标按"是不是我们的错"分两型:内容问题 FileWarning,能力问题 FileQuestion。 */
const FAILURE_ICON: Record<FilePreviewFailure, typeof FileWarning> = {
  tooLarge: FileWarning,
  typeMismatch: ShieldAlert,
  corrupt: FileWarning,
  empty: FileQuestion,
  unsupported: FileQuestion,
  failed: FileWarning,
}

export function PreviewErrorCard({
  failure,
  ext,
  href,
  detail,
  className,
}: PreviewErrorCardProps) {
  const t = useTranslations('chat')
  const Icon = FAILURE_ICON[failure]

  const message = (() => {
    switch (failure) {
      case 'tooLarge':
        return t('officeTooLarge')
      case 'unsupported':
        return t('officeUnsupported')
      case 'typeMismatch':
        return t('filePreviewTypeMismatch', { ext: ext || '—' })
      case 'corrupt':
        return t('filePreviewCorrupt')
      case 'empty':
        return t('filePreviewEmpty')
      case 'failed':
        return detail ? `${t('officeFailed')} (${detail})` : t('officeFailed')
    }
  })()

  return (
    <div
      className={cn(
        'my-0 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2',
        className,
      )}
      data-testid="file-preview-error-card"
      data-preview-failure={failure}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{fileNameOf(href)}</p>
        <p className="text-sm">{message}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        download={fileNameOf(href)}
        className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        data-testid="file-preview-error-download"
      >
        <Download className="h-3 w-3" />
        <span>{t('officeDownload')}</span>
      </a>
    </div>
  )
}

/** 从 href 取文件名(去 query/hash),供错误卡与无障碍名称用。 */
export function fileNameOf(href: string): string {
  const tail = href.split('?')[0]?.split('#')[0] ?? ''
  return tail.split('/').pop() || tail
}
