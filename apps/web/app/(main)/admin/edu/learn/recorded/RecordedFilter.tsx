'use client'

import Link from 'next/link'
import { Plus, Trash2, Download, ChevronLeft } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import { useTranslations } from 'next-intl'
import type { RecordedSearch } from './types'

interface Props {
  q: RecordedSearch
  onSearchChange: (q: RecordedSearch) => void
  onReset: () => void
  onCreate: () => void
  onBatchDelete: () => void
  onExport: () => void
  idsCount: number
}

export function RecordedFilter({
  q,
  onSearchChange,
  onReset,
  onCreate,
  onBatchDelete,
  onExport,
  idsCount,
}: Props) {
  const t = useTranslations('admin.edu.learn.recorded')
  const inputCls = 'h-9 w-32'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/learn">
          <ChevronLeft className="h-4 w-4" />
          {t('backToLearn')}
        </Link>
      </Button>
      <Input
        placeholder={t('filterTitle')}
        value={q.title}
        onChange={(e) => onSearchChange({ ...q, title: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filterLabel')}
        value={q.label}
        onChange={(e) => onSearchChange({ ...q, label: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filterCreator')}
        value={q.creator}
        onChange={(e) => onSearchChange({ ...q, creator: e.target.value })}
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
          <Button variant="outline" size="sm" disabled={idsCount === 0} onClick={onBatchDelete}>
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
