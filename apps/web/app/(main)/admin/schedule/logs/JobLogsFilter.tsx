'use client'

import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { JobLogSearch } from './types'

interface Props {
  search: JobLogSearch
  onSearchChange: (patch: Partial<JobLogSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function JobLogsFilter({ search, onSearchChange, onReset, onQuery }: Props) {
  const t = useTranslations('admin.scheduleLogs')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelJobName')}</Label>
        <Input
          className="h-9 w-40"
          value={search.jobName}
          onChange={(e) => onSearchChange({ jobName: e.target.value })}
          placeholder={t('placeholderJobName')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelJobGroup')}</Label>
        <Input
          className="h-9 w-40"
          value={search.jobGroup}
          onChange={(e) => onSearchChange({ jobGroup: e.target.value })}
          placeholder={t('placeholderJobGroup')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelStatus')}</Label>
        <Select
          value={search.status}
          onValueChange={(v) => onSearchChange({ status: v as JobLogSearch['status'] })}
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('statusAll')}</SelectItem>
            <SelectItem value="success">{t('statusSuccess')}</SelectItem>
            <SelectItem value="fail">{t('statusFail')}</SelectItem>
            <SelectItem value="running">{t('statusRunning')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <DatePicker
          label={t('labelStart')}
          value={search.startDate}
          onChange={(v) => onSearchChange({ startDate: v })}
        />
      </div>
      <div className="space-y-1">
        <DatePicker
          label={t('labelEnd')}
          value={search.endDate}
          min={search.startDate || undefined}
          onChange={(v) => onSearchChange({ endDate: v })}
        />
      </div>
      <Button size="sm" onClick={onQuery}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
