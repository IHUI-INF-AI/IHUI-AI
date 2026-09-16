// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

'use client'

/**
 * 一键扫码登录(批量串行队列,2026-09-15):
 * 自动逐个平台打开登录页,用户只需连续用手机扫码;
 * 每个平台检测到登录即自动保存凭据并切换下一个。单平台 2 分钟超时自动跳过,
 * 支持"跳过此平台"与"停止队列"。
 *
 * 2026-09-16 修复(用户反馈):
 * ① 关闭弹窗 = 停止队列:此前关掉窗口后队列仍在后台跑,会不停弹出新浏览器窗口;
 *    现在 open 变 false 立即取消队列并关闭当前浏览器会话。
 * ② 停止按钮即时生效:轮询等待改为可中断(≤100ms 响应),点击后立刻置"正在停止"状态
 *    并关闭当前浏览器窗口,不再出现"点了半天没反应"。
 * ③ 外部浏览器 = 用户自己的浏览器:ai-service 侧改为复制用户本机默认浏览器(Chrome/Edge)
 *    的真实 profile(带登录状态),已登录的平台直接识别保存,窗口本身就是用户日常浏览器。
 * ④ 用户手动关掉浏览器窗口 = 结束队列:后端返回"浏览器已关闭"此前被当成普通检测异常,
 *    队列会继续弹下一个平台(用户视角"我都关了怎么还在弹");现已识别该信号并停止队列。
 *
 * 2026-09-15:启动前支持选择"内置浏览器(CDP)"或"你自己的浏览器(系统默认浏览器)"。
 * 内置:createBrowserSession → openCdpSession → detectLoginFromCdp 轮询;
 * 外部:startExternalScanLogin(用户本机浏览器 + 真实 profile 副本 + CDP 调试端口)→
 * 同一 detectLoginFromCdp 轮询,登录成功自动保存账号并关闭该浏览器窗口。
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
type PollOutcome = 'success' | 'timeout' | 'cancelled' | 'skipped' | 'error' | 'closed'
/** 扫码打开方式:内置 CDP 视图 / 用户自己的浏览器(本机真实 profile 副本) */
type BrowserMode = 'internal' | 'external'

interface QueueItem {
  platform: string
  name: string
  status: ItemStatus
  msg?: string
}

const POLL_INTERVAL_MS = 3000
/** 取消标记轮询粒度:停止/关闭弹窗后最多 100ms 内让轮询退出 */
const CANCEL_POLL_MS = 100
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

/** 可中断等待:每 100ms 检查取消标记,停止队列/关闭弹窗时立即返回(不再傻等 3s 轮询间隔)。 */
async function sleepCancelable(ms: number, isCancelled: () => boolean): Promise<void> {
  let left = ms
  while (left > 0) {
    if (isCancelled()) return
    const step = Math.min(CANCEL_POLL_MS, left)
    await sleep(step)
    left -= step
  }
}

/** 外部模式实际使用的浏览器信息(由 ai-service 返回,用于如实提示"用的是你自己的哪个浏览器") */
interface ExternalBrowserInfo {
  browser: string
  profileUsed: boolean
}

/**
 * 后端在"用户把浏览器窗口关掉了"时返回的提示(2026-09-16 实测:
 * `浏览器已关闭,请重新发起扫码登录`;会话已被清理时是 `浏览器会话不存在或已关闭`)。
 *
 * 这类结果必须与普通检测异常区分:它是用户主动结束的信号,
 * 否则队列会把它当作"本平台失败"继续弹下一个窗口 —— 正是用户反馈的
 * "我关掉窗口了,怎么还在继续弹窗"。
 */
