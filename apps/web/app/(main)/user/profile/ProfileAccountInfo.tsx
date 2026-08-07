'use client'

import { useTranslations } from 'next-intl'
import { DescriptionList } from '@/components/data/DescriptionList'
import { TruncatedText } from '@/components/common'
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
          {
            label: t('userId'),
            value: <TruncatedText value={user?.id ?? '—'} className="block font-mono" />,
          },
          {
            label: t('nickname'),
            value: <span className="block truncate">{user?.nickname ?? '—'}</span>,
          },
          { label: t('phone'), value: <span className="whitespace-nowrap">{user?.phone ?? '—'}</span> },
          {
            label: t('email'),
            value: <TruncatedText value={data?.user?.email ?? '—'} className="block" />,
          },
          {
            label: t('bio'),
            value: (
              <span className="line-clamp-2 break-words">{data?.user?.bio || '—'}</span>
            ),
          },
        ]}
      />
    </div>
  )
}
