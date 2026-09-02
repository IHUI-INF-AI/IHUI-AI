// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { WorkPanel, WebViewFrame } from '@ihui/ui-react'
import type { WorkPanelTabItem } from '@ihui/ui-react'
import { useWorkPanelStore } from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'
import { openInGoogleChrome } from '@/lib/tauri-bridge'

import { CdpBrowserView } from './cdp-browser-view'

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

  // 2026-08-01 架构改动:删除 maxAvailableWidth / effectiveWidth / handleResize / 空间不足自动关闭逻辑
  // 原因:WebWorkPanel 从右列独立面板改为 absolute inset-0 覆盖 work-area children,
  // 不再需要固定宽度 + resize handle + 空间不足自动关闭(由父容器 work-area 控制宽度)
  const effectiveOpen = mounted && open

  // Tab 栏数据(映射为 UI 组件需要的格式)
  const uiTabs: WorkPanelTabItem[] = React.useMemo(
    () => tabs.map((t) => ({ id: t.id, title: t.title || t.url || '新标签页', type: t.type })),
    [tabs],
  )

  const handleOpenExternal = React.useCallback(() => {
    // 2026-08-17:桌面端用 Google Chrome --app 打开(用户要求"内置浏览器要谷歌"),
    // web 端降级 window.open 新标签页。
    if (url) void openInGoogleChrome(url)
  }, [url])

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
        // Ctrl/Cmd+点击代理链接 → 应用内新开 WorkPanel 标签页(对标 Cursor/Trae 浏览器)
        newTab(d.url)
      } else if (d.type === 'ihui-embed-proxy-error') {
        onFailed(typeof d.message === 'string' ? d.message : '嵌入代理加载失败')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isProxyMode, onEmbedNavigation, onFailed, newTab])

  // 代理 iframe 加载超时兜底:20s 未 onLoad(强反爬挑战页/网络挂起)→ 降级 CDP
  React.useEffect(() => {
    if (!isProxyMode || status !== 'loading') return
    const timer = window.setTimeout(() => onFailed('嵌入代理加载超时,已切换到截图浏览'), 20000)
    return () => window.clearTimeout(timer)
  }, [isProxyMode, status, onFailed, proxyUrl])

  // 收藏切换
  const isFavorite = favorites.some((f) => f.url === url)
  const handleToggleFavorite = React.useCallback(() => {
    if (!url) return
    if (isFavorite) {
      removeFavorite(url)
    } else {
      addFavorite(url, title ?? url)
    }
  }, [url, title, isFavorite, addFavorite, removeFavorite])

  // 键盘快捷键(2026-09-02,对标 Cursor/Trae 内嵌浏览器):
  // 仅在焦点位于面板 chrome(工具栏/地址栏)时生效——代理 iframe 为跨源 sandbox(opaque origin),
  // 其键盘事件被隔离不会冒泡到父文档,这是沙箱固有限制(与 Cursor/Trae 一致)。
  // 组合:Alt+←/→ 后退/前进、Ctrl/Cmd+R 或 F5 重载、Ctrl/Cmd+L 聚焦地址栏。
  const panelRef = React.useRef<HTMLDivElement>(null)
  const handlePanelKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey
      if (e.altKey && e.key === 'ArrowLeft') {
        if (canBack) {
          e.preventDefault()
          back()
        }
        return
      }
      if (e.altKey && e.key === 'ArrowRight') {
        if (canForward) {
          e.preventDefault()
          forward()
        }
        return
      }
      if (mod && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        reload()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        reload()
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
    [canBack, canForward, back, forward, reload],
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
        onAddressSubmit={() => navigate(addressInput, 'user')}
        onBack={back}
        onForward={forward}
        onReload={reload}
        onStop={stop}
        onOpenExternal={handleOpenExternal}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
        favorites={favorites}
        recentUrls={recentUrls}
        onSelectFromList={(url) => navigate(url, 'user')}
        onRemoveFavorite={removeFavorite}
        onClearHistory={clearHistory}
        canBack={canBack}
        canForward={canForward}
        isLoading={isLoading}
        isSecure={url.startsWith('https://')}
        tabs={uiTabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTab}
        onTabClose={closeTab}
        onTabReorder={reorderTabs}
        onNewTab={() => newTab()}
        className="border-l-0"
      >
        {isProxyMode && proxyUrl ? (
          <WebViewFrame
            url={proxyUrl}
            mode="iframe"
            status={status}
            title={title}
            error={error}
            /* 无 allow-same-origin:代理页外部 JS 为 opaque origin,无法触碰本站 DOM/存储 */
            sandbox="allow-scripts allow-forms allow-popups"
            onLoad={onLoaded}
            onError={onFailed}
            onOpenExternal={handleOpenExternal}
            onRetry={reload}
          />
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
            onLoad={onLoaded}
            onError={onFailed}
            onOpenExternal={handleOpenExternal}
            onRetry={reload}
          />
        )}
      </WorkPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
