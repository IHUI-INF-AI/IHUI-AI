'use client'

import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { STATUS_OPTIONS, selectClass } from './helpers'

interface Props {
  status: string
  onStatusChange: (v: string) => void
  onExport: () => void
}

export function DemandSquareFilter({ status, onStatusChange, onExport }: Props) {
  const t = useTranslations('admin.demandSquare')
  const tc = useTranslations('common')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={selectClass} aria-label={t('colStatus')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <HasPermi code="demandsquare:export">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          {tc('export')}
        </Button>
      </HasPermi>
    </div>
  )
}
