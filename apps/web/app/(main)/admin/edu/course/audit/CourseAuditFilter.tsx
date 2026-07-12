'use client'

import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { CourseAuditSearch } from './types'

interface Props {
  q: CourseAuditSearch
  onQChange: (patch: Partial<CourseAuditSearch>) => void
  onReset: () => void
  onExport: () => void
}

export function CourseAuditFilter({ q, onQChange, onReset, onExport }: Props) {
  const t = useTranslations('admin.edu.course.audit')
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('filter.operatePlaceholder')}
        value={q.operate}
        onChange={(e) => onQChange({ operate: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filter.sourceIdPlaceholder')}
        value={q.sourceId}
        onChange={(e) => onQChange({ sourceId: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filter.creatorPlaceholder')}
        value={q.creator}
        onChange={(e) => onQChange({ creator: e.target.value })}
        className={inputCls}
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
      <div className="ml-auto">
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
