'use client'

import { Search, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'

interface CompaniesFilterProps {
  search: string
  status: string
  onSearchChange: (v: string) => void
  onStatusChange: (v: string) => void
  onCreate: () => void
}

export function CompaniesFilter({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onCreate,
}: CompaniesFilterProps) {
  const t = useTranslations('admin.member')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="h-9 pl-8"
          aria-label={t('colName')}
        />
      </div>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-9 w-[140px]" id="company-status-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('colStatus')}</SelectItem>
          <SelectItem value="1">{t('enabled')}</SelectItem>
          <SelectItem value="0">{t('disabled')}</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
