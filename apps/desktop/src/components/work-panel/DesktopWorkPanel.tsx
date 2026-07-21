import * as React from 'react'
import { open as openExternalUrl } from '@tauri-apps/plugin-shell'
import { WorkPanel, WebViewFrame, type WorkPanelTabItem } from '@ihui/ui'
import {
  getWorkPanelState,
  useWorkPanelStore,
} from '../../stores/work-panel'

/**
 * Desktop 端工作展示区(右侧固定面板)。
 * - 渲染 @ihui/ui 的 WorkPanel 容器 + WebViewFrame(iframe 模式)
 * - Tauri WebView2 主窗口内 iframe 原生不受 X-Frame-Options 限制
 * - onError 降级到 mode='external',显示"在外部浏览器打开"按钮
 * - "在外部打开"用 @tauri-apps/plugin-shell 的 open() 调用系统默认浏览器
 *
 * 布局:position:fixed 右侧覆盖层,不修改 Layout.tsx,open=false 时返回 null。
 */
export function DesktopWorkPanel() {
  const {
    open,
    width,
    url,
    addressInput,
    status,
    mode,
    error,
    isLoading,
    history,
    historyIndex,
    closePanel,
    navigate,
    back,
    forward,
    reload,
    stop,
    setWidth,
    setAddressInput,
    onLoaded,
    onFailed,
  } = useWorkPanelStore()

  const tabs: WorkPanelTabItem[] = React.useMemo(() => {
    if (!url) return []
    let title = url
    try {
      title = new URL(url).hostname
    } catch {
      // 非 URL,保留原值
    }
    return [{ id: 'current', title, type: 'browser' }]
  }, [url])

  const handleResize = React.useCallback(
    (delta: number) => {
      setWidth(getWorkPanelState().width + delta)
    },
    [setWidth],
  )

  const handleOpenExternal = React.useCallback(() => {
    if (url) void openExternalUrl(url)
  }, [url])

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', right: 0, top: 0, height: '100vh', zIndex: 50 }}
    >
      <WorkPanel
        open={open}
        width={width}
        onResize={handleResize}
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
      >
        <WebViewFrame
          url={url}
          mode={mode}
          status={status}
          error={error}
          onLoad={onLoaded}
          onError={onFailed}
          onOpenExternal={(u) => void openExternalUrl(u)}
          onRetry={reload}
        />
      </WorkPanel>
    </div>
  )
}

export default DesktopWorkPanel
