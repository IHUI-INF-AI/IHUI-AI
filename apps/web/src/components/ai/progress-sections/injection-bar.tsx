// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

// D34 上下文注入交代条(2026-09-22 立):把"本轮回答实际带了哪些私有上下文"显示出来。
//
// 措辞**取前端 i18n,不取后端文本**:后端帧里的 `collapsed` 是中文硬编码,直接渲染会让
// en/ja/ko 用户看到中文(且 kind 曾把"Repo Wiki"与"自动检索"挤成同一个 environments)。
// 因此本组件按 `kind` 映射本地化标签,`collapsed` 仅作为**未知 kind 的兜底文本**保留。

import * as React from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** 与 apps/ai-service `llm.py` 的 injection_frames 同源(改 kind 必须两端同时改) */
const INJECTION_KIND_KEYS: Record<string, string> = {
  developer_instructions: 'injectionKindDeveloper',
  workspace_memory: 'injectionKindWorkspace',
  repo_wiki: 'injectionKindRepoWiki',
  auto_context: 'injectionKindAutoContext',
}

export interface InjectionBarProps {
  injections: Array<{ kind: string; collapsed: string; fullText?: string; count?: number }>
  className?: string
}

/** 单条注入:标签行 + 可展开全文(没有 fullText 就不给可点的假控件) */
function InjectionRow({
  injection,
  t,
}: {
  injection: InjectionBarProps['injections'][number]
  t: ReturnType<typeof useTranslations>
}) {
  const [open, setOpen] = React.useState(false)
  const kindKey = INJECTION_KIND_KEYS[injection.kind]
  const label = kindKey
    ? injection.kind === 'auto_context'
      ? t(kindKey, { count: injection.count ?? 0 })
      : t(kindKey)
    : injection.collapsed
  const canExpand = typeof injection.fullText === 'string' && injection.fullText !== ''

  return (
    <div className="rounded-sm">
      <button
        type="button"
        onClick={() => canExpand && setOpen((v) => !v)}
        aria-expanded={canExpand ? open : undefined}
        disabled={!canExpand}
        data-testid={`injection-row-${injection.kind}`}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs',
          canExpand ? 'cursor-pointer transition-colors hover:bg-accent/40' : 'cursor-default',
        )}
      >
        {canExpand ? (
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {open && injection.fullText ? (
        <pre className="mx-1 mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {injection.fullText}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * InjectionBar —— 消息气泡内的「本轮上下文」交代条。
 *
 * 折叠只在**多于一条**时才给"展开/收起"整体开关;单条直接平铺,不制造二次折叠。
 */
export function InjectionBar({ injections, className }: InjectionBarProps) {
  const t = useTranslations('ai.pane')
  const [expanded, setExpanded] = React.useState(false)
  if (injections.length === 0) return null

  const multi = injections.length > 1
  const shown = multi && !expanded ? injections.slice(0, 1) : injections

  return (
    <div
      className={cn('mt-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-1', className)}
      data-testid="injection-bar"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={multi ? expanded : undefined}
        disabled={!multi}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs text-muted-foreground',
          multi && 'cursor-pointer transition-colors hover:bg-accent/40',
        )}
        data-testid="injection-bar-header"
      >
        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {t('injectionTitle', { count: injections.length })}
        </span>
        {multi ? (
          <span className="shrink-0 text-[11px] text-primary/80">
            {expanded
              ? t('injectionCollapse')
              : t('injectionExpand', { count: injections.length - 1 })}
          </span>
        ) : null}
      </button>
      <div className="mt-0.5">
        {shown.map((injection, i) => (
          <InjectionRow key={`${injection.kind}-${i}`} injection={injection} t={t} />
        ))}
      </div>
    </div>
  )
}
