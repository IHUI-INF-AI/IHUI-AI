// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
// WorkBuddy 程序一键重置(2026-10-10 立):维护清理/登出重置/出厂重置(隔离区搬移可逆)。
// 目标=~/.workbuddy 本地状态;边界:只做本地清理,服务端解绑走官方渠道,不做指纹伪造。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Eraser,
  Factory,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
} from '@ihui/ui-react'
import { useTauriIpcReady } from '@/hooks/use-desktop'
import {
  workbuddyResetFactory,
  workbuddyResetLogout,
  workbuddyResetMaintenance,
  workbuddyResetProbe,
  type WbProbeReport,
  type WbResetReport,
} from '@/lib/tauri-bridge'

type Mode = 'maintenance' | 'logout' | 'factory'

const TIER_BADGE: Record<string, string> = {
  maintenance: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  webview_logout: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  device_identity: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  user_asset: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  never: 'bg-zinc-500/15 text-zinc-500',
}

export default function WorkbuddyResetPage() {
  const t = useTranslations('workbuddyReset')
  // 桌面端专属:useTauriIpcReady 抗 IPC 异步注入竞态 + 免水合不一致(与 checkin 页同纪律)
  const desktop = useTauriIpcReady()
  const [probe, setProbe] = React.useState<WbProbeReport | null>(null)
  const [probing, setProbing] = React.useState(false)
  const [probeError, setProbeError] = React.useState('')
  const [busy, setBusy] = React.useState<'' | Mode>('')
  const [killRunning] = React.useState(true)
  const [includeDeviceId, setIncludeDeviceId] = React.useState(false)
  const [factoryConfirm, setFactoryConfirm] = React.useState(false)
  const [result, setResult] = React.useState<{ mode: Mode; rep: WbResetReport } | null>(null)
  const [runError, setRunError] = React.useState('')

  const runProbe = React.useCallback(async () => {
    setProbing(true)
    setProbeError('')
    try {
      const rep = await workbuddyResetProbe()
      setProbe(rep)
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : String(e))
    } finally {
      setProbing(false)
    }
  }, [])

  React.useEffect(() => {
    if (!desktop) return
    void runProbe()
  }, [desktop, runProbe])

  const execute = React.useCallback(
    async (mode: Mode) => {
      if (mode === 'factory' && !factoryConfirm) {
        setFactoryConfirm(true)
        return
      }
      setFactoryConfirm(false)
      setBusy(mode)
      setRunError('')
      try {
        const rep =
          mode === 'maintenance'
            ? await workbuddyResetMaintenance(killRunning)
            : mode === 'logout'
              ? await workbuddyResetLogout(killRunning, includeDeviceId)
              : await workbuddyResetFactory(killRunning)
        setResult({ mode, rep })
      } catch (e) {
        setRunError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy('')
      }
    },
    [factoryConfirm, killRunning, includeDeviceId],
  )

  if (!desktop) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('nonDesktop')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
      maintenance: t('tierMaintenance'),
      webview_logout: t('tierWebviewLogout'),
      device_identity: t('tierDeviceIdentity'),
      user_asset: t('tierUserAsset'),
      never: t('tierNever'),
    }
    return map[tier] ?? tier
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {/* 探针报告 */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('probeTitle')}</CardTitle>
            <CardDescription>
              {probe ? `${t('probeRoot')}: ${probe.root}` : t('probeScanning')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {probe && (
              <Badge variant="secondary">
                {probe.workbuddy_running ? t('wbRunning') : t('wbNotRunning')}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => void runProbe()} disabled={probing}>
              {probing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('probeRefresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {probeError ? (
            <p className="text-destructive text-sm">
              {t('errPrefix')}: {probeError}
            </p>
          ) : probe ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('probeTotal')}: </span>
                  <span className="font-medium">{probe.total_mb.toFixed(1)} MB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('probeReclaimable')}: </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {probe.reclaimable_mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {probe.entries.slice(0, 12).map((e) => (
                  <div key={e.path} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${TIER_BADGE[e.tier] ?? ''}`}>
                        {tierLabel(e.tier)}
                      </span>
                      <span className="truncate font-mono text-xs">{e.path}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {e.size_mb.toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('probeScanning')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 三档操作 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eraser className="h-4 w-4" /> {t('maintTitle')}
            </CardTitle>
            <CardDescription>{t('maintDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => void execute('maintenance')}
              disabled={busy !== ''}
            >
              {busy === 'maintenance' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('maintCta')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="h-4 w-4" /> {t('logoutTitle')}
            </CardTitle>
            <CardDescription>{t('logoutDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="wb-device-id"
                checked={includeDeviceId}
                onCheckedChange={(v) => setIncludeDeviceId(v === true)}
              />
              <Label htmlFor="wb-device-id" className="text-sm">
                {t('logoutDeviceIdOpt')}
              </Label>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void execute('logout')}
              disabled={busy !== ''}
            >
              {busy === 'logout' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('logoutCta')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Factory className="h-4 w-4" /> {t('factoryTitle')}
            </CardTitle>
            <CardDescription>{t('factoryDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {factoryConfirm ? (
              <div className="space-y-2">
                <p className="text-destructive flex items-start gap-1 text-xs">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('factoryConfirm')}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => void execute('factory')}
                    disabled={busy !== ''}
                  >
                    {busy === 'factory' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t('factoryConfirmYes')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setFactoryConfirm(false)}
                  >
                    {t('factoryConfirmNo')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => void execute('factory')}
                disabled={busy !== ''}
              >
                {t('factoryCta')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 提示与边界 */}
      <div className="text-muted-foreground space-y-1 text-xs">
        <p className="flex items-start gap-1">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('killNote')}
        </p>
        <p className="flex items-start gap-1">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('boundaryNote')}
        </p>
      </div>

      {runError ? (
        <p className="text-destructive text-sm">
          {t('errPrefix')}: {runError}
        </p>
      ) : null}

      {/* 执行结果 */}
      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.rep.layers.map((l) => (
              <div key={l.layer} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <Badge
                    className={
                      l.ok
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    }
                  >
                    {l.ok ? t('resultOk') : t('resultFail')}
                  </Badge>
                  <span className="font-mono text-xs">{l.name}</span>
                </div>
                <span className="text-muted-foreground min-w-0 flex-1 break-all text-right text-xs">
                  {l.detail}
                </span>
              </div>
            ))}
            <p className="text-muted-foreground pt-1 text-xs">{t('restartHint')}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
