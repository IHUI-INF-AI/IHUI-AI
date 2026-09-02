// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  browserHubBack,
  browserHubForward,
  browserHubReload,
  buildEmbedProxyUrl,
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

/** onFailed 降级链(CDP → 截图)in-flight 标志:防代理错误 postMessage + 超时双重触发 */
let _degradingToCdp = false

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

/**
 * 判断 URL 是否与当前页面同源。
 * 2026-08-02 fix:同源页面(发布/设置等)在 X-Frame-Options: SAMEORIGIN 下允许 iframe 嵌入,
 * 后端 probeEmbed 无法感知请求方 origin,会把 SAMEORIGIN 一律判为不可嵌入 → 误走 CDP/截图。
 */
function isSameOriginUrl(href: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(href, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
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
  /** 代理 iframe 内导航桥接(代理页 postMessage,更新 tab url + 地址栏 + 历史栈)
   *  @param title 页面真实 <title>(代理页桥接广播),缺省时保留原标题
   *  @param kind 'nav' = 用户发起导航(链接点击/pushState → 压入历史栈,默认);
   *              'loaded' = 文档就绪/重定向落点广播 → 只把当前条目修正为真实落点 URL,绝不压栈
   *              (否则每次 302/301 落点都会被当"新导航"二次压栈 + 后退弹回) */
  onEmbedNavigation: (url: string, title?: string, kind?: 'nav' | 'loaded') => void
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
        // 2026-09-02 fix:重复提交当前 URL → 截断前进栈但不压重复条目(浏览器语义:
        // 同 URL 导航 = 重载当前页,不产生新历史条目,避免地址栏 Enter 同 URL 出现 [A,A])
        const newTabs = patchActiveTab(tabs, activeTabId, (tab) => {
          const isSameUrl = url === tab.url
          const newHistory = isSameUrl
            ? tab.history.slice(0, tab.historyIndex + 1)
            : [...tab.history.slice(0, tab.historyIndex + 1), url]
          return {
            url,
            title: url,
            history: newHistory,
            // 两分支末位索引一致:same → slice 后长度 = idx+1,末位 = idx;非 same → 追加后末位
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
              if (isSameOriginUrl(url)) {
                // 2026-08-02 fix:同源 URL 直接走 iframe(SAMEORIGIN 允许同源嵌入)
                canEmbed = true
              } else {
                const probe = await probeEmbed(url)
                if (probe.success && probe.data) {
                  canEmbed = probe.data.canEmbed
                } else {
                  // 2026-08-02 fix:探测失败(未登录 403 / 网络异常)时跨源站点
                  // 不能默认 iframe——抖音/微信等 XFO/CSP 拦截后 iframe 无内容且
                  // 无失败回调,表现为"白屏点不动";直接走 CDP 完整浏览器模式
                  // (createBrowserSession 走 ai-service,无需登录)。
                  canEmbed = false
                }
              }
            } catch {
              // 探测异常 → 同源仍走 iframe,跨源走 CDP(iframe 无失败检测兜底)
              canEmbed = isSameOriginUrl(url)
            }

            if (canEmbed) {
              // 可嵌入 → 保持 iframe 模式,等 iframe onLoad 触发 onLoaded
              return
            }

            // 不可嵌入 → 同源嵌入代理优先(2026-09-02):后端剥 XFO/CSP 后以同源响应喂 iframe,
            // 真实 HTML 渲染(可交互/可选中)。代理失败(错误页 postMessage / 20s 超时)
            // → onFailed 链降级:CDP 截图流 → 静态截图 → external
            const { tabs: proxyTabs, activeTabId: proxyId } = get()
            if (!proxyId) return

            // 先关闭旧 CDP 会话(同 tab 重新导航时)
            const preTab = proxyTabs.find((t) => t.id === proxyId)
            if (preTab?.state.sessionId) {
              void closeBrowserSession(preTab.state.sessionId)
            }

            set({
              tabs: patchActiveTabState(proxyTabs, proxyId, {
                status: 'loading',
                mode: 'proxy',
                proxyUrl: buildEmbedProxyUrl(url),
                sessionId: undefined,
                error: undefined,
                screenshot: undefined,
              }),
            })
            return
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

        const newIndex = tab.historyIndex - 1
        const url = tab.history[newIndex]!

        // proxy 模式(2026-09-02 fix):保持代理通道,直接换 proxyUrl
        // (WebViewFrame key={proxyUrl} 变化 → iframe 重建加载)。不能回落 iframe + loadUrl 重探测:
        // ① XFO/CSP 站点直嵌白屏;② loadUrl 去重锁 10s 内同 URL 直接跳过,state 停在 iframe 而
        // proxyUrl 未设置 → 渲染分支错乱;③ 落点页 loaded 广播把 idx 弹回(压栈误判)。
        if (tab.state.mode === 'proxy') {
          set({
            tabs: patchActiveTab(tabs, activeTabId, () => ({
              url,
              historyIndex: newIndex,
              state: {
                status: 'loading' as WebViewStatus,
                url,
                mode: 'proxy' as WebViewMode,
                proxyUrl: buildEmbedProxyUrl(url),
              },
            })),
            addressInput: url,
          })
          return
        }

        // iframe / 截图降级等模式:本地历史栈重置 iframe + loadUrl(loadUrl 会重新探测嵌入能力,
        // 可嵌入保持 iframe,不可嵌入自动切 proxy / CDP)
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

        const newIndex = tab.historyIndex + 1
        const url = tab.history[newIndex]!

        // proxy 模式(2026-09-02 fix):与 back() 同规则,保持代理通道直接换 proxyUrl
        if (tab.state.mode === 'proxy') {
          set({
            tabs: patchActiveTab(tabs, activeTabId, () => ({
              url,
              historyIndex: newIndex,
              state: {
                status: 'loading' as WebViewStatus,
                url,
                mode: 'proxy' as WebViewMode,
                proxyUrl: buildEmbedProxyUrl(url),
              },
            })),
            addressInput: url,
          })
          return
        }

        // iframe / 截图降级等模式:本地历史栈重置 iframe + loadUrl
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
        const cdpSessionId = tab.state.sessionId
        if (tab.state.mode === 'cdp' && cdpSessionId) {
          void (async () => {
            const result = await browserHubReload(cdpSessionId)
            const { tabs: curTabs, activeTabId: curId } = get()
            if (!curId) return
            // 2026-08-02 fix:命中反爬/风控墙时后端重建会话,前端需切换到新 sessionId
            if (
              result.success &&
              result.data?.session_id &&
              result.data.session_id !== tab.state.sessionId
            ) {
              set({
                tabs: patchActiveTabState(curTabs, curId, {
                  status: 'loaded',
                  sessionId: result.data.session_id,
                  error: undefined,
                  screenshot: undefined,
                }),
              })
            }
          })()
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

        // 防重入:代理页错误 postMessage 与 20s 超时可能接连触发 onFailed,
        // 用 in-flight 标志保证降级链(CDP → 截图)只跑一次
        if (_degradingToCdp) return
        _degradingToCdp = true

        // 保留 loading 状态(CDP/截图期间仍显示 loading)
        set({
          tabs: patchActiveTabState(tabs, activeTabId, {
            status: 'loading',
            error: undefined,
          }),
        })

        const url = tab.url
        void (async () => {
          try {
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
          } finally {
            _degradingToCdp = false
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

      onEmbedNavigation: (url, title, kind = 'nav') => {
        const { tabs, activeTabId } = get()
        if (!activeTabId) return
        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab) return

        // kind='loaded'(2026-09-02 fix):每次代理文档就绪广播(初次加载 / 点击落点 /
        // back/forward remount)。url = cur() = 服务端注入 <base> = fetch 跟随重定向后的
        // **最终落点**。按"新 URL"压栈是 back() 零变化的根因:后退目标 302 回当前页时,
        // 落点广播把 idx 弹回。浏览器语义 = 重定向不产生新历史条目 → 只把当前条目原地
        // 修正为真实 URL;同 URL 仅同步 title。
        if (kind === 'loaded') {
          const idx = tab.historyIndex
          let nextHistory = tab.history
          let nextIndex = idx
          if (url !== tab.history[idx]) {
            nextHistory = [...tab.history.slice(0, idx), url, ...tab.history.slice(idx + 1)]
            // 修正后与前一条目相同(点链接又重定向回上一页)→ 合并,不留 [.., A, A] 死条目
            if (idx > 0 && nextHistory[idx - 1] === url) {
              nextHistory = [...nextHistory.slice(0, idx), ...nextHistory.slice(idx + 1)]
              nextIndex = idx - 1
            }
          }
          set({
            tabs: patchActiveTab(tabs, activeTabId, () => ({
              url,
              title: title || tab.title,
              history: nextHistory,
              historyIndex: nextIndex,
              // 2026-09-02 fix(单测捕获):status 必须写进 state.status(渲染层读 activeTab.state.status),
              // 旧代码写在 tab 顶层 → 状态机死水,工具栏 loading/loaded 永远不随页内导航变化
              state: { ...tab.state, status: 'loaded' as WebViewStatus, url },
            })),
            addressInput: url,
          })
          return
        }

        // kind='nav'(默认):页内导航(链接点击 / pushState / popstate)。桥接脚本在跳转
        // **前**同步广播 → 截断前进栈压入新条目(与 navigate 语义一致);同 URL 导航
        // (重定向回自身 / popstate 同步)不重复压栈,仅标记加载中(点击同 URL 链接会真实
        // 触发 iframe 重载,loading 状态由随后的 loaded 清除)。
        const isNewUrl = url !== tab.url
        const nextHistory = isNewUrl
          ? [...tab.history.slice(0, tab.historyIndex + 1), url]
          : tab.history
        const nextIndex = isNewUrl ? nextHistory.length - 1 : tab.historyIndex

        set({
          tabs: patchActiveTab(tabs, activeTabId, () => ({
            url,
            title: title || tab.title,
            history: nextHistory,
            historyIndex: nextIndex,
            state: { ...tab.state, status: 'loading' as WebViewStatus, url },
          })),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
