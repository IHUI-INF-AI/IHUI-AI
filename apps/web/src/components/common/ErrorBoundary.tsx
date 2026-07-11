'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}
