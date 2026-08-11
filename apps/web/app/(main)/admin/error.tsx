'use client'

import { useEffect } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { useNavigationStore } from '@/stores/navigation'

/**
 * admin 路由组错误边界。
 *
 * 捕获 admin 页面抛出的运行时错误,带管理员专属 UI(ShieldAlert 图标)。
 * 比 (main)/error.tsx 更精细:只捕获 admin 子路由。
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error('[admin-route-error]', error)
    // 页面崩溃时重置 pending 状态
    useNavigationStore.getState().end()
  }, [error])

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-4 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">管理后台发生错误</h1>
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
