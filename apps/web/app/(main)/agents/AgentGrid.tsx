'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Bot, Sparkles } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@ihui/ui'
import { Grid } from '@/components/layout'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'
import type { Agent } from './types'

interface Props {
  agents: Agent[]
  isLoading: boolean
  error: unknown
}

export function AgentGrid({ agents, isLoading, error }: Props) {
  const t = useTranslations('agents')
  const locale = useLocale()
  const priceFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
        <Bot className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <Grid cols={1} smCols={2} lgCols={3} gap="md">
      {agents.map((a) => (
        <Link key={a.agentId} href={`/agents/${a.agentId}`} className="group">
          <Card className="flex h-full flex-col overflow-hidden transition-colors hover:bg-accent">
            <div className="relative h-32 w-full overflow-hidden bg-muted">
              {a.cover ? (
                <Image
                  fill
                  src={a.cover}
                  alt={a.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/40">
                  <Sparkles className="h-8 w-8" />
                </div>
              )}
            </div>
            <CardContent className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar src={a.avatar ?? undefined} name={a.name ?? 'A'} size="sm" />
                <span className="break-words font-medium">{a.name}</span>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">
                {a.description || t('noDescription')}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    a.isFree
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                      : 'bg-primary/10 text-primary',
                  )}
                >
                  {a.isFree ? t('free') : priceFmt.format(a.price)}
                </span>
                <span className="text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  {t('viewDetail')}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </Grid>
  )
}
