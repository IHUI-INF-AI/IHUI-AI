'use client'

import { Plus, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { CoursePaySearch } from './types'

interface Props {
  q: CoursePaySearch
  onQChange: (patch: Partial<CoursePaySearch>) => void
  onReset: () => void
  onCreate: () => void
  onExport: () => void
}

export function CoursePayFilter({ q, onQChange, onReset, onCreate, onExport }: Props) {
  const t = useTranslations('admin.edu.course.pay')
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('payCrowdLabel')}
        value={q.payCrowd}
        onChange={(e) => onQChange({ payCrowd: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('creator')}
        value={q.creator}
        onChange={(e) => onQChange({ creator: e.target.value })}
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
