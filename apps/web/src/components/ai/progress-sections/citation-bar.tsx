// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useWorkPanelStore } from '@/stores/work-panel'
import { FoldableSection } from './foldable-section'
import type { CitationEntry } from '@ihui/types/ai'

interface CitationBarProps {
  citations: CitationEntry[]
}

/** W13(2026-09-13 立):引用深链分类。
 *  - '#x' 页内锚点 → 平滑滚动 + 高亮闪烁
 *  - 'http(s)://' 外链 → 新窗口(target=_blank + rel)
 *  - 其余(应用内路由/相对路径) → WorkPanel 打开(与 markdown-link 同路) */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** 页内锚点滚动 + 临时高亮(inline style,避免引入全局 CSS)。
 *  元素不存在时静默返回(锚点目标可能随渲染时序未挂载)。 */
function scrollAndHighlight(id: string): void {
  let el: HTMLElement | null = null
  try {
    el = document.getElementById(decodeURIComponent(id))
  } catch {
    el = document.getElementById(id)
  }
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const prev = el.style.boxShadow
  el.style.transition = 'box-shadow 0.6s ease'
  el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.45)'
  window.setTimeout(() => {
    el!.style.boxShadow = prev
  }, 1400)
}

/** source 类别 → 徽章配色(与 KnowledgeHit.source 对齐) */
const SOURCE_CLS: Record<string, string> = {
  codebase: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  knowledge_cards: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  rag: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  graph: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  long_term_memory: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
}

/**
 * CitationBar — 消息级引用溯源条(#11 Citations 全链路,2026-09-13 立)
 *
 * 后端 knowledge_lookup 工具执行后 done 前下发 citations SSE 事件,
 * 前端写入 ChatMessage.citations 后由 MessageItem 渲染本组件:
 * 来源徽章 + 标签 chip,携带 url 时可点击跳转(新窗口)。
 * memo:citations 引用稳定时跳过重渲染。
 */
export const CitationBar = React.memo(function CitationBar({ citations }: CitationBarProps) {
  const t = useTranslations('ai.pane')
  const openWorkPanel = useWorkPanelStore((s) => s.openPanel)
  if (citations.length === 0) return null

  /** W13:锚点点击 → 滚动高亮;非外链非锚点 → WorkPanel 内打开 */
  const handleCitationClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string): void => {
    if (url.startsWith('#')) {
      e.preventDefault()
      scrollAndHighlight(url.slice(1))
      return
    }
    if (!isExternalUrl(url)) {
      e.preventDefault()
      openWorkPanel({ url, source: 'ai-tool' })
    }
    // http(s) 外链:不拦截,默认新窗口(target=_blank)
  }

  return (
    <FoldableSection
      title={t('citationBar.title')}
      count={citations.length}
      icon={BookOpen}
      defaultOpen
      data-testid="citation-bar"
    >
      <div className="flex flex-wrap gap-1 py-0.5">
        {citations.map((c, i) => {
          const cls = SOURCE_CLS[c.source] ?? 'bg-muted text-muted-foreground'
          const chip = (
            <>
              <span className={cn('rounded-sm px-1 py-px text-[9px] font-medium', cls)}>
                {c.source}
              </span>
              <span className="truncate">{c.label}</span>
              {c.url && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
            </>
          )
          const baseCls =
            'inline-flex max-w-full items-center gap-1 rounded-sm border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/40'
          const url = c.url
          return url ? (
            <Tooltip content={url}>
              <a
                key={`${c.source}-${c.label}-${i}`}
                href={url}
                target={isExternalUrl(url) ? '_blank' : undefined}
                rel={isExternalUrl(url) ? 'noopener noreferrer' : undefined}
                onClick={(e) => handleCitationClick(e, url)}
                className={cn(baseCls, 'cursor-pointer')}
                data-testid={`citation-item-${i}`}
              >
                {chip}
              </a>
            </Tooltip>
          ) : (
            <span
              key={`${c.source}-${c.label}-${i}`}
              className={baseCls}
              data-testid={`citation-item-${i}`}
            >
              {chip}
            </span>
          )
        })}
      </div>
    </FoldableSection>
  )
})

export default CitationBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
