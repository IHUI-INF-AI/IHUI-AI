'use client'

import * as React from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GroupColumn {
  key: string
  name: string
  highlight?: boolean
}

export interface GroupFeatureRow {
  feature: string
  values: Record<string, boolean | string>
}

export interface GroupComparisonTableProps {
  columns?: GroupColumn[]
  rows?: GroupFeatureRow[]
  className?: string
}

const DEFAULT_COLUMNS: GroupColumn[] = [
  { key: 'free', name: '免费版' },
  { key: 'pro', name: '专业版', highlight: true },
  { key: 'enterprise', name: '企业版' },
]

const DEFAULT_ROWS: GroupFeatureRow[] = [
  { feature: 'QPS 限制', values: { free: '10', pro: '100', enterprise: '不限' } },
  { feature: '调用次数', values: { free: '1万/天', pro: '100万/天', enterprise: '不限' } },
  { feature: '技术支持', values: { free: false, pro: true, enterprise: true } },
  { feature: 'SLA 保障', values: { free: false, pro: false, enterprise: true } },
]

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-emerald-500" />
    ) : (
      <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
    )
  }
  return <span className="text-sm">{value}</span>
}

export default function GroupComparisonTable({
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
  className,
}: GroupComparisonTableProps): React.JSX.Element {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-card', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">功能</th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn('px-4 py-3 text-center font-medium', c.highlight && 'text-primary')}
              >
                {c.name}
                {c.highlight && (
                  <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    推荐
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.feature} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-left">{r.feature}</td>
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 text-center">
                  <Cell value={r.values[c.key] ?? false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
