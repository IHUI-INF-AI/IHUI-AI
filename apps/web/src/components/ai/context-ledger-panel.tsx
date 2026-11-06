// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍‌​​‌​​‌‍‍‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​​‌​​‌‌‌‌‍‍​‌​​‌​​​‍‍‌‌‌‌‌‌​‍‍‌​‌​​​‌‍‍‌​‌‌‌‌‌‌‌​‌‌‌‍‍​‌‌‌‌‌‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌‌​‌‌‍‌‍‌​‍‍​‌​​​​‌‍‍​‌‌‌‌‌‌​‌​‌‍‍‌​​‌‌​‌‍⁠

'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatTokenCount } from '@/lib/model-context-capacity'
import { CONTEXT_LEDGER_CATEGORIES, type ContextLedgerCategory } from '@ihui/shared'
import { useContextLedger, type ContextLedgerRecord } from '@/hooks/use-chat/context-ledger'

/** 七类的展示名与颜色（按 CONTEXT_LEDGER_CATEGORIES 固定顺序取用，不另行排序）。 */
const CATEGORY_META: Record<
  ContextLedgerCategory,
  { label: string; colorClass: string; neutral?: boolean }
> = {
  system_prompt: { label: '系统提示', colorClass: 'bg-sky-500' },
  system_tools: { label: '工具定义', colorClass: 'bg-violet-500' },
  skills: { label: '技能', colorClass: 'bg-amber-500' },
  messages: { label: '消息历史', colorClass: 'bg-emerald-500' },
  other: { label: '其它', colorClass: 'bg-rose-500' },
  // 剩余空间是"未占用"的中性态，刻意不与前五类同色系，避免读成占用。
  free_space: { label: '剩余空间', colorClass: 'bg-muted-foreground/40', neutral: true },
  auto_compact: { label: '自动压缩预留', colorClass: 'bg-slate-500' },
}

/** tokenizer 口径标注：服务端直接给出的计量来源，端内不重算。 */
function tokenizerLabel(tokenizer: ContextLedgerRecord['tokenizer']): string {
  return tokenizer === 'provider_usage' ? '上游 usage' : '本地估算'
}

function categoryTokens(ledger: ContextLedgerRecord, category: ContextLedgerCategory): number {
  const found = ledger.categories.find((item) => item.category === category)
  return found ? found.tokens : 0
}

