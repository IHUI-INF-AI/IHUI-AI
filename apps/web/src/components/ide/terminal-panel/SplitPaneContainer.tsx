// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { TerminalViewport } from './TerminalViewport'

interface SplitPaneContainerProps {
  sessionId: string
  paneIds: string[]
  direction: TerminalSplitDirection
  activePaneId: string | null
  fontSize: number
  onFontSizeChange: React.Dispatch<React.SetStateAction<number>>
  onAddPane: (direction: TerminalSplitDirection) => void
  onRemovePane: (paneId: string) => void
  onSetActivePane: (paneId: string) => void
}

/**
 * 分屏容器 — 用 CSS Grid 渲染多个 pane。
 *
 * - vertical:grid-template-columns: repeat(N, 1fr) 左右并排
 * - horizontal:grid-template-rows: repeat(N, 1fr) 上下堆叠
 *
 * 每个 pane 独立 xterm 实例,共享同一 WS 数据流(后端 PTY 广播给所有 WS 连接)。
 */
export function SplitPaneContainer({
  sessionId,
  paneIds,
  direction,
  activePaneId,
  fontSize,
  onFontSizeChange,
  onAddPane,
  onRemovePane,
  onSetActivePane,
}: SplitPaneContainerProps) {
  // 焦点切换:Alt+Arrow 按 pane 顺序循环
  const handleFocusSwitch = React.useCallback(
    (focusDirection: 'prev' | 'next') => {
      if (paneIds.length <= 1) return
      const currentIdx = activePaneId ? paneIds.indexOf(activePaneId) : 0
      let nextIdx: number
      if (focusDirection === 'next') {
        nextIdx = (currentIdx + 1) % paneIds.length
      } else {
        nextIdx = (currentIdx - 1 + paneIds.length) % paneIds.length
      }
      const nextId = paneIds[nextIdx]
      if (nextId) onSetActivePane(nextId)
    },
    [paneIds, activePaneId, onSetActivePane],
  )

  // 容器级键盘事件(Alt+Arrow 焦点切换)
  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.altKey && e.key.startsWith('Arrow')) {
        // Alt+ArrowLeft/Up → prev;Alt+ArrowRight/Down → next
        const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 'prev' : 'next'
        handleFocusSwitch(dir)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [handleFocusSwitch])

  if (paneIds.length === 0) return null

  // 单 pane 直接渲染(避免 grid 分隔线)
  if (paneIds.length === 1) {
    const singlePaneId = paneIds[0]
    if (!singlePaneId) return null
    return (
      <TerminalViewport
        key={singlePaneId}
        sessionId={sessionId}
        paneId={singlePaneId}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        onSplitRequest={onAddPane}
        onClosePane={() => onRemovePane(singlePaneId)}
        canClosePane={false}
        isActive={activePaneId === singlePaneId}
        onFocusPane={() => onSetActivePane(singlePaneId)}
      />
    )
  }

  // 多 pane 用 CSS Grid 布局
  const gridStyle: React.CSSProperties =
    direction === 'vertical'
      ? {
          display: 'grid',
          gridTemplateColumns: `repeat(${paneIds.length}, 1fr)`,
          gap: '1px',
          background: 'var(--border)',
          height: '100%',
          width: '100%',
        }
      : {
          display: 'grid',
          gridTemplateRows: `repeat(${paneIds.length}, 1fr)`,
          gap: '1px',
          background: 'var(--border)',
          height: '100%',
          width: '100%',
        }

  return (
    <div style={gridStyle}>
      {paneIds.map((paneId) => (
        <div key={paneId} className="relative overflow-hidden bg-card">
          <TerminalViewport
            sessionId={sessionId}
            paneId={paneId}
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            onSplitRequest={onAddPane}
            onClosePane={() => onRemovePane(paneId)}
            canClosePane={paneIds.length > 1}
            isActive={activePaneId === paneId}
            onFocusPane={() => onSetActivePane(paneId)}
          />
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
