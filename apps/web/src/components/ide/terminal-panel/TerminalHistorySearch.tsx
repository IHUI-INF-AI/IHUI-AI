// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import type { TerminalHistoryEntry } from '@ihui/types'
import { History, X } from 'lucide-react'

interface TerminalHistorySearchProps {
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  index: number
  setIndex: React.Dispatch<React.SetStateAction<number>>
  entries: TerminalHistoryEntry[]
  allEntries: TerminalHistoryEntry[]
  onSelect: (command: string) => void
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

/** Ctrl+R 智能历史搜索(2026-07-23 立,仅活跃 pane) */
export function TerminalHistorySearch({
  query,
  setQuery,
  index,
  setIndex,
  entries,
  allEntries,
  onSelect,
  onClose,
  inputRef,
}: TerminalHistorySearchProps) {
  const t = useTranslations('ide')
  return (
    <div className="absolute left-1/2 top-2 z-30 w-96 -translate-x-1/2 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              const item = entries[index]
              if (item) onSelect(item.command)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((prev) => Math.min(prev + 1, Math.max(0, entries.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
          placeholder={t('terminalPanel.historySearchPlaceholder')}
          className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
          aria-label={t('terminalPanel.historySearchAria')}
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {entries.length > 0 ? `${index + 1}/${entries.length}` : '0/0'}
        </span>
        <Tooltip content={t('terminalPanel.closeSearchTitle')}>
          <button
            type="button"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onClose}
            aria-label={t('terminalPanel.close')}
          >
            <X className="h-3 w-3" />
          </button>
        </Tooltip>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
            {allEntries.length === 0
              ? t('terminalPanel.noHistoryHint')
              : t('terminalPanel.noMatchHistory')}
          </div>
        ) : (
          entries.map((entry, i) => (
            <button
              key={`${i}-${entry.command}`}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors',
                i === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
              )}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(entry.command)}
            >
              <code className="flex-1 truncate font-mono">{entry.command}</code>
              {entry.exitCode !== 0 && (
                <span className="shrink-0 text-[10px] text-red-500">
                  {t('terminalPanel.exitCode', { code: entry.exitCode })}
                </span>
              )}
              {entry.frequency > 1 && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  ×{entry.frequency}
                </span>
              )}
              {entry.gitBranch && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {entry.gitBranch}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
