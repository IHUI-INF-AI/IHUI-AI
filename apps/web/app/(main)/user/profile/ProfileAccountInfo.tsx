'use client'

import { useTranslations } from 'next-intl'
import { DescriptionList } from '@/components/data/DescriptionList'
import type { AuthUser } from '@/stores/auth'
import type { ProfileResponse } from './types'

interface Props {
  user: AuthUser | null
  data: ProfileResponse | undefined
}

export function ProfileAccountInfo({ user, data }: Props) {
  const t = useTranslations('user.profile')
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{t('accountInfo')}</h2>
      <DescriptionList
        column={2}
        items={[
          { label: t('userId'), value: user?.id ?? '—' },
          { label: t('nickname'), value: user?.nickname ?? '—' },
          { label: t('phone'), value: user?.phone ?? '—' },
          { label: t('email'), value: data?.user?.email ?? '—' },
          { label: t('bio'), value: data?.user?.bio || '—' },
        ]}
      />
    </div>
  )
}
