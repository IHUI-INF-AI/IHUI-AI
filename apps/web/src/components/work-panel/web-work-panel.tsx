'use client'

import * as React from 'react'
import { WorkPanel, WebViewFrame } from '@ihui/ui'
import type { WorkPanelTabItem } from '@ihui/ui'
import {
  useWorkPanelStore,
  WORK_PANEL_DEFAULT_WIDTH,
} from '@/stores/work-panel'
import { useMounted } from '@/hooks/use-mounted'

/**
 * Web 端工作展示区(右侧固定面板)。
 * - 渲染 @ihui/ui 的 WorkPanel 容器 + WebViewFrame(iframe + 降级)
 * - P0:iframe 失败降级到 external(显示"在外部打开"按钮)
 * - P1:接入后端 Playwright 截图 API,screenshot 模式
 *
 * 布局:作为 GlobalShell flex 流的一部分,在 work-area 右侧。
 */
export function WebWorkPanel() {
  const mounted = useMounted()
  const {
    open,
    width,
    url,
    addressInput,
    status,
    mode,
    screenshot,
    title,
    error,
    isLoading,
    history,
    historyIndex,
    isResizing,
    closePanel,
    navigate,
    back,
    forward,
    reload,
    stop,
    setWidth,
    setResizing,
    setAddressInput,
    onLoaded,
    onFailed,
  } = useWorkPanelStore()

  // SSR / 首帧:用默认宽度占位,避免 hydration mismatch
  const effectiveWidth = !mounted ? WORK_PANEL_DEFAULT_WIDTH : width
  const effectiveOpen = mounted && open

  // 当前单 Tab(P0 单 tab,P3 扩展多 tab)
  const tabs: WorkPanelTabItem[] = React.useMemo(() => {
    if (!url) return []
    return [{ id: 'current', title: title ?? new URL(url).hostname ?? url, type: 'browser' }]
  }, [url, title])

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
      canBack={historyIndex > 0}
      canForward={historyIndex < history.length - 1}
      isLoading={isLoading}
      isSecure={url.startsWith('https://')}
      tabs={tabs}
      activeTabId={tabs.length > 0 ? 'current' : null}
      onTabChange={() => {}}
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
