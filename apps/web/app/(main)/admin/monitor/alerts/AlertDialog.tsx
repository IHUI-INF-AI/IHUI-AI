'use client'

import { Bell } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { AlertRule } from './types'

interface Props {
  rules: AlertRule[]
}

export function AlertRules({ rules }: Props) {
  if (rules.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          告警规则
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.metric} {r.operator} {r.threshold}
                </span>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                  r.enabled
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    r.enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                  )}
                />
                {r.enabled ? '启用' : '禁用'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
