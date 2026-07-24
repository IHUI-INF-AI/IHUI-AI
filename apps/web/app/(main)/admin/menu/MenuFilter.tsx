'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui-react'

interface Props {
  search: string
  setSearch: (v: string) => void
}

export function MenuFilter({ search, setSearch }: Props) {
  const t = useTranslations('admin.menu')
  return (
    <Input
      placeholder={t('searchPlaceholder')}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="max-w-sm"
    />
  )
}
