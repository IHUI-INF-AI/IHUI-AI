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
import { Loader2, QrCode, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  cancelScanLogin,
  fetchScanLoginQr,
  getScanLoginStatus,
  importCookiesManually,
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
const TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_SECONDS = 300

type Phase = 'idle' | 'starting' | 'polling' | 'manual-import' | 'success' | 'failed'

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
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [qrUrl, setQrUrl] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string>('')
  const [countdownSeconds, setCountdownSeconds] = React.useState<number>(TIMEOUT_SECONDS)
  const [cookiesInput, setCookiesInput] = React.useState<string>('')
  const [importError, setImportError] = React.useState<string>('')
  const [importing, setImporting] = React.useState<boolean>(false)
  /** 后端真实进度文案(「正在打开 X 登录页…」)。干等最伤体验,这里如实转述后端进度 */
  const [taskMessage, setTaskMessage] = React.useState<string>('')
  const startTimeRef = React.useRef<number>(0)
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 当前后端任务 id。轮询闭包里读 state 会拿到旧值,取消/卸载路径必须读这一份。 */
  const taskIdRef = React.useRef<string>('')
  /**
   * 预热任务:弹窗一开就给默认平台点火(见下方 useEffect)。
   * 它把用户"点按钮 → 后端才起浏览器"的那段延迟提前到用户还在看界面的时候。
   * jobId 为空 = 无预热;一旦被点击路径接管或被取消即清空。
   */
  const prewarmRef = React.useRef<{ platform: string; jobId: string; cancelled: boolean } | null>(
    null,
  )
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
   * 预热(2026-09-30 提速,只对"用户已经选定平台"的入口生效):
   * 弹窗一打开就用该平台发起扫码任务 —— 用户点「开始扫码登录」之前,后端的浏览器启动
   * 与登录页导航已经跑掉了;等用户点下去时二维码往往已经就绪,判断到"整点"。
   *
   * 只认 defaultPlatform(账号页「添加账号」带平台进来),不认下拉里"用户自己选的":
   * 后者只是浏览平台列表,开一枚 Chromium 纯属浪费。用户改选平台时下面的定时器会
   * 取消这枚预热任务,不留给后端 5 分钟空转。
   */
  React.useEffect(() => {
    if (!open || phase !== 'idle' || !platform) return
    const chosen = platform
    // 带默认平台的入口(账号页「添加账号」)立刻点火;用户自己挑平台的入口推迟 0.8s ——
    // 判据是"他已经停下选择动作",不是"他一定会扫":计时器被下一次改选清掉,这枚预热
    // 就再也不会发生,不留空转的浏览器。
    const delay = defaultPlatform ? 0 : 800
    const timer = setTimeout(() => {
      const warmed = { platform: chosen, jobId: '', cancelled: false }
      prewarmRef.current = warmed
      void (async () => {
        try {
          const r = await startScanLogin(chosen)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, platform, defaultPlatform])

  // 弹窗关闭(而不是卸载):把还在预热的任务退掉,否则那枚 Chromium 会挂到后端超时。
  React.useEffect(() => {
    if (open) return
    cancelPrewarm()
    setTaskMessage('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** 用户改选平台:`handleStart` 之外的一切入口都不该留着一枚为别的平台预热的任务。 */
  function cancelPrewarm(): string {
    const pre = prewarmRef.current
    if (!pre) return ''
    pre.cancelled = true
    prewarmRef.current = null
    if (pre.jobId && taskIdRef.current !== pre.jobId) {
      void cancelScanLogin(pre.jobId).catch(() => undefined)
    }
    return pre.platform
  }

  React.useEffect(() => {
    return () => {
      stopPolling()
      releaseQr()
      // 卸载即取消:后端任务不取消会占着一个 Chromium 直到 10 分钟超时
      if (taskIdRef.current) void cancelScanLogin(taskIdRef.current).catch(() => undefined)
      cancelPrewarm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 没有 defaultPlatform 的入口(用户自己在下拉里挑平台):预热点火推迟到"挑完 0.8s"。
   * 判据是"用户已经停下选择动作",而不是"他一定会扫" —— 所以计时器一旦被下一次改选
   * 清掉,这枚预热就再也不会发生,不留空转的浏览器。
   */
  React.useEffect(() => {
    if (!open || defaultPlatform || !platform || phase !== 'idle') return
    const timer = setTimeout(() => {
      const chosen = platform
      const warmed = { platform: chosen, jobId: '', cancelled: false }
      prewarmRef.current = warmed
      void (async () => {
        try {
          const r = await startScanLogin(chosen)
          if (warmed.cancelled) {
            if (r.success && r.data?.task_id) {
              void cancelScanLogin(r.data.task_id).catch(() => undefined)
            }
            return
          }
          if (r.success && r.data?.task_id) warmed.jobId = r.data.task_id
          else warmed.jobId = ''
        } catch {
          if (prewarmRef.current === warmed) warmed.jobId = ''
        }
      })()
    }, 800)
    return () => {
      clearTimeout(timer)
      cancelPrewarm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPlatform, platform, phase])

  React.useEffect(() => {
    if (open && phase === 'polling' && startTimeRef.current > 0) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setCountdownSeconds(Math.max(0, TIMEOUT_SECONDS - elapsed))
    }
  }, [open, phase])

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
    // 后端任务可能还在跑(它自己也要等到 10 分钟才收),这里必须显式取消,
    // 否则每次失败都留一个 Chromium 挂在服务器上。
    if (taskIdRef.current) {
      void cancelScanLogin(taskIdRef.current).catch(() => undefined)
      taskIdRef.current = ''
    }
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
  function adoptTask(id: string) {
    taskIdRef.current = id
    startTimeRef.current = Date.now()
    setCountdownSeconds(TIMEOUT_SECONDS)
    setTaskMessage('')
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
      prewarmRef.current = null
      adoptTask(pre.jobId)
      return
    }
    // 预热平台与本次选择不同(或用户改选过):取消它,别让后端空转一枚 Chromium
    cancelPrewarm()

    setPhase('starting')
    setErrorMsg('')
    setTaskMessage('')
    networkFailRef.current = 0
    try {
      const r = await startScanLogin(plat)
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
      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
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
        // 后端进度如实转述(「正在打开 X 登录页…」),用户不用对着一个转圈猜
        if (d.message) setTaskMessage((prev) => (prev === d.message ? prev : d.message))
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
            </>
          )}

          {phase === 'starting' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {taskMessage || t('accounts.preparingQr')}
              </p>
            </div>
          )}

          {phase === 'polling' && (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3">
              {qrUrl ? (
                // 二维码由后端截取登录页后逐帧更新(qr_updated_at 变一次取一帧);
                // 用 blob 而不是裸 URL,是因为 /qr 那一口要带 Authorization。
                <img
                  src={qrUrl}
                  alt={t('accounts.scanLoginQrAlt')}
                  width={240}
                  height={240}
                  className="h-60 w-60 bg-white object-contain"
                  data-testid="qr-image"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  {/* 干等时显示**后端真实进度**(「正在打开 X 登录页…」),不是一句静止的
                      「正在加载」—— 用户能看出系统在动、卡在哪一步。拿不到文案才退回通用键。 */}
                  <p className="text-sm text-muted-foreground">
                    {taskMessage || t('accounts.preparingQr')}
                  </p>
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
