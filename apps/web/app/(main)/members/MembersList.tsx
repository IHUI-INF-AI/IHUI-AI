'use client'

import { Loader2, Users, ShieldCheck, ShieldAlert, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import type { MemberItem } from './types'

function StatusBadge({ status, t }: { status: number; t: (k: string) => string }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
        <ShieldCheck className="h-3 w-3" />
        {t('statusActive')}
      </span>
    )
  }
  if (status === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
        <ShieldAlert className="h-3 w-3" />
        {t('statusSealed')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
      <Clock className="h-3 w-3" />
      {t('statusPending')}
    </span>
  )
}

interface Props {
  members: MemberItem[]
  isLoading: boolean
  error: Error | null
  levelMap: Map<string, string>
}

export function MembersList({ members, isLoading, error, levelMap }: Props) {
  const t = useTranslations('members')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    )
  }
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      {members.map((member) => (
        <Card key={member.id} className="transition-colors hover:bg-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-base">
              {member.nickname ?? member.username ?? t('unnamed')}
            </CardTitle>
            <StatusBadge status={member.status} t={t} />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('username')}</p>
              <p className="break-words">{member.username ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('mobile')}</p>
              <p className="break-words">{member.mobile ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('level')}</p>
              <p className="break-words">
                {member.levelId ? (levelMap.get(member.levelId) ?? '-') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('growthValue')}</p>
              <p className="break-words">{member.growthValue}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
