// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Crown, GitCompareArrows, Trophy } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useBestOfStore } from '@/stores/best-of'
import type { BestOfCandidate } from '@/api/best-of-api'

/**
 * BestOfCompare — Best-of-N 候选并排对比视图(W23,2026-09-14 立)。
 *
 * 数据源:useBestOfStore(由 /bestof 斜杠命令写入)。
 * - N 个候选并排卡片:编号/评分/模型/耗时/状态 + 内容预览
 * - 点击卡片改选候选(默认选中后端 winner);非选中卡片可切换「对比」模式,
 *   以行级 diff(新增绿/删除红)显示与选中候选的差异
 * - 「落盘」:把选中候选内容经 onAdopt 交给宿主(工具面板 → 写入会话消息)
 */

/** 最小行级 LCS diff:返回与 base 相比的变化行(仅够展示用,不追求最优编辑脚本) */
function diffLines(
  base: string,
  target: string,
): Array<{ type: 'same' | 'add' | 'del'; text: string }> {
  const a = base.split('\n')
  const b = target.split('\n')
  const m = a.length
  const n = b.length
  // LCS 长度表(行数有限,cap 防御极端长文本)
  if (m * n > 250_000) {
    return b.map((text) => ({ type: 'same' as const, text }))
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    const rowI = dp[i] ?? []
    const rowI1 = dp[i + 1] ?? []
    for (let j = n - 1; j >= 0; j--) {
      rowI[j] = a[i] === b[j] ? (rowI1[j + 1] ?? 0) + 1 : Math.max(rowI1[j] ?? 0, rowI[j + 1] ?? 0)
    }
  }
  const out: Array<{ type: 'same' | 'add' | 'del'; text: string }> = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    const av = a[i] ?? ''
    const bv = b[j] ?? ''
    if (av === bv) {
      out.push({ type: 'same', text: bv })
      i++
      j++
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ type: 'del', text: av })
      i++
    } else {
      out.push({ type: 'add', text: bv })
      j++
    }
  }
  while (i < m) {
    out.push({ type: 'del', text: a[i] ?? '' })
    i++
  }
  while (j < n) {
    out.push({ type: 'add', text: b[j] ?? '' })
    j++
  }
  return out
}

export interface BestOfCompareProps {
  /** 落盘回调:宿主决定选中内容如何持久化(如写入会话 assistant 消息) */
  onAdopt?: (content: string, candidateId: number) => void
  /** P3 #36(2026-09-16 立):按 runId 从 results 映射取数(消息流内对比卡用);
   *  不传 = 读最近一次结果(工具面板单卡视图,既有行为)。runId 无匹配时回退。 */
  runId?: string
}

