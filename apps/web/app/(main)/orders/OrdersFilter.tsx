'use client'

import { useTranslations } from 'next-intl'
import { LayoutGrid, Table } from 'lucide-react'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
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

export function OrdersFilter({ status, setStatus, orderType, setOrderType, view, setView }: Props) {
  const t = useTranslations('orders')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={orderType} onValueChange={setOrderType}>
        <SelectTrigger className={selectClass} aria-label={t('orderType')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_TABS.map((tab) => (
            <SelectItem key={tab.value} value={tab.value}>
              {t(`type.${tab.labelKey}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status.${tab.labelKey}`)}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
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
