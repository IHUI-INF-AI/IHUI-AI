// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 全局快捷检索（Ctrl/Cmd + K）。
 *
 * 对照程序 SAG Wiki 的 0.2.x 有「任意界面唤起、直接搜本地知识库」的入口，
 * 本仓此前只有 /sag2 一个页面 —— 用户想知道「公司文档里有没有提过这件事」
 * 必须先想到去那个页面。本组件把这件事降到一次按键。
 *
 * 设计取舍：
 * - 只调 `/sag2/search`（离线 BM25，零模型、零延迟），**不调**多跳检索：
 *   快捷键场景要的是「立刻看到在哪」，深度多跳留给页面里的显式操作；
 * - 命中高亮由后端下发字符区间，前端只做渲染 —— 前端自己再算一遍必然与
 *   后端的 casefold 口径漂移；
 * - 无结果时显示后端给的真实原因（索引为空 / 词元无命中），不显示「暂无数据」
 *   这种把两种世界糊在一起的话。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { sag2Search, type Sag2SearchItem } from '@/api/sag2-lexical'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { Highlighted } from './highlighted'

/** 层栈 id(见 @/lib/overlay-stack):本弹层的 Esc 只在栈顶时消费 */
const GLOBAL_SEARCH_OVERLAY_ID = 'global-search-palette'

const OVERLAY_CLASS =
  'fixed inset-0 z-popover flex items-start justify-center bg-foreground/25 p-4 pt-[12vh] backdrop-blur-sm'

const PANEL_CLASS =
  'flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-elevation-xl'

const INPUT_CLASS =
  'w-full border-0 bg-transparent px-4 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground'

const ROW_CLASS =
  'flex cursor-pointer flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors'

type ExtFilter = 'all' | 'text' | 'office'

const EXT_PRESETS: Record<ExtFilter, string[] | undefined> = {
  all: undefined,
  text: ['.md', '.txt', '.rst', '.log'],
  office: ['.pdf', '.docx', '.xlsx', '.epub', '.html'],
}

export function GlobalSearchPalette() {
  const t = useTranslations('sag2Lexical')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [ext, setExt] = useState<ExtFilter>('all')
  const [items, setItems] = useState<Sag2SearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 快捷键：Ctrl/Cmd+K 切换；打开时 Esc 关闭（与项目其它遮罩的 Esc 语义一致）。
  // 监听常驻（关闭态也要能收 Ctrl+K），但 Esc 只在层栈顶时消费：
  // 与其它浮层同开时，一次 Esc 只退最上面那层，不再把全部层一起关掉。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const withMeta = event.metaKey || event.ctrlKey
      if (withMeta && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
        setOpen((value) => !value)
        return
      }
      if (event.key === 'Escape') {
        if (!isTopOverlay(GLOBAL_SEARCH_OVERLAY_ID)) return
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 层栈注册：打开时入栈，关闭/卸载时出栈（顺序与 push/pop 严格配对）。
  useEffect(() => {
    if (!open) return
    pushOverlay(GLOBAL_SEARCH_OVERLAY_ID)
    return () => popOverlay(GLOBAL_SEARCH_OVERLAY_ID)
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  // 关掉时清空，避免下次打开还挂着上一次的旧结果（旧结果配新输入最误导）。
  useEffect(() => {
    if (open) return
    setQuery('')
    setItems([])
    setTotal(0)
    setError('')
    setActive(0)
  }, [open])

  // 防抖检索：输入停顿 220ms 才发请求，连打不刷屏。
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) {
      setItems([])
      setTotal(0)
      setError('')
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = window.setTimeout(() => {
      const filters = EXT_PRESETS[ext] ? { ext: EXT_PRESETS[ext] } : undefined
      sag2Search(trimmed, 1, 20, { filters, highlight: true })
        .then((result) => {
          if (cancelled) return
          setItems(result.items ?? [])
          setTotal(result.total_files ?? 0)
          setError('')
          setActive(0)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setItems([])
          setTotal(0)
          setError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, ext, open])

  const go = useCallback(
    (item?: Sag2SearchItem) => {
      const target = item ?? items[active]
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (target) params.set('path', target.path)
      setOpen(false)
      router.push(`/sag2${params.toString() ? `?${params.toString()}` : ''}`)
    },
    [active, items, query, router],
  )

  const onPanelKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((value) => (items.length ? (value + 1) % items.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((value) => (items.length ? (value - 1 + items.length) % items.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go()
    }
  }

  if (!open) return null

  const emptyHint = error ? error : busy ? t('loading') : total === 0 ? t('globalSearchEmpty') : ''

  return (
    <div
      className={OVERLAY_CLASS}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      {/* 焦点始终在面板内的输入框，箭头/回车属于「漫游焦点」导航（combobox 模式）：
          role=dialog 无法加 tabIndex，键盘事件只能挂在面板上，故按交互容器放行。 */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={PANEL_CLASS}
        role="dialog"
        aria-modal="true"
        aria-label={t('globalSearchTitle')}
        onKeyDown={onPanelKey}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('globalSearchPlaceholder')}
            aria-label={t('globalSearchPlaceholder')}
            className={INPUT_CLASS}
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2">
          {(['all', 'text', 'office'] as ExtFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setExt(key)}
              className={`font-[weight:inherit] rounded-sm px-2 py-0.5 text-label transition-colors ${
                ext === key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t(`filter_${key}` as 'filter_all')}
            </button>
          ))}
          <span className="font-[weight:inherit] ml-auto text-label text-muted-foreground">
            {busy ? t('loading') : `${total}`}
          </span>
        </div>

        <div
          className="max-h-[52vh] overflow-y-auto p-2"
          role="listbox"
          aria-label={t('globalSearchTitle')}
        >
          {emptyHint ? (
            <p className="font-[weight:inherit] px-3 py-6 text-center text-body text-muted-foreground">
              {emptyHint}
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.path}
                type="button"
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item)}
                className={`${ROW_CLASS} w-full ${
                  index === active ? 'bg-muted' : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-body font-medium text-foreground">
                    {item.title || item.path}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {item.bm25.toFixed(2)}
                  </span>
                </div>
                <p className="font-[weight:inherit] line-clamp-2 text-label leading-relaxed text-muted-foreground">
                  <Highlighted text={item.snippet} spans={item.highlights} />
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{item.path}</p>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>{t('globalSearchHint')}</span>
          <span className="ml-auto">{t('modelCalls')}: 0</span>
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
