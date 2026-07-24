'use client'

import { Search } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { SEARCH_FIELDS } from './helpers'

interface Props {
  search: Record<string, string>
  setSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onApply: () => void
  onReset: () => void
}

export function TaskDeveloperFilter({ search, setSearch, onApply, onReset }: Props) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
      {SEARCH_FIELDS.map((f) => (
        <Input
          key={f.key}
          placeholder={f.label}
          value={search[f.key] || ''}
          onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
          className="h-8 w-40"
        />
      ))}
      <Button size="sm" variant="outline" onClick={onApply}>
        <Search className="h-4 w-4" />
        搜索
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset}>
        重置
      </Button>
    </div>
  )
}
