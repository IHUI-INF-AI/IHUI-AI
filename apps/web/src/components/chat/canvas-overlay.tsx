// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Code2, Eye, History, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useCanvasStore, type CanvasVersion } from '@/stores/canvas-store'

/** 相对时间格式化(Intl.RelativeTimeFormat,遵守 locale) */
function formatRelativeTime(ts: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = Date.now() - ts
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(diffMs / 3600000)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(diffMs / 86400000)
  return rtf.format(-days, 'day')
}

interface CanvasVersionMenuProps {
  versions: CanvasVersion[]
  onRevert: (index: number) => void
}

/** 版本历史下拉:History 图标触发,列出最近版本(相对时间),点选回退 */
export function CanvasVersionMenu({ versions, onRevert }: CanvasVersionMenuProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // 点击外部关闭
  React.useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (versions.length === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={t('canvasVersions')}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t('canvasVersions')}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-full z-modal mt-1 max-h-48 w-64 overflow-y-auto rounded-sm border border-border/40 bg-popover p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {t('canvasVersions')}
          </p>
          {versions.map((v, i) => (
            <button
              key={`${v.savedAt}-${i}`}
              type="button"
              onClick={() => {
                onRevert(i)
                setOpen(false)
              }}
              title={t('canvasRevert')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted/60"
            >
              <span className="w-20 shrink-0 text-[10px] text-muted-foreground">
                {i === 0 ? t('canvasEdited') : formatRelativeTime(v.savedAt, locale)}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground/70">
                {v.content.slice(0, 60) || '—'}
              </span>
              <Check className="h-3 w-3 shrink-0 text-transparent" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type CanvasTab = 'preview' | 'code'

/** 全屏画布 overlay(P0-4):store.open 驱动,Esc / X 关闭,预览与源码编辑闭环 */
export function CanvasOverlay() {
  const t = useTranslations('chat')
  const open = useCanvasStore((s) => s.open)
  const content = useCanvasStore((s) => s.content)
  const title = useCanvasStore((s) => s.title)
  const versions = useCanvasStore((s) => s.versions)
  const closeCanvas = useCanvasStore((s) => s.closeCanvas)
  const setContent = useCanvasStore((s) => s.setContent)
  const pushVersion = useCanvasStore((s) => s.pushVersion)
  const revertToVersion = useCanvasStore((s) => s.revertToVersion)
  const [tab, setTab] = React.useState<CanvasTab>('preview')
  const [draft, setDraft] = React.useState(content)

  // 外部内容更新(AI 修改 / 版本回退)→ 同步编辑草稿
  React.useEffect(() => {
    setDraft(content)
  }, [content])

  // Esc 关闭
  React.useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCanvas()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, closeCanvas])

  if (!open) return null

  const dirty = draft !== content

  const applyEdit = () => {
    setContent(draft)
    pushVersion(draft, t('canvasEdited'))
  }

  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="max-w-[200px] truncate text-xs font-medium">
            {title || t('artifactPreview')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('preview')}
            aria-pressed={tab === 'preview'}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px]',
              tab === 'preview'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60',
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('artifactPreview')}
          </button>
          <button
            type="button"
            onClick={() => setTab('code')}
            aria-pressed={tab === 'code'}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px]',
              tab === 'code'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60',
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            {t('artifactCode')}
          </button>
          <CanvasVersionMenu versions={versions} onRevert={(i) => revertToVersion(i)} />
          {tab === 'code' && (
            <button
              type="button"
              onClick={applyEdit}
              disabled={!dirty}
              className="rounded-sm bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40"
            >
              {t('canvasApplyRefresh')}
            </button>
          )}
          <Tooltip content={t('canvasExitFullscreen')}>
            <button
              type="button"
              onClick={closeCanvas}
              aria-label={t('canvasExitFullscreen')}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {tab === 'preview' ? (
        <iframe
          title={title || 'canvas-preview'}
          sandbox="allow-scripts"
          srcDoc={content}
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="min-h-0 w-full flex-1 resize-none bg-muted/40 p-3 font-mono text-xs leading-5 outline-none"
        />
      )}
    </div>
  )
}
