// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
  LoaderCircle,
  Lock,
  Maximize2,
  Minus,
  Pin,
  PinOff,
  Play,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react'
import { buildBrowserWsUrl, setBrowserWsToken } from '@ihui/api-client'

import { useBrowserPipLabels } from '@/hooks/use-browser-pip-labels'
import {
  resolveBrowserPipStatus,
  resolveBrowserPipTaskView,
  PIP_MIN_HEIGHT,
  PIP_MIN_WIDTH,
  type BrowserPipPhase,
  type BrowserPipStatusKind,
} from '@/lib/browser-pip-core'
import {
  closeAiPipWindow,
  handoverAiPipWindow,
  isTauri,
  toggleAiPipCollapsed,
} from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'

const KIND_COLOR: Record<BrowserPipStatusKind, string> = {
  connecting: '#9aa3af',
  running: '#34d399',
  stalled: '#fb923c',
  waiting: '#fbbf24',
  gate: '#f59e0b',
  error: '#f87171',
}

/** 窄顶栏用低饱和底色;状态只染这一条,不拿整块画布铺色。 */
const HEADER_BG: Record<BrowserPipStatusKind, string> = {
  connecting: 'rgba(8,10,14,0.86)',
  running: 'rgba(8,10,14,0.84)',
  stalled: 'rgba(24,16,9,0.9)',
  waiting: 'rgba(24,16,9,0.92)',
  gate: 'rgba(24,16,9,0.92)',
  error: 'rgba(40,10,10,0.92)',
}

const PIN_STORAGE_KEY = 'ihui-ai-pip-pinned'

interface BrowserHubMessage {
  type?: string
  data?: unknown
  url?: string
  title?: string
  phase?: string
  task?: unknown
  checkpoint?: unknown
}

/**
 * 桌面端 AI 画中画监看页 —— 2026-11-25 立,2026-11-25 重做视觉。
 *
 * 跑在独立 Tauri 窗口里(由 `open_browser_pip_window` 打开),和网页版 Document PiP
 * 共用同一套 Browser Hub 协议、任务归一和文案:只读 canvas、任务条、检查点、
 * 「已处理,继续」、接管。它监控的是真正的 Browser Hub AI 会话,不是本地浏览器。
 *
 * 2026-11-25 用户反馈「样式不符、功能缺失」后重做:
 * - 画面全幅,状态/任务/操作全部改成悬浮窄条,不再用大块不透明任务栏压掉页面;
 * - 任务卡默认一行,点开才展开目标/运行要求/检查点;命中检查点时自动展开一次;
 * - 补置顶开关(记忆偏好)、重新连接、窗口内只读标识;创建后不抢焦点。
 */
