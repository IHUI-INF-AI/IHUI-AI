// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器画中画运行时 —— 2026-11-24 立(对齐 TRAE「画中画模式」)。
 *
 * 与 D181「电脑使用画中画」的差异:
 * - D181 只开了一个空窗(标题 + 一句空态),没有任何画面来源;
 * - 本模块把正在跑的 Browser Hub 会话接进浮窗:独立 WebSocket 收帧(后端
 *   多观众 fan-out),canvas 只读渲染,状态条每秒自检,「接管」一键切回主面板。
 *
 * 三条硬约束:
 * 1. 只读:canvas / 状态条 pointer-events:none,唯一可点的是「接管」;
 * 2. 不抢鼠标:监看期间不调用 focus(),主窗口的键盘/鼠标输入不受影响;
 * 3. 尺寸下限 320×200:开窗前夹一次,运行中被拖小就给「窗口过小」提示。
 */

'use client'

import { buildBrowserWsUrl, setBrowserWsToken } from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'

import {
  PIP_MIN_HEIGHT,
  PIP_MIN_WIDTH,
  clampPipSize,
  readStoredPipSize,
  resolveBrowserPipStatus,
  storePipSize,
  type BrowserPipPhase,
  type BrowserPipStatusKind,
} from './browser-pip-core'

interface DocumentPictureInPictureLike {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
}

/** 空态/监控两种用法共用的两句文案 */
export interface BrowserPipBaseLabels {
  title: string
  emptyState: string
}

export interface BrowserPipLabels extends BrowserPipBaseLabels {
  readOnly: string
  handover: string
  connecting: string
  running: string
  waiting: string
  gate: string
  error: string
  stalled: (seconds: number) => string
  tooSmall: string
}

export interface BrowserPipMonitorOptions {
  sessionId: string
  title?: string
  labels: BrowserPipLabels
  /** 「接管」:关浮窗 → 聚焦主窗口 → 把工作面切回该 tab */
  onHandover?: () => void
  /** 浮窗被关闭(用户点 × / 接管 / 外部 close)时回调,用于复位入口按钮态 */
  onClose?: () => void
}

export interface BrowserPipHandle {
  readonly sessionId: string | null
  close(): void
  /** 外部把会话状态推到浮窗(AI 暂停等人工 / 任务失败) */
  setPhase(phase: BrowserPipPhase): void
}

let pipWindow: Window | null = null
let activeHandle: BrowserPipHandle | null = null
let cleanupCurrent: (() => void) | null = null

function getPipCapability(): DocumentPictureInPictureLike | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { documentPictureInPicture?: DocumentPictureInPictureLike })
    .documentPictureInPicture
}

export function isDocumentPictureInPictureSupported(): boolean {
  return getPipCapability() !== undefined
}

export function isBrowserPipOpen(): boolean {
  return pipWindow !== null && !pipWindow.closed
}

