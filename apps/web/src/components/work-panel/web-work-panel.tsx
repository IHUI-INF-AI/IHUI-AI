'use client'

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { WorkPanel, WebViewFrame } from '@ihui/ui-react'
import type { WorkPanelTabItem } from '@ihui/ui-react'
import {
  useWorkPanelStore,
  WORK_PANEL_DEFAULT_WIDTH,
} from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'

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
  // WebViewFrame 只支持 iframe/screenshot/external,native(Tauri)映射为 external
  const rawMode = activeTab?.state.mode ?? 'iframe'
  const mode: 'iframe' | 'screenshot' | 'external' =
    rawMode === 'native' ? 'external' : rawMode
  const screenshot = activeTab?.state.screenshot
  const title = activeTab?.state.title
  const error = activeTab?.state.error
  const isLoading = status === 'loading'
  const canBack = activeTab ? activeTab.historyIndex > 0 : false
  const canForward = activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false

  // SSR / 首帧:用默认宽度占位,避免 hydration mismatch
  const effectiveWidth = !mounted ? WORK_PANEL_DEFAULT_WIDTH : width
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
    <WorkPanel
      open={effectiveOpen}
      width={effectiveWidth}
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
    </WorkPanel>
  )
}
