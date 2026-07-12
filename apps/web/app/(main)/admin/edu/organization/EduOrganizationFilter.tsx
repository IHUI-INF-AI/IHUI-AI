'use client'

import { useTranslations } from 'next-intl'
import { Plus, Download } from 'lucide-react'
import { Input, Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { OrganizationSearch } from './types'

interface Props {
  search: OrganizationSearch
  onSearchChange: (patch: Partial<OrganizationSearch>) => void
  onReset: () => void
  onCreate: () => void
  onExport: () => void
}

export function EduOrganizationFilter({
  search,
  onSearchChange,
  onReset,
  onCreate,
  onExport,
}: Props) {
  const t = useTranslations('admin.edu.organization')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('platformId')}
        value={search.platformId}
        onChange={(e) => onSearchChange({ platformId: e.target.value })}
        className="h-9 w-40"
      />
      <Input
        placeholder={t('name')}
        value={search.name}
        onChange={(e) => onSearchChange({ name: e.target.value })}
        className="h-9 w-40"
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
