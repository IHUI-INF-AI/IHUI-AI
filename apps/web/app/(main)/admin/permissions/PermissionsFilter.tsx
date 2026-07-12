'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { inputClass } from './helpers'

interface Props {
  keyword: string
  setKeyword: (v: string) => void
  resourceFilter: string
  setResourceFilter: (v: string) => void
  actionFilter: string
  setActionFilter: (v: string) => void
  resources: string[]
  actions: string[]
  filteredCount: number
}

export function PermissionsFilter({
  keyword,
  setKeyword,
  resourceFilter,
  setResourceFilter,
  actionFilter,
  setActionFilter,
  resources,
  actions,
  filteredCount,
}: Props) {
  const t = useTranslations('admin.permissions')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <Select value={resourceFilter} onValueChange={(v) => setResourceFilter(v)}>
        <SelectTrigger className={inputClass} aria-label={t('resource')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allResources')}</SelectItem>
          {resources.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={actionFilter} onValueChange={(v) => setActionFilter(v)}>
        <SelectTrigger className={cn(inputClass, 'w-32')} aria-label={t('action')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allActions')}</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-muted-foreground">
        {t('filteredCount', { count: filteredCount })}
      </span>
    </div>
  )
}
