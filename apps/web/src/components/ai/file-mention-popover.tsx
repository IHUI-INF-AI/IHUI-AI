// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'

import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
// 2026-09-15 治理:定位/portal/关闭逻辑统一收敛到 PortalPanel(此前手写一套
// createPortal + 坐标 + 监听,与全项目其余浮层重复约 10 份)。
import { PortalPanel } from '@/components/feedback/portal-panel'

interface MentionFile {
  id: string
  name: string
  path: string
}

interface FileMentionPopoverProps {
  files: MentionFile[]
  open: boolean
  // 锚点元素(输入区容器):PortalPanel 以它做 fixed 定位
  anchorRef: React.RefObject<HTMLElement | null>
  onSelect: (file: MentionFile) => void
  onClose: () => void
}

export function FileMentionPopover({
  files,
  open,
  anchorRef,
  onSelect,
  onClose,
}: FileMentionPopoverProps) {
  const t = useTranslations('fileMention')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files
    return files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
  }, [files, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = filtered[activeIndex]
      if (current) {
        onSelect(current)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <PortalPanel
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      side="top"
      align="start"
      gap={8}
      testId="file-mention-popover"
      // 外观对齐全项目基准(rounded-md + border-border + bg-popover + shadow-md,与
      // slash-command-palette / Select / view-switcher 等一致);w-72 收窄避免过宽
      className="flex w-72 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
    >
      {/* 顶部搜索框(全项目统一搜索框:引用 @ihui/ui-react 共享 SearchInput,
          圆角输入井唯一视觉来源;父容器 p-1.5 留内边距) */}
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('fileSearchPlaceholder')}
        clearable
        clearAriaLabel={t('clearAriaLabel')}
        wrapperClassName="p-1.5"
      />
      <ul ref={listRef} className="max-h-60 min-h-0 flex-1 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </li>
        ) : (
          filtered.map((file, idx) => {
            const isActive = idx === activeIndex
            return (
              <li key={file.id}>
                <button
                  type="button"
                  data-idx={idx}
                  onClick={() => {
                    onSelect(file)
                    onClose()
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50',
                  )}
                >
                  {/* active 项左侧高亮条(与 slash-command-palette 同款,2px primary 色条) */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-sm bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  {/* 单行截断:文件名 + 等宽字体路径(此前 break-words 多行换行显杂乱) */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium leading-tight">{file.name}</span>
                    <span className="truncate font-mono text-[10px] leading-snug text-muted-foreground">
                      {file.path}
                    </span>
                  </div>
                </button>
              </li>
            )
          })
        )}
      </ul>
      {/* 底部快捷键提示条(与 slash-command-palette 同款:kbd 样式 + 右侧计数) */}
      <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ↑↓
          </kbd>
          {t('hintSelect')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            Enter
          </kbd>
          {t('hintConfirm')}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ESC
          </kbd>
          {t('hintClose')}
        </span>
        <span className="ml-auto text-muted-foreground/60">
          {t('hintFilesCount', { n: filtered.length })}
        </span>
      </div>
    </PortalPanel>
  )
}

export default FileMentionPopover
