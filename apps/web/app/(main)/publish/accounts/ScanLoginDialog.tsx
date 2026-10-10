// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 扫码登录弹窗(2026-09-29 换回"后端截二维码 + 前端轮询任务"这条 HTTP 通道)。
 *
 * 为什么换:此前走内置浏览器 CDP(`POST /api/browser/sessions` + `WS /api/browser/ws/*`),
 * 而生产 nginx 把 `/api/` 整段交给 Fastify(8802),那两层路由**都不存在**;Next.js rewrites
 * 只在 dev 生效。实测(同一枚合法 token,2026-09-29):`POST /api/browser/sessions` → 404
 * `Route ... not found`,`GET https://aizhs.top/api/browser/ws/zz` → 404 同信封。
 * 即"所有平台一起不好使"不是平台适配问题,是入口选了一条到端的 404 通道。
 * 同一台机上 `POST /api/publish/scan-login/start` → 200,约 9s 后 `/qr` 出 604KB PNG ——
 * HTTP 那条腿整条是通的(api 代理四条路由齐备),只是此前没有调用方。
 *
 * 弹窗保持打开并直接显示二维码:关闭弹窗=取消任务(A5),不再"缩到侧栏"——
 * 侧栏那块画面正是依赖上面那条 404 的 WS 才有内容。
 *
 * 2026-09-16:"默认浏览器 + 手动导入"模式保留 —— Chrome 136+ 禁止在默认 profile 上开 CDP
 * 调试端口,外部浏览器拿不到用户日常登录态,故用 openExternalUrl 调系统默认浏览器打开登录页,
 * 用户登录后粘贴 Cookie,后端 import-cookies 解析校验入库。
 */

import * as React from 'react'
import { Loader2, QrCode, CheckCircle2, XCircle, ExternalLink, RefreshCw, Import as ImportIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  cancelScanLogin,
  fetchScanLoginQr,
  getScanLoginStatus,
  importChromeFromCdp,
  importCookiesManually,
  launchChromeForImport,
  listScanLoginPlatforms,
  startScanLogin,
  type ScanLoginPlatform,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
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
import { PlatformIcon } from '@/components/publish/platform-icon'
import { apiFailureToError } from '@ihui/shared/utils'

export interface ScanLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultPlatform?: string
}

/**
 * 2026-09-30 提速:"快跑慢走"轮询节奏。
 *
 * 旧实现固定 3s 一轮 —— 后端起浏览器 + 出码实测 3.5~8s,点完按钮后第一轮轮询要等到 3s,
 * 而**出码那一刻常常正好落在两轮之间**,用户白等最多一整个间隔。现在:
 *   出码前 400ms 一轮(这段时间用户正盯着空白框,越快发现第一帧越好)
 *   出码后 2500ms 一轮(码已在屏上,轮询只为发现"扫了",不必再密)
 * 20s 之后整体降到 2500ms:等待窗口是 10 分钟,一直 400ms 打状态口没有必要。
 */
const FAST_POLL_INTERVAL_MS = 400
const RELAXED_POLL_INTERVAL_MS = 2500
const FAST_POLL_WINDOW_MS = 20_000
/** 同一帧二维码最多重试几次;失败后按放宽节奏再试,不把它当任务失败 */
const MAX_RETRY_PER_FRAME = 3
/** 出码前的进度阶梯(顺序即推进顺序):后端 stage 值一一对应,i18n 键同值 */
const LOADING_STAGES = ['booting', 'opening', 'switching', 'rendering', 'ready'] as const
type LoadingStage = (typeof LOADING_STAGES)[number]
/** 已等待秒数轮询间隔:0.1s 一跳,数字变动肉眼可辨 */
const ELAPSED_TICK_MS = 100
/** 等超过这个秒数才补一句"在跑什么"的说明,免得用户以为界面卡死 */
const SLOW_HINT_AFTER_SECONDS = 5
const TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_SECONDS = 300

type Phase = 'idle' | 'starting' | 'polling' | 'manual-import' | 'chrome-import' | 'success' | 'failed'

/** 连续多少次"根本没拿到应答"(网络层失败)才判失败。有状态码的应答一律当场点名,不拖到超时。 */
const MAX_NETWORK_RETRIES = 3

/**
 * 头条双通道姊妹映射(2026-09-29):同一个头条账号有两条出码通道 ——
 * `toutiao` 是纯 HTTP 的微信网页扫码码,`toutiao_app` 是头条 App 原生码。
 * 两码不互通(网页端首登还强制手机验证),但用户不必回平台下拉重开:
 * 弹窗 polling 态一键互切 = 取消当前任务 + 用姊妹通道重新出码。
 * 微信通道每次 start 都拿新鲜 state,后端零改动。
 */
