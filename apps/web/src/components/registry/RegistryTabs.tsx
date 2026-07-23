'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { RegistrySortKey } from '@ihui/types'

const TABS: Array<{ key: RegistrySortKey; label: string }> = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'best', label: '最优' },
]

export interface RegistryTabsProps {
  value: RegistrySortKey
  onChange: (key: RegistrySortKey) => void
  className?: string
}

export function RegistryTabs({ value, onChange, className }: RegistryTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as RegistrySortKey)}>
      <TabsList className={cn('bg-muted', className)}>
        {TABS.map((t) => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            className="transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
