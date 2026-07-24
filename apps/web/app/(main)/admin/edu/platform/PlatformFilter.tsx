'use client'
import { Plus, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input } from '@ihui/ui-react'
import { PERM } from './helpers'

interface PlatformQuery {
  code: string
  name: string
}

interface Props {
  q: PlatformQuery
  onQChange: (patch: Partial<PlatformQuery>) => void
  onReset: () => void
  onCreate: () => void
  onExport: () => void
}

export function PlatformFilter({ q, onQChange, onReset, onCreate, onExport }: Props) {
  const t = useTranslations('admin.edu.platform')
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('filterCode')}
        value={q.code}
        onChange={(e) => onQChange({ code: e.target.value })}
        className={inputCls}
      />
      <Input
        placeholder={t('filterName')}
        value={q.name}
        onChange={(e) => onQChange({ name: e.target.value })}
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
