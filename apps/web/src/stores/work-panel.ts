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
import { WORK_PANEL_STORAGE_KEY } from '@ihui/shared/constants'
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

/* ---------------------------------------------------------------------------
 * D50② 工作面板 Tab 状态按会话(conversationId)分桶持久化
 *
 * 模型:活视图(tabs/activeTabId)永远属于「当前作用域」;非当前作用域的快照
 * 存在 conversationTabs 桶里。作用域 = 某 conversationId,或 null(全局)。
 * 持久化形态(buildWorkPanelPersistedState):
 *  - 顶层 tabs/activeTabId 恒等于**全局视图**(与旧单键形态逐位一致 → 向后兼容,
 *    老数据无 conversationTabs 字段时按空归档合并,行为不变);
 *  - 会话快照存入同键的 conversationTabs 字段,按 updatedAt 做 LRU 上限裁剪。
 *
 * 留在 web 端而非下沉共享工厂(§3 判据「有第二个端需要它吗?」):工作展示区
 * 是 web 端独有的右侧面板布局,mobile-rn / miniapp-taro / desktop 均无对应 UI,
 * 且持久化复用端内既有 persist 工厂 createPersistConfig,不造第二套存储机制。
 * ------------------------------------------------------------------------- */

/** 单个作用域的 Tab 快照桶(tabs + 激活指针 + LRU 时间戳) */
export interface WorkPanelTabBucket {
  tabs: WorkPanelTab[]
  activeTabId: string | null
  /** 归档时刻(ms),LRU 裁剪依据 */
  updatedAt: number
}

/**
 * 持久化会话桶数量上限(LRU 超限裁剪最旧)。
 * 取值依据:每桶至多 MAX_TABS=5 个 tab,持久化时剔除 screenshot 等大字段,
 * 单桶实测 <10KB;20 桶合计约 200KB,远低于 localStorage 单键 ~5MB 预算,
 * 同时覆盖重度用户来回切换的活跃会话数;超出即回退空视图(重新打开即可恢复)。
 */
export const MAX_CONVERSATION_TAB_BUCKETS = 20

/**
 * 全局作用域(conversationId=null)在内存归档中的暂存键。
 * 只存活于 state.conversationTabs;持久化时**不**进 conversationTabs 字段
 * (全局桶落盘走顶层 tabs/activeTabId,保持旧形态)。
 */
export const WORK_PANEL_GLOBAL_BUCKET_KEY = '__global__'

/** 持久化时剔除瞬态大字段(screenshot / loading 态 / progress),全局桶与会话桶共用 */
function scrubTabForPersist(t: WorkPanelTab): WorkPanelTab {
  return {
    ...t,
    state: {
      ...t.state,
      screenshot: undefined,
      status: 'idle' as WebViewStatus,
      progress: undefined,
    },
  }
}

/** 把一组 tabs 归档进 buckets[key](不可变)。tabs 为空 → 移除该桶,不占 LRU 名额 */
function stashBucket(
  buckets: Record<string, WorkPanelTabBucket>,
  key: string,
  tabs: WorkPanelTab[],
  activeTabId: string | null,
  now: number,
): Record<string, WorkPanelTabBucket> {
  const next = { ...buckets }
  if (tabs.length === 0) delete next[key]
  else next[key] = { tabs, activeTabId, updatedAt: now }
  return next
}

/**
 * LRU 裁剪:会话桶总数(含 protectKey,不含 globalKey 暂存位)超过 max 时,
 * 按 updatedAt 升序丢弃最旧,直到回到 max。protectKey(正在装入/使用的作用域)
 * 永不驱逐——它挤掉的应是更旧的桶;globalKey 不计名额、不参与驱逐。
 * 纯函数,setConversationScope 与 partialize 共用同一实现,保证内存与磁盘口径一致。
 */
export function pruneTabBuckets(
  buckets: Record<string, WorkPanelTabBucket>,
  max: number,
  opts?: { globalKey?: string; protectKey?: string },
): Record<string, WorkPanelTabBucket> {
  const globalKey = opts?.globalKey
  const protectKey = opts?.protectKey
  const conversationKeys = Object.keys(buckets).filter((k) => k !== globalKey)
  if (conversationKeys.length <= max) return buckets
  const evictable = conversationKeys
    .filter((k) => k !== protectKey)
    .sort((a, b) => (buckets[a]?.updatedAt ?? 0) - (buckets[b]?.updatedAt ?? 0))
  const drop = new Set(evictable.slice(0, conversationKeys.length - max))
  const next: Record<string, WorkPanelTabBucket> = {}
  for (const [k, v] of Object.entries(buckets)) if (!drop.has(k)) next[k] = v
  return next
}

