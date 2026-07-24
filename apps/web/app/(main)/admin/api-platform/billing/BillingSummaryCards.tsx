'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/date-utils'

interface SummaryCard {
  label: string
  value: number
  icon: LucideIcon
  cls: string
}

interface Props {
  cards: SummaryCard[]
}

export function BillingSummaryCards({ cards }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', c.cls)}>
                ¥{formatCurrency(c.value / 100)}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
