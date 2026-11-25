// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { handoverAiPipWindow, isTauri } from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'

const KIND_COLOR: Record<BrowserPipStatusKind, string> = {
  connecting: '#9aa3af',
  running: '#34d399',
  stalled: '#fb923c',
  waiting: '#fbbf24',
  gate: '#f59e0b',
  error: '#f87171',
}

const BANNER_BG: Record<BrowserPipStatusKind, string> = {
  connecting: 'rgba(15,17,21,0.86)',
  running: 'rgba(15,17,21,0.86)',
  stalled: 'rgba(124,45,18,0.92)',
  waiting: 'rgba(120,53,15,0.92)',
  gate: 'rgba(120,53,15,0.92)',
  error: 'rgba(127,29,29,0.92)',
}

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
 * 桌面端 AI 画中画监看页 —— 2026-11-25 立。
 *
 * 跑在独立 Tauri 窗口里(由 `open_browser_pip_window` 打开),和网页版 Document PiP
 * 共用同一套 Browser Hub 协议、任务归一和文案:只读 canvas、任务条、检查点、
 * 「已处理,继续」、接管。它监控的是真正的 Browser Hub AI 会话,不是本地浏览器。
 */
export function AiPipMonitor({ sessionId }: { sessionId: string }) {
  const labels = useBrowserPipLabels()
  const labelsRef = useRef(labels)
  labelsRef.current = labels

  const token = useAuthStore((s) => s.token)
  const [pipToken, setPipToken] = useState('')
  useEffect(() => {
    // 独立窗的 native 标题在 Windows 上会被外壳窗控落成应用名;页面加载完
    // 再显式写一次,任务栏/Alt-Tab 才认得出这是「AI 画中画监看」。
    if (!isTauri()) return
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('AI 画中画监看'))
      .catch(() => {
        /* 标题只是外观,失败不影响监看 */
      })
  }, [])
  useEffect(() => {
    // 独立窗口拿不到主窗内存里的 access token;Rust 建窗时用 initialization_script
    // 只往这个窗口注入 __IHUI_PIP_TOKEN__(不进 URL、不落盘),这里优先读它。
    const injected = (window as Window & { __IHUI_PIP_TOKEN__?: string }).__IHUI_PIP_TOKEN__
    setPipToken(injected || token || '')
  }, [token])
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const onResize = () => {
      setTooSmall(window.innerWidth < PIP_MIN_WIDTH || window.innerHeight < PIP_MIN_HEIGHT)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

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
    let ws: WebSocket
    try {
      ws = new WebSocket(buildBrowserWsUrl(sessionId))
    } catch {
      setPhase('error')
      setError(labelsRef.current.error)
      return
    }
    wsRef.current = ws
    ws.onopen = () => {
      if (disposed) return
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
      setPhase('error')
      setError(labelsRef.current.error)
    }
    ws.onclose = (event) => {
      if (disposed) return
      setConnected(false)
      if (event.code !== 1000) {
        setPhase('error')
        setError(event.reason || labelsRef.current.error)
      }
    }
    return () => {
      disposed = true
      wsRef.current = null
      try {
        ws.close(1000)
      } catch {
        /* 已断开 */
      }
    }
  }, [sessionId, pipToken])

  const onContinue = useCallback(() => {
    const checkpointId = activeCheckpoint?.id
    const ws = wsRef.current
    if (!checkpointId || !ws || ws.readyState !== 1) return
    setResumeBusy(true)
    ws.send(JSON.stringify({ type: 'checkpoint_resume', checkpoint_id: checkpointId }))
    window.setTimeout(() => setResumeBusy(false), 1500)
  }, [activeCheckpoint?.id])

  const onHandover = useCallback(async () => {
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
  }, [currentUrl, pageTitle, sessionId])

  const warn =
    status.kind === 'stalled' ||
    status.kind === 'waiting' ||
    status.kind === 'gate' ||
    status.kind === 'error'

  return (
    <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-[#0f1115] text-slate-200">
      <header
        data-tauri-drag-region
        className="flex flex-none items-center gap-2 border-b border-white/10 bg-[#16181d] px-3 py-1.5"
      >
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: KIND_COLOR[status.kind] }}
        />
        <span
          className="min-w-0 flex-1 truncate text-[11px] font-semibold"
          style={{ color: KIND_COLOR[status.kind] }}
          title={statusLabel}
        >
          {statusLabel}
        </span>
        {pageTitle && (
          <span
            className="max-w-[38%] flex-none truncate text-[10px] text-slate-400"
            title={currentUrl}
          >
            {pageTitle}
          </span>
        )}
        <span className="flex-none rounded bg-[#2f5d50] px-1.5 py-0.5 text-[10px] text-emerald-100">
          {labels.readOnly}
        </span>
      </header>

      {taskView && (
        <div className="flex flex-none flex-col gap-1 border-b border-white/10 bg-[#141821] px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate text-[11px] font-medium"
              title={taskView.task.goal}
            >
              {taskView.task.goal}
            </span>
            <span className="flex-none text-[10px] text-slate-400">
              {labels.checkpointProgress(taskView.done, taskView.total)}
            </span>
          </div>
          {taskView.task.requirements.length > 0 && (
            <div
              className="truncate text-[9px] leading-snug text-slate-500"
              title={taskView.task.requirements.join(' · ')}
            >
              {labels.requirements} · {taskView.task.requirements.join(' · ')}
            </div>
          )}
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[9px]">
            {taskView.task.checkpoints.map((cp) => {
              const text = checkpointText(cp.label, cp.labelKey)
              const icon = cp.status === 'done' ? '✓' : cp.status === 'active' ? '●' : '○'
              const color =
                cp.status === 'done' ? '#86efac' : cp.status === 'active' ? '#fbbf24' : '#9aa3af'
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
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {!hasFrame && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-slate-400">
            {error || labels.connecting}
          </div>
        )}
        {warn && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-1.5 text-center text-[10px] text-amber-100"
            style={{ background: BANNER_BG[status.kind] }}
          >
            {statusLabel}
          </div>
        )}
        {tooSmall && (
          <div className="pointer-events-none absolute inset-x-0 top-0 px-3 py-1 text-center text-[10px] text-slate-300">
            {labels.tooSmall}
          </div>
        )}
      </div>

      <footer className="flex flex-none items-center gap-2 border-t border-white/10 bg-[#16181d] px-3 py-1.5">
        {activeCheckpoint && phase === 'waiting' && (
          <button
            type="button"
            onClick={onContinue}
            disabled={resumeBusy}
            className="rounded-md bg-[#2f5d50] px-2.5 py-1 text-[11px] font-medium text-emerald-50 disabled:opacity-50"
          >
            {labels.continueLabel}
          </button>
        )}
        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500" title={currentUrl}>
          {currentUrl || labels.title}
        </span>
        <button
          type="button"
          onClick={() => void onHandover()}
          className="flex-none rounded-md border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-white/15"
        >
          {labels.handover}
        </button>
      </footer>
    </div>
  )
}

