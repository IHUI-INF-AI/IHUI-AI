// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, BookOpen, Braces, Copy, Sparkles, Trash2 } from 'lucide-react'

import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import {
  extractWikiDraft,
  useRepoWikiStore,
  WIKI_CATEGORIES,
  wikiToMarkdown,
  type WikiCategory,
} from '@/stores/repo-wiki'

/**
 * RepoWikiPanel — Repo Wiki / 知识卡片面板(W29,2026-09-14 立,对标 Qoder Repo Wiki)。
 *
 * - 类目 tab(architecture/api/pattern/pitfall)+ 搜索过滤
 * - 卡片列表(标题 + 正文 + 删除)
 * - 「生成卡片」按钮:对最近一轮问答手动触发 LLM 提取(与自动捕获同路径)
 * - 「自动捕获」开关:开启后消息收尾自动提取知识卡片
 * - 「导出 Markdown」:全部卡片复制到剪贴板
 */

const CATEGORY_ICON: Record<WikiCategory, React.ComponentType<{ className?: string }>> = {
  architecture: BookOpen,
  api: Braces,
  pattern: Sparkles,
  pitfall: AlertTriangle,
}

export function RepoWikiPanel() {
  const t = useTranslations('repoWiki')
  const cards = useRepoWikiStore((s) => s.cards)
  const autoCapture = useRepoWikiStore((s) => s.autoCapture)
  const add = useRepoWikiStore((s) => s.add)
  const remove = useRepoWikiStore((s) => s.remove)
  const toggleAutoCapture = useRepoWikiStore((s) => s.toggleAutoCapture)

  const [active, setActive] = React.useState<WikiCategory>('architecture')
  const [query, setQuery] = React.useState('')
  const [generating, setGenerating] = React.useState(false)

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards.filter((c) => {
      if (c.category !== active) return false
      if (!q) return true
      return c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q)
    })
  }, [cards, active, query])

  /** 最近一轮问答(最后一条 assistant + 其前最近一条 user) */
  const lastExchange = React.useMemo(() => {
    const messages = useChatStore.getState().messages
    let answer: string | null = null
    let question: string | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (!m || m.error) continue
      if (!answer && m.role === 'assistant') {
        answer = typeof m.content === 'string' ? m.content : ''
        continue
      }
      if (answer && m.role === 'user') {
        question = typeof m.content === 'string' ? m.content : ''
        break
      }
    }
    if (!answer || !question) return null
    return { question, answer }
  }, [])

  const handleGenerate = async () => {
    if (generating) return
    if (!lastExchange) {
      toast.warning(t('noExchange'))
      return
    }
    setGenerating(true)
    try {
      const draft = await extractWikiDraft(lastExchange.question, lastExchange.answer)
      if (!draft) {
        toast.info(t('nothingToCapture'))
        return
      }
      add(draft.category, draft.title, draft.content)
      toast.success(t('generated'))
    } catch (e) {
      toast.error(t('generateFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async () => {
    if (cards.length === 0) return
    try {
      await navigator.clipboard.writeText(wikiToMarkdown(cards))
      toast.success(t('exported'))
    } catch {
      toast.error(t('exportFailed'))
    }
  }

  return (
    <div data-testid="repo-wiki-panel" className="space-y-3 text-sm">
      {/* 类目 tab */}
      <div className="flex gap-1" role="tablist" aria-label={t('title')}>
        {WIKI_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON[cat]
          const count = cards.filter((c) => c.category === cat).length
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active === cat}
              data-testid={`wiki-tab-${cat}`}
              onClick={() => setActive(cat)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                active === cat
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {t(cat)}
              {count > 0 && (
                <span className="rounded-md bg-muted px-1 text-[10px] text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 搜索 */}
      <input
        data-testid="wiki-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
      />

      {/* 卡片列表 */}
      <div data-testid="wiki-card-list" className="space-y-1.5">
        {items.length === 0 ? (
          <p
            data-testid="wiki-empty"
            className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
          >
            {t('empty')}
          </p>
        ) : (
          items.map((c, i) => (
            <div
              key={c.id}
              data-testid={`wiki-card-${i}`}
              className="rounded-md border px-2 py-1.5 text-xs"
            >
              <div className="flex items-start gap-1.5">
                <span className="min-w-0 flex-1 break-words font-medium">{c.title}</span>
                <button
                  type="button"
                  data-testid={`wiki-card-remove-${i}`}
                  aria-label={t('remove')}
                  onClick={() => remove(c.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                {c.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 操作区:生成 / 自动捕获 / 导出 / 清空 */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="wiki-generate"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {generating ? t('generating') : t('generate')}
        </button>
        <button
          type="button"
          data-testid="wiki-auto-toggle"
          onClick={toggleAutoCapture}
          aria-pressed={autoCapture}
          className={cn(
            'flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent',
            autoCapture && 'bg-accent font-medium text-accent-foreground',
          )}
        >
          <BookOpen className="h-3 w-3" />
          {autoCapture ? t('autoOn') : t('autoOff')}
        </button>
        <button
          type="button"
          data-testid="wiki-export"
          onClick={() => void handleExport()}
          disabled={cards.length === 0}
          className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy className="h-3 w-3" />
          {t('export')}
        </button>
        <button
          type="button"
          data-testid="wiki-clear"
          onClick={() => useRepoWikiStore.getState().clear()}
          disabled={cards.length === 0}
          className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          {t('clear')}
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
