import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { Copy, ClipboardPaste, Search as SearchIcon, Columns2, Rows2, Eraser } from 'lucide-react'
import type { ContextMenuState } from './types'

interface TerminalContextMenuProps {
  state: ContextMenuState
  onCopy: () => void
  onPaste: () => void
  onSearch: () => void
  onSplit: (direction: TerminalSplitDirection) => void
  onClear: () => void
}

/** 右键菜单:复制选中 / 粘贴 / 清屏 / 搜索 / 分屏 */
export function TerminalContextMenu({
  state,
  onCopy,
  onPaste,
  onSearch,
  onSplit,
  onClear,
}: TerminalContextMenuProps) {
  const t = useTranslations('ide')
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed z-50 min-w-36 overflow-hidden rounded-md border border-border bg-popover py-0.5 shadow-md"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onCopy}
        disabled={!state.hasSelection}
      >
        <Copy className="h-3 w-3" />
        <span>{t('terminalPanel.copySelection')}</span>
        <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+C</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={onPaste}
      >
        <ClipboardPaste className="h-3 w-3" />
        <span>{t('terminalPanel.paste')}</span>
        <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+V</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={onSearch}
      >
        <SearchIcon className="h-3 w-3" />
        <span>{t('terminalPanel.search')}</span>
        <span className="ml-auto text-[10px] opacity-50">Ctrl+F</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => onSplit('vertical')}
      >
        <Columns2 className="h-3 w-3" />
        <span>{t('terminalPanel.splitVertical')}</span>
        <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+D</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => onSplit('horizontal')}
      >
        <Rows2 className="h-3 w-3" />
        <span>{t('terminalPanel.splitHorizontal')}</span>
        <span className="ml-auto text-[10px] opacity-50">Ctrl+Shift+H</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={onClear}
      >
        <Eraser className="h-3 w-3" />
        <span>{t('terminalPanel.clear')}</span>
      </button>
    </div>
  )
}
