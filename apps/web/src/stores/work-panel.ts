import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  browserHubBack,
  browserHubForward,
  browserHubReload,
  closeBrowserSession,
  createBrowserSession,
  probeEmbed,
  takeScreenshot,
} from '@ihui/api-client'
import type { WebViewMode, WebViewStatus, WorkPanelTab } from '@ihui/types'

import { createPersistConfig } from './persist-helpers'

/** 工作展示区默认宽度(右侧面板) */
export const WORK_PANEL_DEFAULT_WIDTH = 480
export const WORK_PANEL_MIN_WIDTH = 320
export const WORK_PANEL_MAX_WIDTH = 900

export type { WebViewStatus, WebViewMode }

/** 最大 Tab 数量(超出自动关闭最旧) */
const MAX_TABS = 5
/** 最大最近访问记录数 */
const MAX_RECENT_URLS = 30
/** 最大收藏数 */
const MAX_FAVORITES = 100

/**
 * 2026-07-31 完美化:loadUrl 去重锁
 * 防止同一 URL 在短时间内被多次触发 createBrowserSession
 * (React StrictMode 双渲染 / 用户快速双击 / 电路断路器重试 都可能触发)
 * 当 _inFlightUrl === url 时,后续相同 URL 的 loadUrl 调用直接跳过
 */
let _inFlightUrl: string | null = null
let _inFlightTs = 0
const IN_FLIGHT_TTL_MS = 10000 // 10s 超时自动释放(防死锁)

/** 收藏项 */
export interface FavoriteItem {
  url: string
  title: string
  addedAt: number
}

/** 最近访问记录(全局历史) */
export interface RecentUrlItem {
  url: string
  title: string
  visitedAt: number
}

