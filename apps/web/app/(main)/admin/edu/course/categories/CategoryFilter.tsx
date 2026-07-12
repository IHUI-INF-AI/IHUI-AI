'use client'
import Link from 'next/link'
import { Plus, Trash2, Download, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input } from '@ihui/ui'
import { PERM } from './helpers'

interface CategoryQuery {
  code: string
  name: string
  prentId: string
}

interface Props {
  q: CategoryQuery
  onQChange: (patch: Partial<CategoryQuery>) => void
  onReset: () => void
  onCreate: () => void
  onBatchDelete: () => void
  onExport: () => void
  hasSelection: boolean
}

export function CategoryFilter({
  q,
  onQChange,
  onReset,
  onCreate,
  onBatchDelete,
  onExport,
  hasSelection,
}: Props) {
  const t = useTranslations('admin.edu.course.categories')
  const inputCls = 'h-9 w-36'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/course">
          <ChevronLeft className="h-4 w-4" />
          {t('backToCourse')}
        </Link>
      </Button>
      <Input
        placeholder={t('filter.codePlaceholder')}
        value={q.code}
        onChange={(e) => onQChange({ code: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filter.namePlaceholder')}
        value={q.name}
        onChange={(e) => onQChange({ name: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filter.prentIdPlaceholder')}
        value={q.prentId}
        onChange={(e) => onQChange({ prentId: e.target.value })}
        className={inputCls}
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
      <div className="ml-auto flex gap-2">
        <HasPermi code={`${PERM}add`}>
          <Button onClick={onCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </HasPermi>
        <HasPermi code={`${PERM}remove`}>
          <Button variant="outline" size="sm" disabled={!hasSelection} onClick={onBatchDelete}>
            <Trash2 className="h-4 w-4" />
            {t('batchDelete')}
          </Button>
        </HasPermi>
        <HasPermi code={`${PERM}export`}>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            {t('export')}
          </Button>
        </HasPermi>
      </div>
    </div>
  )
}
