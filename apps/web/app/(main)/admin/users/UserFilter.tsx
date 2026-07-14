'use client'

import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { selectClass } from './helpers'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  role: string
  onRoleChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
}

export function UserFilter({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
}: Props) {
  const t = useTranslations('admin.users')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
          aria-label={t('search')}
        />
      </div>
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger className={selectClass} aria-label={t('role')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allRoles')}</SelectItem>
          <SelectItem value="1">{t('roleAdmin')}</SelectItem>
          <SelectItem value="0">{t('roleUser')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={selectClass} aria-label={t('status')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="1">{t('statusActive')}</SelectItem>
          <SelectItem value="0">{t('statusDisabled')}</SelectItem>
          <SelectItem value="3">{t('statusCancelled')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
