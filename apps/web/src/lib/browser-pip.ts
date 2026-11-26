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
  resolveBrowserPipTaskView,
  storePipSize,
  type BrowserPipCheckpoint,
  type BrowserPipPhase,
  type BrowserPipStatusKind,
  type BrowserPipTaskView,
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
  /** 检查点任务条 */
  checkpointProgress: (done: number, total: number) => string
  checkpointWaiting: (label: string) => string
  checkpointTimeout: (label: string) => string
  continueLabel: string
  taskFailed: string
  /** 任务条上的「运行要求」前缀;要求正文由服务端任务下发 */
  requirements: string
  /** 窄窗控制(2026-11-25 补):关闭、最小化、任务卡、置顶、重连的可访问文案。 */
  close: string
  minimize: string
  expandWindow: string
  /** 一键最大化 / 还原;旧版文案包缺省时组件回退中文。 */
  maximize?: string
  restore?: string
  task: string
  pin: string
  unpin: string
  reconnect: string
  expandTask: string
  collapseTask: string
  /** 内置检查点 label_key → 本地化文案;缺省时回退服务端 label。 */
  checkpointLabels?: Record<string, string>
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
  /** 外部把任务快照推进浮窗(测试/受控嵌入用;正常路径走 WebSocket) */
  setTask(task: unknown): void
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
    setTask: () => {
      /* 空态窗没有任务可推 */
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
    'width:7px;height:7px;border-radius:50%;background:#9aa3af;flex:none',
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

  // 任务条:目标 + 检查点进度。只读(pointer-events:none),高度按需出现,
  // 没有任务时 display:none,保持原来的单行状态条布局。
  const taskBar = makeEl(
    doc,
    'div',
    'display:none;flex-direction:column;gap:2px;padding:4px 10px 5px;background:#141821;border-bottom:1px solid rgba(255,255,255,0.08);pointer-events:none;flex:none',
  )
  const taskTop = makeEl(doc, 'div', 'display:flex;align-items:center;gap:8px;min-width:0')
  const goalText = makeEl(
    doc,
    'span',
    'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;font-weight:600;color:#cbd5e1',
  )
  const progressText = makeEl(
    doc,
    'span',
    'flex:none;font-size:9px;color:#9aa3af;font-variant-numeric:tabular-nums',
  )
  const checkpointRow = makeEl(
    doc,
    'div',
    'display:flex;align-items:center;gap:8px;overflow:hidden;white-space:nowrap;font-size:9px;color:#9aa3af',
  )
  const requirementsText = makeEl(
    doc,
    'div',
    'display:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;line-height:1.3;color:#64748b',
  )
  taskTop.append(goalText, progressText)
  taskBar.append(taskTop, requirementsText, checkpointRow)

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
    'position:absolute;left:8px;right:8px;bottom:8px;display:none;padding:6px 8px;border-radius:var(--radius-md,6px);font-size:10px;line-height:1.45;white-space:normal;pointer-events:none',
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
    'flex:none;padding:1px 5px;border:1px solid rgba(255,255,255,0.16);border-radius:var(--radius-md,6px);font-size:9px;color:#9aa3af',
  )
  readOnlyBadge.textContent = labels.readOnly
  const continueBtn = makeEl(
    doc,
    'button',
    'display:none;flex:none;border:0;border-radius:var(--radius-md,6px);padding:3px 9px;background:#f59e0b;color:#111827;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit',
  )
  continueBtn.type = 'button'
  continueBtn.textContent = labels.continueLabel
  const handover = makeEl(
    doc,
    'button',
    'flex:none;border:0;border-radius:var(--radius-md,6px);padding:3px 10px;background:#e5e7eb;color:#0f1115;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit',
  )
  handover.type = 'button'
  handover.textContent = labels.handover
  footer.append(urlText, readOnlyBadge, continueBtn, handover)
  root.append(header, taskBar, stage, footer)
  doc.body.append(root)

  let connected = false
  let phase: BrowserPipPhase = 'running'
  let lastFrameAt = 0
  let currentUrl: string | null = null
  let closing = false
  let taskView: BrowserPipTaskView | null = null

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

  const syncContinue = (): void => {
    const active = taskView?.active
    continueBtn.style.display = active && phase === 'waiting' ? '' : 'none'
  }

  const checkpointText = (cp: BrowserPipCheckpoint): string => {
    const translated = cp.labelKey ? labels.checkpointLabels?.[cp.labelKey] : undefined
    return translated || cp.label
  }

  const refreshTask = (raw: unknown): void => {
    taskView = resolveBrowserPipTaskView(raw)
    if (!taskView) {
      taskBar.style.display = 'none'
      checkpointRow.replaceChildren()
      requirementsText.style.display = 'none'
      continueBtn.style.display = 'none'
      return
    }
    taskBar.style.display = 'flex'
    goalText.textContent = taskView.task.goal
    goalText.title = taskView.task.goal
    progressText.textContent = labels.checkpointProgress(taskView.done, taskView.total)
    const requirementText = taskView.task.requirements.join(' · ')
    requirementsText.style.display = requirementText ? 'block' : 'none'
    requirementsText.textContent = requirementText ? `${labels.requirements} · ${requirementText}` : ''
    requirementsText.title = requirementText
    const nodes = taskView.task.checkpoints.map((cp) => {
      const item = doc.createElement('span')
      item.style.cssText = 'flex:none;display:inline-flex;align-items:center;gap:3px'
      const icon = cp.status === 'done' ? '✓' : cp.status === 'active' ? '●' : '○'
      const color = cp.status === 'done' ? '#86efac' : cp.status === 'active' ? '#fbbf24' : '#9aa3af'
      const iconEl = doc.createElement('span')
      iconEl.textContent = icon
      iconEl.style.color = color
      const labelEl = doc.createElement('span')
      labelEl.textContent = checkpointText(cp)
      labelEl.style.color = color
      item.append(iconEl, labelEl)
      return item
    })
    checkpointRow.replaceChildren(...nodes)
    syncContinue()
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
    const activeCheckpoint = taskView?.active ?? null
    const statusLabel =
      status.kind === 'waiting' && activeCheckpoint
        ? activeCheckpoint.timedOut
          ? labels.checkpointTimeout(checkpointText(activeCheckpoint))
          : labels.checkpointWaiting(checkpointText(activeCheckpoint))
        : textFor(status.kind, status.stalledSeconds)
    statusText.textContent = statusLabel
    syncContinue()
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
      banner.textContent = statusLabel
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
          data?: unknown
          url?: string
          title?: string
          phase?: string
          reason?: string
          task?: unknown
          checkpoint?: unknown
        }
        if (msg.type === 'frame' && typeof msg.data === 'string') {
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
        } else if (msg.type === 'task') {
          refreshTask(msg.task)
          refresh()
        } else if (msg.type === 'checkpoint') {
          if (msg.task) refreshTask(msg.task)
          refresh()
        } else if (msg.type === 'checkpoint_result') {
          const data = msg.data as { task?: unknown } | undefined
          if (data?.task) refreshTask(data.task)
          refresh()
        } else if (msg.type === 'phase') {
          // 服务端人工节点状态:自动化说"停下来等人"时,浮窗不用自己猜。
          phase =
            msg.phase === 'waiting' || msg.phase === 'gate' || msg.phase === 'error'
              ? msg.phase
              : 'running'
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
  const onContinue = () => {
    const checkpointId = taskView?.active?.id
    // 用数值 1 而不是 WebSocket.OPEN:jsdom/测试替身不必实现静态常量。
    if (!checkpointId || !ws || ws.readyState !== 1) return
    continueBtn.disabled = true
    ws.send(JSON.stringify({ type: 'checkpoint_resume', checkpoint_id: checkpointId }))
    // ACK 丢失时 1.5s 后放开按钮;服务端广播仍是唯一状态真相。
    window.setTimeout(() => {
      continueBtn.disabled = false
    }, 1500)
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
  continueBtn.addEventListener('click', onContinue)
  refresh()

  const handle: BrowserPipHandle = {
    sessionId: options.sessionId,
    close: () => closeBrowserPip(),
    setPhase: (next) => {
      phase = next
      refresh()
    },
    setTask: (task) => {
      refreshTask(task)
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
    continueBtn.removeEventListener('click', onContinue)
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
