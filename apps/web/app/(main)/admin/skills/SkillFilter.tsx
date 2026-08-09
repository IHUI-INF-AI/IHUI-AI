'use client'

import * as React from 'react'
import { Search, Plus, Store } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, Input } from '@ihui/ui-react'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
  onOpenMarket: () => void
}

export function SkillFilter({ search, onSearchChange, onCreate, onOpenMarket }: Props) {
  const t = useTranslations('admin.skills')

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-8"
        />
      </div>
      <Button variant="outline" size="sm" onClick={onOpenMarket}>
        <Store className="mr-1.5 h-4 w-4" />
        {t('market')}
      </Button>
      <Button size="sm" onClick={onCreate}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}