export function closeBrowserPip(): void {
  const cleanup = cleanupCurrent
  cleanupCurrent = null
  cleanup?.()
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

async function requestPipWindow(): Promise<Window | null> {
  const capability = getPipCapability()
  if (!capability) return null
  const size = clampPipSize(readStoredPipSize(safeLocalStorage()))
  try {
    return await capability.requestWindow({ width: size.width, height: size.height })
  } catch {
    return null
  }
}

/** 关掉旧窗再开新窗(同一时刻只允许一个画中画,模块级单例) */
function resetForOpen(): void {
  if (cleanupCurrent) closeBrowserPip()
  pipWindow = null
  activeHandle = null
}

/**
 * 空态窗(无会话):保留 D181 的极简语义,只写标题与空态文案。
 */
export async function openBrowserPipEmpty(
  labels: BrowserPipBaseLabels,
): Promise<BrowserPipHandle | null> {
  if (typeof window === 'undefined') return null
  resetForOpen()
  const pip = await requestPipWindow()
  if (!pip) return null
  pipWindow = pip
  pip.document.title = labels.title
  pip.document.body.textContent = labels.emptyState

  const onHide = () => {
    if (pipWindow === pip) {
      pipWindow = null
      activeHandle = null
      cleanupCurrent = null
    }
  }
  pip.addEventListener('pagehide', onHide)
  const handle: BrowserPipHandle = {
    sessionId: null,
    close: () => closeBrowserPip(),
    setPhase: () => {
      /* 空态窗没有会话可推状态 */
    },
  }
  activeHandle = handle
  cleanupCurrent = () => {
    pip.removeEventListener('pagehide', onHide)
    if (!pip.closed) pip.close()
    pipWindow = null
    activeHandle = null
  }
  return handle
}

const FONT_STACK = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'

const KIND_COLOR: Record<BrowserPipStatusKind, string> = {
  connecting: '#9aa3af',
  running: '#22c55e',
  stalled: '#f59e0b',
  waiting: '#f59e0b',
  gate: '#f59e0b',
  error: '#ef4444',
}

const BANNER_BG: Record<BrowserPipStatusKind, string> = {
  connecting: 'rgba(28,32,38,0.94)',
  running: 'rgba(28,32,38,0.94)',
  stalled: 'rgba(120,53,15,0.94)',
  waiting: 'rgba(120,53,15,0.94)',
  gate: 'rgba(120,53,15,0.94)',
  error: 'rgba(127,29,29,0.94)',
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  css: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  node.style.cssText = css
  return node
}

/**
 * 把 Browser Hub 会话接进浮窗(只读)。
 * 返回 null = 浏览器不支持 Document PiP / 用户拒绝授权。
 */
export async function openBrowserPipMonitor(
  options: BrowserPipMonitorOptions,
): Promise<BrowserPipHandle | null> {
  if (typeof window === 'undefined') return null
  if (isBrowserPipOpen() && activeHandle) {
    if (activeHandle.sessionId === options.sessionId) return activeHandle
    closeBrowserPip()
  }
  resetForOpen()
  const pip = await requestPipWindow()
  if (!pip) return null

  const { labels } = options
  pipWindow = pip
  pip.document.title = labels.title
  const doc = pip.document
  doc.body.style.cssText = `margin:0;overflow:hidden;background:#0f1115;color:#e5e7eb;font-family:${FONT_STACK};user-select:none`

  const root = makeEl(doc, 'div', 'display:flex;flex-direction:column;height:100vh;width:100vw')
  const header = makeEl(
    doc,
    'div',
    'display:flex;align-items:center;gap:6px;padding:6px 10px;background:#16181d;border-bottom:1px solid rgba(255,255,255,0.08);pointer-events:none;flex:none',
  )
  const dot = makeEl(
    doc,
    'span',
    'width:7px;height:7px;border-radius:999px;background:#9aa3af;flex:none',
  )
  const statusText = makeEl(
    doc,
    'span',
    'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600',
  )
  const pageTitle = makeEl(
    doc,
    'span',
    'max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#9aa3af;flex:none',
  )
  pageTitle.textContent = options.title ?? ''
  if (!options.title) pageTitle.style.display = 'none'
  header.append(dot, statusText, pageTitle)

  const stage = makeEl(
    doc,
    'div',
    'position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#000',
  )
  const canvas = makeEl(
    doc,
    'canvas',
    'max-width:100%;max-height:100%;display:block;pointer-events:none',
  )
  const placeholder = makeEl(
    doc,
    'div',
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;font-size:11px;color:#9aa3af;pointer-events:none',
  )
  placeholder.textContent = labels.connecting
  const banner = makeEl(
    doc,
    'div',
    'position:absolute;left:8px;right:8px;bottom:8px;display:none;padding:6px 8px;border-radius:6px;font-size:10px;line-height:1.45;white-space:normal;pointer-events:none',
  )
  stage.append(canvas, placeholder, banner)

  const footer = makeEl(
    doc,
    'div',
    'display:flex;align-items:center;gap:8px;padding:5px 8px;background:#16181d;border-top:1px solid rgba(255,255,255,0.08);flex:none',
  )
  const urlText = makeEl(
    doc,
    'span',
    'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#9aa3af',
  )
  const readOnlyBadge = makeEl(
    doc,
    'span',
    'flex:none;padding:1px 5px;border:1px solid rgba(255,255,255,0.16);border-radius:4px;font-size:9px;color:#9aa3af',
  )
  readOnlyBadge.textContent = labels.readOnly
  const handover = makeEl(
    doc,
    'button',
    'flex:none;border:0;border-radius:5px;padding:3px 10px;background:#e5e7eb;color:#0f1115;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit',
  )
  handover.type = 'button'
  handover.textContent = labels.handover
  footer.append(urlText, readOnlyBadge, handover)
  root.append(header, stage, footer)
  doc.body.append(root)

  let connected = false
  let phase: BrowserPipPhase = 'running'
  let lastFrameAt = 0
  let currentUrl: string | null = null
  let closing = false

  const textFor = (kind: BrowserPipStatusKind, seconds: number): string => {
    switch (kind) {
      case 'connecting':
        return labels.connecting
      case 'running':
        return labels.running
      case 'waiting':
        return labels.waiting
      case 'gate':
        return labels.gate
      case 'error':
        return labels.error
      case 'stalled':
        return labels.stalled(seconds)
    }
  }

  const refresh = (): void => {
    if (pip.closed) return
    const status = resolveBrowserPipStatus({
      connected,
      phase,
      lastFrameAt,
      url: currentUrl,
      now: Date.now(),
    })
    const color = KIND_COLOR[status.kind]
    dot.style.background = color
    statusText.style.color = color
    statusText.textContent = textFor(status.kind, status.stalledSeconds)
    const warn =
      status.kind === 'stalled' ||
      status.kind === 'waiting' ||
      status.kind === 'gate' ||
      status.kind === 'error'
    const width = pip.outerWidth
    const height = pip.outerHeight
    const tooSmall = width > 0 && height > 0 && (width < PIP_MIN_WIDTH || height < PIP_MIN_HEIGHT)
    if (warn) {
      banner.style.display = 'block'
      banner.style.background = BANNER_BG[status.kind]
      banner.style.color = '#fef3c7'
      banner.textContent = textFor(status.kind, status.stalledSeconds)
    } else if (tooSmall) {
      banner.style.display = 'block'
      banner.style.background = BANNER_BG.connecting
      banner.style.color = '#e5e7eb'
      banner.textContent = labels.tooSmall
    } else {
      banner.style.display = 'none'
    }
  }

  const img = new Image()
  img.onload = () => {
    if (pip.closed) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dw = img.naturalWidth || 1280
    const dh = img.naturalHeight || 720
    if (canvas.width !== dw) canvas.width = dw
    if (canvas.height !== dh) canvas.height = dh
    ctx.drawImage(img, 0, 0, dw, dh)
    lastFrameAt = Date.now()
    placeholder.style.display = 'none'
    refresh()
  }

  setBrowserWsToken(useAuthStore.getState().token ?? '')
  let ws: WebSocket | null = null
  try {
    ws = new WebSocket(buildBrowserWsUrl(options.sessionId))
    ws.onopen = () => {
      connected = true
      refresh()
    }
    ws.onmessage = (event) => {
      if (closing) return
      try {
        const msg = JSON.parse(event.data as string) as {
          type?: string
          data?: string
          url?: string
          title?: string
          phase?: string
          reason?: string
        }
        if (msg.type === 'frame' && msg.data) {
          img.src = `data:image/jpeg;base64,${msg.data}`
        } else if (msg.type === 'navigation' && msg.url) {
          currentUrl = msg.url
          urlText.textContent = msg.url
          urlText.title = msg.url
          if (msg.title) {
            pageTitle.textContent = msg.title
            pageTitle.style.display = ''
          }
          refresh()
        } else if (msg.type === 'phase') {
          // 服务端人工节点状态:自动化说"停下来等人"时,浮窗不用自己猜。
          phase = msg.phase === 'waiting' || msg.phase === 'error' ? msg.phase : 'running'
          refresh()
        }
      } catch {
        /* 单帧解析失败不改变状态 */
      }
    }
    ws.onclose = () => {
      connected = false
      if (!closing) {
        phase = 'error'
        refresh()
      }
    }
  } catch {
    phase = 'error'
  }

  const timer = window.setInterval(refresh, 1000)
  const onResize = () => {
    if (pip.outerWidth > 0 && pip.outerHeight > 0) {
      storePipSize({ width: pip.outerWidth, height: pip.outerHeight }, safeLocalStorage())
    }
    refresh()
  }
  const onPageHide = () => {
    if (!closing) cleanupCurrent?.()
  }
  const onHandover = () => {
    const callback = options.onHandover
    closeBrowserPip()
    try {
      window.focus()
    } catch {
      /* 主窗口已关闭/被拦截时交给回调 */
    }
    callback?.()
  }

  pip.addEventListener('resize', onResize)
  pip.addEventListener('pagehide', onPageHide)
  handover.addEventListener('click', onHandover)
  refresh()

  const handle: BrowserPipHandle = {
    sessionId: options.sessionId,
    close: () => closeBrowserPip(),
    setPhase: (next) => {
      phase = next
      refresh()
    },
  }
  activeHandle = handle
  let closedNotified = false
  cleanupCurrent = () => {
    closing = true
    window.clearInterval(timer)
    pip.removeEventListener('resize', onResize)
    pip.removeEventListener('pagehide', onPageHide)
    handover.removeEventListener('click', onHandover)
    try {
      ws?.close(1000)
    } catch {
      /* 已断开 */
    }
    if (!pip.closed) pip.close()
    pipWindow = null
    activeHandle = null
    if (!closedNotified) {
      closedNotified = true
      options.onClose?.()
    }
  }
  return handle
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
