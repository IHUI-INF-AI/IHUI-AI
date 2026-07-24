'use client'

import { useTranslations } from 'next-intl'
import { Input, Button } from '@ihui/ui-react'
import type { Search } from './types'

interface Props {
  q: Search
  onChange: (k: keyof Search, v: string) => void
  onReset: () => void
}

const inputCls = 'h-9 w-36'

export function ZhsIdentityFilter({ q, onChange, onReset }: Props) {
  const t = useTranslations('admin.eduZhsIdentity')
  return (
    <>
      <Input
        placeholder="UUID"
        value={q.uuid}
        onChange={(e) => onChange('uuid', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('placeholderName')}
        value={q.name}
        onChange={(e) => onChange('name', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('placeholderPlatformId')}
        value={q.platformId}
        onChange={(e) => onChange('platformId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('placeholderOrganizationId')}
        value={q.organizationId}
        onChange={(e) => onChange('organizationId', e.target.value)}
        className={inputCls}
      />
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </>
  )
}