/**
 * persist partialize:把「活视图 + 归档桶」折叠成稳定磁盘形态。
 * 导出供单测直接对账(分桶读写 / 全局回退 / 上限裁剪均可纯函数验证)。
 */
export function buildWorkPanelPersistedState(s: WorkPanelState): Partial<WorkPanelState> {
  const scope = s.conversationId
  const scrubbedLive = s.tabs.map(scrubTabForPersist)
  // 顶层全局视图:scope 为 null 时活视图就是全局;否则取内存 __global__ 暂存
  const globalBucket =
    scope === null
      ? { tabs: scrubbedLive, activeTabId: s.activeTabId }
      : {
          tabs: (s.conversationTabs[WORK_PANEL_GLOBAL_BUCKET_KEY]?.tabs ?? []).map(
            scrubTabForPersist,
          ),
          activeTabId: s.conversationTabs[WORK_PANEL_GLOBAL_BUCKET_KEY]?.activeTabId ?? null,
        }
  // 会话桶:归档(剔除全局暂存位)+ 折入当前作用域的活视图
  const folded: Record<string, WorkPanelTabBucket> = {}
  for (const [k, v] of Object.entries(s.conversationTabs)) {
    if (k === WORK_PANEL_GLOBAL_BUCKET_KEY) continue
    folded[k] = {
      tabs: v.tabs.map(scrubTabForPersist),
      activeTabId: v.activeTabId,
      updatedAt: v.updatedAt,
    }
  }
  if (scope !== null) {
    folded[scope] = { tabs: scrubbedLive, activeTabId: s.activeTabId, updatedAt: Date.now() }
  }
  const pruned = pruneTabBuckets(folded, MAX_CONVERSATION_TAB_BUCKETS, {
    protectKey: scope ?? undefined,
  })
  return {
    width: s.width,
    tabs: globalBucket.tabs,
    activeTabId: globalBucket.activeTabId,
    favorites: s.favorites,
    recentUrls: s.recentUrls,
    conversationTabs: pruned,
  }
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

  /** Tab 列表(当前作用域的活视图:属于 conversationId 指向的会话,null 时为全局) */
  tabs: WorkPanelTab[]
  /** 当前激活 Tab ID(活视图内) */
  activeTabId: string | null

  /** 当前会话作用域(D50②);null = 无会话/新会话,退回全局桶,行为与改造前一致 */
  conversationId: string | null
  /**
   * 非当前作用域的 Tab 快照归档(含 WORK_PANEL_GLOBAL_BUCKET_KEY 暂存位)。
   * 当前作用域的快照**不在**此处(它就是 tabs/activeTabId 活视图),落盘时由
   * buildWorkPanelPersistedState 折入,读取(setConversationScope)时取出并删除,
   * 保证同一时刻只有一份真相。
   */
  conversationTabs: Record<string, WorkPanelTabBucket>

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
  /**
   * 切换会话作用域(D50②):把活视图 stash 进旧作用域的桶,再装入新作用域的桶
   * (无桶 → 空视图)。conversationId=null 退回全局桶。同值调用为 no-op。
   * 由本文件底部的 chat store 订阅自动驱动,组件无需直接调用。
   */
  setConversationScope: (conversationId: string | null) => void
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
      conversationId: null,
      conversationTabs: {},
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

      // P1-3:主动探测嵌入能力,不可嵌入 → CDP 完整 Chrome 模式(对标 主流 AI IDE)
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

        // proxy 模式(2026-09-02 fix,键盘快捷键 Ctrl/Cmd+R / F5 复用):
        // 保留代理通道,换带 cache-buster 的 proxyUrl 触发 WebViewFrame(iframe key={url})
        // 重挂载即重载,不会回落 iframe 重探测(避免白屏闪 + 二次 probeEmbed 浪涌)。
        // 加载完成桥接 'loaded' 广播只修正 tab.url/status,不动 proxyUrl,nonce 残留无害。
        if (tab.state.mode === 'proxy') {
          set({
            tabs: patchActiveTabState(tabs, activeTabId, {
              status: 'loading',
              mode: 'proxy',
              proxyUrl: `${buildEmbedProxyUrl(tab.url)}&_ihui_reload=${Date.now()}`,
            }),
          })
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
            // CDP 模式优先(可交互,对标 主流 AI IDE)
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

      setConversationScope: (nextId) =>
        set((s) => {
          const target = nextId ?? null
          if (s.conversationId === target) return s
          const now = Date.now()
          // 1) 活视图 stash 进它所属旧作用域的桶(空 tabs → 移桶,不留空桶)
          const oldKey = s.conversationId ?? WORK_PANEL_GLOBAL_BUCKET_KEY
          let buckets = stashBucket(s.conversationTabs, oldKey, s.tabs, s.activeTabId, now)
          // 2) 取出目标桶并删除 —— 桶一旦成为活视图就不再留在归档里(单份真相)。
          //    stashBucket 返回的是浅拷贝,delete 不污染原 state 的 record。
          const bucket = buckets[target ?? WORK_PANEL_GLOBAL_BUCKET_KEY]
          delete buckets[target ?? WORK_PANEL_GLOBAL_BUCKET_KEY]
          // 3) LRU 裁剪(全局暂存位不计名额、不驱逐)
          buckets = pruneTabBuckets(buckets, MAX_CONVERSATION_TAB_BUCKETS, {
            globalKey: WORK_PANEL_GLOBAL_BUCKET_KEY,
          })
          const tabs = bucket?.tabs ?? []
          const activeTabId =
            tabs.length === 0
              ? null
              : bucket?.activeTabId && tabs.some((t) => t.id === bucket.activeTabId)
                ? bucket.activeTabId
                : tabs[0]!.id
          const addressInput = tabs.find((t) => t.id === activeTabId)?.url ?? ''
          return {
            conversationId: target,
            conversationTabs: buckets,
            tabs,
            activeTabId,
            addressInput,
          }
        }),

      reset: () =>
        set({
          tabs: [],
          activeTabId: null,
          addressInput: '',
        }),
    }),
    {
      ...createPersistConfig<WorkPanelState>(WORK_PANEL_STORAGE_KEY, buildWorkPanelPersistedState),
      // D50②:hydrate 完成前挂起 chat 作用域装配(防止 persist 的浅合并把已装入的
      // 会话视图覆盖回顶层全局桶);完成后立即补装最近一次请求的作用域。
      onRehydrateStorage: () => () => {
        markWorkPanelHydrated()
      },
    },
  ),
)

