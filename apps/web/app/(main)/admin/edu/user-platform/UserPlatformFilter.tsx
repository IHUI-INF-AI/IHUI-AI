'use client'

import { useTranslations } from 'next-intl'
import {
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import type { SearchQ } from './types'

interface Props {
  q: SearchQ
  set: (k: keyof SearchQ, v: string) => void
  onReset: () => void
}

export function UserPlatformFilter({ q, set, onReset }: Props) {
  const t = useTranslations('admin.eduUserPlatform')
  const inputCls = 'h-9 w-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t('placeholderUserUuid')}
        value={q.userUuid}
        onChange={(e) => set('userUuid', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('placeholderPlatformId')}
        value={q.platformId}
        onChange={(e) => set('platformId', e.target.value)}
        className={inputCls}
      />
      <Input
        placeholder={t('placeholderIdentityId')}
        value={q.identityId}
        onChange={(e) => set('identityId', e.target.value)}
        className={inputCls}
      />
      <Select value={q.status || 'all'} onValueChange={(v) => set('status', v === 'all' ? '' : v)}>
        <SelectTrigger className={cn(selectClass, 'w-32')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="0">{t('statusNormal')}</SelectItem>
          <SelectItem value="1">{t('statusDisabled')}</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
