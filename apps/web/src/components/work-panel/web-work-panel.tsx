'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { WorkPanel, WebViewFrame } from '@ihui/ui-react'
import type { WorkPanelTabItem } from '@ihui/ui-react'
import {
  useWorkPanelStore,
} from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'

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
    // 2026-08-01 架构改动:absolute inset-0 覆盖 GlobalShell work-area 的 children 区域
    // (用户规则:"不允许额外出来一个窗口,所有内容必须在工作内容展示区内展示")
    // - 旧:右列独立 flex item(mt-[50px] mr-2 固定宽度 + resize handle)
    // - 新:absolute inset-0 覆盖父容器(GlobalShell 的 relative div),替换展示工作区内容
    // - 父容器(GlobalShell L239)是 relative,WebWorkPanel absolute inset-0 刚好覆盖 children
    // - z-30 确保覆盖 children(MainShell 可能有 z-index)
    // - bg-background 确保不透明(即使 WorkPanel 内部有问题,外层也能覆盖 children)
    // - 不传 width/onResize 给 WorkPanel → WorkPanel w-full + 无 resize handle
    // - WorkPanel 的 border-l(左边框)在嵌入场景不需要,用 className='border-l-0' 覆盖
    <div className="absolute inset-0 z-30 bg-background">
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
