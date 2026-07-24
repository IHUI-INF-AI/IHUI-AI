'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, Users, UserPlus, ArrowRight } from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@ihui/ui-react'

import { formatDate } from '@/lib/date-utils'
import type { TeamItem } from './types'

interface Props {
  data: TeamItem[] | undefined
  isLoading: boolean
  error: Error | null
}

export function TeamList({ data, isLoading, error }: Props) {
  const t = useTranslations('teams')
  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((team) => (
            <Card
              key={team.id}
              className="flex h-full flex-col transition-colors hover:bg-accent hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription className="min-h-[2.5rem]">
                  {team.description || team.slug}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserPlus className="h-4 w-4" />
                  <span>{t('memberCount', { count: team.memberCount })}</span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatDate(team.createdAt) || '-'}
                </span>
                <Button asChild size="sm">
                  <Link href={`/teams/${team.id}`}>
                    {t('enter')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}
    </>
  )
}
