// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * ③ 外部模式 = 在**用户自己日常使用的浏览器**里打开:此前用"复制的 profile 起托管浏览器",
 *    实测副本会丢 Google 登录态(还要求重新登录 Google)、且没有书签/扩展,用户感知"不是我的
 *    浏览器"。现改为前端用系统默认浏览器打开平台登录页(真实 profile、登录态/Google 都在),
 *    后端从真实 profile 读 cookie 名判断登录态,命中后用无窗口 headless 取值入库。
 * ④ 用户手动关掉浏览器窗口 = 结束队列:后端返回"浏览器已关闭"此前被当成普通检测异常,
 *    队列会继续弹下一个平台(用户视角"我都关了怎么还在弹");现已识别该信号并停止队列。
 *
 * 2026-09-15:启动前支持选择"内置浏览器(CDP)"或"你自己的浏览器(系统默认浏览器)"。
 * 内置:createBrowserSession → openCdpSession → detectLoginFromCdp 轮询;
 * 外部:openExternalUrl 在用户真实浏览器打开登录页 + detectLoginFromProfile 读真实 profile →
 * 同一轮询语义,但检测走 detectLoginFromProfile(读用户真实 profile),不再托管浏览器会话。
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
  detectLoginFromProfile,
  listScanLoginPlatforms,
  type ScanLoginPlatform,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { useWorkPanelStore } from '@/stores/work-panel'
import { openExternalUrl } from '@/lib/tauri-bridge'
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
/** 扫码打开方式:内置 CDP 视图 / 用户自己日常使用的浏览器(真实 profile) */
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

/** 登录检测响应(CDP 与"用户真实 profile"两种检测共用字段) */
interface DetectResult {
  detected?: boolean
  error?: string | null
  cookies_count?: number
  account_id?: number | null
  profile_available?: boolean
}
type DetectFn = () => Promise<{ success: boolean; data?: DetectResult; error?: string }>

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
  /** 是否成功读到用户浏览器的登录态(由检测响应回报,决定提示文案) */
  const [profileAvailable, setProfileAvailable] = React.useState<boolean | null>(null)
  /** 浏览器拦截了新标签页(外部模式在 web 端可能发生):需提示用户允许弹出窗口 */
  const [popupBlocked, setPopupBlocked] = React.useState(false)

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

  function pollPlatform(detect: DetectFn): Promise<PollOutcome> {
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
          const r = await detect()
          const pa = r.data?.profile_available
          if (typeof pa === 'boolean') setProfileAvailable(pa)
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
    setPopupBlocked(false)
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
        let sid = ''
        if (useExternal) {
          // 外部模式:在**用户自己日常使用的浏览器**里打开该平台登录页(系统默认浏览器/新标签,
          // 真实 profile —— 平台登录态与 Google 账号都在,不需要重新登录),随后由后端从真实
          // profile 读登录态自动保存。本应用不再托管这个浏览器,所以没有会话要关。
          // 复用同一个命名标签页:整个队列只用一个标签轮流导航(登录态在同一个 profile 内保持)
          const opened = await openExternalUrl(plat.login_url, 'ihui-scan-login')
          // 浏览器拦截了非用户手势打开的标签(队列里只有第 1 个平台在点击手势内)→
          // 不能假装"已打开",立即停队列并提示用户允许本站弹出窗口
          if (!opened) {
            cancelRef.current = true
            markStoppedFrom(i)
            setPopupBlocked(true)
            toast.error(t('accounts.batchScanPopupBlockedToast'))
            break
          }
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
        const outcome = await pollPlatform(
          useExternal
            ? () => detectLoginFromProfile(item.platform)
            : () => detectLoginFromCdp(sid, item.platform),
        )
        if (sid && sessionRef.current === sid) sessionRef.current = ''
        if (sid) void closeBrowserSession(sid)
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
          {popupBlocked && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {t('accounts.batchScanPopupBlocked')}
            </div>
          )}

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
                  ? profileAvailable === false
                    ? t('accounts.batchScanWaitingHintExternal')
                    : t('accounts.batchScanWaitingHintExternalOwn')
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
