// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D37 内联系统注入聚合条 + 上下文装配查看器(2026-09-24 立)。
//
// 与既有渲染的关系:D34 的 InjectionBar(apps/web components/ai/progress-sections/
// injection-bar.tsx,底座 @ihui/ui-react ContextInjectionList)只做**单条交代**,
// 多条时默认只露第一条。本组件是其**聚合增量**,不重复单条渲染的实现:
//   ① 计数徽章形态的聚合条(默认收起,折叠默认态与 D21 fold-policy 联动:
//      'expanded' 偏好全程可见 → 初始展开,'auto'/'collapsed' → 收起让位正文)
//   ② 展开后 = 上下文装配查看器:逐条 kind 本地化标签(取词口径与
//      ContextInjectionList 的 INJECTION_KIND_KEYS 同源,复用 ai.pane 既有词表键,
//      不新增第二份文案)+ fullText 可展开 + "本轮上下文来源"分组
//      (citations/steerNotices/retryNotice 等旁路型过程信息,可选 props;
//      MessageItem 处这些信息已有 CitationBar/SteerNoticeBar/RetryNoticeBar
//      专属条,故接线时不传,避免同屏重复渲染)。
//
// kind→词表键映射与后端 llm.py injection_frames 四发射点一一对应
// (developer_instructions / workspace_memory / repo_wiki / auto_context,
// 见 packages/shared/src/sse/contract.ts);未知 kind 回落后端 collapsed 兜底。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Layers } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  readFoldPolicyMode,
  type FoldPolicyMode,
} from '@/components/chat/message-list/fold-policy'

export interface ContextAssemblyInjection {
  kind: string
  collapsed: string
  fullText?: string
  count?: number
}

export interface ContextAssemblyBarProps {
  injections: readonly ContextAssemblyInjection[]
  citations?: ReadonlyArray<{ source: string; label: string; url?: string }>
  retryNotice?: { attempt: number; maxRetries: number; retryInMs: number; httpStatus?: number }
  steerNotices?: ReadonlyArray<{ phase: 'injected'; text: string }>
  className?: string
}

/** 与 packages/ui-react context-injection-list.tsx 的 INJECTION_KIND_KEYS 同源(改 kind 两处同步) */
const KIND_KEYS: Record<string, string> = {
  developer_instructions: 'injectionKindDeveloper',
  workspace_memory: 'injectionKindWorkspace',
  repo_wiki: 'injectionKindRepoWiki',
  auto_context: 'injectionKindAutoContext',
}

/**
 * 聚合条默认态与 D21 fold-policy 联动:'expanded'(全程可见偏好)→ 初始展开;
 * 'auto'/'collapsed' → 默认收起(计数徽章形态,让位正文)。纯函数可单测。
 */
export function resolveAssemblyInitialOpen(mode: FoldPolicyMode): boolean {
  return mode === 'expanded'
}

/** 装配查看器内的一条注入:kind 本地化标签 + fullText 可展开(展开控件只在有全文时给) */
function AssemblyInjectionRow({ injection }: { injection: ContextAssemblyInjection }) {
  const tPane = useTranslations('ai.pane')
  const [open, setOpen] = React.useState(false)
  const kindKey = KIND_KEYS[injection.kind]
  const label = kindKey
    ? injection.kind === 'auto_context'
      ? tPane(kindKey, { count: injection.count ?? 0 })
      : tPane(kindKey)
    : injection.collapsed
  const canExpand = typeof injection.fullText === 'string' && injection.fullText.length > 0

  return (
    <div data-testid={`assembly-injection-${injection.kind}`}>
      <button
        type="button"
        onClick={() => canExpand && setOpen((v) => !v)}
        aria-expanded={canExpand ? open : undefined}
        disabled={!canExpand}
        data-testid={`assembly-injection-row-${injection.kind}`}
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
 * D37 上下文装配聚合条:默认收起为一行计数徽章,点击展开逐条注入交代 + 来源分组。
 * 数据面(injections/citations/retryNotice/steerNotices)全部由调用方注入,本组件不取数。
 */
export function ContextAssemblyBar({
  injections,
  citations,
  retryNotice,
  steerNotices,
  className,
}: ContextAssemblyBarProps) {
  const t = useTranslations('chat')
  const [open, setOpen] = React.useState(() => resolveAssemblyInitialOpen(readFoldPolicyMode()))

  if (injections.length === 0) return null

  const hasSources =
    (citations?.length ?? 0) > 0 ||
    (steerNotices?.length ?? 0) > 0 ||
    retryNotice !== undefined

  return (
    <div
      className={cn('mt-1 rounded-md border border-border/60 bg-muted/30', className)}
      data-testid="context-assembly-bar"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="context-assembly-toggle"
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">
          {t('injectionAssemblyBadge', { count: injections.length })}
        </span>
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] leading-4 text-muted-foreground"
          data-testid="context-assembly-count"
        >
          {injections.length}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-1.5 pb-1" data-testid="context-assembly-panel">
          {injections.map((injection, i) => (
            <AssemblyInjectionRow key={`${injection.kind}-${i}`} injection={injection} />
          ))}
          {hasSources ? (
            <div
              className="mt-1 border-t border-border/40 pt-1"
              data-testid="context-assembly-sources"
            >
              <div className="px-1 pb-0.5 text-[11px] text-muted-foreground/80">
                {t('injectionAssemblySourcesTitle')}
              </div>
              {citations && citations.length > 0 ? (
                <div className="px-1 py-0.5 text-xs text-muted-foreground">
                  {t('injectionAssemblySourceCitations', { count: citations.length })}
                </div>
              ) : null}
              {steerNotices && steerNotices.length > 0 ? (
                <div className="px-1 py-0.5 text-xs text-muted-foreground">
                  {t('injectionAssemblySourceSteer', { count: steerNotices.length })}
                </div>
              ) : null}
              {retryNotice ? (
                <div className="px-1 py-0.5 text-xs text-muted-foreground">
                  {t('injectionAssemblyRetry', {
                    attempt: retryNotice.attempt,
                    max: retryNotice.maxRetries,
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
