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
import { Cpu, Loader2, Play, RefreshCw, Square, Zap } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { getBaseUrl, issueSelfDeviceToken } from '@ihui/api-client'

import { Alert } from '@/components/feedback'
import {
  adoptDeviceExecutor,
  getDeviceExecutorStatus,
  getExecutorHostName,
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

  /**
   * 自助接入（G5）：已登录就是凭据，不再让用户去手机抄 8 位配对码。
   *
   * 1. 登录态调 `POST /api/devices/self-token` 换设备令牌（只对 /devices/* 有效）；
   * 2. 令牌交给桌面端 → CLI `ihui device adopt` 落盘（指纹/白名单仍是 CLI 唯一实现）；
   * 3. 落盘成功立刻启动，用户点一次就到位。
   * 目录选择由桌面端弹原生对话框（浏览器给不出本地路径，也不该给）。
   */
  const enable = async () => {
    setBusy(true)
    setError(null)
    let wasRunning = false
    try {
      // 重配（换工作区）时必须先停：常驻进程已把旧凭据读进内存，覆盖盘面不会让它搬家，
      // 不先停就会出现"界面显示新目录、实际还在旧目录跑"的假象。
      const before = await getDeviceExecutorStatus()
      wasRunning = before.running
      if (wasRunning) await stopDeviceExecutor()
      const host = await getExecutorHostName()
      const name = `${host} · 桌面端`
      const issued = await issueSelfDeviceToken({ name, os: navigator.platform || null })
      if (!issued.success || !issued.data) throw new Error(issued.error ?? '签发设备令牌失败')
      const adopted = await adoptDeviceExecutor({
        deviceId: issued.data.device_id,
        deviceToken: issued.data.device_token,
        name: issued.data.name,
        // 后端地址必须落在本机凭证里:桌面端加载线上站点时 getBaseUrl() 是同源空串,
        // 而 CLI 的默认值是本机开发地址 —— 不补 origin 就会把生产机器指到 localhost:8802。
        apiUrl:
          getBaseUrl() || (typeof window === 'undefined' ? undefined : window.location.origin),
      })
      setStatus(adopted)
      setStatus(await startDeviceExecutor())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 用户主动取消目录选择 ≠ 失败：不弹红条，也不去复读状态（什么都不该变）；
      // 但如果刚才为了重配把进程停了，要把它原样拉起来（不能让"取消"留下停机）。
      if (msg.includes('已取消选择工作区')) {
        if (wasRunning) {
          try {
            setStatus(await startDeviceExecutor())
          } catch {
            await load()
          }
        }
        return
      }
      // 登录态过期是"重新登录再说"，不是把英文 401 原文糊到脸上
      setError(
        /\b401\b|Authentication required|未登录|登录已失效/.test(msg)
          ? t('devices.executorNeedLogin')
          : msg,
      )
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!desktop) return null

  const running = status?.running === true
  const needsEnable = status?.supported === true && !status.paired

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
          {needsEnable ? (
            <Button
              size="sm"
              data-testid="executor-enable"
              disabled={busy}
              onClick={() => void enable()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Zap className="h-4 w-4" aria-hidden />
              )}
              {t('devices.executorEnable')}
            </Button>
          ) : (
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
          )}
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
        {status && status.supported && status.paired ? (
          <Button
            variant="ghost"
            size="xs"
            data-testid="executor-change-workspace"
            disabled={busy}
            onClick={() => void enable()}
            className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            {t('devices.executorChangeWorkspace')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
