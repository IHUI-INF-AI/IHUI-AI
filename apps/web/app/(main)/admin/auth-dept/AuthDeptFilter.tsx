'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui'

interface Props {
  userId: string
  onUserIdChange: (v: string) => void
  onSearch: () => void
  onReset: () => void
}

export function AuthDeptFilter({ userId, onUserIdChange, onSearch, onReset }: Props) {
  const t = useTranslations('adminAuthDept')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserId')}</Label>
        <Input
          className="h-9 w-48"
          value={userId}
          onChange={(e) => onUserIdChange(e.target.value)}
          placeholder={t('phUserId')}
        />
      </div>
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
