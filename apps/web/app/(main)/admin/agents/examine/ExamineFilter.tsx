'use client'

import { Input } from '@ihui/ui'

interface ExamineFilterProps {
  value: string
  onChange: (v: string) => void
}

export function ExamineFilter({ value, onChange }: ExamineFilterProps) {
  return (
    <div className="relative w-full max-w-xs">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索Agent名称"
        className="h-9"
      />
    </div>
  )
}