function isBrowserClosedError(msg: string | null | undefined): boolean {
  if (!msg) return false
  return msg.includes('浏览器已关闭') || msg.includes('浏览器会话不存在')
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
  /** 已点击停止(队列正在收尾):按钮与进度区立即反馈,避免"点了没反应" */
  const [stopping, setStopping] = React.useState(false)
  const [platMapReady, setPlatMapReady] = React.useState(false)
  // 2026-09-16:默认改为"你自己的浏览器"——带上用户日常登录态,已登录平台无需再扫码
  const [mode, setMode] = React.useState<BrowserMode>('external')
  const [extInfo, setExtInfo] = React.useState<ExternalBrowserInfo | null>(null)

  const itemsRef = React.useRef<QueueItem[]>([])
  const platMapRef = React.useRef<Map<string, ScanLoginPlatform>>(new Map())
  const runningRef = React.useRef(false)
  const cancelRef = React.useRef(false)
  const skipRef = React.useRef(false)
  const sessionRef = React.useRef('')
  const lastQueueKeyRef = React.useRef('')
  const modeRef = React.useRef<BrowserMode>('external')
  const queueKey = queuePlatforms.join(',')

  /**
   * 立即取消整个队列(2026-09-16):
   * 置取消标记 → 轮询/串行循环在 ≤100ms 内退出;同时立刻关闭当前浏览器会话,
   * 点"停止队列"或关闭弹窗时用户能当场看到浏览器窗口关掉(不再"点了半天没反应")。
   */
  const cancelQueue = React.useCallback(() => {
    cancelRef.current = true
    skipRef.current = false
    setStopping(true)
    const sid = sessionRef.current
    if (sid) {
      sessionRef.current = ''
      void closeBrowserSession(sid)
    }
  }, [])

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

  // 2026-09-15:启动前先选择"内置浏览器/你自己的浏览器",由用户点"开始扫码"触发(不再自动开始)

  // 2026-09-16:关闭弹窗(点 X / Esc / 点遮罩)= 停止队列。
  // 此前设计为"弹窗关闭后队列继续后台运行",实际表现为关掉窗口后仍不断弹出新的浏览器窗口、
  // 用户无法终止,故改为关闭即停:取消队列 + 关掉当前浏览器会话。
  React.useEffect(() => {
    if (open || !runningRef.current) return
    cancelQueue()
    toast.info(t('accounts.batchScanStoppedToast'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cancelQueue])

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
          // 2026-09-16:检测请求返回期间用户可能已点停止/关窗 → 立即退出,不再等下一轮
          if (cancelRef.current) return 'cancelled'
          if (r.success && r.data?.detected) return 'success'
          // 用户手动关掉浏览器窗口 → 视为"本人结束队列",不能当普通异常继续下一个
          if (r.success && r.data?.error) {
            return isBrowserClosedError(r.data.error) ? 'closed' : 'error'
          }
        } catch {
          /* 网络错误静默,继续轮询 */
          if (cancelRef.current) return 'cancelled'
        }
        // 可中断等待(停止后 ≤100ms 返回,不再傻等完整轮询间隔)
        await sleepCancelable(POLL_INTERVAL_MS, () => cancelRef.current)
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
    setStopping(false)
    const useExternal = modeRef.current === 'external'
    let successCount = 0

    /** 取消时把第 idx 个及之后的条目统一标记为"已停止"(保证队列不留 pending 残影) */
    function markStoppedFrom(idx: number) {
      for (let j = idx; j < list.length; j++)
        updateItem(j, { status: 'skipped', msg: t('accounts.batchScanStopped') })
    }

    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) {
        markStoppedFrom(i)
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
          // 外部模式:ai-service 用**用户自己的浏览器**(系统默认 Chromium 浏览器 + 其真实
          // profile 副本,带登录状态)打开登录页并附着 CDP。已登录的平台直接命中自动保存,
          // 未登录的在该窗口里正常扫码;closeBrowserSession 会一并关闭该窗口。
          const r = await startExternalScanLogin(item.platform)
          // 启动请求期间用户可能已点停止/关窗 → 关掉刚拉起的浏览器并立即收尾
          if (cancelRef.current) {
            if (r.success && r.data?.session_id) void closeBrowserSession(r.data.session_id)
            markStoppedFrom(i)
            break
          }
          if (!r.success || !r.data?.session_id) throw new Error(r.error || '启动外部浏览器失败')
          sid = r.data.session_id
          setExtInfo({
            browser: r.data.browser ?? '',
            profileUsed: !!r.data.profile_used,
          })
        } else {
          // 内置模式:BrowserHub Playwright Chromium + WorkPanel CDP 截图流视图
          const r = await createBrowserSession({
            url: plat.login_url,
            viewport_width: 1024,
            viewport_height: 720,
          })
          if (cancelRef.current) {
            if (r.success && r.data?.session_id) void closeBrowserSession(r.data.session_id)
            markStoppedFrom(i)
            break
          }
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
          markStoppedFrom(i)
          break
        }
        if (outcome === 'closed') {
          // 用户把浏览器窗口关掉了 = 结束队列(否则会一路把剩余平台逐个弹出来)
          cancelRef.current = true
          markStoppedFrom(i)
          toast.info(t('accounts.batchScanWindowClosedToast'))
          break
        }
        updateItem(i, { status: 'error', msg: t('accounts.batchScanDetectError') })
      } catch (e) {
        if (sessionRef.current) {
          void closeBrowserSession(sessionRef.current)
          sessionRef.current = ''
        }
        if (cancelRef.current) {
          markStoppedFrom(i)
          break
        }
        updateItem(i, { status: 'error', msg: (e as Error).message })
      }
    }

    runningRef.current = false
    setRunning(false)
    setStopping(false)
    if (successCount > 0) {
      toast.success(
        `${t('accounts.batchScanDone')} · ${t('accounts.batchScanSuccessCount', { count: successCount })}`,
      )
    }
  }

  function skipCurrent() {
    skipRef.current = true
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
                {stopping
                  ? t('accounts.batchScanStopping')
                  : t('accounts.batchScanProgress', {
                      current: activeIdx + 1,
                      total,
                      name: activeItem.name,
                    })}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {mode === 'external'
                  ? extInfo?.profileUsed
                    ? t('accounts.batchScanWaitingHintExternalOwn', {
                        browser: extInfo.browser || 'Chrome',
                      })
                    : t('accounts.batchScanWaitingHintExternal')
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
              <Button variant="outline" onClick={skipCurrent} disabled={stopping}>
                <SkipForward className="h-4 w-4" />
                {t('accounts.batchScanSkip')}
              </Button>
              <Button variant="outline" onClick={cancelQueue} disabled={stopping}>
                {stopping && <Loader2 className="h-4 w-4 animate-spin" />}
                {stopping ? t('accounts.batchScanStopping') : t('accounts.batchScanStop')}
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
