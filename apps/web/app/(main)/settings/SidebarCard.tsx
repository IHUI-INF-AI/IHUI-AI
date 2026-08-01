'use client'

import { Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'

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
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {collapsed ? t('sidebarCollapsed') : t('sidebarExpanded')}
          </span>
          <Switch checked={collapsed} onCheckedChange={onToggle} className="shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}
