// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


'use client'

/**
 * D166 链接预览卡(2026-09-30 立,承 V4 §9.4③)。
 *
 * 纯展示组件:输入区上方的链接预览三态卡,数据由 useLinkPreview 注入,
 * 本组件不取数、不触碰发送路径(预览失败不阻止发送的结构性前提)。
 *
 * 三态文案(竞品 previewLoading / previewUnavailable 之外补"未判定"):
 *   - loading       "正在加载链接预览..."
 *   - ok            标题 + 摘要(title 缺省回落展示主机名)
 *   - unavailable   "无法读取链接预览"(判定读不到:404/410/5xx)
 *   - undetermined  "暂时无法判定该链接"(需登录/超时/内网 —— 未判定 ≠ 读不到)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Globe, Loader2, ShieldQuestion, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { LinkPreviewState } from '@/hooks/use-link-preview'

export interface LinkPreviewCardProps {
  /** 当前预览态;null ⇒ 不渲染(零占位)。 */
  preview: LinkPreviewState | null
  onDismiss: () => void
  className?: string
  'data-testid'?: string
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function LinkPreviewCard({ preview, onDismiss, className, 'data-testid': testId }: LinkPreviewCardProps) {
  const t = useTranslations('chat.linkPreview')

  if (!preview) return null

  const icon =
    preview.status === 'loading' ? (
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
    ) : preview.status === 'unavailable' ? (
      <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
    ) : preview.status === 'undetermined' ? (
      <ShieldQuestion className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    ) : (
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    )

  let body: React.ReactNode
  if (preview.status === 'loading') {
    body = <span className="text-muted-foreground">{t('loading')}</span>
  } else if (preview.status === 'unavailable') {
    body = (
      <span className="font-medium text-destructive">
        {t('unavailable')}
        <span className="ml-2 font-normal text-muted-foreground/70">{`(${preview.reason})`}</span>
      </span>
    )
  } else if (preview.status === 'undetermined') {
    body = <span className="text-muted-foreground">{t('undetermined')}</span>
  } else {
    body = (
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {preview.title ?? hostnameOf(preview.url)}
        </span>
        {preview.description ? (
          <span className="mt-0.5 line-clamp-2 block text-muted-foreground">{preview.description}</span>
        ) : null}
      </span>
    )
  }

  return (
    <div
      data-testid={testId ?? 'link-preview-card'}
      data-preview-status={preview.status}
      role="status"
      className={cn(
        'mx-1 mb-1 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs',
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{body}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="shrink-0 rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
