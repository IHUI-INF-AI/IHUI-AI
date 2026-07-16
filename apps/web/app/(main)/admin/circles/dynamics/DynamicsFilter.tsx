'use client'

import { MessageSquare, Search, RotateCcw } from 'lucide-react'
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
} from '@ihui/ui'
import type { PostFilter } from './types'

interface Props {
  filter: PostFilter
  onFilterChange: (f: PostFilter) => void
  onSearch: () => void
  onReset: () => void
}

export function DynamicsFilter({ filter, onFilterChange, onSearch, onReset }: Props) {
  const t = useTranslations('admin.circlesDynamics')
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('keywordLabel')}</Label>
          <Input
            value={filter.keyword}
            onChange={(e) => onFilterChange({ ...filter, keyword: e.target.value })}
            placeholder={t('keywordPlaceholder')}
            className="h-9 w-64"
            aria-label={t('keywordPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('statusLabel')}</Label>
          <Select
            value={filter.status}
            onValueChange={(v) => onFilterChange({ ...filter, status: v as PostFilter['status'] })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder={t('statusAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              <SelectItem value="published">{t('statusPublished')}</SelectItem>
              <SelectItem value="pending">{t('statusPending')}</SelectItem>
              <SelectItem value="rejected">{t('statusRejected')}</SelectItem>
              <SelectItem value="deleted">{t('statusDeleted')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSearch}>
            <Search className="h-4 w-4" />
            {t('search')}
          </Button>
          <Button size="sm" variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            {t('reset')}
          </Button>
        </div>
      </div>
    </div>
  )
}
