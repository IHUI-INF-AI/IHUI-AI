import { useSyncExternalStore } from 'react'

/** 工作展示区默认宽度(右侧面板) */
export const WORK_PANEL_DEFAULT_WIDTH = 480
export const WORK_PANEL_MIN_WIDTH = 320
export const WORK_PANEL_MAX_WIDTH = 900

export type WebViewStatus = 'idle' | 'loading' | 'loaded' | 'screenshot' | 'failed' | 'blocked'
export type WebViewMode = 'iframe' | 'screenshot' | 'external'
export type NavigateSource = 'user' | 'ai-tool' | 'markdown-link'

interface WorkPanelData {
  open: boolean
  width: number
  url: string
  addressInput: string
  history: string[]
  historyIndex: number
  status: WebViewStatus
  mode: WebViewMode
  isLoading: boolean
  error?: string
}

export interface WorkPanelActions {
  openPanel: (params?: { url?: string; source?: NavigateSource }) => void
  closePanel: () => void
  navigate: (url: string, source?: NavigateSource) => void
  back: () => void
  forward: () => void
  reload: () => void
  stop: () => void
  setWidth: (w: number) => void
  setAddressInput: (v: string) => void
  onLoaded: () => void
  onFailed: (error?: string) => void
}

export type WorkPanelState = WorkPanelData & WorkPanelActions

function isSafeUrl(href: string): boolean {
  return /^(https?:|mailto:|\/|#)/.test(href)
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed) && !/\s/.test(trimmed)) {
    return `https://${trimmed}`
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`
}

const initialData: WorkPanelData = {
  open: false,
  width: WORK_PANEL_DEFAULT_WIDTH,
  url: '',
  addressInput: '',
  history: [],
  historyIndex: -1,
  status: 'idle',
  mode: 'iframe',
  isLoading: false,
  error: undefined,
}

let data: WorkPanelData = { ...initialData }
let cachedState: WorkPanelState | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function setData(patch: Partial<WorkPanelData>): void {
  data = { ...data, ...patch }
  cachedState = null
  emit()
}

const actions: WorkPanelActions = {
  openPanel: (params) => {
    if (params?.url) {
      actions.navigate(params.url, params.source ?? 'user')
    } else {
      setData({ open: true })
    }
  },
  closePanel: () => setData({ open: false }),
  navigate: (rawUrl, _source = 'user') => {
    const url = normalizeUrl(rawUrl)
    if (!url || !isSafeUrl(url)) {
      setData({ status: 'blocked', mode: 'external', error: 'URL 不安全' })
      return
    }
    const { history, historyIndex } = data
    const newHistory =
      historyIndex < 0 ? [url] : [...history.slice(0, historyIndex + 1), url]
    setData({
      open: true,
      url,
      addressInput: url,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      status: 'loading',
      mode: 'iframe',
      isLoading: true,
      error: undefined,
    })
  },
  back: () => {
    const { history, historyIndex } = data
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    const url = history[newIndex]
    if (!url) return
    setData({
      url,
      addressInput: url,
      historyIndex: newIndex,
      status: 'loading',
      mode: 'iframe',
      isLoading: true,
    })
  },
  forward: () => {
    const { history, historyIndex } = data
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    const url = history[newIndex]
    if (!url) return
    setData({
      url,
      addressInput: url,
      historyIndex: newIndex,
      status: 'loading',
      mode: 'iframe',
      isLoading: true,
    })
  },
  reload: () => {
    if (!data.url) return
    setData({ status: 'loading', mode: 'iframe', isLoading: true, error: undefined })
  },
  stop: () => setData({ isLoading: false, status: 'idle' }),
  setWidth: (w) =>
    setData({ width: Math.min(WORK_PANEL_MAX_WIDTH, Math.max(WORK_PANEL_MIN_WIDTH, w)) }),
  setAddressInput: (v) => setData({ addressInput: v }),
  onLoaded: () => setData({ isLoading: false, status: 'loaded', error: undefined }),
  onFailed: (error) =>
    setData({
      isLoading: false,
      status: 'failed',
      mode: 'external',
      error: error ?? '该网站禁止嵌入',
    }),
}

function getState(): WorkPanelState {
  if (!cachedState) {
    cachedState = { ...data, ...actions }
  }
  return cachedState
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook:获取工作展示区 store 状态 + actions */
export function useWorkPanelStore(): WorkPanelState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** 非 React 上下文下读取当前状态(用于回调中读取最新值) */
export function getWorkPanelState(): WorkPanelState {
  return getState()
}
