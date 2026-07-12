'use client'

import { Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardHeader, CardTitle, CardDescription } from '@ihui/ui'
import { fmt } from './helpers'
import type { TeamDetail } from './types'

export function TeamInfoCard({ team }: { team: TeamDetail }) {
  const t = useTranslations('teams')
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Crown className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl">{team.name}</CardTitle>
          <CardDescription className="mt-1">{team.description || `@${team.slug}`}</CardDescription>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>
            {t('owner')}: {team.ownerName}
          </div>
          <div className="mt-1">
            {t('createdAt')}: {fmt(team.createdAt)}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
