'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { WorkPanel, WebViewFrame } from '@ihui/ui-react'
import type { WorkPanelTabItem } from '@ihui/ui-react'
import {
  useWorkPanelStore,
  WORK_PANEL_DEFAULT_WIDTH,
  WORK_PANEL_MIN_WIDTH,
} from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'
import { useIsMobile } from '@/hooks/use-media-query'

import { CdpBrowserView } from './cdp-browser-view'

/**
 * Web 端工作展示区(右侧固定面板)。
 * - 渲染 @ihui/ui-react 的 WorkPanel 容器 + WebViewFrame(iframe + 降级)
 * - P0:iframe 失败降级到 external(显示"在外部打开"按钮)
 * - P1:接入后端 Playwright 截图 API,screenshot 模式
 * - P3:多 Tab + 收藏夹 + 历史记录
 *
 * 布局:作为 GlobalShell flex 流的一部分,在 work-area 右侧。
 */
export function WebWorkPanel() {
  const mounted = useMounted()
  // 移动端适配(2026-07-31):移动端 WebWorkPanel 改为全屏覆盖,不参与 flex 流
  const isMobile = useIsMobile()
  // 性能修复(2026-07-25):原 25+ 字段全解构 `useWorkPanelStore()` 等价于订阅整个 state,
  // 任何字段(tabs 切换 / addressInput 输入 / recentUrls 追加)变化都会触发 WebWorkPanel 重渲染,
  // 内含 iframe/WebViewFrame 重建开销极大。改用 useShallow 浅比较,只对返回对象做浅层 diff,
  // 大部分字段引用稳定(尤其 actions),可显著降低无关重渲染。
  const {
    open,
    width,
    addressInput,
    isResizing,
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
    setWidth,
    setResizing,
    setAddressInput,
    onLoaded,
    onFailed,
    onCdpNavigation,
  } = useWorkPanelStore(
    useShallow((s) => ({
      open: s.open,
      width: s.width,
      addressInput: s.addressInput,
      isResizing: s.isResizing,
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
      setWidth: s.setWidth,
      setResizing: s.setResizing,
      setAddressInput: s.setAddressInput,
      onLoaded: s.onLoaded,
      onFailed: s.onFailed,
      onCdpNavigation: s.onCdpNavigation,
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
  const rawMode = activeTab?.state.mode ?? 'iframe'
  const sessionId = activeTab?.state.sessionId
  const isCdpMode = rawMode === 'cdp' && !!sessionId
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

  // 动态计算 WebWorkPanel 最大可用宽度:当 AI 面板 + WebWorkPanel 同时打开且 viewport 不足时,
  // flex 布局会自动收缩 work-area,但 WebWorkPanel 需要限制自身宽度避免挤压 work-area 至 0。
  // --ai-panel-occupy CSS 变量由 GlobalShell 同步(反映 AI 面板当前占用的宽度)。
  const [maxAvailableWidth, setMaxAvailableWidth] = React.useState(WORK_PANEL_DEFAULT_WIDTH)

  React.useEffect(() => {
    if (!mounted) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const root = document.documentElement
        const computed = getComputedStyle(root)
        // 从 CSS 变量读取 sidebar 宽度和 AI 面板占用(由 GlobalShell/AISidePanel 同步)
        const aiOccupyVal = computed.getPropertyValue('--ai-panel-occupy')
        const sidebarVal = computed.getPropertyValue('--sidebar-width')
        const aiOccupy = aiOccupyVal ? parseInt(aiOccupyVal, 10) || 0 : 0
        const sidebarWidth = sidebarVal ? parseInt(sidebarVal, 10) || 130 : 130
        // work-area content 最小保留宽度(保证 MainShell 内容可见)
        const MIN_WORK_AREA_CONTENT = 240
        // 可用 = viewport - sidebar - AI占用 - work-area最小content - WebWorkPanel mr-2(8px)
        const available = window.innerWidth - sidebarWidth - aiOccupy - MIN_WORK_AREA_CONTENT - 8
        setMaxAvailableWidth(available)
      })
    }
    update()
    // resize:窗口大小变化
    window.addEventListener('resize', update)
    // MutationObserver:sidebar 折叠/展开 + AI 面板拖拽宽度会修改 :root style
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [mounted])

  // 空间严重不足时自动关闭 WebWorkPanel(避免挤压 work-area 至 0 宽度)
  // 2026-07-31 移动端适配:移动端 WebWorkPanel 改为 fixed 全屏覆盖,不占 flex 空间,跳过自动关闭
  React.useEffect(() => {
    if (!mounted || !open || isMobile) return
    if (maxAvailableWidth < WORK_PANEL_MIN_WIDTH) {
      closePanel()
    }
  }, [mounted, open, maxAvailableWidth, closePanel, isMobile])

  // SSR / 首帧:用默认宽度占位,避免 hydration mismatch
  // 运行时:width 不超过 maxAvailableWidth(空间不足时自动缩小)
  const effectiveWidth = !mounted
    ? WORK_PANEL_DEFAULT_WIDTH
    : Math.min(width, Math.max(WORK_PANEL_MIN_WIDTH, maxAvailableWidth))
  const effectiveOpen = mounted && open

  // Tab 栏数据(映射为 UI 组件需要的格式)
  const uiTabs: WorkPanelTabItem[] = React.useMemo(
    () => tabs.map((t) => ({ id: t.id, title: t.title || t.url || '新标签页', type: t.type })),
    [tabs],
  )

  const handleResize = React.useCallback(
    (delta: number) => {
      const current = useWorkPanelStore.getState().width
      setWidth(current + delta)
    },
    [setWidth],
  )

  const handleOpenExternal = React.useCallback(() => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }, [url])

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

  if (!effectiveOpen) return null

  return (
    // 2026-07-31 修复"双重设定冲突"(用户反馈"右侧工作展示区顶部高度变低,跟顶部标签栏链路变大"):
    // - 布局:GlobalShell 右列 flex-row(h-screen)内并排 <AISidePanel /> + <work-area-portal-root flex-col>(GlobalTopBar + MainShell) + <WebWorkPanel />
    // - 根因:GlobalTopBar 总高 50px(pt-2=8 + h-9=36 + pb-1.5=6),MainShell 工作区卡片顶部在 50px(顶栏下方)。
    //   旧设定 my-2(8px)让 WebWorkPanel 顶部在 8px,比 MainShell 顶部高 42px,视觉"链路变大"。
    // - 修复:mt-[50px] 让 WebWorkPanel 顶部对齐 MainShell 顶部(都在 GlobalTopBar 下方 50px);
    //   mb-2 底部 8px 跟 MainShell 的 pb-2 对齐;mr-2 右侧 8px 跟 MainShell 的 pr-2 对齐;
    //   h-[calc(100%-58px)] = 100% - 50(顶部) - 8(底部),保证底部 8px 可见不被 overflow-hidden 裁剪。
    // - WebWorkPanel 关闭时 return null,不影响布局。
    // 2026-07-31 移动端深度适配:移动端 WebWorkPanel 改为 fixed 全屏覆盖,
    // 不参与 flex 流(避免在 390px 视口占 480px 把 work-area 挤到 0)。
    // 桌面端保持 flex 流内布局(mt-[50px] 对齐 GlobalTopBar 下方)。
    <div
      className={
        isMobile
          ? 'fixed inset-0 z-sticky' // 移动端:全屏覆盖
          : 'mt-[50px] mb-2 mr-2 h-[calc(100%-58px)] shrink-0' // 桌面端:flex 流内
      }
    >
      <WorkPanel
        open={effectiveOpen}
        width={isMobile ? (typeof window !== 'undefined' ? window.innerWidth : 375) : effectiveWidth}
        onResize={handleResize}
        onResizeStart={() => setResizing(true)}
        onResizeEnd={() => setResizing(false)}
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
        className={isResizing ? 'select-none' : undefined}
      >
        {isCdpMode && sessionId ? (
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
