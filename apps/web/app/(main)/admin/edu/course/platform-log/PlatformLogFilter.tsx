'use client'

import { useTranslations } from 'next-intl'
import { Input, Button } from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { Search } from './types'

interface Props {
  q: Search
  onChange: (k: keyof Search, v: string) => void
  onReset: () => void
}

const inputCls = 'h-9 w-36'

export function PlatformLogFilter({ q, onChange, onReset }: Props) {
  const t = useTranslations('admin.edu.course.platformLog')
  return (
    <>
      <Input
        placeholder={t('platformId')}
        value={q.platformId}
        onChange={(e) => onChange('platformId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('courseId')}
        value={q.courseId}
        onChange={(e) => onChange('courseId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('videoId')}
        value={q.videoId}
        onChange={(e) => onChange('videoId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('typeLabel')}
        value={q.type}
        onChange={(e) => onChange('type', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('creator')}
        value={q.creator}
        onChange={(e) => onChange('creator', e.target.value)}
        className={inputCls}
      />
      <DatePicker
        value={q.createdAt}
        onChange={(v) => onChange('createdAt', v)}
        placeholder={t('createdAt')}
        className="w-40"
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </>
  )
}
