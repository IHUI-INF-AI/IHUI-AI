'use client'

import * as React from 'react'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PurchaseRecord {
  id: string
  title: string
  amount?: number | string
  method?: string
  createdAt?: string
  status?: 'success' | 'pending' | 'failed'
}

export interface UserPurchaseRecordsProps {
  records?: PurchaseRecord[]
  onExport?: () => void
  className?: string
}

const STATUS_TEXT: Record<NonNullable<PurchaseRecord['status']>, string> = {
  success: '成功',
  pending: '处理中',
  failed: '失败',
}

export default function UserPurchaseRecords({
  records = [],
  onExport,
  className,
}: UserPurchaseRecordsProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">购买历史</h3>
        </div>
        {onExport && (
          <button type="button" onClick={onExport} className="text-xs text-primary hover:underline">
            导出
          </button>
        )}
      </div>
      {records.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">暂无记录</div>
      ) : (
        <ul className="divide-y">
          {records.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.method && <span>{r.method}</span>}
                  {r.createdAt && <span>{r.createdAt}</span>}
                  {r.status && <span>{STATUS_TEXT[r.status]}</span>}
                </div>
              </div>
              {r.amount !== undefined && (
                <div className="shrink-0 text-sm font-medium">¥{r.amount}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
