'use client'

import { Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { selectClass } from '@/lib/edu'
import type { Category } from './types'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  categoryId: string
  onCategoryChange: (v: string) => void
  categories: Category[]
  onCreate: () => void
}

export function LearnFilter({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  onCreate,
}: Props) {
  const t = useTranslations('admin.edu.learn.index')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <div className="w-full max-w-[200px]">
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger className={selectClass} aria-label={t('category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
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
