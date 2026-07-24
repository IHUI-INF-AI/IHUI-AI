'use client'

import { Input } from '@ihui/ui-react'
import { FIELDS } from './helpers'

interface Props {
  search: Record<string, string>
  onSearchChange: (key: string, value: string) => void
}

export function ZhsUserFilter({ search, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FIELDS.map((f) => (
        <Input
          key={f.key}
          value={search[f.key] ?? ''}
          onChange={(e) => onSearchChange(f.key, e.target.value)}
          placeholder={f.label}
          className="h-9 w-32"
        />
      ))}
    </div>
  )
}
