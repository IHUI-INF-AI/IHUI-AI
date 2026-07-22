'use client'
import { useEffect } from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { ViewPanelType } from '@ihui/types'

export function useIDEShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return

      const target = e.target as HTMLElement
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      const key = e.key.toLowerCase()
      const store = useIDEWorkspace.getState()

      // Ctrl+Shift+* — 始终响应(视图切换)
      if (e.shiftKey) {
        switch (key) {
          case 'e':
            e.preventDefault()
            store.setActiveView('files')
            return
          case 'f':
            e.preventDefault()
            store.setActiveView('search')
            return
          case 'g':
            e.preventDefault()
            store.setActiveView('source-control')
            return
          case 'd':
            e.preventDefault()
            store.setActiveView('debug')
            return
          case 'a':
            e.preventDefault()
            store.setActiveView('applications')
            return
        }
        return
      }

      // 以下快捷键在输入框聚焦时不响应(避免影响输入)
      if (isInputFocused) return

      switch (key) {
        case ',':
          e.preventDefault()
          store.setActiveTopTab('settings')
          return
        case '`':
          e.preventDefault()
          store.setActiveTopTab('terminal')
          return
        case 'w': {
          e.preventDefault()
          if (store.activeTabId) store.closeTab(store.activeTabId)
          return
        }
        case 'b': {
          e.preventDefault()
          // 简化:在 files 和 search 之间切换
          const next: ViewPanelType = store.activeView === 'files' ? 'search' : 'files'
          store.setActiveView(next)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
