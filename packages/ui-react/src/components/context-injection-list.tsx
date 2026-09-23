// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { ChevronDown, Layers } from 'lucide-react'

import { cn } from '../lib/utils'

/**
 * 本轮上下文注入交代列表(D34;第 43 轮从 apps/web 沉到共享层)。
 *
 * 为什么在共享层:`injection_applied` 是**消息级交代帧**,四端都收得到;组件内不得
 * `useTranslations`(那是 web 独占),取词函数由 props 注入 → extension / miniapp-taro
 * 等端传自己命名空间的 t 即可复用同一份呈现与无障碍口径(AGENTS §3 共享层优先)。
 *
 * 措辞纪律:`kind` 才是取词键,后端 `collapsed` 只在 kind 不认识时兜底 ——
 * 后端文本无法本地化,直接渲染会让 en/ja/ko 看到中文。
 */
export interface ContextInjectionItem {
  kind: string
  collapsed: string
  fullText?: string
  count?: number
}

export interface ContextInjectionListProps {
  injections: readonly ContextInjectionItem[]
  /** 端内取词函数(web=useTranslations('ai.pane')、extension=全路径点号键包装) */
  t: (key: string, values?: Record<string, string | number>) => string
  className?: string
}

/** 与后端 `llm.py` injection_frames 四处发射点一一对应;加 kind 必须同时加五语言词表 */
const INJECTION_KIND_KEYS: Record<string, string> = {
  developer_instructions: 'injectionKindDeveloper',
  workspace_memory: 'injectionKindWorkspace',
  repo_wiki: 'injectionKindRepoWiki',
  auto_context: 'injectionKindAutoContext',
}

function InjectionItemRow({
  injection,
  t,
}: {
  injection: ContextInjectionItem
  t: ContextInjectionListProps['t']
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

export function ContextInjectionList({ injections, t, className }: ContextInjectionListProps) {
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
          <InjectionItemRow key={`${injection.kind}-${i}`} injection={injection} t={t} />
        ))}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
