'use client'

import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchBegin: string
  setSearchBegin: (v: string) => void
  searchEnd: string
  setSearchEnd: (v: string) => void
}

export function IdentityProportionFilter({
  searchBegin,
  setSearchBegin,
  searchEnd,
  setSearchEnd,
}: Props) {
  const t = useTranslations('admin.identityProportion')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={searchBegin}
        onChange={(v) => setSearchBegin(v as string)}
        placeholder={t('beginTime')}
      />
      <DatePicker
        value={searchEnd}
        onChange={(v) => setSearchEnd(v as string)}
        placeholder={t('endTime')}
      />
    </div>
  )
}
