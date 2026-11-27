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

export function LinkPreviewCard({
  preview,
  onDismiss,
  className,
  'data-testid': testId,
}: LinkPreviewCardProps) {
  const t = useTranslations('chat.linkPreview')
  // 图标加载失败按 URL 记账,不按布尔:换一条链接时天然复位,不需要 effect。
  const [failedIcon, setFailedIcon] = React.useState<string | null>(null)

  if (!preview) return null

  const iconSrc =
    preview.status === 'ok' && preview.icon?.startsWith('data:image/') ? preview.icon : ''

  // 把后端 reason 映射成具体人话:同一句"暂时无法判定"会让用户无法判断是登录墙、
  // 超时还是地址被拦。未知 reason 才回落到三态总文案(未判定 ≠ 读不到)。
  const reasonText = (fallback: 'unavailable' | 'undetermined'): string => {
    const reason = ('reason' in preview ? preview.reason : '') ?? ''
    switch (reason) {
      case 'timeout':
        return t('reasonTimeout')
      case 'network_error':
      case 'probe_error':
      case 'probe_request_failed':
        return t('reasonNetwork')
      case 'ssrf_blocked':
        return t('reasonBlocked')
      case 'invalid_host':
      case 'invalid_url':
      case 'unsupported_scheme':
        return t('reasonInvalid')
      case 'read_error':
        return t('reasonReadError')
      case 'http_401':
      case 'http_403':
        return t('reasonLogin')
      case 'http_429':
        return t('reasonRateLimited')
      case 'http_404':
        return t('reasonNotFound')
      case 'http_410':
        return t('reasonGone')
      default:
        if (reason?.startsWith('http_5')) return t('reasonServerError')
        return fallback === 'unavailable' ? t('unavailable') : t('undetermined')
    }
  }

  const host = preview.status === 'ok' ? hostnameOf(preview.url) : ''
  // 站点字母块:不请求 favicon(既有 SSRF 面不动),用主机首字母做轻量站点标识。
  const monogramHost = host.replace(/^www\./i, '')
  const monogram = /^[a-z0-9]/i.test(monogramHost) ? monogramHost.charAt(0).toUpperCase() : null

  const icon =
    preview.status === 'loading' ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : preview.status === 'unavailable' ? (
      <X className="h-3.5 w-3.5" aria-hidden />
    ) : preview.status === 'undetermined' ? (
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <Globe className="h-3.5 w-3.5" aria-hidden />
    )

  const tileTone =
    preview.status === 'ok'
      ? 'border-border/70 bg-gradient-to-br from-muted to-muted/40 text-foreground/70'
      : preview.status === 'loading'
        ? 'border-border/50 bg-muted/50 text-muted-foreground'
        : preview.status === 'undetermined'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'border-destructive/25 bg-destructive/10 text-destructive'

  let body: React.ReactNode
  if (preview.status === 'loading') {
    body = (
      <span className="block truncate text-[12.5px] leading-5 text-muted-foreground">
        {t('loading')}
      </span>
    )
  } else if (preview.status === 'unavailable') {
    body = (
      <span className="block truncate text-[12.5px] font-medium leading-5 text-destructive/90">
        {reasonText('unavailable')}
      </span>
    )
  } else if (preview.status === 'undetermined') {
    body = (
      <span className="block truncate text-[12.5px] leading-5 text-muted-foreground">
        {reasonText('undetermined')}
      </span>
    )
  } else {
    body = (
      <span className="block min-w-0">
        <span className="block truncate text-[13px] font-medium leading-5 text-foreground">
          {preview.title ?? host}
        </span>
        {preview.title ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
            <span className="truncate">{host}</span>
            {preview.description ? (
              <>
                <span className="shrink-0 text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <span className="truncate text-muted-foreground/80">{preview.description}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <div
      data-testid={testId ?? 'link-preview-card'}
      data-preview-status={preview.status}
      role="status"
      title={preview.status === 'ok' ? preview.url : undefined}
      className={cn(
        'mx-1 mb-1.5 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/85 px-2 py-1.5 text-label shadow-sm backdrop-blur-sm transition-colors hover:border-border',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', tileTone)}
      >
        {preview.status === 'ok' && iconSrc && failedIcon !== preview.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- 20px 固定尺寸的 data URL 图标,无需 next/image 管线
          <img
            src={iconSrc}
            alt=""
            aria-hidden
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedIcon(preview.icon ?? null)}
            className="h-5 w-5 rounded-[3px] object-contain"
          />
        ) : preview.status === 'ok' && monogram ? (
          <span className="text-[13px] font-semibold tracking-tight">{monogram}</span>
        ) : (
          icon
        )}
      </span>
      <div className="min-w-0 flex-1">{body}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismiss')}
        className="-mr-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
