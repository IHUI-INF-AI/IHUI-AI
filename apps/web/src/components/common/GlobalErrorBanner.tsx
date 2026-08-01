'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, AlertCircle } from 'lucide-react'

import { useErrorBannerStore } from '@/stores/error-banner'

/**
 * GlobalErrorBanner — 全局错误通知条(2026-08-01 立)。
 *
 * 设计目标(用户需求):
 * - 错误提示从页面顶部滑下来(translate-y -100% → 0)
 * - 常驻直到用户关闭或错误解决(不自动消失)
 * - 多条错误堆叠,每条可独立关闭
 * - 错误消息自动中文化(由 error-banner store 的 toUserFriendlyMessage 处理)
 *
 * 挂载位置:MainShell 工作区卡片内 <main> 之前,固定在卡片顶部不随内容滚动。
 *
 * 配套动画:globals.css 的 @keyframes error-slide-down
 */
export function GlobalErrorBanner() {
  const t = useTranslations('errors')
  const errors = useErrorBannerStore((s) => s.errors)
  const clearError = useErrorBannerStore((s) => s.clearError)
  const clearAll = useErrorBannerStore((s) => s.clearAll)

  if (errors.length === 0) return null

  return (
    <div
      className="flex flex-col gap-1.5 px-3 pt-2"
      role="region"
      aria-label={t('region')}
    >
      {errors.map((err) => (
        <div
          key={err.id}
          className="animate-error-slide-down flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1 break-words">{err.message}</span>
          <button
            type="button"
            onClick={() => clearError(err.id)}
            className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-destructive/20"
            aria-label={t('dismiss')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {errors.length > 1 ? (
        <button
          type="button"
          onClick={clearAll}
          className="self-end text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('clearAll')}
        </button>
      ) : null}
    </div>
  )
}

export default GlobalErrorBanner
