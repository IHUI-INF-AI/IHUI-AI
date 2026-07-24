'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui-react'
import { SEARCH_KEYS, FIELDS } from './helpers'

interface Props {
  search: Record<string, string>
  setSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSearch: () => void
  onReset: () => void
}

export function AboutUsFilter({ search, setSearch, onSearch, onReset }: Props) {
  const t = useTranslations('admin.aboutUs')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      {SEARCH_KEYS.map((k) => {
        const label = t(FIELDS.find((f) => f.key === k)!.label)
        return (
          <div key={k} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              className="h-9 w-40"
              value={search[k]}
              onChange={(e) => setSearch({ ...search, [k]: e.target.value })}
              placeholder={t('searchPlaceholder', { field: label })}
            />
          </div>
        )
      })}
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
