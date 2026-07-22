'use client'
import { useEffect } from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useInlineEditStore } from '@/stores/inline-edit'
import type { ViewPanelType } from '@ihui/types'

export function useIDEShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return

      const target = e.target as HTMLElement
      const inMonaco = !!target.closest?.('.monaco-editor')
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

      // Ctrl+K 在 Monaco 编辑器聚焦时 → 派发 inline-edit 事件
      // (use-global-shortcuts 在 monaco 场景不派发,交由本 hook 处理)
      if (key === 'k' && inMonaco) {
        // 对话框已打开时不再重复派发(避免打断输入)
        if (useInlineEditStore.getState().isOpen) return
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('global-shortcut:inline-edit'))
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
