// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { LayoutGrid, Table } from 'lucide-react'
import {
  CategoryBar,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  type CategoryBarItem,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { STATUS_TABS, TYPE_TABS, selectClass } from './helpers'

interface Props {
  status: string
  setStatus: (v: string) => void
  orderType: string
  setOrderType: (v: string) => void
  view: 'table' | 'card'
  setView: (v: 'table' | 'card') => void
}

const TYPE_KEY: Record<string, string> = {
  all: 'type.all',
  course: 'type.course',
  card: 'type.card',
}

const STATUS_KEY: Record<'all' | 'pending' | 'paid' | 'cancelled' | 'refunded', string> = {
  all: 'status.all',
  pending: 'status.pending',
  paid: 'status.paid',
  cancelled: 'status.cancelled',
  refunded: 'status.refunded',
}

export function OrdersFilter({ status, setStatus, orderType, setOrderType, view, setView }: Props) {
  const t = useTranslations('orders')
  const statusItems = useMemo<CategoryBarItem[]>(
    () => STATUS_TABS.map((tab) => ({ id: tab.value, label: t(STATUS_KEY[tab.labelKey]!) })),
    [t],
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={orderType} onValueChange={setOrderType}>
        <SelectTrigger className={selectClass} aria-label={t('orderType')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_TABS.map((tab) => (
            <SelectItem key={tab.value} value={tab.value}>
              {t(TYPE_KEY[tab.labelKey] ?? 'type.unknown')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CategoryBar items={statusItems} value={status} onChange={setStatus} />
      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1 rounded-lg border p-1">
        <button
          onClick={() => setView('table')}
          className={cn(
            'rounded p-1.5 transition-colors',
            view === 'table'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Table view"
        >
          <Table className="h-4 w-4" />
        </button>
        <button
          onClick={() => setView('card')}
          className={cn(
            'rounded p-1.5 transition-colors',
            view === 'card'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Card view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
