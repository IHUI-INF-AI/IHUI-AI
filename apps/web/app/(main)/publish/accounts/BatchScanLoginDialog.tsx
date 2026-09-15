// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

'use client'

/**
 * 一键扫码登录(批量串行队列,2026-09-15):
 * 自动逐个平台打开登录页,用户只需连续用手机扫码;
 * 每个平台检测到登录即自动保存凭据并切换下一个。单平台 2 分钟超时自动跳过,
 * 支持"跳过此平台"与"停止队列"。弹窗关闭后队列继续在后台运行,重新打开可查看进度。
 *
 * 2026-09-15:启动前支持选择"内置浏览器(CDP)"或"外部浏览器(系统 Chrome 自动闭环)"。
 * 内置:createBrowserSession → openCdpSession → detectLoginFromCdp 轮询;
 * 外部:startExternalScanLogin(系统 Chrome 带 CDP 调试端口)→ 同一 detectLoginFromCdp 轮询,
 * 登录成功自动保存账号并关闭外部 Chrome。后端检测成功即自动加密入库,无需额外保存调用。
 */

import * as React from 'react'
import {
  Loader2,
  QrCode,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  MinusCircle,
  ListChecks,
  Monitor,
  ExternalLink,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  createBrowserSession,
  closeBrowserSession,
  detectLoginFromCdp,
  listScanLoginPlatforms,
  startExternalScanLogin,
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
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export interface BatchScanLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /** 待扫码的平台 id 队列(按顺序串行执行) */
  queuePlatforms: string[]
}

type ItemStatus = 'pending' | 'active' | 'success' | 'timeout' | 'error' | 'skipped'
type PollOutcome = 'success' | 'timeout' | 'cancelled' | 'skipped' | 'error'
/** 扫码打开方式:内置 CDP 视图 / 外部系统 Chrome(自动闭环) */
type BrowserMode = 'internal' | 'external'

interface QueueItem {
  platform: string
  name: string
  status: ItemStatus
  msg?: string
}

const POLL_INTERVAL_MS = 3000
/** 单平台超时:2 分钟(连续扫码场景下单个平台通常 30s 内完成) */
const PER_PLATFORM_TIMEOUT_MS = 2 * 60 * 1000

