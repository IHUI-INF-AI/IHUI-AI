// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 「本机执行器」卡片（桌面端独占，G4）。
 *
 * 这个电脑是不是已经在替手机跑任务、一键开/关本机常驻进程 —— 用户不需要打开终端。
 * 浏览器里不渲染（`isDesktopHost()` 为 false）：网页端没有"本机进程"这回事。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Cpu, Loader2, Play, RefreshCw, Square } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import { Alert } from '@/components/feedback'
import {
  getDeviceExecutorStatus,
  isDesktopHost,
  startDeviceExecutor,
  stopDeviceExecutor,
  type DeviceExecutorStatus,
} from '@/lib/device-executor'
import { cn } from '@/lib/utils'

export function DeviceExecutorCard() {
  const t = useTranslations('settings')
  const desktop = React.useMemo(() => isDesktopHost(), [])
  const [status, setStatus] = React.useState<DeviceExecutorStatus | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      setStatus(await getDeviceExecutorStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  React.useEffect(() => {
    if (!desktop) return
    void load()
  }, [desktop, load])

  const toggle = async (action: 'start' | 'stop') => {
    setBusy(true)
    setError(null)
    try {
      setStatus(action === 'start' ? await startDeviceExecutor() : await stopDeviceExecutor())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // 失败后复读一次真实状态：错误文案已经说明原因，状态不该停在旧值
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!desktop) return null

  const running = status?.running === true

  return (
    <Card className="mt-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-title">
          <Cpu className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('devices.executorTitle')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('devices.executorRefresh')}
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
          </Button>
          <Button
            size="sm"
            data-testid="executor-toggle"
            disabled={busy || status === null || !status.supported}
            onClick={() => void toggle(running ? 'stop' : 'start')}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : running ? (
              <Square className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {running ? t('devices.executorStop') : t('devices.executorStart')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-label text-muted-foreground">{t('devices.executorHint')}</p>
        {error ? <Alert variant="danger" title={error} closable /> : null}
        {status && !status.supported ? (
          <p className="text-label text-muted-foreground">{t('devices.executorUnsupported')}</p>
        ) : null}
        {status && status.supported ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label">
            <span
              data-testid="executor-state"
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                running ? 'text-emerald-600' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  running ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                )}
                aria-hidden
              />
              {running ? t('devices.executorRunning') : t('devices.executorStopped')}
            </span>
            {status.paired && status.deviceName ? (
              <span className="text-muted-foreground">{status.deviceName}</span>
            ) : null}
            {status.taskRegistered ? (
              <span className="text-muted-foreground">{t('devices.executorTaskRegistered')}</span>
            ) : null}
            {running && status.pid ? (
              <span className="text-muted-foreground tabular-nums">PID {status.pid}</span>
            ) : null}
          </div>
        ) : null}
        {status && status.supported && !status.paired ? (
          <p className="text-label text-muted-foreground">{t('devices.executorUnpaired')}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
