'use client'

import { Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Switch } from '@/components/form'

interface Props {
  t: (k: string) => string
  collapsed: boolean
  onToggle: (v: boolean) => void
}

export function SidebarCard({ t, collapsed, onToggle }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          {t('sidebar')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {collapsed ? t('sidebarCollapsed') : t('sidebarExpanded')}
          </span>
          <Switch checked={collapsed} onChange={onToggle} />
        </div>
      </CardContent>
    </Card>
  )
}
