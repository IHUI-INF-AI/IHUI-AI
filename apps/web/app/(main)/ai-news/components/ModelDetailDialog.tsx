'use client'

import * as React from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/ai-news-api'
import { CapabilityRadar } from './CapabilityRadar'

interface Props {
  entry: LeaderboardEntry
  open: boolean
  onClose: () => void
}

/** 模型详情弹窗:评分 + 核心参数 + 能力雷达图 */
export function ModelDetailDialog({ entry, open, onClose }: Props) {
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const rankDelta = entry.rankDelta
  const caps = entry.capabilities

  const paramRows = [
    { label: 'Arena 评分', value: entry.arenaScore ? `${entry.arenaScore}${entry.scoreCi ? ` ±${entry.scoreCi}` : ''}` : null },
    { label: '排名', value: entry.arenaRank ? `#${entry.arenaRank}` : null },
    { label: '排名变化', value: rankDelta !== null ? (rankDelta > 0 ? `↑${rankDelta}` : rankDelta < 0 ? `↓${Math.abs(rankDelta)}` : '持平') : null },
    { label: '胜率', value: entry.winRate ? `${entry.winRate.toFixed(1)}%` : null },
    { label: '投票数', value: entry.voteCount ? entry.voteCount.toLocaleString() : null },
    { label: '上下文窗口', value: entry.contextWindow },
    { label: '最大输出', value: entry.maxOutput },
    { label: '输入价格', value: entry.inputPrice },
    { label: '输出价格', value: entry.outputPrice },
    { label: '发布时间', value: entry.releaseDate },
    { label: 'License', value: entry.license },
  ].filter((r) => r.value)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-3 bg-muted/30 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">{entry.modelName}</h3>
              {rankDelta !== null && rankDelta > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                  <TrendingUp className="h-2.5 w-2.5" />{rankDelta}
                </span>
              ) : rankDelta !== null && rankDelta < 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                  <TrendingDown className="h-2.5 w-2.5" />{Math.abs(rankDelta)}
                </span>
              ) : rankDelta === 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Minus className="h-2.5 w-2.5" />持平
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{entry.vendor}</span>
              <span>·</span>
              <span>{entry.arenaRank ? `#${entry.arenaRank}` : '-'}</span>
              {entry.arenaScore ? (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground">{entry.arenaScore}{entry.scoreCi ? ` ±${entry.scoreCi}` : ''}</span>
                </>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          {/* 左:核心参数 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">核心参数</h4>
            <div className="space-y-1.5">
              {paramRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
            {entry.highlight ? (
              <div className="mt-3 rounded-md bg-primary/5 px-3 py-2">
                <p className="text-[10px] font-medium text-muted-foreground">核心亮点</p>
                <p className="mt-0.5 text-xs leading-relaxed">{entry.highlight}</p>
              </div>
            ) : null}
          </div>

          {/* 右:能力雷达图 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">能力雷达</h4>
            {caps ? (
              <div className="rounded-md bg-muted/20 p-3">
                <CapabilityRadar capabilities={caps} size={200} />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                暂无能力评分数据
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
