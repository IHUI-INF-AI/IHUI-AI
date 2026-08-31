// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { Search as SearchIcon, ChevronUp, ChevronDown, X } from 'lucide-react'
import type { SearchOptions } from './types'

interface TerminalSearchBarProps {
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  searchOpts: SearchOptions
  setSearchOpts: React.Dispatch<React.SetStateAction<SearchOptions>>
  matchIndex: number
  matchTotal: number
  searchInputRef: React.RefObject<HTMLInputElement | null>
  doSearch: (forward: boolean) => void
  clearDecorations: () => void
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
}

/** 搜索条(Ctrl+F 触发,深化:正则 + 全字 + 大小写三开关) */
export function TerminalSearchBar({
  searchTerm,
  setSearchTerm,
  searchOpts,
  setSearchOpts,
  matchIndex,
  matchTotal,
  searchInputRef,
  doSearch,
  clearDecorations,
  setSearchOpen,
}: TerminalSearchBarProps) {
  const t = useTranslations('ide')

  const handleClose = React.useCallback(() => {
    setSearchOpen(false)
    setSearchTerm('')
    clearDecorations()
  }, [setSearchOpen, setSearchTerm, clearDecorations])

  return (
    <div className="flex flex-col gap-1 bg-card px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              doSearch(!e.shiftKey)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handleClose()
            }
          }}
          placeholder={
            searchOpts.regex
              ? t('terminalPanel.searchRegexPlaceholder')
              : t('terminalPanel.searchPlaceholder')
          }
          className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-ring/50"
          aria-label={t('terminalPanel.searchAria')}
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {matchTotal > 0 ? `${matchIndex}/${matchTotal}` : '0/0'}
        </span>
        <Tooltip content={t('terminalPanel.prevMatchTitle')}>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={() => doSearch(false)}
            disabled={!searchTerm}
            aria-label={t('terminalPanel.prevMatchAria')}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip content={t('terminalPanel.nextMatchTitle')}>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={() => doSearch(true)}
            disabled={!searchTerm}
            aria-label={t('terminalPanel.nextMatchAria')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip content={t('terminalPanel.closeSearchTitle')}>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={handleClose}
            aria-label={t('terminalPanel.closeSearchAria')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
      {/* 搜索选项开关(正则 / 全字 / 大小写) */}
      <div className="flex items-center gap-1 pl-5">
        <Tooltip content={t('terminalPanel.regexModeTitle')}>
          <button
            type="button"
            className={cn(
              'flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] transition-colors',
              searchOpts.regex
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            onClick={() => setSearchOpts((p) => ({ ...p, regex: !p.regex, wholeWord: false }))}
          >
            <span>.*</span>
            <span>{t('terminalPanel.regexMode')}</span>
          </button>
        </Tooltip>
        <Tooltip content={t('terminalPanel.wholeWordTitle')}>
          <button
            type="button"
            className={cn(
              'flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] transition-colors',
              searchOpts.wholeWord
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            onClick={() => setSearchOpts((p) => ({ ...p, wholeWord: !p.wholeWord, regex: false }))}
          >
            <span>W</span>
            <span>{t('terminalPanel.wholeWord')}</span>
          </button>
        </Tooltip>
        <Tooltip content={t('terminalPanel.caseSensitiveTitle')}>
          <button
            type="button"
            className={cn(
              'flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] transition-colors',
              searchOpts.caseSensitive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            onClick={() => setSearchOpts((p) => ({ ...p, caseSensitive: !p.caseSensitive }))}
          >
            <span>Aa</span>
            <span>{t('terminalPanel.caseSensitive')}</span>
          </button>
        </Tooltip>
        {searchOpts.regex && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {t('terminalPanel.regexModeHint')}
          </span>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
