'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

/**
 * (main) 路由组错误边界。
 *
 * 捕获 (main) 路由组内页面抛出的运行时错误,提供 reset 重试。
 * 比 app/error.tsx 更精细:只捕获 (main) 组,不影响其他路由组。
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error('[main-route-error]', error)
  }, [error])

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-4 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('errorTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || t('errorDescription')}
        </p>
      </div>
      <Button onClick={reset}>
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </Button>
    </div>
  )
}
