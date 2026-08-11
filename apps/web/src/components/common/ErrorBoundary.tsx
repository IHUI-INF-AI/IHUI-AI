'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useNavigationStore } from '@/stores/navigation'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 min-[768px]:p-8 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h3 className="text-base font-medium">{t('errorTitle')}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message ?? t('unknownError')}
      </p>
      <button
        onClick={onReset}
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </button>
    </div>
  )
}

/**
 * 2026-08-02 修复: Bug 9 — 不依赖任何 context 的纯静态 fallback。
 * 当 next-intl Provider 自身崩溃时,原 ErrorFallback 调用 useTranslations 会二次抛错,
 * 导致整个错误边界无效。StaticErrorFallback 不依赖任何 Provider,作为默认 fallback。
 */
function StaticErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h1 className="text-2xl font-bold">页面出错了</h1>
      <p className="text-muted-foreground">应用发生了错误,请刷新页面重试</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        重试
      </button>
    </div>
  )
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info)
    // 2026-08-11: 崩溃时重置 navigation pending 状态,防止骨架屏覆盖层永久遮挡内容区。
    // 与 error.tsx 的 useEffect 逻辑一致,覆盖 ErrorBoundary 包裹的场景。
    useNavigationStore.getState().end()
    // 2026-08-06: 崩溃自动上报(crash_reports 链路,POST /api/crash-reports)。
    // 静默失败:上报失败 / 环境异常绝不影响 UI 渲染。
    if (typeof window !== 'undefined') {
      try {
        void fetch('/api/crash-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'web',
            errorMessage: error?.message ?? 'unknown error',
            stack: error?.stack,
            route: window.location.pathname,
          }),
        }).catch(() => {})
      } catch {
        /* 上报失败静默 */
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      // 2026-08-02 修复: Bug 9 — 默认 fallback 用 StaticErrorFallback(不依赖任何 Provider)
      return <StaticErrorFallback onReset={this.handleReset} />
    }
    return this.props.children
  }
}
