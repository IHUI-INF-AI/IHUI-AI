'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { inputCls } from './helpers'
import type { SearchState } from './types'

interface Props {
  search: SearchState
  onSearchChange: (patch: Partial<SearchState>) => void
  onQuery: () => void
  onReset: () => void
}

export function TaskLogFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  const t = useTranslations('admin.system')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">{t('tasksLog.filter.jobName')}</Label>
        <Input
          value={search.jobName}
          onChange={(e) => onSearchChange({ jobName: e.target.value })}
          placeholder={t('tasksLog.filter.jobNamePlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('tasksLog.filter.jobGroup')}</Label>
        <Input
          value={search.jobGroup}
          onChange={(e) => onSearchChange({ jobGroup: e.target.value })}
          placeholder={t('tasksLog.filter.jobGroupPlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('tasksLog.filter.status')}</Label>
        <Select
          value={search.status || 'all'}
          onValueChange={(v) => onSearchChange({ status: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder={t('common.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="0">{t('tasksLog.status.success')}</SelectItem>
            <SelectItem value="1">{t('tasksLog.status.failed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onQuery}>
          <Search className="h-4 w-4" />
          {t('common.search')}
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          {t('common.reset')}
        </Button>
      </div>
    </div>
  )
}
