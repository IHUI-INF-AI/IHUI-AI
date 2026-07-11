'use client'

import * as React from 'react'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

export function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  gradient: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
            gradient,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}
