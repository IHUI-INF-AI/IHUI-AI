import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** 工作展示区默认宽度(右侧面板) */
export const WORK_PANEL_DEFAULT_WIDTH = 480
export const WORK_PANEL_MIN_WIDTH = 320
export const WORK_PANEL_MAX_WIDTH = 900

/** WebView 状态与模式(与 packages/ui/webview-frame 保持一致) */
export type WebViewStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'screenshot'
  | 'failed'
  | 'blocked'
export type WebViewMode = 'iframe' | 'screenshot' | 'external'

/** URL 安全白名单(与 markdown-stream.tsx 一致) */
function isSafeUrl(href: string): boolean {
  return /^(https?:|mailto:|\/|#)/.test(href)
}

/** 规范化 URL:无协议补 https://,搜索词转搜索引擎 */
function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // 已是 URL
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  // 看起来像域名(含点且无空格)
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed) && !/\s/.test(trimmed)) {
    return `https://${trimmed}`
  }
  // 否则当作搜索词
  return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`
}

interface WorkPanelState {
  /** 面板是否展开 */
  open: boolean
  /** 面板宽度(持久化) */
  width: number
  /** 拖拽中标记 */
  isResizing: boolean
  /** 当前 URL */
  url: string
  /** 地址栏输入值(实时输入,未提交) */
  addressInput: string
  /** 历史栈 */
  history: string[]
  /** 当前历史索引(-1=无) */
  historyIndex: number
  /** 加载状态 */
  status: WebViewStatus
  /** 嵌入模式 */
  mode: WebViewMode
  /** 截图 base64(screenshot 模式) */
  screenshot?: string
  /** 页面标题 */
  title?: string
  /** 错误信息 */
  error?: string
  /** 是否加载中 */
  isLoading: boolean
  /** 打开来源(最后一次) */
  lastSource?: 'user' | 'ai-tool' | 'markdown-link'

  // actions
  openPanel: (params?: { url?: string; source?: 'user' | 'ai-tool' | 'markdown-link' }) => void
  closePanel: () => void
  toggle: () => void
  navigate: (url: string, source?: 'user' | 'ai-tool' | 'markdown-link') => void
  back: () => void
  forward: () => void
  reload: () => void
  stop: () => void
  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
  setAddressInput: (v: string) => void
  /** iframe 加载完成 */
  onLoaded: () => void
  /** iframe 加载失败(触发降级) */
  onFailed: (error?: string) => void
  /** 设置截图模式(P1 后端截图返回后调用) */
  setScreenshot: (screenshot: string, title?: string) => void
  /** 重置到 idle */
  reset: () => void
}

const idleState = {
  status: 'idle' as WebViewStatus,
  mode: 'iframe' as WebViewMode,
  screenshot: undefined,
  title: undefined,
  error: undefined,
  isLoading: false,
}

export const useWorkPanelStore = create<WorkPanelState>()(
  persist(
    (set, get) => ({
      open: false,
      width: WORK_PANEL_DEFAULT_WIDTH,
      isResizing: false,
      url: '',
      addressInput: '',
      history: [],
      historyIndex: -1,
      ...idleState,

      openPanel: (params) => {
        if (params?.url) {
          get().navigate(params.url, params.source ?? 'user')
        } else {
          set({ open: true })
        }
      },
      closePanel: () => set({ open: false }),
      toggle: () => set((s) => ({ open: !s.open })),

      navigate: (rawUrl, source = 'user') => {
        const url = normalizeUrl(rawUrl)
        if (!url || !isSafeUrl(url)) {
          set({ status: 'blocked', error: 'URL 不安全', mode: 'external' })
          return
        }
        const { history, historyIndex } = get()
        // 截断前进栈
        const newHistory = historyIndex < 0 ? [url] : [...history.slice(0, historyIndex + 1), url]
        set({
          open: true,
          url,
          addressInput: url,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          status: 'loading',
          mode: 'iframe',
          isLoading: true,
          screenshot: undefined,
          title: undefined,
          error: undefined,
          lastSource: source,
        })
      },

      back: () => {
        const { history, historyIndex } = get()
        if (historyIndex <= 0) return
        const newIndex = historyIndex - 1
        const url = history[newIndex]
        set({
          url,
          addressInput: url,
          historyIndex: newIndex,
          status: 'loading',
          mode: 'iframe',
          isLoading: true,
          screenshot: undefined,
        })
      },

      forward: () => {
        const { history, historyIndex } = get()
        if (historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        const url = history[newIndex]
        set({
          url,
          addressInput: url,
          historyIndex: newIndex,
          status: 'loading',
          mode: 'iframe',
          isLoading: true,
          screenshot: undefined,
        })
      },

      reload: () => {
        const { url } = get()
        if (!url) return
        set({
          status: 'loading',
          mode: 'iframe',
          isLoading: true,
          screenshot: undefined,
          error: undefined,
        })
      },

      stop: () => set({ isLoading: false, status: 'idle' }),

      setWidth: (w) =>
        set({ width: Math.min(WORK_PANEL_MAX_WIDTH, Math.max(WORK_PANEL_MIN_WIDTH, w)) }),
      setResizing: (v) => set({ isResizing: v }),
      setAddressInput: (v) => set({ addressInput: v }),

      onLoaded: () =>
        set({ isLoading: false, status: 'loaded', error: undefined }),

      onFailed: (error) => {
        // P0:iframe 失败降级到 external(P1 接入 Playwright 截图)
        set({
          isLoading: false,
          status: 'failed',
          mode: 'external',
          error: error ?? '该网站禁止嵌入',
        })
      },

      setScreenshot: (screenshot, title) =>
        set({
          isLoading: false,
          status: 'screenshot',
          mode: 'screenshot',
          screenshot,
          title,
        }),

      reset: () => set({ ...idleState, url: '', addressInput: '', history: [], historyIndex: -1 }),
    }),
    {
      ...createPersistConfig<WorkPanelState>('ihui-work-panel', (s) => ({
        width: s.width,
      })),
    },
  ),
)

// 开发调试暴露(非 production):供 browser 验证 / DevTools 触发 openPanel
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { __workPanelStore?: typeof useWorkPanelStore }).__workPanelStore =
    useWorkPanelStore
}