const SISTER_CHANNEL: Record<string, string> = {
  toutiao: 'toutiao_app',
  toutiao_app: 'toutiao',
}

/**
 * 2026-09-30 用户规则:平台选择面只留一个「今日头条」= App 扫码(toutiao_app)。
 * 微信网页码(toutiao)被头条 need_bind_mobile 策略拦截,不再出现在下拉/网格里,
 * 仅经 polling 态「切换到微信码」按钮(SISTER_CHANNEL)可达。
 */
const HIDDEN_PLATFORM_KEYS = new Set(['toutiao'])

/** 常用平台 pill 网格(按此顺序取与后端列表的交集),其余平台收进「更多平台」下拉 */
const COMMON_PLATFORM_KEYS = [
  'toutiao_app',
  'douyin',
  'bilibili',
  'xiaohongshu',
  'zhihu',
  'wechat',
  'weibo',
  'kuaishou',
]

/** pill 显示名净化:「今日头条(App扫码)」→「今日头条」(通道语义对用户是内部细节) */
function platformDisplayName(name: string): string {
  return name.replace(/\(App扫码\)$/, '').replace(/（App扫码）$/, '')
}

export function ScanLoginDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultPlatform,
}: ScanLoginDialogProps) {
  const t = useTranslations('publish')
  const tCommon = useTranslations('common')
  const toast = useToast()
  const [platforms, setPlatforms] = React.useState<ScanLoginPlatform[]>([])
  const [platform, setPlatform] = React.useState<string>(defaultPlatform ?? '')
  /**
   * 会话复用(2026-09-30,用户拍板):该平台已有有效登录态时直接复用、免扫码;
   * 关掉 = 每次重新扫码(后端清登录态出码)。选择持久化到 localStorage,两档并存。
   */
  const [reuseSession, setReuseSession] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem('ihui:scan-login:reuse-session') !== '0'
    } catch {
      return true
    }
  })
  function toggleReuseSession() {
    setReuseSession((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('ihui:scan-login:reuse-session', next ? '1' : '0')
      } catch {
        /* 隐私模式等 localStorage 不可用场景:仅本次会话内生效 */
      }
      return next
    })
  }
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [qrUrl, setQrUrl] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string>('')
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(TIMEOUT_SECONDS)
  const [cookiesInput, setCookiesInput] = React.useState<string>('')
  const [importError, setImportError] = React.useState<string>('')
  const [importing, setImporting] = React.useState<boolean>(false)
  /** 后端真实进度文案(「正在打开 X 登录页…」)。干等最伤体验,这里如实转述后端进度 */
  const [taskMessage, setTaskMessage] = React.useState<string>('')
  /** 后端进度阶梯值(见 ScanLoginTask.stage);前端按值映射文案,不猜 */
  const [taskStage, setTaskStage] = React.useState<LoadingStage>('booting')
  /** 已等待秒数(0.1s 一跳)。用户原话"一点变化都没有" —— 这是最直接的"页面还活着"证据 */
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0)
  const startTimeRef = React.useRef<number>(0)
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 当前后端任务 id。轮询闭包里读 state 会拿到旧值,取消/卸载路径必须读这一份。 */
  const taskIdRef = React.useRef<string>('')
  /** 最近一次轮询看到的任务状态(2026-09-30):扫码后的绑定阶段不该被 UI 关闭连带取消,取消前必须看这一份 */
  const lastStatusRef = React.useRef<string>('')
  /**
   * 预热任务:弹窗一开就给默认平台点火(见下方 useEffect)。
   * 它把用户"点按钮 → 后端才起浏览器"的那段延迟提前到用户还在看界面的时候。
   * jobId 为空 = 无预热;一旦被点击路径接管或被取消即清空。
   */
  const prewarmRef = React.useRef<{
    platform: string
    jobId: string
    startedAt: number
    cancelled: boolean
  } | null>(null)
  /** 已渲染的二维码批次(qr_updated_at),用它避免重复拉同一张图 */
  const qrStampRef = React.useRef<number>(0)
  /** 同一帧二维码已失败几次(见 poll 里"取不到图不换帧"那段) */
  const qrFailRef = React.useRef<number>(0)
  /** 上一次 attempt 请求的帧号,用来判断这一轮拿到的是不是同一帧 */
  const qrAttemptStampRef = React.useRef<number>(0)
  /** 二维码 blob 的 objectURL,卸载/重取时必须释放,否则每次刷新都漏一个 Blob */
  const qrUrlRef = React.useRef<string>('')
  const networkFailRef = React.useRef<number>(0)

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
          // 2026-09-30 用户规则:默认选「今日头条(App扫码)」——微信网页码被头条
          // need_bind_mobile 策略拦截(网页端身份未绑手机号),App 码才是全自动通道。
          if (!defaultPlatform) {
            setPlatform(
              (prev) =>
                prev ||
                r.data.platforms.find((p) => p.platform === 'toutiao_app')?.platform ||
                r.data.platforms[0]?.platform ||
                '',
            )
          }
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPlatform])

  /**
   * 预热(2026-09-30 提速):在用户按下「开始扫码登录」**之前**就把后端任务点起来。
   *
   * 为什么值得:后端起 Chromium + 打开平台登录页 + 等登录入口渲染,实测 1.2s 起步
   * (固定等待另算,已在后端侧改成条件式);那 1.2s 过去是用户点完按钮才开始跑的。
   * 现在弹窗一露出二维码区,后端就已经在跑了,点击只是**接管**这枚任务。
   *
   * 两档点火时机:
   *   - 带 defaultPlatform 的入口(账号页「添加账号」带平台进来)= 立刻。用户已经用
   *     "我要加这个平台的账号"表达过意图,不是浏览。
   *   - 用户自己在下拉/pill 里挑的 = 停手 350ms 后。改选会清掉计时器,这枚预热就再也
   *     不会发生 —— 不留空转的浏览器。350ms 的取舍:实测浏览器整段 1s 上下,用户
   *     "挑完立刻点"的间隔常在 0.5~1s,800ms 会让这一档白白错过预热窗口;
     350ms 仍大于连点两次的真实停顿,churn 由改选即退兜住。
   * 任一时刻只保留一枚:平台变了、phase 离开 idle(点击已接管 / 已成功 / 已失败)、
   * 弹窗关掉,都会把旧的退掉(见 cancelPrewarm 与下方 close 效应)。
   */
  React.useEffect(() => {
    if (!open || phase !== 'idle' || !platform) return
    const chosen = platform
    const delay = defaultPlatform ? 0 : 350
    const timer = setTimeout(() => {
      const warmed = { platform: chosen, jobId: '', startedAt: Date.now(), cancelled: false }
      prewarmRef.current = warmed
      void (async () => {
        try {
          const r = await startScanLogin(chosen, { reuseSession })
          if (warmed.cancelled) {
            if (r.success && r.data?.task_id) {
              void cancelScanLogin(r.data.task_id).catch(() => undefined)
            }
            return
          }
          warmed.jobId = r.success && r.data?.task_id ? r.data.task_id : ''
        } catch {
          /* 预热失败不算错误:用户点按钮时 handleStart 会照常发起一次新任务 */
          if (prewarmRef.current === warmed) warmed.jobId = ''
        }
      })()
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelPrewarm()
    }
  }, [open, phase, platform, defaultPlatform, reuseSession])

  // 弹窗关闭(而不是卸载):把还在预热的任务退掉,否则那枚 Chromium 会挂到后端超时。
  React.useEffect(() => {
    if (open) return
    cancelPrewarm()
    setTaskMessage('')
  }, [open])

  /**
   * 用户改选平台:`handleStart` 之外的一切入口都不该留着一枚为别的平台预热的任务。
   * 返回被取消的预热记录(供"接管"路径取真实起点时间),无预热时返回 null。
   */
  function cancelPrewarm(): { platform: string; startedAt: number } | null {
    const pre = prewarmRef.current
    if (!pre) return null
    pre.cancelled = true
    prewarmRef.current = null
    if (pre.jobId && taskIdRef.current !== pre.jobId) {
      void cancelScanLogin(pre.jobId).catch(() => undefined)
    }
    return { platform: pre.platform, startedAt: pre.startedAt }
  }

  /**
   * 只取消「还没扫上码」的任务(2026-09-30)。
   * 用户扫码确认后,后端进入绑定/短信阶段 —— 那是一个正在进行的登录会话,
   * 弹窗被关闭/组件卸载/倒计时到点都不该把它连带杀掉(实测杀死过 4 次绑定到最后一刻的会话)。
   * 只有 pending/waiting_scan(以及状态未知 = 还没轮询到)才随 UI 退出而取消。
   */
  function cancelTaskIfNotScanned() {
    const id = taskIdRef.current
    if (!id) return
    if (!lastStatusRef.current || lastStatusRef.current === 'pending' || lastStatusRef.current === 'waiting_scan') {
      void cancelScanLogin(id).catch(() => undefined)
    }
    taskIdRef.current = ''
  }

  React.useEffect(() => {
    return () => {
      stopPolling()
      releaseQr()
      stopChromePolling()
      chromeActiveRef.current = false
      // 卸载即取消:后端任务不取消会占着一个 Chromium 直到 10 分钟超时。
      // 但仅限还没扫上码的任务 —— 扫码后的绑定会话必须活到它自己终态(见 cancelTaskIfNotScanned)。
      cancelTaskIfNotScanned()
      cancelPrewarm()
    }
  }, [])

  React.useEffect(() => {
    if (open && phase === 'polling' && startTimeRef.current > 0) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setCountdownSeconds(Math.max(0, TIMEOUT_SECONDS - elapsed))
    }
  }, [open, phase])

  /**
   * 已等待秒数计时器(2026-09-30,针对"用户以为卡住了")。
   *
   * 只在 starting/polling 两档跑:出码前这段时间屏幕上必须**每秒都有变化**。
   * 分辨率 0.1s 是刻意的 —— 1s 一跳在慢机器上会被看成"静止",0.1s 跳字一眼可辨,
   * 而代价只是两帧文本重渲染。
   */
  React.useEffect(() => {
    if (!open || (phase !== 'polling' && phase !== 'starting' && phase !== 'chrome-import')) return
    const from = startTimeRef.current || Date.now()
    const tick = () => setElapsedSeconds((Date.now() - from) / 1000)
    tick()
    const timer = setInterval(tick, ELAPSED_TICK_MS)
    return () => clearInterval(timer)
  }, [open, phase])

  /** 后端 stage → 进度阶梯下标;值不认识时从第一档起(不假装已完成) */
  const stageIndex = Math.max(0, LOADING_STAGES.indexOf(taskStage))
  const displayStage: LoadingStage = LOADING_STAGES[stageIndex] ?? 'booting'

  function stopPolling() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  /**
   * 轮询节奏(2026-09-30):出码前 400ms、出码后 2500ms、20s 后一律 2500ms。
   * 为什么不是一路 400ms:后端等待窗口是 10 分钟,密轮询只在"用户正盯着空白框"那段
   * 有意义;码上了屏,用户去拿手机、扫码、确认,这段时间密轮询纯属空转。
   */
  function nextPollDelay(hasQr: boolean): number {
    if (hasQr) return RELAXED_POLL_INTERVAL_MS
    if (Date.now() - startTimeRef.current > FAST_POLL_WINDOW_MS) return RELAXED_POLL_INTERVAL_MS
    return FAST_POLL_INTERVAL_MS
  }

  /** 释放二维码 blob。换图/失败/卸载三条路径都必须走这里,否则每次刷新都漏一个 Blob。 */
  function releaseQr() {
    if (qrUrlRef.current) {
      URL.revokeObjectURL(qrUrlRef.current)
      qrUrlRef.current = ''
    }
    qrStampRef.current = 0
    qrFailRef.current = 0
    qrAttemptStampRef.current = 0
    setQrUrl('')
  }

  /** 拉当前这一帧二维码。用 blob 而不是 <img src=URL>:该口要带 Authorization,裸 URL 拿不到。 */
  async function showQr(id: string, stamp: number) {
    const blob = await fetchScanLoginQr(id)
    const next = URL.createObjectURL(blob)
    if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current)
    qrUrlRef.current = next
    qrStampRef.current = stamp
    qrFailRef.current = 0
    setQrUrl(next)
  }

  function failTask(msg: string) {
    stopPolling()
    releaseQr()
    // Chrome 导入轮询一并停摆(倒计时到点走这条路径)
    chromeActiveRef.current = false
    stopChromePolling()
    // 后端任务可能还在跑(它自己也要等到 10 分钟才收),这里必须显式取消,
    // 否则每次失败都留一个 Chromium 挂在服务器上。
    // 2026-09-30:已扫码的绑定会话除外 —— 同 cancelTaskIfNotScanned 的口径。
    cancelTaskIfNotScanned()
    cancelPrewarm()
    setTaskMessage('')
    setPhase('failed')
    setErrorMsg(msg)
    toast.error(msg)
  }

  function handleCountdownExpire() {
    failTask(t('accounts.scanLoginTimeout'))
  }

  /** 接管一枚已经在跑的任务(预热任务):跳过"再起一遍浏览器",直接开始轮询。 */
  function adoptTask(id: string, startAt?: number) {
    taskIdRef.current = id
    // 预热任务在用户点击之前就跑了一小段:起点必须用预热真正发起的那一刻,
    // 否则"已等待 N 秒"与倒计时都会把那段抹掉(少算了自己偷偷省下的时间)。
    startTimeRef.current = startAt ?? Date.now()
    setCountdownSeconds(TIMEOUT_SECONDS)
    setTaskMessage('')
    setTaskStage('booting')
    setElapsedSeconds(0)
    setPhase('polling')
    startPolling(id)
  }

  async function handleStart(platOverride?: string) {
    // platOverride:姊妹通道切换时同步调用,setState 是异步的,读 state 会拿到旧值
    const plat = platOverride ?? platform
    if (!plat) return
    const platInfo = platforms.find((p) => p.platform === plat)
    if (!platInfo) return

    // 预热命中:该平台的任务已经在跑(大概率二维码都快出来了),直接接管,不再发起新任务。
    // 判据同时看"平台一致"与"还没有别的任务在跑",避免把用户当前正在等的任务顶掉。
    const pre = prewarmRef.current
    if (!platOverride && pre && pre.platform === plat && pre.jobId && !taskIdRef.current) {
      const preStartedAt = pre.startedAt
      prewarmRef.current = null
      adoptTask(pre.jobId, preStartedAt)
      return
    }
    // 预热平台与本次选择不同(或用户改选过):取消它,别让后端空转一枚 Chromium
    cancelPrewarm()

    setPhase('starting')
    setErrorMsg('')
    setTaskMessage('')
    networkFailRef.current = 0
    try {
      const r = await startScanLogin(plat, { reuseSession })
      if (!r.success) throw apiFailureToError(r, t('accounts.scanLoginFailed'))
      const id = r.data?.task_id
      if (!id) throw new Error(t('accounts.scanLoginFailed'))
      adoptTask(id)
    } catch (e) {
      const msg = (e as Error).message
      stopPolling()
      setPhase('failed')
      setErrorMsg(msg)
      toast.error(msg)
    }
  }

  /** 终态集合:后端 expired 不在 ScanLoginTask 的类型并集里,所以按字符串集合判,不做字面量比较。 */
  const TERMINAL_STATUSES = new Set(['success', 'failed', 'timeout', 'cancelled', 'expired'])

  /**
   * 自重排轮询(2026-09-30 替换 setInterval)。
   *
   * setInterval 的两个毛病在这一档都要命:① 上一轮没回来就发下一轮(网络慢时叠请求);
   * ② 节奏固定,出码前后只能取同一个值。改成"每轮结束再按当前状态决定下一次等多久",
   * 出码前 400ms、出码后 2500ms,顺带天然互斥。
   */
  function startPolling(id: string) {
    stopPolling()
    const tick = async () => {
      pollTimerRef.current = null
      if (taskIdRef.current !== id) return
      const schedule = (hasQr: boolean) => {
        if (taskIdRef.current !== id) return
        pollTimerRef.current = setTimeout(() => void tick(), nextPollDelay(hasQr))
      }
      if (Date.now() - startTimeRef.current > TIMEOUT_MS && lastStatusRef.current !== 'scanned') {
        // 2026-09-30:已扫码(进入绑定/短信阶段)的任务不受弹窗倒计时约束,
        // 短信往返+人工输码需要的时间远超扫码倒计时;此时只继续轮询,等后端终态。
        failTask(t('accounts.scanLoginTimeout'))
        return
      }
      try {
        const r = await getScanLoginStatus(id)
        if (!r.success) {
          // 拿到状态码 = 服务答过了。这一类问题多轮几次不会自己好,当场点名 ——
          // 旧实现把每一次 404 都表现成"等待扫码",即"不好使"最难归因的那一层。
          failTask(apiFailureToError(r, t('accounts.scanLoginFailed')).message)
          return
        }
        networkFailRef.current = 0
        const d = r.data
        if (!d) {
          schedule(false)
          return
        }
        // 记录最近状态:取消/倒计时路径要用它区分"还没扫上"与"绑定进行中"
        lastStatusRef.current = d.status
        // 后端进度如实转述(「正在打开 X 登录页…」),用户不用对着一个转圈猜
        if (d.message) setTaskMessage((prev) => (prev === d.message ? prev : d.message))
        // 进度阶梯:亮到哪一级完全由后端说了算(前端不编动画进度)
        // 注:先落成局部量再进 updater —— d.stage 是可选字段,闭包里的收窄不作数
        const nextStage = d.stage
        if (nextStage) setTaskStage((prev) => (prev === nextStage ? prev : nextStage))
        if (d.status === 'success') {
          stopPolling()
          releaseQr()
          taskIdRef.current = ''
          setTaskMessage('')
          setPhase('success')
          toast.success(
            `${t('accounts.scanLoginSuccess')}${d.cookies_count ? ` (${d.cookies_count})` : ''}`,
          )
          onSuccess?.()
          return
        }
        if (TERMINAL_STATUSES.has(d.status)) {
          failTask(d.message || t('accounts.scanLoginFailed'))
          return
        }
        let gotQr = Boolean(qrUrlRef.current)
        if (d.has_qr && d.qr_updated_at !== qrStampRef.current) {
          // 同一帧最多重试 MAX_RETRY_PER_FRAME 次;超过就把它记成"已尝试",按放宽节奏
          // 再试。否则这一帧取不到时每一轮都会立刻重取,等于自己给自己打满流量。
          if (qrAttemptStampRef.current !== d.qr_updated_at) {
            qrAttemptStampRef.current = d.qr_updated_at
            qrFailRef.current = 0
          }
          if (qrFailRef.current < MAX_RETRY_PER_FRAME) {
            qrFailRef.current += 1
            try {
              await showQr(id, d.qr_updated_at)
              gotQr = true
            } catch {
              /* 这一帧图没取到:下一轮还会再取,不能因此把整个任务判失败 */
            }
          }
        }
        schedule(gotQr)
      } catch {
        // 只有"根本没拿到应答"(网络层异常)才计入重试预算;连续 3 次判失败。
        networkFailRef.current += 1
        if (networkFailRef.current >= MAX_NETWORK_RETRIES) {
          failTask(t('accounts.scanLoginFailed'))
          return
        }
        schedule(Boolean(qrUrlRef.current))
      }
    }
    pollTimerRef.current = setTimeout(() => void tick(), 0)
  }

  function handleCancel() {
    stopPolling()
    releaseQr()
    if (taskIdRef.current) {
      void cancelScanLogin(taskIdRef.current).catch(() => undefined)
      taskIdRef.current = ''
    }
    cancelPrewarm()
    setTaskMessage('')
    setPhase('idle')
  }

  /** 弹窗内一键换姊妹通道(微信码 ↔ App码):取消当前任务,立刻用另一条通道重新出码。 */
  function handleSwitchChannel() {
    const sister = SISTER_CHANNEL[platform]
    if (!sister) return
    handleCancel()
    setPlatform(sister)
    void handleStart(sister)
  }

  // 2026-09-30:登录成功 2s 后自动关闭(用户要求)——"已自动保存"提示可见即走,不挡后续
  // 操作。清理动作与下方成功态「关闭」按钮逐字一致;failed 态保持手动关闭(用户要读错误)。
  React.useEffect(() => {
    if (phase !== 'success') return
    const timer = setTimeout(() => {
      setPhase('idle')
      setErrorMsg('')
      taskIdRef.current = ''
      onOpenChange(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [phase, onOpenChange])

  // 选择面数据派生:隐藏微信网页码;常用 8 个进 pill 网格,其余收进「更多平台」下拉
  const visiblePlatforms = platforms.filter((p) => !HIDDEN_PLATFORM_KEYS.has(p.platform))
  const commonPlatforms = COMMON_PLATFORM_KEYS.map((k) =>
    visiblePlatforms.find((p) => p.platform === k),
  ).filter((p): p is ScanLoginPlatform => Boolean(p))
  const restPlatforms = visiblePlatforms.filter((p) => !COMMON_PLATFORM_KEYS.includes(p.platform))
  const restPlatformSet = new Set(restPlatforms.map((p) => p.platform))

  /** 手动导入 cookies(2026-09-16):系统默认浏览器登录闭环的最后一步。 */
  async function handleImportCookies() {
    if (!cookiesInput.trim() || importing) return
    setImporting(true)
    setImportError('')
    try {
      const r = await importCookiesManually(platform, cookiesInput)
      if (!r.success) throw apiFailureToError(r, '导入失败')
      if (!r.data?.account_id) throw new Error('导入失败')
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

  // ===========================================================================
  // 「从我的 Chrome 导入」模式(2026-09-30 新增,chrome_import 消费端闭环)
  //
  // 与"手动粘贴"互补:后端用临时 profile 拉起一个带 CDP 调试端口的 Chrome/Edge
  // (规避 Chrome 136+ 默认 profile 禁 CDP 的限制),用户在**那个独立窗口**里正常
  // 登录,前端每 3s 轮询 import-chrome → 后端经 CDP 提 cookie/检测/自动入库,
  // 全程无需粘贴 Cookie。
  // ===========================================================================
  const [chromeLaunching, setChromeLaunching] = React.useState<boolean>(false)
  /** 本轮导入用的 CDP 端口与平台(handleChromeImport 成功时盖章,轮询闭包读 ref 不读 state) */
  const chromePortRef = React.useRef<number>(0)
  const chromePlatformRef = React.useRef<string>('')
  /** 轮询活动开关:返回/取消/成功/超时都要先翻 false,再清计时器,闭包自然停摆 */
  const chromeActiveRef = React.useRef<boolean>(false)
  const chromeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const chromeStartRef = React.useRef<number>(0)
  /** Chrome 导入模式的轮询间隔:登录动作发生在用户那边,3s 足够跟手且不压后端 */
  const CHROME_POLL_INTERVAL_MS = 3000

  function stopChromePolling() {
    if (chromeTimerRef.current) {
      clearTimeout(chromeTimerRef.current)
      chromeTimerRef.current = null
    }
  }

  async function handleChromeImport() {
    if (!platform || chromeLaunching) return
    setChromeLaunching(true)
    setErrorMsg('')
    try {
      const r = await launchChromeForImport(platform)
      if (!r.success) throw apiFailureToError(r, t('accounts.chromeImportFailed'))
      const d = r.data
      if (!d?.launched || !d.port) throw new Error(d?.error || t('accounts.chromeImportFailed'))
      chromePortRef.current = d.port
      chromePlatformRef.current = platform
      chromeStartRef.current = Date.now()
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
      setCountdownSeconds(TIMEOUT_SECONDS)
      setPhase('chrome-import')
      chromeActiveRef.current = true
      startChromePolling()
    } catch (e) {
      const msg = (e as Error).message
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setChromeLaunching(false)
    }
  }

  function cancelChromeImport() {
    chromeActiveRef.current = false
    stopChromePolling()
    chromePortRef.current = 0
    setPhase('idle')
  }

  function startChromePolling() {
    stopChromePolling()
    const tick = async () => {
      chromeTimerRef.current = null
      if (!chromeActiveRef.current || !chromePortRef.current) return
      const plat = chromePlatformRef.current
      if (Date.now() - chromeStartRef.current > TIMEOUT_MS) {
        chromeActiveRef.current = false
        failTask(t('accounts.scanLoginTimeout'))
        return
      }
      try {
        const r = await importChromeFromCdp(chromePortRef.current, plat)
        if (!chromeActiveRef.current) return
        if (r.success && r.data?.detected) {
          chromeActiveRef.current = false
          setPhase('success')
          toast.success(
            `${t('accounts.scanLoginSuccess')}${r.data.cookies_count ? ` (${r.data.cookies_count})` : ''}`,
          )
          onSuccess?.()
          return
        }
        // detected=false(error=null 未登录 / error 非空 端口未就绪等)都继续轮询,
        // 由总超时兜底——用户登录动作耗时不可控,不该把一次探测失败当成失败。
        chromeTimerRef.current = setTimeout(() => void tick(), CHROME_POLL_INTERVAL_MS)
      } catch {
        // 网络层异常同样只重试,不提前终止(与扫码轮询口径一致)
        if (!chromeActiveRef.current) return
        chromeTimerRef.current = setTimeout(() => void tick(), CHROME_POLL_INTERVAL_MS)
      }
    }
    chromeTimerRef.current = setTimeout(() => void tick(), 0)
  }

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
                {/* 2026-09-30 重设计:常用平台 pill 网格直选(2 列,大点击区),其余收进下拉 */}
                {commonPlatforms.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {commonPlatforms.map((p) => {
                      const active = platform === p.platform
                      return (
                        <button
                          key={p.platform}
                          type="button"
                          onClick={() => setPlatform(p.platform)}
                          disabled={isBusy}
                          aria-pressed={active}
                          className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? 'border-brand-accent-deep bg-primary/10 text-primary'
                              : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted'
                          }`}
                        >
                          <PlatformIcon
                            platform={p.platform}
                            platformName={p.name}
                            size={20}
                            className="bg-transparent"
                          />
                          <span className="truncate">{platformDisplayName(p.name)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {restPlatforms.length > 0 && (
                  <Select
                    value={restPlatformSet.has(platform) ? platform : ''}
                    onValueChange={setPlatform}
                    disabled={isBusy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('accounts.morePlatforms')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {restPlatforms.map((p) => (
                        <SelectItem key={p.platform} value={p.platform}>
                          <span className="flex items-center gap-2">
                            <PlatformIcon
                              platform={p.platform}
                              platformName={p.name}
                              size={16}
                              className="bg-transparent"
                            />
                            <span>{platformDisplayName(p.name)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <button
                type="button"
                onClick={toggleReuseSession}
                disabled={isBusy}
                className="flex w-full items-center justify-between rounded-sm border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
              >
                <span>{t('accounts.scanLoginReuseLabel')}</span>
                <span className={reuseSession ? 'font-medium text-foreground' : ''}>
                  {reuseSession ? t('accounts.scanLoginReuseOn') : t('accounts.scanLoginReuseOff')}
                </span>
              </button>
              <Button
                onClick={() => void handleStart()}
                disabled={!platform || isBusy}
                className="w-full"
              >
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                <QrCode className="h-4 w-4" />
                {isBusy ? t('accounts.preparingQr') : t('accounts.startScanLogin')}
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
              {/* 2026-09-30 新增:Chrome 导入模式 —— 后端拉起带调试端口的独立 Chrome 窗口,
                  用户在里面登录后自动经 CDP 收 cookie 入库,免去手动粘贴。 */}
              <Button
                variant="outline"
                className="w-full"
                disabled={!platform || isBusy || chromeLaunching}
                onClick={() => void handleChromeImport()}
              >
                {chromeLaunching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImportIcon className="h-4 w-4" />
                )}
                {chromeLaunching
                  ? t('accounts.chromeImportLaunching')
                  : t('accounts.chromeImportBtn')}
              </Button>
            </>
          )}

          {phase === 'starting' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('accounts.loadingStage.booting')}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t('accounts.elapsedSeconds', { seconds: elapsedSeconds.toFixed(1) })}
              </p>
            </div>
          )}

          {phase === 'polling' && (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3">
              {qrUrl ? (
                // 二维码由后端截取登录页后逐帧更新(qr_updated_at 变一次取一帧);
                // 用 blob 而不是裸 URL,是因为 /qr 那一口要带 Authorization。
                // eslint-disable-next-line @next/next/no-img-element -- 同上:由后端逐帧截取登录页、带 Authorization 取回后转成的 blob: 二维码
                <img
                  src={qrUrl}
                  alt={t('accounts.scanLoginQrAlt')}
                  width={240}
                  height={240}
                  className="h-60 w-60 bg-white object-contain"
                  data-testid="qr-image"
                />
              ) : (
                /**
                 * 出码前的占位(2026-09-30 "别让用户以为卡住了"档)。
                 *
                 * 用户原话:「一点变化都没有」。所以这里三件事同时在动:
                 *   ① 与二维码**同尺寸**的骨架 + animate-pulse —— 位置、大小都不跳,码一好就地替换;
                 *   ② 五级进度阶梯:亮到哪一级 = 后端走到哪一步(值来自后端 stage 字段,
                 *      不是编出来的动画),用户看得出系统在推进而不是在转圈;
                 *   ③ 已用秒数实时跳字 + 提示语每 1.6s 换一条 —— 肉眼可辨"页面还活着"。
                 */
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="relative flex h-60 w-60 animate-pulse items-center justify-center rounded-md border border-dashed border-border bg-background"
                    data-testid="qr-placeholder"
                  >
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="absolute bottom-3 text-xs tabular-nums text-muted-foreground">
                      {t('accounts.elapsedSeconds', { seconds: elapsedSeconds.toFixed(1) })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t(`accounts.loadingStage.${displayStage}`)}
                  </p>
                  {taskMessage && taskMessage !== t(`accounts.loadingStage.${displayStage}`) && (
                    <p className="-mt-2 max-w-[16rem] text-center text-xs text-muted-foreground">
                      {taskMessage}
                    </p>
                  )}
                  <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]">
                    {LOADING_STAGES.map((s, i) => {
                      const reached = i <= stageIndex
                      const current = i === stageIndex
                      return (
                        <li
                          key={s}
                          className={
                            current
                              ? 'flex items-center gap-1 font-semibold text-primary'
                              : reached
                                ? 'flex items-center gap-1 text-primary/70'
                                : 'flex items-center gap-1 text-muted-foreground/60'
                          }
                        >
                          {i > 0 && <span className="text-muted-foreground/40">·</span>}
                          {current && (
                            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                          )}
                          {t(`accounts.loadingStage.${s}`)}
                        </li>
                      )
                    })}
                  </ol>
                  {elapsedSeconds >= SLOW_HINT_AFTER_SECONDS && (
                    <p className="max-w-[15rem] text-center text-xs text-muted-foreground">
                      {t('accounts.loadingSlowHint')}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">{t('accounts.scanLogin')}</p>
                <p className="text-xs text-muted-foreground">{t('accounts.scanWithPhoneHint')}</p>
              </div>
              <CountdownTimer
                totalSeconds={countdownSeconds}
                onExpire={handleCountdownExpire}
                variant="danger"
              />
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

          {phase === 'chrome-import' && (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <ImportIcon className="h-10 w-10 text-primary" />
              <p className="max-w-[18rem] text-center text-sm text-foreground">
                {t('accounts.chromeImportHint', { platform: platformName })}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t('accounts.elapsedSeconds', { seconds: elapsedSeconds.toFixed(1) })}
              </p>
              <CountdownTimer
                totalSeconds={countdownSeconds}
                onExpire={handleCountdownExpire}
                variant="danger"
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
            <>
              {SISTER_CHANNEL[platform] && (
                <Button variant="outline" onClick={handleSwitchChannel}>
                  <RefreshCw className="h-4 w-4" />
                  {SISTER_CHANNEL[platform] === 'toutiao_app'
                    ? t('accounts.switchToAppQr')
                    : t('accounts.switchToWechatQr')}
                </Button>
              )}
              <Button variant="outline" onClick={handleCancel}>
                {t('accounts.cancelScan')}
              </Button>
            </>
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
          {phase === 'chrome-import' && (
            <Button variant="outline" onClick={cancelChromeImport}>
              {t('accounts.cancelScan')}
            </Button>
          )}
          {(phase === 'success' || phase === 'failed') && (
            <Button
              onClick={() => {
                setPhase('idle')
                setErrorMsg('')
                taskIdRef.current = ''
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