/* ---------------------------------------------------------------------------
 * D50② 接线:监听 chat store 的 conversationId → 自动切换 Tab 桶。
 * 组件清单不在本票允许改动面内,且「会话切换」的真相源本就是 chat store,
 * 故订阅放在 store 层自举;动态 import 断开 work-panel ↔ chat 的静态依赖环
 * (chat 侧不 import work-panel,此处若静态 import 会把 1500 行 chat 模块
 * 拖进每个用到工作面板的单测)。加载失败静默降级为全局桶 = 改造前行为。
 * NODE_ENV=test 不自动接线:单测直接调 setConversationScope,避免拉真 chat store。
 * ------------------------------------------------------------------------- */

let _workPanelHydrated = false
let _pendingScope: { readonly has: boolean; readonly id: string | null } = {
  has: false,
  id: null,
}

function markWorkPanelHydrated() {
  _workPanelHydrated = true
  if (_pendingScope.has) {
    const id = _pendingScope.id
    _pendingScope = { has: false, id: null }
    useWorkPanelStore.getState().setConversationScope(id)
  }
}

/** 应用作用域;persist hydration 尚未完成时排队,完成后由 markWorkPanelHydrated 补装 */
function requestConversationScope(id: string | null) {
  if (!_workPanelHydrated) {
    _pendingScope = { has: true, id }
    return
  }
  useWorkPanelStore.getState().setConversationScope(id)
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  void import('@/stores/chat')
    .then(({ useChatStore }) => {
      // 初值:chat store 可能已 hydrate 完(persist 浅合并直接 set,不保证再触发 subscribe)
      requestConversationScope(useChatStore.getState().conversationId ?? null)
      useChatStore.subscribe((state, prev) => {
        if (state.conversationId !== prev.conversationId) {
          requestConversationScope(state.conversationId ?? null)
        }
      })
    })
    .catch(() => {
      // chat store 不可用 → 保持全局桶(与改造前行为一致),不打断渲染
    })
}

// 开发调试暴露(非 production):供 browser 验证 / DevTools 触发 openPanel
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { __workPanelStore?: typeof useWorkPanelStore }).__workPanelStore =
    useWorkPanelStore
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
