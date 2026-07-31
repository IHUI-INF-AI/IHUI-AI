'use client'

import { Search, RotateCcw } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { selectClass } from './helpers'
import type { ProductSearch } from './types'

interface Props {
  search: ProductSearch
  setSearch: (s: ProductSearch) => void
  onReset: () => void
}

export function ProductFilter({ search, setSearch, onReset }: Props) {
  const t = useTranslations('admin.shop')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.name}
          onChange={(e) => setSearch({ ...search, name: e.target.value })}
          placeholder={t('products.searchName')}
          className="h-9 pl-8"
        />
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.category}
          onChange={(e) => setSearch({ ...search, category: e.target.value })}
          placeholder={t('products.searchCategory')}
          className="h-9 pl-8"
        />
      </div>
      <Input
        value={search.type}
        onChange={(e) => setSearch({ ...search, type: e.target.value })}
        placeholder={t('products.searchType')}
        className="h-9 w-full max-w-[160px]"
      />
      <Select
        value={search.status}
        onValueChange={(v) => setSearch({ ...search, status: v === 'all' ? '' : v })}
      >
        <SelectTrigger className={cn(selectClass, 'w-[120px]')}>
          <SelectValue placeholder={t('products.statusPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('products.allStatus')}</SelectItem>
          <SelectItem value="online">{t('products.status.online')}</SelectItem>
          <SelectItem value="offline">{t('products.status.offline')}</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />
        {t('products.reset')}
      </Button>
    </div>
  )
}