/** URL 安全白名单(与 markdown-stream.tsx 一致) */
function isSafeUrl(href: string): boolean {
  return /^(https?:|mailto:|\/|#)/.test(href)
}

/** 规范化 URL:无协议补 https://,搜索词转搜索引擎 */
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

/** 创建新 Tab */
function createTab(url: string, title?: string): WorkPanelTab {
  const now = Date.now()
  return {
    id: `tab-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'browser',
    title: title ?? url,
    url,
    history: [url],
    historyIndex: 0,
    state: {
      status: 'loading',
      url,
      mode: 'iframe',
    },
    closable: true,
    createdAt: now,
    updatedAt: now,
  }
}

/** 更新 active tab(不可变更新) */
function patchActiveTab(
  tabs: WorkPanelTab[],
  activeTabId: string | null,
  patch: (tab: WorkPanelTab) => Partial<WorkPanelTab>,
): WorkPanelTab[] {
  if (!activeTabId) return tabs
  return tabs.map((t) => (t.id === activeTabId ? { ...t, ...patch(t), updatedAt: Date.now() } : t))
}

/** 更新 active tab 的 state 字段 */
function patchActiveTabState(
  tabs: WorkPanelTab[],
  activeTabId: string | null,
  statePatch: Partial<WorkPanelTab['state']>,
): WorkPanelTab[] {
  return patchActiveTab(tabs, activeTabId, (tab) => ({
    state: { ...tab.state, ...statePatch },
  }))
}

interface WorkPanelState {
  /** 面板是否展开 */
  open: boolean
  /** 面板宽度(持久化) */
  width: number
  /** 拖拽中标记 */
  isResizing: boolean
  /** 地址栏输入值(全局,切换 tab 时同步为 active tab url) */
  addressInput: string

  /** Tab 列表 */
  tabs: WorkPanelTab[]
  /** 当前激活 Tab ID */
  activeTabId: string | null

  /** 收藏夹 */
  favorites: FavoriteItem[]
  /** 最近访问记录(全局历史) */
  recentUrls: RecentUrlItem[]

  // actions
  openPanel: (params?: {
    url?: string
    source?: 'user' | 'ai-tool' | 'markdown-link' | 'markdown-image'
  }) => void
  closePanel: () => void
  toggle: () => void
  navigate: (url: string, source?: 'user' | 'ai-tool' | 'markdown-link' | 'markdown-image') => void
  /** 启动 URL 加载(主动探测嵌入能力 + 截图降级) */
  loadUrl: (url: string) => void
  back: () => void
  forward: () => void
  reload: () => void
  stop: () => void

  /** 新建 Tab(可带初始 URL) */
  newTab: (url?: string) => void
  /** 关闭 Tab */
  closeTab: (tabId: string) => void
  /** 切换激活 Tab */
  setActiveTab: (tabId: string) => void
  /** 拖拽 Tab 排序:P3++
   * - 默认 position='after':把 fromId 移到 toId 之后(原行为,后兼容)
   * - position='before':把 fromId 移到 toId 之前(用于精细控制 drop indicator)
   * - 相同 id / 越界 id / 拖到原相邻位置 no-op */
  reorderTabs: (fromId: string, toId: string, position?: 'before' | 'after') => void

  /** 添加收藏 */
  addFavorite: (url: string, title: string) => void
  /** 移除收藏 */
  removeFavorite: (url: string) => void
  /** 清空历史记录(P3+) */
  clearHistory: () => void

  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
  setAddressInput: (v: string) => void
  /** iframe 加载完成 */
  onLoaded: () => void
  /** iframe 加载失败(触发降级) */
  onFailed: (error?: string) => void
  /** 设置截图模式 */
  setScreenshot: (screenshot: string, title?: string) => void
  /** CDP 浏览器导航完成(后端推送 navigation 事件时调用,更新 tab url + title + 地址栏) */
  onCdpNavigation: (url: string, title: string) => void
  /** 直接用已有 sessionId 打开 CDP tab(扫码登录用,跳过 probeEmbed 探测 + createBrowserSession) */
  openCdpSession: (url: string, sessionId: string, title?: string) => void
  /** 重置到 idle */
  reset: () => void
}

export const useWorkPanelStore = create<WorkPanelState>()(
  persist(
    (set, get) => ({
      open: false,
      width: WORK_PANEL_DEFAULT_WIDTH,
      isResizing: false,
      addressInput: '',
      tabs: [],
      activeTabId: null,
      favorites: [],
      recentUrls: [],

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
        void source // 保留参数兼容性(P3 MVP 不区分来源行为)
        const url = normalizeUrl(rawUrl)
        if (!url || !isSafeUrl(url)) {
          // 标记当前 tab 为 blocked(若有)
          const { tabs, activeTabId } = get()
          if (activeTabId) {
            set({
              open: true,
              tabs: patchActiveTabState(tabs, activeTabId, {
                status: 'blocked',
                mode: 'external',
                error: 'URL 不安全',
              }),
            })
          }
          return
        }

        const { tabs, activeTabId, recentUrls } = get()

        // 无 active tab → 新建 tab
        if (!activeTabId || tabs.length === 0) {
          const tab = createTab(url)
          set({
            open: true,
            tabs: [tab],
            activeTabId: tab.id,
            addressInput: url,
            recentUrls: [
              { url, title: url, visitedAt: Date.now() },
              ...recentUrls.filter((r) => r.url !== url),
            ].slice(0, MAX_RECENT_URLS),
          })
          get().loadUrl(url)
          return
        }

        // 更新 active tab:截断前进栈 + push url + state 重置
        const newTabs = patchActiveTab(tabs, activeTabId, (tab) => {
          const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url]
          return {
            url,
            title: url,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            state: {
              status: 'loading' as WebViewStatus,
              url,
              mode: 'iframe' as WebViewMode,
            },
          }
        })

        set({
          open: true,
          tabs: newTabs,
          addressInput: url,
          recentUrls: [
            { url, title: url, visitedAt: Date.now() },
            ...recentUrls.filter((r) => r.url !== url),
          ].slice(0, MAX_RECENT_URLS),
        })
        get().loadUrl(url)
      },

      // P1-3:主动探测嵌入能力,不可嵌入 → CDP 完整 Chrome 模式(对标 Trae/Cursor)
      // 浏览器对 X-Frame-Options/CSP frame-ancestors 拦截的站点不触发 iframe onError,
      // 必须主动调后端 probeEmbed 预判。CDP 失败时降级到截图模式(保证可用性)。
      loadUrl: (url) => {
        // 2026-07-31 完美化:去重锁
        // 同一 URL 在 IN_FLIGHT_TTL_MS 内重复调用直接跳过,防止多次 createBrowserSession
        const now = Date.now()
        if (_inFlightUrl === url && now - _inFlightTs < IN_FLIGHT_TTL_MS) {
          return
        }
        // 超时清理(防死锁:如果上一次 loadUrl 异常未释放锁)
        if (_inFlightUrl && now - _inFlightTs >= IN_FLIGHT_TTL_MS) {
          _inFlightUrl = null
        }
        _inFlightUrl = url
        _inFlightTs = now

        void (async () => {
          try {
            let canEmbed = true
            try {
              const probe = await probeEmbed(url)
              if (probe.success && probe.data) {
                canEmbed = probe.data.canEmbed
              }
            } catch {
              // 探测失败 → 默认尝试 iframe(保留 onFailed 兜底)
            }

            if (canEmbed) {
              // 可嵌入 → 保持 iframe 模式,等 iframe onLoad 触发 onLoaded
              return
            }

            // 不可嵌入 → CDP 模式(可交互,对标 Trae/Cursor 内置浏览器)
            const { tabs: preTabs, activeTabId: preId } = get()
            if (!preId) return

            // 先关闭旧 CDP 会话(同 tab 重新导航时)
            const preTab = preTabs.find((t) => t.id === preId)
            if (preTab?.state.sessionId) {
              void closeBrowserSession(preTab.state.sessionId)
            }

            const cdpResult = await createBrowserSession({
              url,
              viewport_width: 1280,
              viewport_height: 720,
            })

            const { tabs: cdpTabs, activeTabId: cdpId } = get()
            if (!cdpId) return

            if (cdpResult.success && cdpResult.data?.session_id) {
              set({
                tabs: patchActiveTabState(cdpTabs, cdpId, {
                  status: 'loaded',
                  mode: 'cdp',
                  sessionId: cdpResult.data.session_id,
                  title: cdpResult.data.title || url,
                  error: undefined,
                  screenshot: undefined,
                }),
              })
              return
            }

            // CDP 失败 → 降级到截图模式(保证可用性)
            const result = await takeScreenshot({
              url,
              width: 1280,
              height: 720,
              fullPage: false,
              waitUntil: 'load',
              timeout: 15000,
            })

            const { tabs, activeTabId } = get()
            if (!activeTabId) return

            if (result.success && result.data?.screenshot) {
              set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                  status: 'screenshot',
                  mode: 'screenshot',
                  screenshot: result.data.screenshot,
                  title: result.data.title,
                  error: undefined,
                }),
              })
            } else {
              set({
                tabs: patchActiveTabState(tabs, activeTabId, {
                  status: 'failed',
                  mode: 'external',
                  error: result.error || 'CDP 和截图均失败,该网站禁止嵌入',
                }),
              })
            }
          } finally {
            // 释放锁:无论成功/失败/异常,都清除 in-flight 状态
            if (_inFlightUrl === url) {
              _inFlightUrl = null
            }
          }
        })()
      },

      back: () => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab || tab.historyIndex <= 0) return

        // CDP 模式:后端浏览器后退(navigation 事件会更新地址栏 + title)
        if (tab.state.mode === 'cdp' && tab.state.sessionId) {
          void browserHubBack(tab.state.sessionId)
          return
        }

        // iframe 模式:本地历史栈
        const newIndex = tab.historyIndex - 1
        const url = tab.history[newIndex]!
        set({
          tabs: patchActiveTab(tabs, activeTabId, () => ({
            url,
            historyIndex: newIndex,
            state: {
              status: 'loading' as WebViewStatus,
              url,
              mode: 'iframe' as WebViewMode,
            },
          })),
          addressInput: url,
        })
        get().loadUrl(url)
      },

      forward: () => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab || tab.historyIndex >= tab.history.length - 1) return

        // CDP 模式:后端浏览器前进
        if (tab.state.mode === 'cdp' && tab.state.sessionId) {
          void browserHubForward(tab.state.sessionId)
          return
        }

        // iframe 模式:本地历史栈
        const newIndex = tab.historyIndex + 1
        const url = tab.history[newIndex]!
        set({
          tabs: patchActiveTab(tabs, activeTabId, () => ({
            url,
            historyIndex: newIndex,
            state: {
              status: 'loading' as WebViewStatus,
              url,
              mode: 'iframe' as WebViewMode,
            },
          })),
          addressInput: url,
        })
        get().loadUrl(url)
      },

      reload: () => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab || !tab.url) return

        // CDP 模式:后端浏览器刷新
        if (tab.state.mode === 'cdp' && tab.state.sessionId) {
          void browserHubReload(tab.state.sessionId)
          return
        }

        // iframe 模式
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            status: 'loading',
            mode: 'iframe',
            screenshot: undefined,
            error: undefined,
          }),
        })
        get().loadUrl(tab.url)
      },

      stop: () => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        set({
          tabs: patchActiveTabState(tabs, activeTabId, { status: 'idle' }),
        })
      },

      newTab: (url) => {
        const { tabs } = get()
        const tabUrl = url ?? ''
        const tab = createTab(tabUrl || 'about:blank')

        // 超出上限 → 关闭最旧 tab
        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          newTabs = newTabs.slice(newTabs.length - MAX_TABS)
        }

        set({
          open: true,
          tabs: newTabs,
          activeTabId: tab.id,
          addressInput: tabUrl,
        })

        if (tabUrl) {
          get().loadUrl(tabUrl)
        }
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const idx = tabs.findIndex((t) => t.id === tabId)
        if (idx < 0) return

        // CDP 模式:关闭后端会话(异步,不阻塞 UI)
        const closingTab = tabs[idx]
        if (closingTab?.state.mode === 'cdp' && closingTab.state.sessionId) {
          void closeBrowserSession(closingTab.state.sessionId)
        }

        const newTabs = tabs.filter((t) => t.id !== tabId)

        // 关的是 active tab → 切换到相邻
        let newActiveId = activeTabId
        let newAddressInput = ''
        if (activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveId = null
            newAddressInput = ''
          } else {
            // 优先切到右侧,无则左侧
            const newIdx = Math.min(idx, newTabs.length - 1)
            newActiveId = newTabs[newIdx]!.id
            newAddressInput = newTabs[newIdx]!.url ?? ''
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
          addressInput: newAddressInput,
        })
      },

      setActiveTab: (tabId) => {
        const { tabs } = get()
        const tab = tabs.find((t) => t.id === tabId)
        if (!tab) return
        set({
          activeTabId: tabId,
          addressInput: tab.url ?? '',
        })
      },

      reorderTabs: (fromId, toId, position = 'after') => {
        const { tabs } = get()
        if (fromId === toId) return
        const fromIdx = tabs.findIndex((t) => t.id === fromId)
        const toIdx = tabs.findIndex((t) => t.id === toId)
        if (fromIdx < 0 || toIdx < 0) return
        // 拖到原位置 no-op(顺序不变)
        // 'after' 命中:from 已在 to 之后(相邻)
        if (position === 'after' && fromIdx === toIdx + 1) return
        // 'before' 命中:from 已在 to 之前(相邻)
        if (position === 'before' && fromIdx + 1 === toIdx) return
        const next = [...tabs]
        const [moved] = next.splice(fromIdx, 1)
        if (!moved) return
        // 'after':直接用原 toIdx 插入(原行为,后兼容)
        // 'before':用 newToIdx(移除后 toId 在新数组中的位置,等于 toIdx 或 toIdx-1)
        const newToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
        const insertIdx = position === 'after' ? toIdx : newToIdx
        next.splice(insertIdx, 0, moved)
        set({ tabs: next })
      },

      addFavorite: (url, title) => {
        const { favorites } = get()
        if (favorites.some((f) => f.url === url)) return
        set({
          favorites: [{ url, title, addedAt: Date.now() }, ...favorites].slice(0, MAX_FAVORITES),
        })
      },

      removeFavorite: (url) => {
        set((s) => ({ favorites: s.favorites.filter((f) => f.url !== url) }))
      },

      clearHistory: () => set({ recentUrls: [] }),

      setWidth: (w) =>
        set({ width: Math.min(WORK_PANEL_MAX_WIDTH, Math.max(WORK_PANEL_MIN_WIDTH, w)) }),
      setResizing: (v) => set({ isResizing: v }),
      setAddressInput: (v) => set({ addressInput: v }),

      onLoaded: () => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            status: 'loaded',
            error: undefined,
          }),
        })
      },

      onFailed: (error) => {
        // iframe 失败 → CDP 模式优先(可交互),CDP 失败降级截图
        const { tabs, activeTabId } = get()
        if (!activeTabId) return

        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab?.url) {
          set({
            tabs: patchActiveTabState(tabs, activeTabId, {
              status: 'failed',
              mode: 'external',
              error: error ?? '该网站禁止嵌入',
            }),
          })
          return
        }

        // 保留 loading 状态(CDP/截图期间仍显示 loading)
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            status: 'loading',
            error: undefined,
          }),
        })

        const url = tab.url
        void (async () => {
          // CDP 模式优先(可交互,对标 Trae/Cursor)
          const cdpResult = await createBrowserSession({
            url,
            viewport_width: 1280,
            viewport_height: 720,
          })

          const { tabs: curTabs, activeTabId: curId } = get()
          if (!curId) return

          if (cdpResult.success && cdpResult.data?.session_id) {
            set({
              tabs: patchActiveTabState(curTabs, curId, {
                status: 'loaded',
                mode: 'cdp',
                sessionId: cdpResult.data.session_id,
                title: cdpResult.data.title || url,
                error: undefined,
                screenshot: undefined,
              }),
            })
            return
          }

          // CDP 失败 → 降级截图
          const result = await takeScreenshot({
            url,
            width: 1280,
            height: 720,
            fullPage: false,
            waitUntil: 'load',
            timeout: 15000,
          })

          const { tabs: failTabs, activeTabId: failId } = get()
          if (!failId) return

          if (result.success && result.data?.screenshot) {
            set({
              tabs: patchActiveTabState(failTabs, failId, {
                status: 'screenshot',
                mode: 'screenshot',
                screenshot: result.data.screenshot,
                title: result.data.title,
                error: undefined,
              }),
            })
          } else {
            set({
              tabs: patchActiveTabState(failTabs, failId, {
                status: 'failed',
                mode: 'external',
                error: result.error || error || 'CDP 和截图均失败,该网站禁止嵌入',
              }),
            })
          }
        })()
      },

      setScreenshot: (screenshot, title) => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            status: 'screenshot',
            mode: 'screenshot',
            screenshot,
            title,
          }),
        })
      },

      onCdpNavigation: (url, title) => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            url,
            title: title || url,
            status: 'loaded',
          }),
          addressInput: url,
        })
      },

      openCdpSession: (url, sessionId, title) => {
        const { tabs, recentUrls } = get()
        const tab = createTab(url, title)
        // 覆盖默认 iframe state,直接绑定为 cdp 模式(复用外部已创建的 BrowserHub 会话)
        tab.state = {
          status: 'loaded',
          url,
          mode: 'cdp',
          sessionId,
          title: title ?? url,
        }
        set({
          open: true,
          tabs: [...tabs, tab],
          activeTabId: tab.id,
          addressInput: url,
          recentUrls: [
            { url, title: title ?? url, visitedAt: Date.now() },
            ...recentUrls.filter((r) => r.url !== url),
          ].slice(0, MAX_RECENT_URLS),
        })
      },

      reset: () =>
        set({
          tabs: [],
          activeTabId: null,
          addressInput: '',
        }),
    }),
    {
      ...createPersistConfig<WorkPanelState>('ihui-work-panel', (s) => ({
        width: s.width,
        // 持久化 tabs 但清除 screenshot(体积大,需重新加载)
        tabs: s.tabs.map((t) => ({
          ...t,
          state: {
            ...t.state,
            screenshot: undefined,
            status: 'idle' as WebViewStatus,
            progress: undefined,
          },
        })),
        favorites: s.favorites,
        recentUrls: s.recentUrls,
      })),
    },
  ),
)

// 开发调试暴露(非 production):供 browser 验证 / DevTools 触发 openPanel
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { __workPanelStore?: typeof useWorkPanelStore }).__workPanelStore =
    useWorkPanelStore
}
