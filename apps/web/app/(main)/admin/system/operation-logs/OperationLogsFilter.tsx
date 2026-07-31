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
import { BIZ_TYPE, inputCls } from './helpers'

interface OperationLogsFilterProps {
  value: { title: string; operName: string; businessType: string }
  onChange: (v: { title: string; operName: string; businessType: string }) => void
  onSearch: () => void
  onReset: () => void
}

export function OperationLogsFilter({
  value,
  onChange,
  onSearch,
  onReset,
}: OperationLogsFilterProps) {
  const t = useTranslations('admin.system')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">{t('operationLogs.filter.module')}</Label>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder={t('operationLogs.filter.modulePlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('operationLogs.filter.operName')}</Label>
        <Input
          value={value.operName}
          onChange={(e) => onChange({ ...value, operName: e.target.value })}
          placeholder={t('operationLogs.filter.operNamePlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('operationLogs.filter.type')}</Label>
        <Select
          value={value.businessType}
          onValueChange={(v) => onChange({ ...value, businessType: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder={t('common.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {Object.entries(BIZ_TYPE).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {t(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSearch}>
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
