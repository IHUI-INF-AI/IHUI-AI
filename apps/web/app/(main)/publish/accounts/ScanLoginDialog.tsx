'use client'

/**
 * 扫码登录弹窗(2026-07-31 CDP 模式重写)。
 *
 * 旧模式(2026-07-30):弹窗显示后端 Playwright 截图,用户在手机扫码,截图是静态的。
 * 新模式(2026-07-31):用 BrowserHub CDP 在 WorkPanel 内置浏览器打开真实登录页,
 *   用户在 CDP 画面里直接扫码/操作,后端轮询检测 cookies 自动保存。
 *
 * 流程:
 * 1. 选平台 → 点"开始扫码" → createBrowserSession 打开登录页
 * 2. openCdpSession 在 WorkPanel 打开 CDP 画面 → 弹窗关闭,用户在右侧浏览器操作
 * 3. 每 3s 调 detectLoginFromCdp → 后端从 BrowserHub 拿 cookies → 检测 success_cookies
 * 4. detected=true → 加密保存到 publish_accounts → toast 提示 + 刷新账号列表
 * 5. 超时 5 分钟 / 用户取消 → 关闭会话
 *
 * 设计:ScanLoginDialog 始终 mount(open prop 控制显示),
 *   弹窗关闭后轮询继续,用户重新打开可查看进度/取消。
 */

import * as React from 'react'
import { Loader2, QrCode, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  createBrowserSession,
  closeBrowserSession,
  detectLoginFromCdp,
  listScanLoginPlatforms,
  type ScanLoginPlatform,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { useWorkPanelStore } from '@/stores/work-panel'
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

export interface ScanLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /** 预选平台(从账号卡"扫码"按钮传入) */
  defaultPlatform?: string
}

const POLL_INTERVAL_MS = 3000
const TIMEOUT_MS = 5 * 60 * 1000 // 5 分钟

type Phase = 'idle' | 'starting' | 'polling' | 'success' | 'failed'

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
  const startTimeRef = React.useRef<number>(0)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // 同步 defaultPlatform 变化(从账号卡点"扫码"传入不同平台)
  React.useEffect(() => {
    if (defaultPlatform) setPlatform(defaultPlatform)
  }, [defaultPlatform])

  // 加载平台列表
  React.useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const r = await listScanLoginPlatforms()
        if (r.success && r.data) {
          setPlatforms(r.data.platforms)
          if (!platform && r.data.platforms.length > 0) {
            setPlatform(r.data.platforms[0]!.platform)
          }
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 清理:组件 unmount 时停止轮询 + 关闭会话
  React.useEffect(() => {
    return () => {
      stopPolling()
      if (sessionId) void closeBrowserSession(sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  async function handleStart() {
    if (!platform) return
    const plat = platforms.find((p) => p.platform === platform)
    if (!plat) return

    setPhase('starting')
    setErrorMsg('')

    try {
      // 1. 创建 BrowserHub CDP 会话(后端启动 Chromium 打开登录页)
      const r = await createBrowserSession({
        url: plat.login_url,
        viewport_width: 1024,
        viewport_height: 720,
      })
      if (!r.success || !r.data?.session_id) {
        throw new Error(r.error || '创建浏览器会话失败')
      }
      const sid = r.data.session_id
      setSessionId(sid)
      startTimeRef.current = Date.now()

      // 2. 在 WorkPanel 打开 CDP 画面(用户在右侧内置浏览器扫码)
      openCdpSession(plat.login_url, sid, plat.name)

      // 3. 关闭弹窗,让用户在 WorkPanel 操作
      setPhase('polling')
      onOpenChange(false)
      toast.success(`已在右侧内置浏览器打开 ${plat.name} 登录页,请扫码登录`)

      // 4. 开始轮询检测登录态
      startPolling(sid, platform)
    } catch (e) {
      setErrorMsg((e as Error).message)
      setPhase('failed')
    }
  }

  function startPolling(sid: string, plat: string) {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      // 超时检查
      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
        stopPolling()
        setSessionId('')
        void closeBrowserSession(sid)
        setPhase('failed')
        const msg = t('accounts.scanLoginTimeout')
        setErrorMsg(msg)
        toast.error(msg)
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
          // 会话不存在等错误 → 停止轮询
          stopPolling()
          setSessionId('')
          setPhase('failed')
          setErrorMsg(r.data.error)
          toast.error(r.data.error)
        }
      } catch {
        // 网络错误静默,继续轮询
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

  function handleReset() {
    setPhase('idle')
    setErrorMsg('')
    setSessionId('')
  }

  const platformName = platforms.find((p) => p.platform === platform)?.name ?? platform
  const isBusy = phase === 'starting'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
                <Select value={platform} onValueChange={setPlatform} disabled={platforms.length === 0}>
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
              <p className="text-xs text-muted-foreground text-center">
                点击后将在右侧内置浏览器打开登录页,支持扫码或账号密码登录
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
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">正在等待扫码登录</p>
                <p className="text-xs text-muted-foreground">
                  请在右侧内置浏览器中完成 {platformName} 扫码登录
                </p>
              </div>
              <p className="text-xs text-muted-foreground">检测到登录后会自动保存账号</p>
            </div>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center gap-2 text-emerald-600 py-4">
              <CheckCircle2 className="h-12 w-12" />
              <p className="text-sm font-medium">{t('accounts.scanLoginSucceeded')}</p>
            </div>
          )}

          {phase === 'failed' && (
            <div className="flex flex-col items-center gap-2 text-destructive py-4">
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
          {(phase === 'success' || phase === 'failed') && (
            <Button
              onClick={() => {
                handleReset()
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
