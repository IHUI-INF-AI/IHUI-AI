'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { selectClass, TYPE_LABEL } from './helpers'

interface Props {
  tab: 'accounts' | 'flows'
  setTab: (t: 'accounts' | 'flows') => void
  flowType: string
  setFlowType: (v: string) => void
}

export function FundsTabs({ tab, setTab, flowType, setFlowType }: Props) {
  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('accounts')} className={tabCls(tab === 'accounts')}>
          账户
        </button>
        <button onClick={() => setTab('flows')} className={tabCls(tab === 'flows')}>
          流水
        </button>
      </div>
      {tab === 'flows' && (
        <Select value={flowType} onValueChange={setFlowType}>
          <SelectTrigger className={selectClass} aria-label="类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
