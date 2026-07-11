'use client'

import * as React from 'react'

export interface UseAiPanelReturn {
  open: boolean
  mode: 'chat' | 'agent' | 'tools'
  openPanel: (mode?: 'chat' | 'agent' | 'tools') => void
  closePanel: () => void
  togglePanel: () => void
  setMode: (mode: 'chat' | 'agent' | 'tools') => void
}

/** AI 面板状态管理 Hook，提供 open/close/toggle 与模式切换 */
export function useAiPanel(initialMode: 'chat' | 'agent' | 'tools' = 'chat'): UseAiPanelReturn {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<'chat' | 'agent' | 'tools'>(initialMode)

  const openPanel = React.useCallback((nextMode?: 'chat' | 'agent' | 'tools') => {
    if (nextMode) setMode(nextMode)
    setOpen(true)
  }, [])

  const closePanel = React.useCallback(() => setOpen(false), [])

  const togglePanel = React.useCallback(() => setOpen((o) => !o), [])

  return { open, mode, openPanel, closePanel, togglePanel, setMode }
}