export function BestOfCompare({ onAdopt, runId }: BestOfCompareProps) {
  const t = useTranslations('bestOfCompare')
  const task = useBestOfStore((s) => s.task)
  const latestResult = useBestOfStore((s) => s.result)
  const selectedId = useBestOfStore((s) => s.selectedId)
  const setSelected = useBestOfStore((s) => s.setSelected)
  const clear = useBestOfStore((s) => s.clear)
  // P3 #36:runId 指定时读映射(消息流卡与工具面板卡互不干扰),无匹配回退最近一次
  const runTask = useBestOfStore((s) => (runId ? s.tasks[runId] : undefined))
  const runResult = useBestOfStore((s) => (runId ? s.results[runId] : undefined))
  const result = runId ? (runResult ?? latestResult) : latestResult
  const displayTask = runId ? (runTask ?? task) : task

  const [diffMode, setDiffMode] = React.useState(false)
  const [adoptedId, setAdoptedId] = React.useState<number | null>(null)

  const candidates = React.useMemo(
    () => (result?.candidates ?? []).slice().sort((x, y) => x.candidate_id - y.candidate_id),
    [result],
  )

  const selected: BestOfCandidate | null = React.useMemo(() => {
    if (!result) return null
    const byId = candidates.find((c) => c.candidate_id === selectedId)
    return byId ?? result.winner
  }, [result, candidates, selectedId])

  if (!result || candidates.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
  }

  const handleAdopt = () => {
    if (!selected || !selected.ok) return
    setAdoptedId(selected.candidate_id)
    onAdopt?.(selected.content, selected.candidate_id)
  }

  return (
    <div className="space-y-3" data-testid="best-of-compare">
      {/* 运行概览 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
        <span>
          {t('meta', {
            n: result.nRequested,
            evaluator: result.evaluatorFallback ? t('evaluatorFallback') : result.evaluatorModel,
            cost: result.totalCostUsd.toFixed(4),
          })}
        </span>
        <span className="flex-1" />
        {candidates.length > 1 && (
          <button
            type="button"
            data-testid="best-of-diff-toggle"
            onClick={() => setDiffMode((v) => !v)}
            className={cn(
              'flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors',
              diffMode ? 'bg-cta text-cta-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <GitCompareArrows className="h-3 w-3" />
            {t('diffToggle')}
          </button>
        )}
        <button
          type="button"
          data-testid="best-of-clear"
          onClick={() => {
            clear()
            setAdoptedId(null)
          }}
          className="rounded-md px-2 py-0.5 text-muted-foreground transition-colors hover:bg-accent"
        >
          {t('clear')}
        </button>
      </div>
      {displayTask && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t('task', { task: displayTask })}
        </p>
      )}
      {result.rationale && (
        <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          📌 {t('rationale')}: {result.rationale}
        </p>
      )}

      {/* 候选并排卡片 */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2" data-testid="best-of-candidates">
        {candidates.map((c) => {
          const isSelected = selected?.candidate_id === c.candidate_id
          const isWinner = result.winner.candidate_id === c.candidate_id
          return (
            <button
              key={c.candidate_id}
              type="button"
              data-testid={`best-of-candidate-${c.candidate_id}`}
              onClick={() => setSelected(c.candidate_id)}
              className={cn(
                'flex min-w-0 flex-col rounded-lg border p-2.5 text-left transition-colors',
                isSelected ? 'border-brand-accent-deep bg-primary/5' : 'hover:bg-accent/40',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold">#{c.candidate_id}</span>
                {isWinner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                {c.ok ? (
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      c.score !== null && c.score >= 80
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : c.score !== null && c.score < 60
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {c.score !== null ? `${t('score')} ${c.score}` : t('noScore')}
                  </span>
                ) : (
                  <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    {t('failed')}
                  </span>
                )}
                <span className="flex-1" />
                <span className="text-[10px] text-muted-foreground">
                  {c.model || '—'} · {c.latency_ms}ms
                </span>
              </div>
              {!c.ok ? (
                <p className="mt-1.5 line-clamp-3 text-xs text-destructive">{c.error}</p>
              ) : diffMode && selected && !isSelected ? (
                <pre
                  className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed"
                  data-testid={`best-of-diff-${c.candidate_id}`}
                >
                  {diffLines(selected.content, c.content)
                    .slice(0, 200)
                    .map((d, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'block',
                          d.type === 'add' &&
                            'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                          d.type === 'del' && 'bg-destructive/10 text-destructive line-through',
                        )}
                      >
                        {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}
                        {d.text}
                      </span>
                    ))}
                </pre>
              ) : (
                <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-xs text-foreground/90">
                  {c.content}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* 落盘动作条 */}
      {onAdopt && selected?.ok && (
        <div className="flex items-center gap-2" data-testid="best-of-adopt-bar">
          <Button
            size="sm"
            variant={adoptedId === selected.candidate_id ? 'outline' : 'default'}
            disabled={adoptedId === selected.candidate_id}
            onClick={handleAdopt}
            data-testid="best-of-adopt"
          >
            {adoptedId === selected.candidate_id ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {t('adopted')}
              </>
            ) : (
              t('adopt')
            )}
          </Button>
          <span className="text-xs text-muted-foreground">{t('adoptHint')}</span>
        </div>
      )}
    </div>
  )
}

export default BestOfCompare
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
