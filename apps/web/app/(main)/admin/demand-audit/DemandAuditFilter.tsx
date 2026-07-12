'use client'

import { Input, Label } from '@ihui/ui'
import { SEARCH_FIELDS } from './helpers'

interface DemandAuditFilterProps {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}

export function DemandAuditFilter({ value, onChange }: DemandAuditFilterProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-4">
      {SEARCH_FIELDS.map((f) => (
        <div key={f.key}>
          <Label className="text-xs">{f.label}</Label>
          <Input
            className="mt-1 h-8 text-sm"
            value={value[f.key] ?? ''}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            placeholder={f.label}
          />
        </div>
      ))}
    </div>
  )
}
