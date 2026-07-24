'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'
import { SEARCH_FIELDS, SEARCH_DATE_FIELDS } from './helpers'
import type { FormState } from './types'

interface Props {
  search: FormState
  setSearch: React.Dispatch<React.SetStateAction<FormState>>
  onSearch: () => void
  onReset: () => void
}

export function UserMarginFilter({ search, setSearch, onSearch, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      {SEARCH_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Input
            className="h-9 w-48"
            value={search[f.key] ?? ''}
            onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
            placeholder={`搜索${f.label}`}
          />
        </div>
      ))}
      {SEARCH_DATE_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Input
            type="date"
            className="h-9 w-48"
            value={search[f.key] ?? ''}
            onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
          />
        </div>
      ))}
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        搜索
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
    </div>
  )
}