const ITEM_STATUS_STYLE: Record<ItemStatus, string> = {
  pending: 'bg-muted/40 text-muted-foreground',
  active: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  timeout: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  error: 'bg-destructive/10 text-destructive',
  skipped: 'bg-muted/40 text-muted-foreground line-through',
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function BatchScanLoginDialog({
  open,
  onOpenChange,
  onSuccess,
  queuePlatforms,
}: BatchScanLoginDialogProps) {
  const t = useTranslations('publish')
  const toast = useToast()
  const openCdpSession = useWorkPanelStore((s) => s.openCdpSession)

  const [items, setItems] = React.useState<QueueItem[]>([])
  const [running, setRunning] = React.useState(false)
  const [platMapReady, setPlatMapReady] = React.useState(false)
  const [mode, setMode] = React.useState<BrowserMode>('internal')

  const itemsRef = React.useRef<QueueItem[]>([])
  const platMapRef = React.useRef<Map<string, ScanLoginPlatform>>(new Map())
  const runningRef = React.useRef(false)
  const cancelRef = React.useRef(false)
  const skipRef = React.useRef(false)
  const sessionRef = React.useRef('')
  const lastQueueKeyRef = React.useRef('')
  const modeRef = React.useRef<BrowserMode>('internal')
  const queueKey = queuePlatforms.join(',')

  const updateItem = React.useCallback((idx: number, patch: Partial<QueueItem>) => {
    setItems((prev) => {
      const cur = prev[idx]
      if (!cur) return prev
      const next = [...prev]
      next[idx] = { ...cur, ...patch }
      itemsRef.current = next
      return next
    })
  }, [])

  // 打开弹窗:初始化队列。队列进行中或同一队列已有结果时不重置(重新打开可查看进度/结果)
  React.useEffect(() => {
    if (!open) return
    if (runningRef.current) return
    if (lastQueueKeyRef.current === queueKey && itemsRef.current.length > 0) return
    lastQueueKeyRef.current = queueKey
    cancelRef.current = false
    skipRef.current = false
    setPlatMapReady(false)
    void (async () => {
      try {
        const r = await listScanLoginPlatforms()
        if (!r.success || !r.data) throw new Error(r.error || '获取平台列表失败')
        platMapRef.current = new Map(r.data.platforms.map((p) => [p.platform, p]))
        const init: QueueItem[] = queuePlatforms.map((pid) => ({
          platform: pid,
          name: platMapRef.current.get(pid)?.name ?? pid,
          status: 'pending' as ItemStatus,
        }))
        setItems(init)
        itemsRef.current = init
        setPlatMapReady(true)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queueKey])

  // 2026-09-15:启动前先选择"内置浏览器/外部浏览器",由用户点"开始扫码"触发(不再自动开始)

  // 卸载兜底:关闭残留会话
  React.useEffect(() => {
    return () => {
      if (sessionRef.current) void closeBrowserSession(sessionRef.current)
    }
  }, [])

  function pollPlatform(sid: string, platform: string): Promise<PollOutcome> {
    return (async () => {
      const start = Date.now()
      while (true) {
        if (cancelRef.current) return 'cancelled'
        if (skipRef.current) {
          skipRef.current = false
          return 'skipped'
        }
        if (Date.now() - start > PER_PLATFORM_TIMEOUT_MS) return 'timeout'
        try {
          const r = await detectLoginFromCdp(sid, platform)
          if (r.success && r.data?.detected) return 'success'
          if (r.success && r.data?.error) return 'error'
        } catch {
          /* 网络错误静默,继续轮询 */
        }
        await sleep(POLL_INTERVAL_MS)
      }
    })()
  }

  async function startQueue() {
    const list = itemsRef.current
    if (!list.length || runningRef.current) return
    cancelRef.current = false
    skipRef.current = false
    runningRef.current = true
    setRunning(true)
    const useExternal = modeRef.current === 'external'
    let successCount = 0

    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) {
        for (let j = i; j < list.length; j++)
          updateItem(j, { status: 'skipped', msg: t('accounts.batchScanStopped') })
        break
      }
      const item = list[i]
      if (!item) continue
      const plat = platMapRef.current.get(item.platform)
      if (!plat?.login_url) {
        updateItem(i, { status: 'error', msg: t('accounts.batchScanNoLoginUrl') })
        continue
      }
      updateItem(i, { status: 'active', msg: undefined })
      try {
        let sid: string
        if (useExternal) {
          // 外部模式:ai-service 用系统 Chrome(--app + CDP 调试端口 + 临时 profile)打开并附着,
          // 登录成功自动保存账号,closeBrowserSession 时会一并关闭外部 Chrome 窗口
          const r = await startExternalScanLogin(item.platform)
          if (!r.success || !r.data?.session_id) throw new Error(r.error || '启动外部浏览器失败')
          sid = r.data.session_id
        } else {
          // 内置模式:BrowserHub Playwright Chromium + WorkPanel CDP 截图流视图
          const r = await createBrowserSession({
            url: plat.login_url,
            viewport_width: 1024,
            viewport_height: 720,
          })
          if (!r.success || !r.data?.session_id) throw new Error(r.error || '创建浏览器会话失败')
          sid = r.data.session_id
          openCdpSession(plat.login_url, sid, plat.name)
        }
        sessionRef.current = sid
        const outcome = await pollPlatform(sid, item.platform)
        if (sessionRef.current === sid) sessionRef.current = ''
        void closeBrowserSession(sid)
        if (outcome === 'success') {
          successCount++
          updateItem(i, { status: 'success' })
          toast.success(`${item.name} · ${t('accounts.scanLoginSuccess')}`)
          onSuccess?.()
          continue
        }
        if (outcome === 'skipped') {
          updateItem(i, { status: 'skipped', msg: t('accounts.batchScanItemSkipped') })
          continue
        }
        if (outcome === 'timeout') {
          updateItem(i, { status: 'timeout', msg: t('accounts.batchScanItemTimeout') })
          continue
        }
        if (outcome === 'cancelled') {
          updateItem(i, { status: 'skipped', msg: t('accounts.batchScanStopped') })
          for (let j = i + 1; j < list.length; j++)
            updateItem(j, { status: 'skipped', msg: t('accounts.batchScanStopped') })
          break
        }
        updateItem(i, { status: 'error', msg: t('accounts.batchScanDetectError') })
      } catch (e) {
        if (sessionRef.current) {
          void closeBrowserSession(sessionRef.current)
          sessionRef.current = ''
        }
        updateItem(i, { status: 'error', msg: (e as Error).message })
      }
    }

    runningRef.current = false
    setRunning(false)
    if (successCount > 0) {
      toast.success(
        `${t('accounts.batchScanDone')} · ${t('accounts.batchScanSuccessCount', { count: successCount })}`,
      )
    }
  }

  function skipCurrent() {
    skipRef.current = true
  }

  function stopQueue() {
    cancelRef.current = true
  }

  function restart() {
    if (runningRef.current) return
    const next = itemsRef.current.map((it) => ({
      ...it,
      status: 'pending' as ItemStatus,
      msg: undefined,
    }))
    itemsRef.current = next
    setItems(next)
    void startQueue()
  }

  const total = items.length
  const activeIdx = items.findIndex((it) => it.status === 'active')
  const activeItem = activeIdx >= 0 ? items[activeIdx] : null
  const done =
    !running &&
    items.length > 0 &&
    items.every((it) => it.status !== 'pending' && it.status !== 'active')
  const successCount = items.filter((it) => it.status === 'success').length
  const timeoutCount = items.filter((it) => it.status === 'timeout').length
  const errorCount = items.filter((it) => it.status === 'error').length
  const skippedCount = items.filter((it) => it.status === 'skipped').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-[640px]:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {t('accounts.batchScanTitle')}
          </DialogTitle>
          <DialogDescription>{t('accounts.batchScanDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 2026-09-15:浏览器选择(内置/外部),未运行时可切换 */}
          {!running && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('accounts.batchScanModeLabel')}</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === 'internal' ? 'default' : 'outline'}
                  className="h-auto flex-col gap-1 py-2"
                  onClick={() => {
                    modeRef.current = 'internal'
                    setMode('internal')
                  }}
                >
                  <Monitor className="h-4 w-4" />
                  <span className="text-xs">{t('accounts.batchScanModeInternal')}</span>
                </Button>
                <Button
                  type="button"
                  variant={mode === 'external' ? 'default' : 'outline'}
                  className="h-auto flex-col gap-1 py-2"
                  onClick={() => {
                    modeRef.current = 'external'
                    setMode('external')
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-xs">{t('accounts.batchScanModeExternal')}</span>
                </Button>
              </div>
            </div>
          )}

          {running && activeItem && (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {t('accounts.batchScanProgress', {
                  current: activeIdx + 1,
                  total,
                  name: activeItem.name,
                })}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {mode === 'external'
                  ? t('accounts.batchScanWaitingHintExternal')
                  : t('accounts.batchScanWaitingHint')}
              </p>
            </div>
          )}

          {done && (
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-sm font-medium">{t('accounts.batchScanDone')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('accounts.batchScanSummary', {
                  success: successCount,
                  timeout: timeoutCount,
                  error: errorCount,
                  skipped: skippedCount,
                })}
              </p>
            </div>
          )}

          {!items.length && !platMapReady && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('accounts.batchScanLoading')}
            </div>
          )}

          {items.length > 0 && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {items.map((it, idx) => (
                <div
                  key={it.platform}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1 text-xs',
                    ITEM_STATUS_STYLE[it.status],
                    it.status === 'active' && 'ring-1 ring-primary/40',
                  )}
                >
                  <span className="w-8 shrink-0 text-right text-[10px] opacity-70">{idx + 1}.</span>
                  {it.status === 'active' ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  ) : it.status === 'success' ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : it.status === 'error' ? (
                    <XCircle className="h-3 w-3 shrink-0" />
                  ) : it.status === 'timeout' ? (
                    <Clock className="h-3 w-3 shrink-0" />
                  ) : it.status === 'skipped' ? (
                    <MinusCircle className="h-3 w-3 shrink-0" />
                  ) : (
                    <QrCode className="h-3 w-3 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
                  {it.msg && <span className="shrink-0 text-[10px] opacity-80">{it.msg}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          {!running && !done && platMapReady && items.length > 0 && (
            <Button onClick={() => void startQueue()} className="w-full">
              <QrCode className="h-4 w-4" />
              {t('accounts.batchScanStart')}
            </Button>
          )}
          {running && (
            <>
              <Button variant="outline" onClick={skipCurrent}>
                <SkipForward className="h-4 w-4" />
                {t('accounts.batchScanSkip')}
              </Button>
              <Button variant="outline" onClick={stopQueue}>
                {t('accounts.batchScanStop')}
              </Button>
            </>
          )}
          {done && (
            <>
              <Button variant="outline" onClick={restart}>
                {t('accounts.batchScanRestart')}
              </Button>
              <Button onClick={() => onOpenChange(false)}>{t('accounts.batchScanClose')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