export function AiPipMonitor({
  sessionId,
  embedded = false,
  streamFps,
  onHandover: onHandoverRequest,
}: {
  sessionId: string
  /** 停靠在工作面内:不占用整屏、不显示原生窗控、接管改走主工作面 */
  embedded?: boolean
  /** MJPEG 每观众限速（1–30）；多路同屏时降低解码/带宽，单路不传保持全速 */
  streamFps?: number
  onHandover?: () => void
}) {
  const labels = useBrowserPipLabels()
  const labelsRef = useRef(labels)
  labelsRef.current = labels

  const token = useAuthStore((s) => s.token)
  const [pipToken, setPipToken] = useState('')
  const [phase, setPhase] = useState<BrowserPipPhase>('running')
  const [taskRaw, setTaskRaw] = useState<unknown>(null)
  const [connected, setConnected] = useState(false)
  const [lastFrameAt, setLastFrameAt] = useState(0)
  const [currentUrl, setCurrentUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [hasFrame, setHasFrame] = useState(false)
  const [tooSmall, setTooSmall] = useState(false)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)
  const [pinned, setPinned] = useState(true)
  const [pinBusy, setPinBusy] = useState(false)
  const [taskExpanded, setTaskExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  // `isTauri()` 在 SSR 恒为 false、客户端首帧为 true;直接写进 JSX 会触发
  // hydration mismatch。先渲染与 SSR 一致的 false,挂载后再显示桌面控件。
  const [tauriHost, setTauriHost] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastWaitingCheckpointRef = useRef<string | null>(null)

  const taskView = useMemo(() => resolveBrowserPipTaskView(taskRaw), [taskRaw])
  const status = resolveBrowserPipStatus({
    connected,
    phase,
    lastFrameAt,
    url: currentUrl,
    now,
  })
  const activeCheckpoint = taskView?.active ?? null
  const checkpointText = (label: string, labelKey?: string | null): string =>
    (labelKey ? labels.checkpointLabels?.[labelKey] : undefined) || label
  const statusLabel =
    status.kind === 'waiting' && activeCheckpoint
      ? activeCheckpoint.timedOut
        ? labels.checkpointTimeout(
            checkpointText(activeCheckpoint.label, activeCheckpoint.labelKey),
          )
        : labels.checkpointWaiting(
            checkpointText(activeCheckpoint.label, activeCheckpoint.labelKey),
          )
      : status.kind === 'stalled'
        ? labels.stalled(status.stalledSeconds)
        : labels[status.kind]
  const warn =
    status.kind === 'stalled' ||
    status.kind === 'waiting' ||
    status.kind === 'gate' ||
    status.kind === 'error'

  useEffect(() => {
    // 独立窗的 native 标题在 Windows 上会被外壳窗控落成应用名;页面加载完
    // 再显式写一次,任务栏/Alt-Tab 才认得出这是「AI 画中画监看」。
    // 停靠态不碰原生窗口:同一组件跑在主 Web 窗里,不能把主窗标题改掉。
    const host = !embedded && isTauri()
    setTauriHost(host)
    if (!host) return
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('AI 画中画监看'))
      .catch(() => {
        /* 标题只是外观,失败不影响监看 */
      })
  }, [embedded])

  useEffect(() => {
    if (!tauriHost) return
    // 页面若在收起态被刷新,窗口只有 32px 高;按实际高度还原按钮语义,
    // 避免图标显示「最小化」但点击命令实际是「展开」的错位。
    setCollapsed(window.innerHeight <= 100)
  }, [tauriHost])

  useEffect(() => {
    // 独立窗口拿不到主窗内存里的 access token;Rust 建窗时用 initialization_script
    // 只往这个窗口注入 __IHUI_PIP_TOKEN__(不进 URL、不落盘),这里优先读它。
    const injected = (window as Window & { __IHUI_PIP_TOKEN__?: string }).__IHUI_PIP_TOKEN__
    setPipToken(injected || token || '')
  }, [token])

  useEffect(() => {
    if (!isTauri() || embedded) return
    const wantPinned = window.localStorage.getItem(PIN_STORAGE_KEY) !== '0'
    setPinned(wantPinned)
    if (!wantPinned) {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setAlwaysOnTop(false))
        .catch(() => {
          /* 取不到窗口时保持 Rust 建窗默认置顶 */
        })
    }
  }, [embedded])

  const togglePin = useCallback(async () => {
    if (!isTauri() || pinBusy) return
    const next = !pinned
    setPinBusy(true)
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setAlwaysOnTop(next)
      window.localStorage.setItem(PIN_STORAGE_KEY, next ? '1' : '0')
      setPinned(next)
    } catch {
      /* 失败保持原状态,不假装切成功 */
    } finally {
      setPinBusy(false)
    }
  }, [pinBusy, pinned])

  const reconnect = useCallback(() => {
    setConnected(false)
    setError('')
    setPhase('running')
    setLastFrameAt(0)
    setHasFrame(false)
    setReconnectKey((key) => key + 1)
  }, [])

  const onClose = useCallback(() => {
    if (!isTauri()) {
      window.close()
      return
    }
    // 独立窗无原生标题栏后,关闭由页面接管;命令走 Rust close() 保留
    // CloseRequested 的几何落盘与 closed 事件,不能只做 window.close()。
    void closeAiPipWindow(sessionId).catch(() => {
      window.close()
    })
  }, [sessionId])

  const onMinimize = useCallback(() => {
    // 不占任务栏的小窗直接 OS minimize 会失去恢复入口;Rust 把它压成 32px
    // 标题条,窗口仍在置顶可见,再点同一枚按钮展开。
    void toggleAiPipCollapsed()
      .then(setCollapsed)
      .catch(() => {
        /* 收起失败保持原窗 */
      })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const onResize = () => {
      // 停靠态按容器布局自适应,不能拿整个浏览器窗口尺寸判定"太小"。
      setTooSmall(
        embedded ? false : window.innerWidth < PIP_MIN_WIDTH || window.innerHeight < PIP_MIN_HEIGHT,
      )
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [embedded])

  useEffect(() => {
    if (!taskView || status.kind !== 'waiting') return
    const checkpointId = taskView.active?.id
    if (!checkpointId || lastWaitingCheckpointRef.current === checkpointId) return
    // 新检查点命中时展开一次;同一个检查点用户手动收起后不再反复弹开。
    lastWaitingCheckpointRef.current = checkpointId
    setTaskExpanded(true)
  }, [status.kind, taskView])

  useEffect(() => {
    if (!sessionId) {
      setError(labelsRef.current.error)
      return
    }
    if (!pipToken) {
      // 独立窗口的 token 由 Rust initialization_script 注入;主窗同源持久层只有
      // isAuthenticated/user,读不到 access token,不能在这里直接连 WS。
      setError('')
      return
    }
    setBrowserWsToken(pipToken)
    let disposed = false
    setConnected(false)
    setPhase('running')
    setError('')
    setLastFrameAt(0)
    let ws: WebSocket
    let fallbackTimer: number | null = null
    let fallbackBusy = false
    let mjpegAbort: AbortController | null = null
    let mjpegStarted = false
    let mjpegRetryTimer: number | null = null
    let mjpegFailures = 0
    let stateTimer: number | null = null
    let stateBusy = false
    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer)
        fallbackTimer = null
      }
      if (mjpegRetryTimer !== null) {
        window.clearTimeout(mjpegRetryTimer)
        mjpegRetryTimer = null
      }
      mjpegAbort?.abort()
      mjpegAbort = null
      mjpegStarted = false
    }
    /**
     * WS 只作为低延迟通道；PIP 不把「WS 能连上」当画面前置条件。
     * 生产 EdgeOne 不转发 Upgrade 时，直接走同源 MJPEG，首帧不再等错误事件。
     */
    const refreshHttpState = async () => {
      if (stateBusy) return
      stateBusy = true
      try {
        const resp = await fetch(`/api/browser/sessions/${encodeURIComponent(sessionId)}/state`, {
          headers: { Authorization: `Bearer ${pipToken}` },
          cache: 'no-store',
        })
        if (!resp.ok) return
        const body = (await resp.json()) as {
          data?: {
            url?: string
            title?: string
            phase?: { phase?: string }
            task?: unknown
          }
        }
        const data = body.data
        if (!data || disposed) return
        if (typeof data.url === 'string') setCurrentUrl(data.url)
        if (typeof data.title === 'string') setPageTitle(data.title)
        if (data.task !== undefined) setTaskRaw(data.task)
        const phaseValue = data.phase?.phase
        if (phaseValue === 'waiting' || phaseValue === 'gate' || phaseValue === 'error') {
          setPhase(phaseValue)
        } else if (phaseValue === 'running') {
          setPhase('running')
        }
      } catch {
        /* 状态轮询是增强；画面/任务下一轮继续 */
      } finally {
        stateBusy = false
      }
    }
    const startHttpState = () => {
      if (stateTimer !== null) return
      void refreshHttpState()
      stateTimer = window.setInterval(() => void refreshHttpState(), 1000)
    }
    const drawPipFrame = (source: CanvasImageSource, width: number, height: number) => {
      if (disposed) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      ctx.drawImage(source, 0, 0, width, height)
      setHasFrame(true)
      setLastFrameAt(Date.now())
    }
    /**
     * 兼容通道：生产 CDN 不保证把 WebSocket Upgrade 透传到 ai-service 时，
     * PIP 不能永远停在一句「画面已断开」。改用同源 HTTP 截图轮询兜底，
     * 250ms 一帧 ≈ 4fps；WS 一旦恢复立即停轮询，回到 screencast 30fps。
     */
    const pumpFallback = async () => {
      if (disposed || fallbackBusy) return
      fallbackBusy = true
      try {
        const resp = await fetch(
          `/api/browser/sessions/${encodeURIComponent(sessionId)}/screenshot`,
          {
            headers: { Authorization: `Bearer ${pipToken}` },
            cache: 'no-store',
          },
        )
        if (!resp.ok) throw new Error(`screenshot ${resp.status}`)
        const blob = await resp.blob()
        const objectUrl = URL.createObjectURL(blob)
        const img = imgRef.current ?? new Image()
        img.onload = () => {
          drawPipFrame(img, img.naturalWidth || 1280, img.naturalHeight || 720)
          URL.revokeObjectURL(objectUrl)
          setConnected(true)
          setPhase('running')
          setError('')
        }
        img.onerror = () => URL.revokeObjectURL(objectUrl)
        img.src = objectUrl
        imgRef.current = img
      } catch {
        /* 兼容通道单帧失败不改变状态，下一轮继续；重连按钮仍可手动重试 WS */
      } finally {
        fallbackBusy = false
      }
    }
    const startScreenshotFallback = () => {
      if (disposed || fallbackTimer !== null) return
      void pumpFallback()
      fallbackTimer = window.setInterval(() => void pumpFallback(), 250)
    }
    /**
     * 主画面通道：同源 MJPEG 直接承接 CDP screencast，动态页面维持 15fps 量级。
     * WS 只作为低延迟传输；即使 WS 被 CDN 拒绝，MJPEG 首帧也会立即到达。
     *
     * 这里不用 `<img src=multipart>`：Chromium/WebView2 对 multipart 的 `load`
     * 事件不可靠，实测会在整条流结束前一直不触发，导致主通道静默退化成截图轮询。
     * 改为 fetch 流 + 手写 multipart 解析，每解出一张 JPEG 就直接画到 canvas。
     */
    const startFallback = () => {
      if (disposed || mjpegAbort || mjpegRetryTimer !== null) return
      const controller = new AbortController()
      mjpegAbort = controller
      const marker = new TextEncoder().encode('--frame')
      const headerEndMarker = new TextEncoder().encode('\r\n\r\n')
      const findBytes = (haystack: Uint8Array, needle: Uint8Array, from = 0): number => {
        for (let i = from; i <= haystack.length - needle.length; i += 1) {
          let matched = true
          for (let j = 0; j < needle.length; j += 1) {
            if (haystack[i + j] !== needle[j]) {
              matched = false
              break
            }
          }
          if (matched) return i
        }
        return -1
      }
      const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array<ArrayBufferLike> => {
        const out = new Uint8Array(left.length + right.length)
        out.set(left, 0)
        out.set(right, left.length)
        return out
      }
      const paintJpeg = async (frame: Uint8Array) => {
        const blob = new Blob(
          [
            frame.buffer.slice(
              frame.byteOffset,
              frame.byteOffset + frame.byteLength,
            ) as ArrayBuffer,
          ],
          { type: 'image/jpeg' },
        )
        try {
          const bitmap = await createImageBitmap(blob)
          if (!disposed) drawPipFrame(bitmap, bitmap.width, bitmap.height)
          bitmap.close()
        } catch {
          const img = new Image()
          const objectUrl = URL.createObjectURL(blob)
          img.onload = () => {
            if (!disposed) drawPipFrame(img, img.naturalWidth || 1280, img.naturalHeight || 720)
            URL.revokeObjectURL(objectUrl)
          }
          img.onerror = () => URL.revokeObjectURL(objectUrl)
          img.src = objectUrl
        }
      }
      void (async () => {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
        try {
          const fpsQuery =
            streamFps && streamFps >= 1 && streamFps <= 30 ? `&fps=${streamFps}` : ''
          const resp = await fetch(
            `/api/browser/sessions/${encodeURIComponent(sessionId)}/mjpeg?token=${encodeURIComponent(pipToken)}${fpsQuery}`,
            {
              headers: { Authorization: `Bearer ${pipToken}` },
              cache: 'no-store',
              signal: controller.signal,
            },
          )
          if (!resp.ok || !resp.body) throw new Error(`mjpeg ${resp.status}`)
          reader = resp.body.getReader()
          let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
          while (!disposed && !controller.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            if (!value?.length) continue
            buffer = concatBytes(buffer, value)
            // 一块 chunk 里可能有多帧；必须循环拆到不足一帧为止。
            for (;;) {
              const frameStartMarker = findBytes(buffer, marker)
              if (frameStartMarker < 0) break
              if (frameStartMarker > 0) buffer = buffer.slice(frameStartMarker)
              const headerEnd = findBytes(buffer, headerEndMarker, marker.length)
              if (headerEnd < 0) break
              const header = new TextDecoder().decode(buffer.slice(marker.length, headerEnd))
              const lengthMatch = /Content-Length:\s*(\d+)/i.exec(header)
              if (!lengthMatch) {
                buffer = buffer.slice(headerEnd + headerEndMarker.length)
                continue
              }
              const frameBytesStart = headerEnd + headerEndMarker.length
              const frameBytesEnd = frameBytesStart + Number(lengthMatch[1])
              if (buffer.length < frameBytesEnd) break
              const frame = buffer.slice(frameBytesStart, frameBytesEnd)
              buffer = buffer.slice(frameBytesEnd)
              if (!mjpegStarted) {
                mjpegStarted = true
                mjpegFailures = 0
                setConnected(true)
                setPhase('running')
                setError('')
                if (fallbackTimer !== null) {
                  window.clearInterval(fallbackTimer)
                  fallbackTimer = null
                }
              }
              await paintJpeg(frame)
            }
          }
        } catch {
          // 断流、超时、token 过期都走统一重试；不把 MJPEG 的失败伪装成画面错误。
        } finally {
          if (mjpegAbort === controller) mjpegAbort = null
          if (!disposed && !controller.signal.aborted) {
            mjpegFailures += 1
            if (mjpegFailures >= 3) {
              startScreenshotFallback()
            } else {
              mjpegRetryTimer = window.setTimeout(() => {
                mjpegRetryTimer = null
                if (!disposed) startFallback()
              }, 1200)
            }
          }
        }
      })()
      window.setTimeout(() => {
        if (disposed || mjpegStarted) return
        // 4s 内连首帧都没有：保留 MJPEG 重试，同时用截图轮询保证静态页也有画面。
        startScreenshotFallback()
      }, 4000)
    }
    // 先开 HTTP 主通道，再尝试 WS；WS 成功才停 MJPEG。这样 CDN 断 Upgrade
    // 时不会出现任何「画面已断开」的空窗。
    startFallback()
    startHttpState()
    try {
      ws = new WebSocket(buildBrowserWsUrl(sessionId))
    } catch {
      // WS 不可用不影响画面：MJPEG 已在上面启动，这里只留一个可观测告警。
      if (!mjpegAbort && fallbackTimer === null) {
        setPhase('error')
        setError(labelsRef.current.error)
        startFallback()
      }
      return
    }
    wsRef.current = ws
    ws.onopen = () => {
      if (disposed) return
      stopFallback()
      setConnected(true)
      setError('')
    }
    ws.onmessage = (event) => {
      if (disposed) return
      try {
        const msg = JSON.parse(event.data as string) as BrowserHubMessage
        if (msg.type === 'frame' && typeof msg.data === 'string') {
          const img = imgRef.current ?? new Image()
          img.onload = () => {
            if (disposed) return
            const canvas = canvasRef.current
            const ctx = canvas?.getContext('2d')
            if (!canvas || !ctx) return
            const dw = img.naturalWidth || 1280
            const dh = img.naturalHeight || 720
            if (canvas.width !== dw) canvas.width = dw
            if (canvas.height !== dh) canvas.height = dh
            ctx.drawImage(img, 0, 0, dw, dh)
            setHasFrame(true)
            setLastFrameAt(Date.now())
          }
          img.src = `data:image/jpeg;base64,${msg.data}`
          imgRef.current = img
        } else if (msg.type === 'navigation' && msg.url) {
          setCurrentUrl(msg.url)
          setPageTitle(msg.title ?? '')
        } else if (msg.type === 'task') {
          setTaskRaw(msg.task ?? null)
        } else if (msg.type === 'checkpoint') {
          if (msg.task !== undefined) setTaskRaw(msg.task)
        } else if (msg.type === 'checkpoint_result') {
          const data = msg.data as { task?: unknown } | undefined
          if (data?.task !== undefined) setTaskRaw(data.task)
        } else if (msg.type === 'phase') {
          setPhase(
            msg.phase === 'waiting' || msg.phase === 'gate' || msg.phase === 'error'
              ? msg.phase
              : 'running',
          )
        }
      } catch {
        /* 单帧解析失败不改变状态 */
      }
    }
    ws.onerror = () => {
      if (disposed) return
      // MJPEG 还在推流时，WS 失败只说明 CDN 没透传 Upgrade，不是画面故障。
      if (!mjpegStarted && !mjpegAbort && fallbackTimer === null) {
        setPhase('error')
        setError(labelsRef.current.error)
      }
      startFallback()
    }
    ws.onclose = (event) => {
      if (disposed) return
      // WS 关闭不等于画面断开:MJPEG 主通道可能仍在推帧。只有两条通道都没有
      // 首帧时才回到“连接中”,否则会把正常动态画面误报成断线(生产 CDN
      // 不透传 Upgrade 时必现)。
      if (!mjpegStarted) setConnected(false)
      if (event.code !== 1000) {
        if (!mjpegStarted && !mjpegAbort && fallbackTimer === null) {
          setPhase('error')
          setError(event.reason || labelsRef.current.error)
        }
        startFallback()
      }
    }
    return () => {
      disposed = true
      stopFallback()
      if (stateTimer !== null) {
        window.clearInterval(stateTimer)
        stateTimer = null
      }
      wsRef.current = null
      try {
        ws.close(1000)
      } catch {
        /* 已断开 */
      }
    }
  }, [sessionId, pipToken, reconnectKey, streamFps])

  const onContinue = useCallback(() => {
    const checkpointId = activeCheckpoint?.id
    if (!checkpointId) return
    setResumeBusy(true)
    setTaskExpanded(false)
    const ws = wsRef.current
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'checkpoint_resume', checkpoint_id: checkpointId }))
      window.setTimeout(() => setResumeBusy(false), 1500)
      return
    }
    // MJPEG 模式下 WS 本来就不通；检查点恢复走同源 HTTP，不能让人卡在等待态。
    void (async () => {
      try {
        const resp = await fetch(
          `/api/browser/sessions/${encodeURIComponent(sessionId)}/checkpoint`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${pipToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'resume', checkpoint_id: checkpointId }),
          },
        )
        if (!resp.ok) throw new Error(`checkpoint ${resp.status}`)
        const state = await fetch(`/api/browser/sessions/${encodeURIComponent(sessionId)}/state`, {
          headers: { Authorization: `Bearer ${pipToken}` },
          cache: 'no-store',
        })
        if (state.ok) {
          const body = (await state.json()) as {
            data?: { task?: unknown; phase?: { phase?: string } }
          }
          if (body.data?.task !== undefined) setTaskRaw(body.data.task)
          if (body.data?.phase?.phase === 'running') setPhase('running')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
      } finally {
        window.setTimeout(() => setResumeBusy(false), 600)
      }
    })()
  }, [activeCheckpoint?.id, pipToken, sessionId])

  const onHandover = useCallback(async () => {
    if (embedded && onHandoverRequest) {
      onHandoverRequest()
      return
    }
    if (!isTauri()) {
      window.close()
      return
    }
    try {
      await handoverAiPipWindow(sessionId, currentUrl, pageTitle)
    } catch {
      // Rust 侧失败时至少不要让监看窗挂在屏幕上;主窗按钮会由 closed 事件复位。
      window.close()
    }
  }, [currentUrl, embedded, onHandoverRequest, pageTitle, sessionId])

  return (
    <div
      className={
        embedded
          ? 'relative h-full w-full select-none overflow-hidden bg-[#05070a] text-slate-200'
          : 'relative h-screen w-screen select-none overflow-hidden bg-[#05070a] text-slate-200'
      }
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      {!hasFrame && (
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center px-6 text-center">
          {error ? (
            <WifiOff className="mb-2 h-4 w-4 text-red-400/80" />
          ) : (
            <LoaderCircle className="mb-2 h-4 w-4 animate-spin text-slate-500" />
          )}
          <span className="max-w-full text-[10.5px] leading-relaxed text-slate-400">
            {error || labels.connecting}
          </span>
          {error && (
            <button
              type="button"
              onClick={reconnect}
              className="pointer-events-auto mt-2 rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
            >
              {labels.reconnect}
            </button>
          )}
        </div>
      )}

      {tooSmall && (
        <div className="pointer-events-none absolute left-1/2 top-11 z-30 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-950/75 px-2 py-0.5 text-[9px] text-amber-200 backdrop-blur-md">
          {labels.tooSmall}
        </div>
      )}

      <header
        className="absolute inset-x-0 top-0 z-30 flex h-8 flex-none items-center gap-1.5 border-b border-white/[0.07] px-2 backdrop-blur-md"
        style={{ backgroundColor: HEADER_BG[status.kind] }}
      >
        <div
          data-tauri-drag-region
          className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch"
        >
          <span
            data-tauri-drag-region
            className="h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: KIND_COLOR[status.kind] }}
          />
          <span
            data-tauri-drag-region
            className="min-w-0 flex-1 truncate text-[10.5px] font-medium tracking-wide"
            style={{ color: KIND_COLOR[status.kind] }}
            title={statusLabel}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 text-[9px] text-slate-300">
            <Lock className="h-2.5 w-2.5" />
            {labels.readOnly}
          </span>
          {tauriHost && (
            <button
              type="button"
              onClick={onMinimize}
              aria-label={collapsed ? labels.expandWindow : labels.minimize}
              title={collapsed ? labels.expandWindow : labels.minimize}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            >
              {collapsed ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
          )}
          {tauriHost && (
            <button
              type="button"
              onClick={() => void togglePin()}
              disabled={pinBusy}
              aria-label={pinned ? labels.unpin : labels.pin}
              title={pinned ? labels.unpin : labels.pin}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
            >
              {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
            </button>
          )}
          <button
            type="button"
            onClick={reconnect}
            aria-label={labels.reconnect}
            title={labels.reconnect}
            className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
          >
            <RefreshCw
              className={`h-3 w-3 ${status.kind === 'connecting' ? 'animate-spin' : ''}`}
            />
          </button>
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              aria-label={labels.close}
              title={labels.close}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </header>

      {!collapsed && taskView && (
        <div className="absolute inset-x-0 top-8 z-20">
          {!taskExpanded ? (
            <button
              type="button"
              onClick={() => setTaskExpanded(true)}
              aria-expanded={false}
              aria-label={labels.expandTask}
              className={`flex h-9 w-full items-center gap-1.5 border-b border-white/[0.06] px-2.5 text-left backdrop-blur-sm transition-colors ${
                warn ? 'hover:bg-amber-900/90' : 'hover:bg-slate-800/90'
              }`}
              style={{
                backgroundColor: warn ? 'rgba(69,26,3,0.92)' : 'rgba(7,10,15,0.92)',
              }}
            >
              <ListChecks className="h-3 w-3 flex-none text-slate-400" />
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="truncate text-[10.5px] font-medium leading-snug text-slate-200">
                  {taskView.task.goal}
                </span>
                {taskView.task.requirements.length > 0 && (
                  <span
                    className="truncate text-[8.5px] leading-tight text-slate-200/80"
                    title={taskView.task.requirements.join(' · ')}
                  >
                    {labels.requirements}
                    {' · '}
                    {taskView.task.requirements.join(' · ')}
                  </span>
                )}
              </span>
              <span className="flex-none text-[9px] tabular-nums text-slate-400">
                {labels.checkpointProgress(taskView.done, taskView.total)}
              </span>
              <ChevronDown className="h-3 w-3 flex-none text-slate-400" />
            </button>
          ) : (
            <section className="mx-2 mt-1 max-h-[46vh] overflow-y-auto rounded-lg border border-white/10 bg-[#0d1117]/95 px-2 py-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex-none text-[8.5px] uppercase tracking-[0.18em] text-slate-500">
                  {labels.task}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[10.5px] font-medium leading-snug text-slate-200"
                  title={taskView.task.goal}
                >
                  {taskView.task.goal}
                </span>
                <span className="flex-none text-[9px] tabular-nums text-slate-500">
                  {labels.checkpointProgress(taskView.done, taskView.total)}
                </span>
                <button
                  type="button"
                  onClick={() => setTaskExpanded(false)}
                  aria-expanded
                  aria-label={labels.collapseTask}
                  title={labels.collapseTask}
                  className="grid h-5 w-5 flex-none place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              </div>
              {taskView.task.requirements.length > 0 && (
                <div
                  className="mt-0.5 truncate text-[8.5px] leading-snug text-slate-400"
                  title={taskView.task.requirements.join(' · ')}
                >
                  <span className="text-slate-500">{labels.requirements}</span>
                  {' · '}
                  {taskView.task.requirements.join(' · ')}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[9px] leading-none">
                {taskView.task.checkpoints.map((cp) => {
                  const text = checkpointText(cp.label, cp.labelKey)
                  const icon = cp.status === 'done' ? '✓' : cp.status === 'active' ? '●' : '○'
                  const color =
                    cp.status === 'done'
                      ? '#86efac'
                      : cp.status === 'active'
                        ? '#fbbf24'
                        : '#9aa3af'
                  return (
                    <span
                      key={cp.id}
                      className="inline-flex flex-none items-center gap-1"
                      style={{ color }}
                    >
                      <span>{icon}</span>
                      <span>{text}</span>
                    </span>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {!collapsed && (
        <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
          <div className="h-24 bg-gradient-to-t from-[#05070a] via-[#05070a]/75 to-transparent" />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 pb-2">
            {activeCheckpoint && phase === 'waiting' && (
              <button
                type="button"
                onClick={onContinue}
                disabled={resumeBusy}
                className="inline-flex h-7 flex-none items-center gap-1 rounded-md bg-amber-400 px-2.5 text-[10px] font-semibold text-[#1b1305] shadow-[0_4px_16px_rgba(245,158,11,0.28)] transition-colors hover:bg-amber-300 disabled:opacity-50"
              >
                <Play className="h-2.5 w-2.5" />
                {labels.continueLabel}
              </button>
            )}
            <span
              className="min-w-0 flex-1 truncate text-[9.5px] text-slate-400/85"
              title={currentUrl}
            >
              {currentUrl || labels.title}
            </span>
            <button
              type="button"
              onClick={() => void onHandover()}
              className="inline-flex h-7 flex-none items-center gap-1 rounded-md border border-white/20 bg-white/[0.08] px-2.5 text-[10px] font-semibold text-slate-100 backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <Maximize2 className="h-2.5 w-2.5" />
              {labels.handover}
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
