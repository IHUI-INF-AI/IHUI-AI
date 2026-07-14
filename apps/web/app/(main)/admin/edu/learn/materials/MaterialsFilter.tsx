'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import { TYPE_MAP } from './helpers'

interface Props {
  typeFilter: string
  onTypeChange: (v: string) => void
  onCreate: () => void
}

export function MaterialsFilter({ typeFilter, onTypeChange, onCreate }: Props) {
  const t = useTranslations('admin.edu.learn.materials')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/learn">
          <ChevronLeft className="h-4 w-4" />
          {t('backToLearn')}
        </Link>
      </Button>
      <div className="w-full max-w-[160px]">
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className={selectClass} aria-label={t('typeAriaLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {Object.entries(TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {t(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
