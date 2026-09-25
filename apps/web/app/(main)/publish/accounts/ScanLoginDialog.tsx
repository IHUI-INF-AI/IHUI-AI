// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 扫码登录弹窗(2026-07-31 CDP 模式):用 BrowserHub CDP 在 WorkPanel 内置浏览器打开真实登录页,
 * 用户在 CDP 画面里直接扫码/操作,后端轮询检测 cookies 自动保存。超时 5 分钟(CountdownTimer + 轮询双保险)。
 * 弹窗关闭后轮询继续,用户重新打开可查看进度/取消。
 *
 * 2026-09-02:新增"外部 Chrome 自动闭环"——系统 Chrome 带 CDP 调试端口打开登录页,
 * 同样走 detect-from-cdp 轮询,登录成功自动保存账号并关闭外部 Chrome(见 startPolling 复用)。
 *
 * 2026-09-16:"默认浏览器 + 手动导入"模式——Chrome 136+ 禁止在默认 profile 上开 CDP 调试端口,
 * 外部 Chrome 只能用独立临时 profile,拿不到用户日常浏览器里已登录的账号。
 * 改为用 openExternalUrl 调系统默认浏览器(用户日常 profile,本来就已登录)打开登录页,
 * 用户登录后从 DevTools 复制 Cookie 粘贴进来,后端 import-cookies 解析校验入库。
 */

import * as React from 'react'
import { Loader2, QrCode, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  createBrowserSession,
  closeBrowserSession,
  detectLoginFromCdp,
  importCookiesManually,
  listScanLoginPlatforms,
  type ScanLoginPlatform,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { useWorkPanelStore } from '@/stores/work-panel'
import { openExternalUrl } from '@/lib/tauri-bridge'
import { Textarea } from '@/components/form/Textarea'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { CountdownTimer } from '@/components/publish/CountdownTimer'

export interface ScanLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultPlatform?: string
}

const POLL_INTERVAL_MS = 3000
const TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_SECONDS = 300

type Phase = 'idle' | 'starting' | 'polling' | 'manual-import' | 'success' | 'failed'

