'use client'

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { CompressionStats } from '@ihui/shared/context/index'

interface CompressionStatsTableProps {
  stats: CompressionStats
  className?: string
}

function fmtTime(ts: string): string {
  try {
    const d = new Date(ts)
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ts
  }
}

function ratioBadgeClass(ratio: number): string {
  if (ratio >= 0.6) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (ratio >= 0.4) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
}

function qualityClass(score: number): string {
  if (score >= 0.8) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 0.6) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function CompressionStatsTable({
  stats,
  className,
}: CompressionStatsTableProps) {
  const rows = stats.recent ?? []
  return (
    <div className={cn('rounded-md border bg-card', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">会话</TableHead>
            <TableHead className="w-[110px]">时间</TableHead>
            <TableHead className="text-right">前 Tokens</TableHead>
            <TableHead className="text-right">后 Tokens</TableHead>
            <TableHead className="text-center">压缩比</TableHead>
            <TableHead className="text-right">质量分</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                暂无压缩记录
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => {
              const cid = r.conversationId
              const short = cid.length > 12 ? `${cid.slice(0, 6)}…${cid.slice(-4)}` : cid
              return (
                <TableRow key={`${r.conversationId}-${i}`}>
                  <TableCell className="font-mono text-xs" title={cid}>
                    {short}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtTime(r.timestamp)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.beforeTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.afterTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        'inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums',
                        ratioBadgeClass(r.compressionRatio),
                      )}
                    >
                      {(r.compressionRatio * 100).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className={cn('text-right text-xs font-medium tabular-nums', qualityClass(r.qualityScore))}>
                    {(r.qualityScore * 100).toFixed(0)}%
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
