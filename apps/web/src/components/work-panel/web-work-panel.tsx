// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { WorkPanel, WebViewFrame } from '@ihui/ui-react'
import type { WorkPanelLabels, WorkPanelTabItem } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import { useWorkPanelStore } from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'
import { useWebViewFrameLabels } from '@/hooks/use-web-view-frame-labels'
import {
  onEmbeddedBrowserElementPicked,
  openExternalUrl,
  closeDockedBrowser,
  destroyDockedBrowser,
  openDockedBrowser,
  setDockedBrowserBounds,
  dockedBrowserBack,
  dockedBrowserCloseTab,
  dockedBrowserDevtools,
  dockedBrowserForward,
  dockedBrowserNavigate,
  dockedBrowserNewTab,
  dockedBrowserPick,
  dockedBrowserPopout,
  dockedBrowserReload,
  dockedBrowserStop,
  dockedBrowserSwitchTab,
  getDockedBrowserTabs,
  getDockedBrowserStore,
  getDockedBrowserUrl,
  dockedBrowserFavoriteRemove,
  dockedBrowserFavoriteToggle,
  dockedBrowserHistoryClear,
  dockedBrowserHome,
  onDockedBrowserPoppedOut,
  onDockedBrowserTabs,
} from '@/lib/tauri-bridge'
import type { DockedBrowserStore, DockedBrowserTab } from '@/lib/tauri-bridge'
import { ADD_TEXT_REFERENCE_EVENT } from '@/components/chat/annotation-anchor'
import { useTauriIpcReady } from '@/hooks/use-desktop'

import { CdpBrowserView } from './cdp-browser-view'

/** 两组停靠标签是否等价(字段级逐项比对,避免无意义的状态替换)。 */
function dockTabsEqual(a: DockedBrowserTab[], b: DockedBrowserTab[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    // noUncheckedIndexedAccess:长度已比对过,这里只是让类型收窄
    if (!x || !y) return false
    if (x.id !== y.id || x.url !== y.url || x.title !== y.title || x.active !== y.active) {
      return false
    }
  }
  return true
}

/**
 * Web 端工作展示区(2026-08-01 架构改动:从右列独立面板改为嵌入工作区覆盖 children)。
 * - 渲染 @ihui/ui-react 的 WorkPanel 容器 + WebViewFrame(iframe + 降级)
 * - P0:iframe 失败降级到 external(显示"在外部打开"按钮)
 * - P1:接入后端 Playwright 截图 API,screenshot 模式
 * - P3:多 Tab + 收藏夹 + 历史记录
 *
 * 布局(2026-08-01 改动):
 * - 旧:GlobalShell 右列独立 flex item(mt-[50px] mr-2 固定宽度 480px + resize handle)
 * - 新:absolute inset-0 覆盖 GlobalShell work-area 的 children 区域(替换展示,非独立窗口)
 *   用户规则:"不允许额外出来一个窗口,所有内容必须在工作内容展示区内展示"
 */
