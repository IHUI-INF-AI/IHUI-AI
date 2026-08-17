'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { SquareTerminal, Plus, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { TerminalPanel } from '@/components/ide/terminal-panel'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import { useTerminalDockStore } from '@/stores/terminal-dock'

/**
 * AI 面板底部 PowerShell 终端停靠面板(2026-08-17 立)。
 *
 * - open=false 时 return null(不挂载 TerminalPanel,避免无谓建 session)。
 * - 结构:mini 工具栏(h-8,PowerShell 标题 + 新建终端 + 收起)+ TerminalPanel 主体 + 底部 4px 拖拽调高命中区。
 * - 工具栏与主体用背景色对比(bg-muted/40 vs bg-card)区分,不画分割线(AGENTS.md 禁单边 border 当分割线)。
 * - 高度由 useTerminalDockStore.height 控制,store 内钳制 160-480;收起再展开保留上次高度。
 */
export function AiTerminalDock() {
  const t = useTranslations('aiChat')
  const tcommon = useTranslations('common')
  const open = useTerminalDockStore((s) => s.open)
  const height = useTerminalDockStore((s) => s.height)
  const isResizing = useTerminalDockStore((s) => s.isResizing)
  const setOpen = useTerminalDockStore((s) => s.setOpen)
  const setHeight = useTerminalDockStore((s) => s.setHeight)
  const setResizing = useTerminalDockStore((s) => s.setResizing)

  const { createSession } = useTerminalSession()

  // 底部 4px 命中区拖拽调高:向上拖动 = 增大 height(startY - clientY > 0)
  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setResizing(true)
      const startY = e.clientY
      const startHeight = useTerminalDockStore.getState().height
      const onMove = (ev: PointerEvent) => {
        setHeight(startHeight + (startY - ev.clientY))
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setHeight, setResizing],
  )

  // 新建终端:显式指定 PowerShell(Windows 默认 shell,跨平台后端也接受 shell 字段)
  const handleNew = React.useCallback(() => {
    void createSession({ shell: 'powershell' })
  }, [createSession])

  if (!open) return null

  return (
    <div
      data-testid="ai-terminal-dock"
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-lg bg-card',
        isResizing && 'select-none',
      )}
    >
      {/* mini 工具栏:背景色对比区分工具栏与主体,不画分割线 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-muted/40 px-2">
        <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-muted-foreground">
          {t('terminalDock.title')}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip content={t('terminalDock.newSession')}>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('terminalDock.newSession')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('terminalDock.collapse')}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('terminalDock.collapse')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      {/* 主体:TerminalPanel 挂载时自动 refreshSessions + 无 session 自动创建(useTerminalSession) */}
      <div className="min-h-0 overflow-hidden" style={{ height }}>
        <TerminalPanel />
      </div>
      {/* 底部 4px 拖拽调高命中区 */}
      <div
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label={tcommon('resize')}
        className="h-1 shrink-0 cursor-row-resize touch-none outline-none"
      />
    </div>
  )
}
