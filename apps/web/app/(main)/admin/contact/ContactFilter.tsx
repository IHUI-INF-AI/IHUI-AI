'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui-react'
import { FIELDS } from './helpers'

interface Props {
  search: Record<string, string>
  setSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSearch: () => void
  onReset: () => void
}

export function ContactFilter({ search, setSearch, onSearch, onReset }: Props) {
  const t = useTranslations('adminContact')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{t(f.label)}</Label>
          <Input
            className="h-9 w-48"
            value={search[f.key]}
            onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
            placeholder={t('searchPlaceholder', { label: t(f.label) })}
          />
        </div>
      ))}
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