/** 一条账本的七类明细（纯展示，供单测直接渲染）。 */
export function ContextLedgerBreakdown({ ledger }: { ledger: ContextLedgerRecord }) {
  const freeSpace = categoryTokens(ledger, 'free_space')
  const autoCompact = categoryTokens(ledger, 'auto_compact')
  const usageByCategory = new Map(ledger.categories.map((item) => [item.category, item]))

  return (
    <div
      className="mt-3 rounded-md border border-border/60 bg-muted/20 p-2.5"
      data-testid="context-ledger"
    >
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
        <span className="font-medium text-foreground" data-testid="context-ledger-round">
          第 {ledger.turnIndex} 轮
        </span>
        <span className="min-w-0 truncate text-muted-foreground">{ledger.model ?? '模型未知'}</span>
        <span
          className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
          data-testid="context-ledger-tokenizer"
        >
          计量：{tokenizerLabel(ledger.tokenizer)}
        </span>
        {ledger.compacted ? (
          <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            本轮已压缩
          </span>
        ) : null}
        <span className="ml-auto shrink-0 tabular-nums text-foreground">
          {formatTokenCount(ledger.usedTokens)} / {formatTokenCount(ledger.contextLimit)}（
          {ledger.percentage}%）
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-xs bg-muted">
        {CONTEXT_LEDGER_CATEGORIES.map((category) => {
          const usage = usageByCategory.get(category)
          if (!usage || usage.tokens <= 0) return null
          return (
            <div
              key={category}
              className={cn('h-full', CATEGORY_META[category].colorClass)}
              style={{ width: `${usage.percent}%` }}
              data-testid={`context-ledger-segment-${category}`}
            />
          )
        })}
      </div>

      <div className="mt-1.5 flex flex-col gap-0.5">
        {CONTEXT_LEDGER_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category]
          const usage = usageByCategory.get(category)
          return (
            <div
              key={category}
              className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px]"
              data-testid={`context-ledger-category-${category}`}
              data-category={category}
              data-token={usage ? usage.tokens : 0}
            >
              <span
                className={cn('h-2 w-2 shrink-0 rounded-sm', meta.colorClass)}
                aria-hidden="true"
              />
              <span className={cn('min-w-0 truncate', meta.neutral && 'text-muted-foreground')}>
                {meta.label}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-foreground">
                {formatTokenCount(usage ? usage.tokens : 0)}
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                {usage ? `${usage.percent}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <p
        className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground"
        data-testid="context-ledger-identity"
      >
        已用 {formatTokenCount(ledger.usedTokens)} + 剩余 {formatTokenCount(freeSpace)} + 预留{' '}
        {formatTokenCount(autoCompact)} = 上限 {formatTokenCount(ledger.contextLimit)}
      </p>
    </div>
  )
}

interface ContextLedgerPanelProps {
  conversationId: string | null
  /** 刷新信号：每轮 usage 落定后换引用即可触发重新拉取 */
  refreshKey?: unknown
  /** 选中某轮账本时回传（主圆环据此切到该轮），回到最新时回传 null */
  onSelect?: (ledger: ContextLedgerRecord | null) => void
  /** 最新一轮服务端账本变化时回传（主圆环默认优先用服务端口径，缺账本才回退估算） */
  onLatestChange?: (ledger: ContextLedgerRecord | null) => void
}

/** 圆环明细面板里的"服务端七类账本"区：账本可得时替代客户端归因作为主视图。 */
export function ContextLedgerPanel({
  conversationId,
  refreshKey,
  onSelect,
  onLatestChange,
}: ContextLedgerPanelProps) {
  const { latest, items, loading, error, refresh } = useContextLedger(conversationId, refreshKey)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    onLatestChange?.(latest)
  }, [latest, onLatestChange])

  React.useEffect(() => {
    // 会话切换时清掉上一会话的轮次选择
    setSelectedId(null)
    onSelect?.(null)
  }, [conversationId, onSelect])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const shown = selected ?? latest

  const select = React.useCallback(
    (record: ContextLedgerRecord | null) => {
      setSelectedId(record?.id ?? null)
      onSelect?.(record)
    },
    [onSelect],
  )

  if (!conversationId) {
    return (
      <p
        className="mt-3 text-[11px] text-muted-foreground"
        data-testid="context-ledger-unavailable"
      >
        服务端账本不可得，以下为客户端估算。
      </p>
    )
  }

  if (loading && !shown) {
    return (
      <p className="mt-3 text-[11px] text-muted-foreground" data-testid="context-ledger-loading">
        正在读取服务端账本…
      </p>
    )
  }

  if (!shown) {
    return (
      <p
        className="mt-3 text-[11px] text-muted-foreground"
        data-testid="context-ledger-unavailable"
      >
        服务端账本不可得，以下为客户端估算。{error ? '（查询失败已静默处理）' : ''}
        <button
          type="button"
          onClick={refresh}
          className="ml-1 underline decoration-dotted underline-offset-2"
        >
          重试
        </button>
      </p>
    )
  }

  return (
    <div data-testid="context-ledger-panel">
      {selected ? (
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>正在回看第 {selected.turnIndex} 轮账本</span>
          <button
            type="button"
            onClick={() => select(null)}
            className="underline decoration-dotted underline-offset-2"
            data-testid="context-ledger-back-to-latest"
          >
            回到最新
          </button>
        </div>
      ) : null}

      <ContextLedgerBreakdown ledger={shown} />

      {items.length > 0 ? (
        <details className="mt-2 rounded-sm bg-muted/30 px-2 py-1.5 text-[11px]">
          <summary
            className="cursor-pointer select-none text-muted-foreground"
            data-testid="context-ledger-history-toggle"
          >
            最近 {items.length} 轮账本
          </summary>
          <div className="mt-1 flex flex-col gap-0.5">
            {items.map((item) => {
              const active = shown.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(item)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-accent',
                    active && 'bg-accent text-accent-foreground',
                  )}
                  data-testid={`context-ledger-history-row-${item.id}`}
                >
                  <span className="shrink-0 tabular-nums">第 {item.turnIndex} 轮</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {item.model ?? '模型未知'}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatTokenCount(item.usedTokens)}</span>
                  <span className="w-11 shrink-0 text-right tabular-nums">{item.percentage}%</span>
                  <span className="w-12 shrink-0 text-right text-muted-foreground">
                    {item.compacted ? '已压缩' : '未压缩'}
                  </span>
                </button>
              )
            })}
          </div>
        </details>
      ) : null}
    </div>
  )
}
