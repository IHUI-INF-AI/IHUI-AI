'use client'

import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { METHODS, inputClass } from './helpers'

interface Props {
  method: string
  onMethodChange: (v: string) => void
  statusCode: string
  onStatusCodeChange: (v: string) => void
  path: string
  onPathChange: (v: string) => void
}

export function LogFilter({
  method,
  onMethodChange,
  statusCode,
  onStatusCodeChange,
  path,
  onPathChange,
}: Props) {
  const t = useTranslations('admin.logs')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={method}
        onChange={(e) => onMethodChange(e.target.value)}
        className={inputClass}
        aria-label={t('method')}
      >
        <option value="all">{t('allMethods')}</option>
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Input
        value={statusCode}
        onChange={(e) => onStatusCodeChange(e.target.value)}
        placeholder={t('statusPlaceholder')}
        className="h-9 w-28"
        inputMode="numeric"
        aria-label={t('statusCode')}
      />
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder={t('pathPlaceholder')}
          className="h-9 pl-8"
          aria-label={t('path')}
        />
      </div>
    </div>
  )
}
