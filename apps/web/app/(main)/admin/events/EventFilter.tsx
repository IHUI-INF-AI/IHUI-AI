'use client'

import { useTranslations } from 'next-intl'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { selectClass, TYPES, LEVELS } from './helpers'
import type { EventType, Level } from './types'

interface Props {
  type: 'all' | EventType
  setType: (v: 'all' | EventType) => void
  level: 'all' | Level
  setLevel: (v: 'all' | Level) => void
}

export function EventFilter({ type, setType, level, setLevel }: Props) {
  const t = useTranslations('admin.events')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type} onValueChange={(v) => setType(v as 'all' | EventType)}>
        <SelectTrigger className={selectClass} aria-label={t('type')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allTypes')}</SelectItem>
          {TYPES.map((tp) => (
            <SelectItem key={tp} value={tp}>
              {t(`types.${tp}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={level} onValueChange={(v) => setLevel(v as 'all' | Level)}>
        <SelectTrigger className={selectClass} aria-label={t('level')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allLevels')}</SelectItem>
          {LEVELS.map((lv) => (
            <SelectItem key={lv} value={lv}>
              {t(`levels.${lv}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
