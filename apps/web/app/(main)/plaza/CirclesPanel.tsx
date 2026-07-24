'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Users, MessageSquare, Circle, Loader2, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui-react'
import type { CircleItem } from './types'

interface Props {
  isLoading: boolean
  error: unknown
  circles: CircleItem[]
}

export function CirclesPanel({ isLoading, error, circles }: Props) {
  const t = useTranslations('plaza')
  const tc = useTranslations('circles')
  return (
    <section className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : circles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Circle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tc('empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {circles.map((c) => (
              <Link key={c.id} href={`/circles/${c.id}`}>
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader className="p-4 pb-2">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Circle className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.description && (
                      <CardDescription className="text-xs">{c.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {tc('memberCount', { count: c.memberCount })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {tc('postCount', { count: c.postCount })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex justify-end">
            <Link
              href="/circles"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t('viewAllCircles')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