export function ScanLoginDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultPlatform,
}: ScanLoginDialogProps) {
  const t = useTranslations('publish')
  const tCommon = useTranslations('common')
  const toast = useToast()
  const openCdpSession = useWorkPanelStore((s) => s.openCdpSession)
  const [platforms, setPlatforms] = React.useState<ScanLoginPlatform[]>([])
  const [platform, setPlatform] = React.useState<string>(defaultPlatform ?? '')
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [sessionId, setSessionId] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string>('')
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(TIMEOUT_SECONDS)
  const [cookiesInput, setCookiesInput] = React.useState<string>('')
  const [importError, setImportError] = React.useState<string>('')
  const [importing, setImporting] = React.useState<boolean>(false)
  const startTimeRef = React.useRef<number>(0)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (defaultPlatform) setPlatform(defaultPlatform)
  }, [defaultPlatform])

  React.useEffect(() => {
    if (!open) return
    // 2026-09-15 fix:每次打开都强制同步指定平台,避免上次会话遗留的平台残留
    if (defaultPlatform) setPlatform(defaultPlatform)
    void (async () => {
      try {
        const r = await listScanLoginPlatforms()
        if (r.success && r.data) {
          setPlatforms(r.data.platforms)
          // 2026-09-15 fix:指定了平台时不得覆盖;函数式更新避免 stale closure
          // (此前闭包捕获 open 时的旧 platform='' 导致误覆盖为列表第一个平台=知乎)
          if (!defaultPlatform) {
            setPlatform((prev) => prev || r.data.platforms[0]?.platform || '')
          }
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPlatform])

  React.useEffect(() => {
    return () => {
      stopPolling()
      if (sessionId) void closeBrowserSession(sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (open && phase === 'polling' && startTimeRef.current > 0) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setCountdownSeconds(Math.max(0, TIMEOUT_SECONDS - elapsed))
    }
  }, [open, phase])

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  function failSession(msg: string) {
    stopPolling()
    if (sessionId) {
      void closeBrowserSession(sessionId)
      setSessionId('')
    }
    setPhase('failed')
    setErrorMsg(msg)
    toast.error(msg)
  }

  function handleCountdownExpire() {
    failSession(t('accounts.scanLoginTimeout'))
  }

  async function handleStart() {
    if (!platform) return
    const plat = platforms.find((p) => p.platform === platform)
    if (!plat) return
    setPhase('starting')
    setErrorMsg('')
    try {
      const r = await createBrowserSession({
        url: plat.login_url,
        viewport_width: 1024,
        viewport_height: 720,
      })
      if (!r.success || !r.data?.session_id) throw new Error(r.error || '创建浏览器会话失败')
      const sid = r.data.session_id
      setSessionId(sid)
      startTimeRef.current = Date.now()
      openCdpSession(plat.login_url, sid, plat.name)
      setPhase('polling')
      onOpenChange(false)
      toast.success(`已在右侧内置浏览器打开 ${plat.name} 登录页,请扫码登录`)
      startPolling(sid, platform)
    } catch (e) {
      setErrorMsg((e as Error).message)
      setPhase('failed')
    }
  }

  function startPolling(sid: string, plat: string) {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
        failSession(t('accounts.scanLoginTimeout'))
        return
      }
      try {
        const r = await detectLoginFromCdp(sid, plat)
        if (r.success && r.data?.detected) {
          stopPolling()
          setSessionId('')
          void closeBrowserSession(sid)
          setPhase('success')
          toast.success(`${t('accounts.scanLoginSuccess')} (${r.data.cookies_count} cookies)`)
          onSuccess?.()
        } else if (r.success && r.data?.error) {
          failSession(r.data.error)
        }
      } catch {
        /* 网络错误静默,继续轮询 */
      }
    }, POLL_INTERVAL_MS)
  }

  function handleCancel() {
    stopPolling()
    if (sessionId) {
      void closeBrowserSession(sessionId)
      setSessionId('')
    }
    setPhase('idle')
  }

  /** 手动导入 cookies(2026-09-16):系统默认浏览器登录闭环的最后一步。 */
  async function handleImportCookies() {
    if (!cookiesInput.trim() || importing) return
    setImporting(true)
    setImportError('')
    try {
      const r = await importCookiesManually(platform, cookiesInput)
      if (!r.success || !r.data?.account_id) throw new Error(r.error || '导入失败')
      setPhase('success')
      toast.success(`${t('accounts.importCookiesSuccess')} (${r.data.cookies_count} cookies)`)
      onSuccess?.()
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const platformName = platforms.find((p) => p.platform === platform)?.name ?? platform
  const isBusy = phase === 'starting'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-[640px]:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {t('accounts.scanLoginTitle')}
          </DialogTitle>
          <DialogDescription>{t('accounts.scanLoginDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === 'idle' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('accounts.platform')}</label>
                <Select
                  value={platform}
                  onValueChange={setPlatform}
                  disabled={platforms.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('accounts.selectPlatform')} />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.platform} value={p.platform}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStart} disabled={!platform || isBusy} className="w-full">
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                <QrCode className="h-4 w-4" />
                {t('accounts.startScanLogin')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t('accounts.scanWithPhoneHint')}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t('accounts.orDivider')}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={!platform || isBusy}
                onClick={() => {
                  // 2026-09-16:用系统默认浏览器打开(用户日常 profile,已有登录态),
                  // Chrome 136+ 禁止默认 profile 开 CDP 端口,故走"手动粘贴 Cookie"闭环。
                  const plat = platforms.find((p) => p.platform === platform)
                  if (!plat?.login_url) return
                  void openExternalUrl(plat.login_url)
                  setCookiesInput('')
                  setImportError('')
                  setPhase('manual-import')
                }}
              >
                <ExternalLink className="h-4 w-4" />
                {t('accounts.openExternalBrowser')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t('accounts.externalBrowserHint')}
              </p>
            </>
          )}

          {phase === 'starting' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">正在打开 {platformName} 登录页...</p>
            </div>
          )}

          {phase === 'polling' && (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">正在等待扫码登录</p>
                <p className="text-xs text-muted-foreground">
                  在浏览器窗口中完成扫码/登录即可,无需点击;检测到登录后自动保存账号
                </p>
              </div>
              <CountdownTimer
                totalSeconds={countdownSeconds}
                onExpire={handleCountdownExpire}
                variant="danger"
              />
              <p className="text-xs text-muted-foreground">检测到登录后会自动保存账号</p>
            </div>
          )}

          {phase === 'manual-import' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('accounts.importCookiesHint', { platform: platformName })}
              </p>
              <Textarea
                label={t('accounts.cookiesInputLabel')}
                value={cookiesInput}
                onChange={(e) => setCookiesInput(e.target.value)}
                placeholder={t('accounts.cookiesInputPlaceholder')}
                rows={6}
                error={importError || undefined}
              />
            </div>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center gap-2 py-4 text-emerald-600">
              <CheckCircle2 className="h-12 w-12" />
              <p className="text-sm font-medium">{t('accounts.scanLoginSucceeded')}</p>
            </div>
          )}

          {phase === 'failed' && (
            <div className="flex flex-col items-center gap-2 py-4 text-destructive">
              <XCircle className="h-12 w-12" />
              <p className="text-sm font-medium">{t('accounts.scanLoginFailed')}</p>
              {errorMsg && <p className="text-xs text-muted-foreground">{errorMsg}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === 'idle' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
          )}
          {phase === 'polling' && (
            <Button variant="outline" onClick={handleCancel}>
              {t('accounts.cancelScan')}
            </Button>
          )}
          {phase === 'manual-import' && (
            <>
              {/* back-label-exempt: 扫码对话框的"上一步"按钮,文字即标签,非页头返回键 until 2026-12-31 */}
              <Button
                variant="outline"
                onClick={() => {
                  setCookiesInput('')
                  setImportError('')
                  setPhase('idle')
                }}
              >
                {t('accounts.back')}
              </Button>
              <Button onClick={handleImportCookies} disabled={!cookiesInput.trim() || importing}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('accounts.saveCookies')}
              </Button>
            </>
          )}
          {(phase === 'success' || phase === 'failed') && (
            <Button
              onClick={() => {
                setPhase('idle')
                setErrorMsg('')
                setSessionId('')
                onOpenChange(false)
              }}
            >
              {tCommon('close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
