'use client'

import { Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label, Card, CardContent } from '@ihui/ui'

import { selectClass } from './helpers'

interface Props {
  statusFilter: string
  setStatusFilter: (v: string) => void
  endpointFilter: string
  setEndpointFilter: (v: string) => void
}

export function ApiLogFilter({
  statusFilter,
  setStatusFilter,
  endpointFilter,
  setEndpointFilter,
}: Props) {
  const t = useTranslations('adminTools')
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('apiLogs.filterStatus')}</Label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">{t('apiLogs.allStatus')}</option>
              <option value="2xx">2xx</option>
              <option value="4xx">4xx</option>
              <option value="5xx">5xx</option>
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">{t('apiLogs.filterEndpoint')}</Label>
            <Input
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              placeholder="/api/..."
              className="h-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('all')
              setEndpointFilter('')
            }}
          >
            <Filter className="h-4 w-4" />
            {t('apiLogs.reset')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
