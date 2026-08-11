'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { useNavigationStore } from '@/stores/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error(error)
    // 页面崩溃时重置 pending 状态
    useNavigationStore.getState().end()
  }, [error])

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-4 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('errorTitle')}</h1>
        {/* 2026-08-01 错误中文化:不直接渲染 error.message(可能英文),始终显示中文兜底 */}
        <p className="text-sm text-muted-foreground">{t('errorDescription')}</p>
      </div>
      <Button onClick={reset}>
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </Button>
    </div>
  )
}