export function WebWorkPanel() {
  const mounted = useMounted()
  const tw = useTranslations('workPanel')
  // 桌面端判据(IPC 异步注入 ⇒ 必须用就绪钩子,否则首帧误判成 web 端)
  const desktop = useTauriIpcReady()
  // 不注入 labels 时 @ihui/ui-react 回退 DEFAULT_LABELS(简体)⇒ 英/日/韩界面整条内置浏览器
  // 工具条、地址栏占位符与空态都是中文。20 键全量注入,新增键须同步 5 语言包。
  const workPanelLabels = React.useMemo<WorkPanelLabels>(
    () => ({
      back: tw('back'),
      forward: tw('forward'),
      reload: tw('reload'),
      stop: tw('stop'),
      addressPlaceholder: tw('addressPlaceholder'),
      favorite: tw('favorite'),
      unfavorite: tw('unfavorite'),
      favoritesAndHistory: tw('favoritesAndHistory'),
      openExternal: tw('openExternal'),
      closePanel: tw('closePanel'),
      newTab: tw('newTab'),
      removeFavorite: tw('removeFavorite'),
      tabFavorites: tw('tabFavorites'),
      tabHistory: tw('tabHistory'),
      emptyFavorites: tw('emptyFavorites'),
      emptyHistory: tw('emptyHistory'),
      clearHistory: tw('clearHistory'),
      dragInsertBefore: tw('dragInsertBefore'),
      dragInsertAfter: tw('dragInsertAfter'),
      closeTab: tw('closeTab'),
      // 2026-10-30 补回注记:原实现此处还注入 home/pickElement/picking/devtools/popout 五键,
      // 但 @ihui/ui-react 的 WorkPanelLabels 类型层与 9fdbc207ba 同批被削(本票禁改第 4 枚文件),
      // 现类型无这些键 ⇒ 暂不注入;ui-react props 层补回时须同批加回(词包五键五语言俱在)。
    }),
    [tw],
  )
  // WebViewFrame 同理:不注入 labels 时回退包内中文兜底(20 键 WorkPanel 之外独立命名空间)
  const webViewFrameLabels = useWebViewFrameLabels()
  // 性能修复(2026-07-25):原 25+ 字段全解构 `useWorkPanelStore()` 等价于订阅整个 state,
  // 任何字段(tabs 切换 / addressInput 输入 / recentUrls 追加)变化都会触发 WebWorkPanel 重渲染,
  // 内含 iframe/WebViewFrame 重建开销极大。改用 useShallow 浅比较,只对返回对象做浅层 diff,
  // 大部分字段引用稳定(尤其 actions),可显著降低无关重渲染。
  const {
    open,
    addressInput,
    tabs,
    activeTabId,
    favorites,
    recentUrls,
    closePanel,
    navigate,
    back,
    forward,
    reload,
    stop,
    newTab,
    closeTab,
    setActiveTab,
    reorderTabs,
    addFavorite,
    removeFavorite,
    clearHistory,
    setAddressInput,
    onLoaded,
    onFailed,
    onCdpNavigation,
    onEmbedNavigation,
  } = useWorkPanelStore(
    useShallow((s) => ({
      open: s.open,
      addressInput: s.addressInput,
      tabs: s.tabs,
      activeTabId: s.activeTabId,
      favorites: s.favorites,
      recentUrls: s.recentUrls,
      closePanel: s.closePanel,
      navigate: s.navigate,
      back: s.back,
      forward: s.forward,
      reload: s.reload,
      stop: s.stop,
      newTab: s.newTab,
      closeTab: s.closeTab,
      setActiveTab: s.setActiveTab,
      reorderTabs: s.reorderTabs,
      addFavorite: s.addFavorite,
      removeFavorite: s.removeFavorite,
      clearHistory: s.clearHistory,
      setAddressInput: s.setAddressInput,
      onLoaded: s.onLoaded,
      onFailed: s.onFailed,
      onCdpNavigation: s.onCdpNavigation,
      onEmbedNavigation: s.onEmbedNavigation,
    })),
  )

  // 当前激活 Tab(从 tabs 数组查找)
  const activeTab = React.useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  )

  // 从 active tab 派生展示字段
  const url = activeTab?.url ?? ''
  const status = activeTab?.state.status ?? 'idle'
  // WebViewFrame 只支持 iframe/screenshot/external,native/cdp 映射为 external
  // cdp 模式由 CdpBrowserView 渲染(canvas + WebSocket),不走 WebViewFrame
  // proxy 模式(2026-09-02):同源嵌入代理 iframe(后端剥 XFO/CSP),走 WebViewFrame 定制 sandbox
  const rawMode = activeTab?.state.mode ?? 'iframe'
  const sessionId = activeTab?.state.sessionId
  const proxyUrl = activeTab?.state.proxyUrl
  const isCdpMode = rawMode === 'cdp' && !!sessionId
  const isDockedMode = rawMode === 'docked'
  const isProxyMode = rawMode === 'proxy' && !!proxyUrl
  const mode: 'iframe' | 'screenshot' | 'external' =
    rawMode === 'native' || rawMode === 'cdp'
      ? 'external'
      : (rawMode as 'iframe' | 'screenshot' | 'external')
  const screenshot = activeTab?.state.screenshot
  const title = activeTab?.state.title
  const error = activeTab?.state.error
  const isLoading = status === 'loading'
  const canBack = activeTab ? activeTab.historyIndex > 0 : false
  const canForward = activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false

  // 停靠档工具条直连原生命令(2026-10-24 用户反馈「独立窗口有的功能这里没有」):
  // 停靠浏览器是 OS 级子 webview,store 的 iframe/代理导航对它无效 —— 不接就是死按钮。
  // 失败只打日志,不走 onFailed:那条路会把 Tab 降级到 CDP/截图,停靠占位反而消失。
  const runDockAction = React.useCallback(async (action: () => Promise<string | null>) => {
    const err = await action()
    if (err) console.warn('[work-panel] docked action failed:', err)
  }, [])

  const handleAddressSubmit = React.useCallback(() => {
    if (!isDockedMode) {
      navigate(addressInput, 'user')
      return
    }
    const raw = addressInput.trim()
    if (!raw) return
    const target = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    void runDockAction(() => dockedBrowserNavigate(target))
  }, [addressInput, isDockedMode, navigate, runDockAction])

  const handleBack = React.useCallback(() => {
    if (isDockedMode) void runDockAction(dockedBrowserBack)
    else back()
  }, [back, isDockedMode, runDockAction])

  const handleForward = React.useCallback(() => {
    if (isDockedMode) void runDockAction(dockedBrowserForward)
    else forward()
  }, [forward, isDockedMode, runDockAction])

  const handleReload = React.useCallback(() => {
    if (isDockedMode) void runDockAction(dockedBrowserReload)
    else reload()
  }, [isDockedMode, reload, runDockAction])

  // 元素点选(2026-10-24):独立窗口有的能力,停靠档不能少 —— 复用同一份 PICK_JS,
  // Rust 端把它 eval 进停靠 webview,点选结果仍走 embedded-browser://element-picked
  // (下面已有的监听会汇入文本引用)。点完自动退出点选态。
  const [picking, setPicking] = React.useState(false)
  const handlePickToggle = React.useCallback(() => {
    if (!isDockedMode) return
    const next = !picking
    setPicking(next)
    void runDockAction(() => dockedBrowserPick(next))
  }, [isDockedMode, picking, runDockAction])
  // 换页/切 Tab 后点选态要归零(原生脚本在页面导航后本就失效)
  React.useEffect(() => {
    setPicking(false)
  }, [activeTab?.id, addressInput])

  const handleHome = React.useCallback(() => {
    if (isDockedMode) void runDockAction(dockedBrowserHome)
    else navigate('https://aizhs.top/', 'user')
  }, [isDockedMode, navigate, runDockAction])

  // 停靠浏览器**内部**标签栏(2026-10-24 用户要求「多标签栏都应该有」):
  // 标签状态归 Rust 会话(每个标签一个子 webview,hide/show 切换),这里只做渲染 +
  // 动作转发。工作区上方那个**页面**标签仍固定叫「浏览器」—— 这是它内部的标签。
  const [dockTabs, setDockTabs] = React.useState<DockedBrowserTab[]>([])
  React.useEffect(() => {
    if (!desktop) return
    let alive = true
    const offs: Array<() => void> = []
    void (async () => {
      offs.push(
        await onDockedBrowserTabs((next) => {
          if (!alive) return
          // 内容一致就复用旧数组:原生侧已去抖,这里再挡一道,
          // 避免每次标题/地址微变都把整块工作面板重渲染一遍。
          setDockTabs((prev) => (dockTabsEqual(prev, next) ? prev : next))
          // 地址栏跟随**当前标签**的落点(切换标签/重定向都以原生侧为准)。
          // 值没变就不 set:zustand 每次 set 都会通知订阅者(面板选择器虽浅比较,
          // 但没必要白跑一轮)。
          const active = next.find((t) => t.active)
          if (active?.url && active.url !== useWorkPanelStore.getState().addressInput) {
            setAddressInput(active.url)
          }
        }),
      )
      offs.push(
        await onDockedBrowserPoppedOut(() => {
          if (!alive) return
          // 已切到独立窗口:停靠层已被 Rust 销毁,前端把停靠标签清掉、面板收起
          setDockTabs([])
          for (const t of useWorkPanelStore.getState().tabs) {
            if (t.state.mode === 'docked') closeTab(t.id)
          }
          // 停靠标签没了还留着面板 = 工作区被一块空的「浏览器」Tab 占着,
          // 独立窗口才是此刻的浏览位置。收面板(closeTab 不会动 open)。
          closePanel()
        }),
      )
    })()
    return () => {
      alive = false
      for (const off of offs) off()
    }
  }, [desktop, setAddressInput, closeTab, closePanel])

  // 进入停靠档时补一次拉取(事件只在变化时推,首帧可能是空)
  React.useEffect(() => {
    if (!desktop || !isDockedMode) return
    let alive = true
    void getDockedBrowserTabs().then((tabs) => {
      if (alive && tabs.length) setDockTabs(tabs)
    })
    return () => {
      alive = false
    }
  }, [desktop, isDockedMode])

  // 停靠档收藏 / 历史来自宿主进程的 browser_store(与独立窗口共用同一份文件):
  // 裸 webview 里的第三方页面拿不到本站 localStorage,所以这一档必须走原生命令。
  // 浏览过程中历史在变,所以每次标签列表推送(页面落点变化)都重拉一次快照。
  const [dockStore, setDockStore] = React.useState<DockedBrowserStore>({
    favorites: [],
    history: [],
  })
  // 依赖只取"落点集合"而不是整个 dockTabs:标题变化(未读数之类)不该触发拉取,
  // 且重定向链会连续改 URL —— 300ms 去抖把它们合成一次请求。
  const dockUrlKey = React.useMemo(
    () => dockTabs.map((t) => `${t.id}:${t.url}`).join('|'),
    [dockTabs],
  )
  React.useEffect(() => {
    if (!desktop || !isDockedMode) return
    let alive = true
    const timer = setTimeout(() => {
      void getDockedBrowserStore().then((s) => {
        if (alive) setDockStore(s)
      })
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [desktop, isDockedMode, dockUrlKey])

  const handleDockTabSelect = React.useCallback(
    (id: number) => {
      void runDockAction(() => dockedBrowserSwitchTab(id))
    },
    [runDockAction],
  )
  const handleDockTabClose = React.useCallback(
    (id: number) => {
      void runDockAction(() => dockedBrowserCloseTab(id))
    },
    [runDockAction],
  )
  const handleDockTabNew = React.useCallback(() => {
    void runDockAction(() => dockedBrowserNewTab())
  }, [runDockAction])
  // 「切换为独立窗口」是打开独立窗口的**唯一**入口(2026-10-24 用户规则)
  const handlePopout = React.useCallback(() => {
    if (!isDockedMode) return
    void runDockAction(dockedBrowserPopout)
  }, [isDockedMode, runDockAction])

  // 2026-08-01 架构改动:删除 maxAvailableWidth / effectiveWidth / handleResize / 空间不足自动关闭逻辑
  // 原因:WebWorkPanel 从右列独立面板改为 absolute inset-0 覆盖 work-area children,
  // 不再需要固定宽度 + resize handle + 空间不足自动关闭(由父容器 work-area 控制宽度)
  const effectiveOpen = mounted && open

  // SSO 兜底登录成功 → 外部桥接发事件收起停靠浏览器(原生层已由桥接销毁,
  // 这里负责把面板里的 docked Tab 一并关掉,否则面板会把它重新铺回来)。
  React.useEffect(() => {
    const onClose = () => {
      for (const t of useWorkPanelStore.getState().tabs) {
        if (t.state.mode === 'docked') closeTab(t.id)
      }
      closePanel()
    }
    window.addEventListener('ihui:close-docked-browser', onClose)
    return () => window.removeEventListener('ihui:close-docked-browser', onClose)
  }, [closeTab, closePanel])

  // 停靠 webview 的**唯一**生命周期所有者(2026-10-24 二次收口):以前只有签到页
  // 自己在量矩形/开窗,导致「+ 菜单/对话链接」开的 docked Tab 没人把原生层铺上去。
  // 现在统一到面板:激活 Tab 是 docked 且面板可见 ⇒ 量宿位矩形并开窗(之后只校正);
  // 切走 Tab / 关面板 / 卸载 ⇒ 收窗。宿位 `[data-ihui-dock-host]` 就是下面渲染的 div。
  //
  // 状态存 ref 而不是 effect 局部变量(2026-10-24 修):Tabs 每次 store 更新都是新对象,
  // 旧实现以 dockedTab 对象为依赖,任何更新都会 cleanup(收窗)+ 重开(重新导航到 Tab 里
  // 记的 URL),表现为"刚点过的页面自己跳回初始 URL"与幽灵窗。依赖只留 id/url 标量。
  const dockedTab = activeTab?.state.mode === 'docked' ? activeTab : null
  const dockedTabId = dockedTab?.id
  const dockedTabUrl = dockedTab?.url
  // rect 一并记在 ref 里:800ms 轮询只用来兜底布局变化,矩形没变就不再调原生命令
  // (原生侧每摆一次 = 一次主线程 set_position/set_size,空转纯浪费)。
  const dockedRef = React.useRef<{
    open: boolean
    url: string
    rect?: { x: number; y: number; width: number; height: number }
    /** 上次是被「切到别的页面标签」收起的:重开时只恢复,不把页面导回 Tab 记的 URL。 */
    paused?: boolean
  }>({ open: false, url: '' })
  React.useEffect(() => {
    if (!dockedTabId || !effectiveOpen || !desktop) return
    const targetUrl = dockedTabUrl || 'about:blank'
    let stopped = false
    let busy = false
    const sync = async () => {
      if (stopped || busy) return
      const host = document.querySelector('[data-ihui-dock-host]')
      if (!host) return
      const r = host.getBoundingClientRect()
      if (r.width < 80 || r.height < 80) return
      const rect = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      }
      busy = true
      try {
        const st = dockedRef.current
        if (st.open) {
          if (st.url !== targetUrl) {
            dockedRef.current = { open: true, url: targetUrl, rect: st.rect }
            await runDockAction(() => dockedBrowserNavigate(targetUrl))
          } else if (
            !st.rect ||
            Math.abs(st.rect.x - rect.x) > 2 ||
            Math.abs(st.rect.y - rect.y) > 2 ||
            Math.abs(st.rect.width - rect.width) > 2 ||
            Math.abs(st.rect.height - rect.height) > 2
          ) {
            dockedRef.current = { ...st, rect }
            await setDockedBrowserBounds(rect)
          }
          return
        }
        // 从「切走再切回」恢复时不要导航:会话里那个页面就是用户离开时的样子
        const err = await openDockedBrowser(targetUrl, rect, !st.paused)
        if (!err) dockedRef.current = { open: true, url: targetUrl, rect }
        else console.warn('[work-panel] docked open failed:', err)
      } finally {
        busy = false
      }
    }
    void sync()
    window.addEventListener('resize', sync)
    const host = document.querySelector('[data-ihui-dock-host]')
    const ro = host ? new ResizeObserver(() => void sync()) : null
    if (host && ro) ro.observe(host)
    // 兜底轮询:resize 与 ResizeObserver 已覆盖真实的布局变化,这里只是万一有
    // 量不到的情况(如父级 transform 动画)不把原生层留在错位置 —— 2s 足够,
    // 频率降到原来的 1/2.5(每次 setInterval 唤醒都要过一遍事件循环)。
    const timer = setInterval(() => void sync(), 2000)
    return () => {
      stopped = true
      window.removeEventListener('resize', sync)
      ro?.disconnect()
      clearInterval(timer)
      // 这里**不**收窗:依赖变化(切 Tab 再切回)不该销毁原生层,
      // 收窗只由下面唯一出口决定。
    }
  }, [dockedTabId, dockedTabUrl, effectiveOpen, desktop, runDockAction])

  // 收窗唯一出口(2026-10-25 分两种):
  // - 切到工作区别的页面标签 ⇒ 只隐藏冻结,**保留多标签与页面状态**,切回来原样恢复;
  // - 整个面板收起 / 「浏览器」页面标签被关 ⇒ 彻底销毁(否则会留下盖在工作区上的幽灵窗)。
  const dockedVisible = !!dockedTab && effectiveOpen
  React.useEffect(() => {
    if (dockedVisible || !dockedRef.current.open) return
    dockedRef.current = { open: false, url: '', paused: effectiveOpen }
    void (effectiveOpen ? closeDockedBrowser() : destroyDockedBrowser())
  }, [dockedVisible, effectiveOpen])

  // 停靠档地址栏跟随真实落点(登录跳转会换 URL);用户正在输入时不覆盖。
  React.useEffect(() => {
    if (!effectiveOpen || !isDockedMode) return
    let stopped = false
    const timer = setInterval(() => {
      void (async () => {
        const live = await getDockedBrowserUrl()
        if (stopped || !live) return
        if (document.activeElement?.tagName === 'INPUT') return
        if (live !== useWorkPanelStore.getState().addressInput) setAddressInput(live)
      })()
    }, 1500)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [effectiveOpen, isDockedMode, setAddressInput])

  // Tab 栏数据(映射为 UI 组件需要的格式)
  const uiTabs: WorkPanelTabItem[] = React.useMemo(
    () =>
      // 停靠档固定显示「浏览器」(2026-10-24 用户要求):全 App 只有这一个浏览器
      // 标签窗口,标题跟着页面走会让人以为"又开了一个浏览器"。
      tabs.map((t) => ({
        id: t.id,
        title: t.state.mode === 'docked' ? tw('browserTab') : t.title || t.url || tw('untitledTab'),
        type: t.type,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next-intl 4.13.4 的 t 每次渲染换新引用(实测 same=false),补进依赖会让本 effect 每渲染重跑
    [tabs],
  )

  const handleOpenExternal = React.useCallback(() => {
    // 2026-10-24 用户规则:独立窗口只能由停靠浏览器工具条上的「切换为独立窗口」
    // 按钮打开 —— 这里的「在外部浏览器打开」按字面交给系统默认浏览器,
    // 不再另开项目内嵌独立窗(否则等于绕过规则留了第二个入口)。
    if (!url) return
    void openExternalUrl(url)
  }, [url])

  // 内嵌浏览器「元素点选」→ 汇入既有文本引用通道(D22 `ihui:add-text-reference`)。
  // 点选发生在内嵌窗(第三方站点无 IPC),Rust 侧经哨兵导航收到后 emit 到 main;
  // 这里把它转成与 CDP 标注/文档批注同一条文本引用事件,由 message-input 消费。
  React.useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void onEmbeddedBrowserElementPicked((payload) => {
      try {
        setPicking(false) // 点完即退出点选态(脚本自己也已 off)
        const info = JSON.parse(payload) as {
          selector?: string
          text?: string
          tag?: string
          url?: string
        }
        const label = info.selector || info.tag || '元素'
        const text = `[浏览器元素] ${label}${info.text ? ` — ${info.text}` : ''}`
        window.dispatchEvent(new CustomEvent(ADD_TEXT_REFERENCE_EVENT, { detail: { text } }))
      } catch {
        /* 负载非 JSON:忽略 */
      }
    }).then((un) => {
      if (disposed) un()
      else unlisten = un
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  // 代理 iframe 桥接(2026-09-02):监听代理页 postMessage
  // - ihui-embed-nav:页内导航 → 同步 tab url + 地址栏
  // - ihui-embed-proxy-error:代理取回失败 → 降级链(onFailed → CDP → 截图)
  // 代理页为 opaque origin(iframe sandbox 无 allow-same-origin),e.origin 为 'null',
  // 无法做同源校验;以消息 type 前缀白名单 + 字段类型校验兜底(影响面:仅地址栏显示/降级触发)
  React.useEffect(() => {
    if (!isProxyMode) return
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        type?: unknown
        url?: unknown
        message?: unknown
        title?: unknown
      } | null
      if (!d || typeof d.type !== 'string' || !d.type.startsWith('ihui-embed-')) return
      const title = typeof d.title === 'string' && d.title ? d.title : undefined
      if (d.type === 'ihui-embed-nav' && typeof d.url === 'string' && d.url) {
        // 用户发起导航(链接点击 / pushState,桥接在跳转前广播)→ 压入历史栈
        onEmbedNavigation(d.url, title, 'nav')
      } else if (d.type === 'ihui-embed-loaded' && typeof d.url === 'string' && d.url) {
        // 文档就绪 / 重定向落点广播(每次代理文档加载都会发,url=最终落点)
        // → 只修正当前历史条目,绝不压栈(否则 302 落点二次压栈 + 后退弹回)
        onEmbedNavigation(d.url, title, 'loaded')
      } else if (d.type === 'ihui-embed-newtab' && typeof d.url === 'string' && d.url) {
        // Ctrl/Cmd+点击代理链接 → 应用内新开 WorkPanel 标签页(对标 主流 AI IDE 浏览器)
        newTab(d.url)
      } else if (d.type === 'ihui-embed-proxy-error') {
        onFailed(typeof d.message === 'string' ? d.message : tw('embedProxyFailed'))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next-intl 4.13.4 的 t 每次渲染换新引用(实测 same=false),补进依赖会让本 effect 每渲染重跑
  }, [isProxyMode, onEmbedNavigation, onFailed, newTab])

  // 代理 iframe 加载超时兜底:20s 未 onLoad(强反爬挑战页/网络挂起)→ 降级 CDP
  React.useEffect(() => {
    if (!isProxyMode || status !== 'loading') return
    const timer = window.setTimeout(() => onFailed(tw('embedProxyTimeout')), 20000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next-intl 4.13.4 的 t 每次渲染换新引用(实测 same=false),补进依赖会让本 effect 每渲染重跑
  }, [isProxyMode, status, onFailed, proxyUrl])

  // 收藏 / 历史(2026-10-24 用户要求「两种形态都该有」):
  // web 端(iframe/代理)用本站 store;停靠档换成宿主进程的 browser_store ——
  // 与独立窗口同一份数据,收藏在停靠档点过,弹出后仍然在。
  const effectiveFavorites = isDockedMode ? dockStore.favorites : favorites
  const effectiveRecentUrls = isDockedMode ? dockStore.history : recentUrls
  const isFavorite = effectiveFavorites.some((f) => f.url === url)
  const handleToggleFavorite = React.useCallback(() => {
    if (isDockedMode) {
      void dockedBrowserFavoriteToggle().then((s) => {
        if (s) setDockStore(s)
      })
      return
    }
    if (!url) return
    if (isFavorite) {
      removeFavorite(url)
    } else {
      addFavorite(url, title ?? url)
    }
  }, [isDockedMode, url, title, isFavorite, addFavorite, removeFavorite])
  const handleRemoveFavorite = React.useCallback(
    (target: string) => {
      if (isDockedMode) {
        void dockedBrowserFavoriteRemove(target).then((s) => {
          if (s) setDockStore(s)
        })
        return
      }
      removeFavorite(target)
    },
    [isDockedMode, removeFavorite],
  )
  const handleClearHistory = React.useCallback(() => {
    if (isDockedMode) {
      void dockedBrowserHistoryClear().then((s) => {
        if (s) setDockStore(s)
      })
      return
    }
    clearHistory()
  }, [isDockedMode, clearHistory])

  // 键盘快捷键(2026-09-02,对标 主流 AI IDE 内嵌浏览器):
  // 仅在焦点位于面板 chrome(工具栏/地址栏)时生效——代理 iframe 为跨源 sandbox(opaque origin),
  // 其键盘事件被隔离不会冒泡到父文档,这是沙箱固有限制(与 主流 AI IDE 一致)。
  // 组合:Alt+←/→ 后退/前进、Ctrl/Cmd+R 或 F5 重载、Ctrl/Cmd+L 聚焦地址栏。
  const panelRef = React.useRef<HTMLDivElement>(null)
  const handlePanelKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey
      if (e.altKey && e.key === 'ArrowLeft') {
        // 停靠档走原生命令(前端历史栈是空的)
        e.preventDefault()
        handleBack()
        return
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        handleForward()
        return
      }
      if (mod && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        // 必须 stopPropagation:window 层还有 use-native-shortcuts 的 Ctrl+R → menu-actions
        // 的 'view.reload'(web 端实现是 location.reload()),只 preventDefault 挡不住它,
        // 结果"刷新内嵌页面"会把整个 SPA 一起重载掉。
        e.stopPropagation()
        handleReload()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        e.stopPropagation()
        handleReload()
        return
      }
      if (isDockedMode && e.key === 'F12') {
        // 停靠档没有独立窗口的工具条按钮,DevTools 用 F12 直连原生 webview
        e.preventDefault()
        e.stopPropagation()
        void runDockAction(dockedBrowserDevtools)
        return
      }
      if (mod && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        const input = panelRef.current?.querySelector(
          'input[type="text"]',
        ) as HTMLInputElement | null
        input?.focus()
        input?.select()
      }
    },
    [handleBack, handleForward, handleReload, isDockedMode, runDockAction],
  )

  if (!effectiveOpen) return null

  return (
    // 2026-08-01 架构改动:absolute inset-0 覆盖 GlobalShell work-area 的 children 区域
    // (用户规则:"不允许额外出来一个窗口,所有内容必须在工作内容展示区内展示")
    // - 旧:右列独立 flex item(mt-[50px] mr-2 固定宽度 + resize handle)
    // - 新:absolute inset-0 覆盖父容器(GlobalShell 的 relative div),替换展示工作区内容
    // - 父容器(GlobalShell L239)是 relative,WebWorkPanel absolute inset-0 刚好覆盖 children
    // - z-30 确保覆盖 children(MainShell 可能有 z-index)
    // - bg-shell-panel 对齐 AI 对话框背景色(2026-08-01 用户反馈"背景色应该跟 ai 对话框背景色一致")
    // - rounded-xl 对齐 AI 对话框圆角度(2026-08-01 用户反馈"圆角度也是应该一致")
    // - 不传 width/onResize 给 WorkPanel → WorkPanel w-full + 无 resize handle
    // - WorkPanel 的 border-l(左边框)在嵌入场景不需要,用 className='border-l-0' 覆盖
    // - bottom-2(8px):底部留间距对齐 AISidePanel 底部(AISidePanel 上下各 8px 间距,
    //   WebWorkPanel 外层 absolute 默认 bottom:0 贴 viewport 边缘,比 AISidePanel 低 8px)
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 容器级快捷键捕获层(Alt+←/→ 前进后退、mod+r/F5 刷新、mod+l 聚焦地址栏);快捷键需焦点在面板内任意原生控件时生效,容器本身刻意不可聚焦,键盘用户经 Tab 到按钮 Enter/Space 等价可达
    <div
      ref={panelRef}
      onKeyDown={handlePanelKeyDown}
      className="absolute inset-x-0 top-0 bottom-2 z-30 rounded-xl bg-shell-panel"
      data-testid="web-work-panel"
    >
      <WorkPanel
        open={effectiveOpen}
        onClose={closePanel}
        addressValue={addressInput}
        onAddressChange={setAddressInput}
        onAddressSubmit={handleAddressSubmit}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onStop={isDockedMode ? () => void runDockAction(dockedBrowserStop) : stop}
        onOpenExternal={handleOpenExternal}
        onHome={isDockedMode ? handleHome : undefined}
        onPickToggle={isDockedMode ? handlePickToggle : undefined}
        isPicking={picking}
        // 停靠档:开发者工具/停止按钮对齐独立窗口工具条(Web 端保持原样)
        onDevtools={isDockedMode ? () => void runDockAction(dockedBrowserDevtools) : undefined}
        onPopout={isDockedMode ? handlePopout : undefined}
        showStop={isDockedMode}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
        favorites={effectiveFavorites}
        recentUrls={effectiveRecentUrls}
        onSelectFromList={(target) => {
          if (isDockedMode) void runDockAction(() => dockedBrowserNavigate(target))
          else navigate(target, 'user')
        }}
        onRemoveFavorite={handleRemoveFavorite}
        onClearHistory={handleClearHistory}
        // 停靠档的历史栈在前端是空的(导航发生在原生 webview 里),按钮不能按栈禁用
        canBack={isDockedMode ? true : canBack}
        canForward={isDockedMode ? true : canForward}
        isLoading={isLoading}
        isSecure={url.startsWith('https://')}
        tabs={uiTabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTab}
        onTabClose={closeTab}
        onTabReorder={reorderTabs}
        onNewTab={() => newTab()}
        labels={workPanelLabels}
        className="border-l-0"
      >
        {isProxyMode && proxyUrl ? (
          <WebViewFrame
            url={proxyUrl}
            mode="iframe"
            status={status}
            title={title}
            error={error}
            /* 无 allow-same-origin:代理页外部 JS 为 opaque origin,无法触碰本站 DOM/存储。
               放宽必须带理由(2026-09-27 沙箱严档缺省票):这一档此前是裸字符串,新 API 下
               裸串不生效 ⇒ 必须显式声明,否则内嵌浏览器会退回"脚本全禁"而整页不渲染。 */
            sandbox={{
              tokens: ['allow-scripts', 'allow-forms', 'allow-popups'],
              reason:
                '代理模式 iframe 加载的是任意第三方站点(后端同源代理 + 剥 XFO/CSP),' +
                '不给 allow-scripts 站点脚本不执行、整页空白,该功能即失效;' +
                'allow-forms 供登录/搜索表单,allow-popups 供站点开窗下载。' +
                '刻意不含 allow-same-origin ⇒ 帧内是 opaque origin,读不到本站 Cookie/存储。',
            }}
            onLoad={onLoaded}
            onError={onFailed}
            onOpenExternal={handleOpenExternal}
            onRetry={reload}
            labels={webViewFrameLabels}
          />
        ) : isDockedMode ? (
          /* 停靠浏览器(2026-10-24):标签栏 + 宿位。真正的页面由桌面端把原生
             webview 按 `[data-ihui-dock-host]` 的屏幕矩形铺在上面 —— 我们只上
             报坐标系,渲染与输入全部发生在原生层。
             多标签(2026-10-24 用户要求):原生侧一个标签一个子 webview,
             这里的标签栏与独立窗口同语义(点击切换 / X 关闭 / + 新建)。 */
          <div className="flex h-full w-full flex-col">
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 bg-muted/30 px-1.5 py-1">
              {dockTabs.map((t) => (
                <div
                  key={t.id}
                  className={
                    t.active
                      ? 'flex min-w-0 max-w-[180px] items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-foreground shadow-sm'
                      : 'flex min-w-0 max-w-[180px] items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background/60'
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleDockTabSelect(t.id)}
                    title={t.title || t.url}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {t.title || t.url}
                  </button>
                  <button
                    type="button"
                    aria-label={workPanelLabels.closeTab}
                    onClick={() => handleDockTabClose(t.id)}
                    className="shrink-0 rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label={workPanelLabels.newTab}
                onClick={handleDockTabNew}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background/60"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div data-ihui-dock-host className="min-h-0 w-full flex-1" />
          </div>
        ) : isCdpMode && sessionId ? (
          <CdpBrowserView
            sessionId={sessionId}
            onNavigation={onCdpNavigation}
            onLoaded={onLoaded}
            onFailed={onFailed}
            onBack={canBack ? back : undefined}
            onForward={canForward ? forward : undefined}
            onReload={reload}
            onOpenExternal={handleOpenExternal}
            currentUrl={url}
          />
        ) : (
          <WebViewFrame
            url={url}
            mode={mode}
            status={status}
            screenshot={screenshot}
            title={title}
            error={error}
            /* 这一处此前**没有**传 sandbox,吃的是组件缺省档 —— 而旧缺省是全仓最宽的
               `allow-same-origin allow-scripts allow-forms allow-popups`。缺省已改严档,
               这里显式声明三档继续能浏览,并**去掉 allow-same-origin**(与上面代理分支同档):
               第三方站点在帧内失去自己的 Cookie/存储 ⇒ 面板内"已登录"状态不再保持,
               这属用户可感知变化,已登记在交付报告。 */
            sandbox={{
              tokens: ['allow-scripts', 'allow-forms', 'allow-popups'],
              reason:
                '直接 iframe 嵌入模式加载用户指定的任意第三方 URL,不给 allow-scripts 则站点脚本不执行、' +
                '整页不可交互,内嵌浏览器功能即失效;allow-forms/allow-popups 为浏览必需(表单提交、站点开窗)。' +
                '刻意不含 allow-same-origin ⇒ 帧内为 opaque origin,与本站 DOM/存储隔离。',
            }}
            onLoad={onLoaded}
            onError={onFailed}
            onOpenExternal={handleOpenExternal}
            onRetry={reload}
            labels={webViewFrameLabels}
          />
        )}
      </WorkPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