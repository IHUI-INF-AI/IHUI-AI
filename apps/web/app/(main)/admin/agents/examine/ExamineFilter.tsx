'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui-react'

interface ExamineFilterProps {
  value: string
  onChange: (v: string) => void
}

export function ExamineFilter({ value, onChange }: ExamineFilterProps) {
  const t = useTranslations('admin.agents.examine')
  return (
    <div className="relative w-full max-w-xs">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchAgentPlaceholder')}
        className="h-9"
      />
    </div>
  )
}
