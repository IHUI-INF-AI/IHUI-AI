'use client'

import * as React from 'react'
import { ExternalLink, Loader2, AlertTriangle, ImageIcon } from 'lucide-react'
import { cn } from '../lib/utils.js'

/**
 * 通用 WebView 抽象组件。
 * 根据 mode 渲染:iframe(直接嵌入)/ screenshot(截图模式)/ external(外部打开兜底)。
 *
 * 各端可基于此组件扩展:
 * - web: iframe + 后端 Playwright 降级
 * - desktop: Tauri WebView2(覆盖 render props)
 * - mobile-rn: 用 react-native-webview(各端自实现,不使用此组件)
 *
 * 圆角守门:容器用 rounded-lg(8px),禁用 rounded-full。
 * 图标垂直对齐依赖全局 --text-vcenter-offset CSS 变量(已在 globals.css 配置)。
 */

export type WebViewMode = 'iframe' | 'screenshot' | 'external'
export type WebViewStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'screenshot'
  | 'failed'
  | 'blocked'

export interface WebViewFrameProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onLoad' | 'onError'> {
  /** 当前 URL */
  url: string
  /** 嵌入模式 */
  mode: WebViewMode
  /** 加载状态 */
  status: WebViewStatus
  /** 截图 base64(screenshot 模式,不含 data: 前缀) */
  screenshot?: string
  /** 页面标题 */
  title?: string
  /** 错误信息 */
  error?: string
  /** iframe sandbox 属性(默认 allow-same-origin allow-scripts allow-forms allow-popups) */
  sandbox?: string
  /** iframe 加载完成回调 */
  onLoad?: () => void
  /** iframe 加载失败回调 */
  onError?: (error: string) => void
  /** "在外部打开"点击回调(status=external/failed 时显示) */
  onOpenExternal?: (url: string) => void
  /** 重试回调 */
  onRetry?: () => void
}

export const WebViewFrame = React.forwardRef<HTMLDivElement, WebViewFrameProps>(
  (
    {
      url,
      mode,
      status,
      screenshot,
      title,
      error,
      sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups',
      onLoad,
      onError,
      onOpenExternal,
      onRetry,
      className,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn('relative h-full w-full overflow-hidden rounded-lg bg-background', className)}
        {...rest}
      >
        {/* 加载中遮罩 */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">加载中...</span>
            </div>
          </div>
        )}

        {/* iframe 模式 */}
        {mode === 'iframe' && url && (
          <iframe
            key={url}
            src={url}
            title={title ?? url}
            className="h-full w-full border-0"
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={onLoad}
            onError={() => onError?.('iframe load failed')}
          />
        )}

        {/* 截图模式 */}
        {mode === 'screenshot' && (
          <div className="flex h-full w-full flex-col">
            {screenshot ? (
              <>
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>该网站禁止嵌入,已切换到截图模式</span>
                </div>
                <div className="flex-1 overflow-auto bg-muted/20 p-2">
                  <img
                    src={`data:image/png;base64,${screenshot}`}
                    alt={title ?? url}
                    className="h-auto w-full rounded-md border border-border shadow-sm"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* 外部打开 / 失败兜底 */}
        {(mode === 'external' || status === 'failed' || status === 'blocked') && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            {status === 'blocked' || status === 'failed' ? (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            ) : (
              <ExternalLink className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status === 'blocked'
                  ? 'URL 不安全,已拦截'
                  : status === 'failed'
                    ? '加载失败'
                    : '无法在面板内嵌入'}
              </p>
              <p className="max-w-xs truncate text-xs text-muted-foreground" title={url}>
                {url}
              </p>
              {error && <p className="text-xs text-muted-foreground">{error}</p>}
            </div>
            <div className="flex gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  重试
                </button>
              )}
              {onOpenExternal && (
                <button
                  type="button"
                  onClick={() => onOpenExternal(url)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>在外部浏览器打开</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* idle 空状态 */}
        {status === 'idle' && !url && (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span className="text-xs">输入网址或点击 AI 消息中的链接以打开</span>
          </div>
        )}
      </div>
    )
  },
)
WebViewFrame.displayName = 'WebViewFrame'
