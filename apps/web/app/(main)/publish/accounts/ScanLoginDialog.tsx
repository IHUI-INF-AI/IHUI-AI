'use client'

/**
 * 扫码登录弹窗(2026-07-30 新增)。
 *
 * 流程:
 * 1. 用户选择平台 → 点"开始扫码" → 调 startScanLogin API 启动后端 Playwright
 * 2. 后端打开平台登录页(知乎/B站/小红书等)+ 持续截图
 * 3. 前端轮询 status + 拉取 qr 截图,在弹窗中显示
 * 4. 用户在 App 扫码 → 后端检测到登录 cookies → 自动保存到账号
 * 5. 弹窗显示"成功",onSuccess 回调刷新列表
 *
 * 设计:与 AccountsPage 解耦,通过 props 传 platform 列表 + onSuccess。
 */

import * as React from 'react'
import { Loader2, QrCode, CheckCircle2, XCircle, Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  startScanLogin,
  getScanLoginStatus,
  cancelScanLogin,
  getScanLoginQrUrl,
  type ScanLoginPlatform,
  type ScanLoginTask,
  listScanLoginPlatforms,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
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
  /** 预选平台(从外部按钮传入) */
  defaultPlatform?: string
}

const POLL_INTERVAL_MS = 2000

export function ScanLoginDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultPlatform,
}: ScanLoginDialogProps) {
  const t = useTranslations('publish')
  const toast = useToast()

  const [platforms, setPlatforms] = React.useState<ScanLoginPlatform[]>([])
  const [platform, setPlatform] = React.useState<string>(defaultPlatform ?? '')
  const [task, setTask] = React.useState<ScanLoginTask | null>(null)
  const [qrUrl, setQrUrl] = React.useState<string>('')
  const [, setLoading] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载支持的平台列表
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

  // 关闭时清理
  React.useEffect(() => {
    if (!open) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      setTask(null)
      setQrUrl('')
      setLoading(false)
      setStarting(false)
    }
  }, [open])

  // 轮询任务状态
  React.useEffect(() => {
    if (!task || task.status === 'success' || task.status === 'failed' || task.status === 'timeout' || task.status === 'cancelled') {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const r = await getScanLoginStatus(task.task_id)
        if (r.success && r.data) {
          setTask(r.data)
          // 每 2 秒刷新二维码截图(加时间戳绕过缓存)
          setQrUrl(`${getScanLoginQrUrl(task.task_id)}?t=${Date.now()}`)
          if (r.data.status === 'success') {
            toast.success(`${t('accounts.scanLoginSuccess')} (${r.data.cookies_count} cookies)`)
            onSuccess?.()
          } else if (r.data.status === 'failed' || r.data.status === 'timeout' || r.data.status === 'cancelled') {
            toast.error(r.data.message || t('accounts.scanLoginFailed'))
          }
        }
      } catch (e) {
        // 静默,继续轮询
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.task_id, task?.status])

  async function handleStart() {
    if (!platform) return
    setStarting(true)
    setTask(null)
    setQrUrl('')
    try {
      const r = await startScanLogin(platform)
      if (!r.success || !r.data) throw new Error(r.error || '启动失败')
      setTask(r.data.snapshot)
      setQrUrl(`${getScanLoginQrUrl(r.data.task_id)}?t=${Date.now()}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  async function handleCancel() {
    if (!task) return
    try {
      await cancelScanLogin(task.task_id)
      const r = await getScanLoginStatus(task.task_id)
      if (r.success && r.data) setTask(r.data)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const isPolling = !!task && !['success', 'failed', 'timeout', 'cancelled'].includes(task.status)
  const platformName = platforms.find((p) => p.platform === platform)?.name ?? platform

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
          {!task ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('accounts.platform')}</label>
                <Select value={platform} onValueChange={setPlatform} disabled={starting || platforms.length === 0}>
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
              <Button onClick={handleStart} disabled={!platform || starting} className="w-full">
                {starting && <Loader2 className="h-4 w-4 animate-spin" />}
                <QrCode className="h-4 w-4" />
                {t('accounts.startScanLogin')}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
                {task.status === 'success' ? (
                  <div className="flex flex-col items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-12 w-12" />
                    <p className="text-sm font-medium">{t('accounts.scanLoginSucceeded')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('accounts.cookiesSaved', { count: task.cookies_count })}
                    </p>
                  </div>
                ) : task.status === 'failed' || task.status === 'timeout' || task.status === 'cancelled' ? (
                  <div className="flex flex-col items-center gap-2 text-destructive">
                    <XCircle className="h-12 w-12" />
                    <p className="text-sm font-medium">
                      {task.status === 'timeout' ? t('accounts.scanLoginTimeout') : t('accounts.scanLoginFailed')}
                    </p>
                    <p className="text-xs text-muted-foreground">{task.message}</p>
                  </div>
                ) : (
                  <>
                    <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-md border bg-background">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={t('accounts.scanLoginQrAlt')}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>
                        {t('accounts.waitingForScan', { platform: platformName })}
                      </span>
                    </div>
                    {task.message && task.status === 'waiting_scan' && (
                      <p className="text-xs text-muted-foreground">{task.message}</p>
                    )}
                  </>
                )}
              </div>

              {isPolling && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    <span>{t('accounts.taskId')}: {task.task_id.slice(0, 8)}...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {!task ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel', { ns: 'common' })}
            </Button>
          ) : isPolling ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                {t('accounts.cancelScan')}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('accounts.minimize')}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>
              {t('accounts.close', { defaultValue: '关闭' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
