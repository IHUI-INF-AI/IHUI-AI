'use client'

import * as React from 'react'
import {
  Bot,
  Brain,
  Sparkles,
  Cloud,
  Server,
  Database,
  Boxes,
  Activity,
  MousePointerClick,
  Github,
  ExternalLink,
  Wrench,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

// 10 个推荐资源,链接为占位,后续替换为真实 affiliate ID
const AFFILIATES = [
  { id: 1, icon: Bot, url: 'https://openai.com/?ref=ihui-ai' },
  { id: 2, icon: Brain, url: 'https://anthropic.com/?ref=ihui-ai' },
  { id: 3, icon: Sparkles, url: 'https://ai.google/?ref=ihui-ai' },
  { id: 4, icon: Cloud, url: 'https://vercel.com/?ref=ihui-ai' },
  { id: 5, icon: Server, url: 'https://railway.app/?ref=ihui-ai' },
  { id: 6, icon: Database, url: 'https://supabase.com/?ref=ihui-ai' },
  { id: 7, icon: Boxes, url: 'https://pinecone.io/?ref=ihui-ai' },
  { id: 8, icon: Activity, url: 'https://smith.langchain.com/?ref=ihui-ai' },
  { id: 9, icon: MousePointerClick, url: 'https://cursor.com/?ref=ihui-ai' },
  { id: 10, icon: Github, url: 'https://github.com/features/copilot/?ref=ihui-ai' },
] as const

export function AffiliatesContent(): React.JSX.Element {
  const t = useTranslations('affiliates')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <BackButton />
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          {t('heroBadge')}
        </div>
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-5xl font-bold tracking-tight">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground min-[768px]:text-lg">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* Affiliate cards */}
      <section className="mt-12 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {AFFILIATES.map(({ id, icon: Icon, url }) => (
          <Card key={id} className="flex flex-col p-4 min-[768px]:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{t(`cards.${id}.name`)}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t(`cards.${id}.desc`)}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {t('reasonLabel')}:{t(`cards.${id}.reason`)}
            </p>
            <div className="mt-6 flex flex-1 items-end">
              <Button asChild className="w-full" variant="outline">
                <a href={url} target="_blank" rel="nofollow sponsored noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('signup')}
                </a>
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {/* Disclosure */}
      <section className="mt-12 rounded-xl border bg-card p-6 text-center min-[768px]:p-8">
        <p className="mx-auto max-w-3xl text-xs leading-relaxed text-muted-foreground min-[768px]:text-sm">
          {t('disclosure')}
        </p>
      </section>
    </main>
  )
}
