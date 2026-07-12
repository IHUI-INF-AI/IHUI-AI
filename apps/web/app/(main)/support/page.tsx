'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { TicketList } from './TicketList'
import { NewTicketForm } from './NewTicketForm'

export default function SupportPage() {
  const [tab, setTab] = React.useState<'list' | 'new'>('list')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">客服中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">提交工单、查看进度与服务评价</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {(['list', 'new'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v === 'list' ? '我的工单' : '提交工单'}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'list' ? (
          <TicketList onSwitchToNew={() => setTab('new')} />
        ) : (
          <NewTicketForm onDone={() => setTab('list')} />
        )}
      </div>
    </div>
  )
}
