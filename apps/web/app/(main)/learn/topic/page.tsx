'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Layers, BookOpen, Loader2, Users, Sparkles, Info } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ihui/ui-react'

type TopicType = 'lesson' | 'premium'

interface LessonTopic {
  id: string
  title: string
  coverImage?: string | null
  description?: string | null
  lessonIds?: string[]
  learnNum?: number
  sort?: number
  createdAt?: string
}

interface PremiumTopic {
  id: string
  title: string
  image?: string
  description?: string
  price?: string
  originalPrice?: string | null
  created_at?: string
}

interface UnifiedTopic {
  type: TopicType
  id: string
  title: string
  coverImage: string | null
  description: string | null
  lessonCount: number
  learnNum?: number
  price: number
  originalPrice: number | null
  createdAt: string
}

interface LessonTopicListData {
  list: LessonTopic[]
  total?: number
}
interface PremiumTopicListData {
  list: PremiumTopic[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function normalizeLessonTopic(t: LessonTopic): UnifiedTopic {
  return {
    type: 'lesson',
    id: String(t.id),
    title: t.title,
    coverImage: t.coverImage ?? null,
    description: t.description ?? null,
    lessonCount: t.lessonIds?.length ?? 0,
    learnNum: t.learnNum,
    price: 0,
    originalPrice: null,
    createdAt: t.createdAt ?? '',
  }
}

function normalizePremiumTopic(t: PremiumTopic): UnifiedTopic {
  return {
    type: 'premium',
    id: String(t.id),
    title: t.title,
    coverImage: t.image ?? null,
    description: t.description ?? null,
    lessonCount: 0,
    price: Number(t.price ?? 0),
    originalPrice: t.originalPrice ? Number(t.originalPrice) : null,
    createdAt: t.created_at ?? '',
  }
}

export default function LearnTopicPage() {
  const t = useTranslations('learn.topic')

  const lessonQ = useQuery({
    queryKey: ['learn', 'topics', 'lesson'],
    queryFn: () => api<LessonTopicListData>(`/api/topics`),
  })
  const premiumQ = useQuery({
    queryKey: ['learn', 'topics', 'premium'],
    queryFn: () => api<PremiumTopicListData>(`/api/learn/topics`),
  })

  const isLoading = lessonQ.isLoading || premiumQ.isLoading
  const error = lessonQ.error ?? premiumQ.error

  const topics: UnifiedTopic[] = React.useMemo(() => {
    const a = (lessonQ.data?.list ?? []).map(normalizeLessonTopic)
    const b = (premiumQ.data?.list ?? []).map(normalizePremiumTopic)
    const merged = [...a, ...b]
    merged.sort((x, y) => {
      const tx = x.createdAt ? Date.parse(x.createdAt) : 0
      const ty = y.createdAt ? Date.parse(y.createdAt) : 0
      if (ty !== tx) return ty - tx
      if (x.type === y.type) return 0
      return x.type === 'premium' ? -1 : 1
    })
    return merged
  }, [lessonQ.data, premiumQ.data])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Layers className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <Link
              key={`${topic.type}:${topic.id}`}
              href={`/learn/topic/${topic.id}`}
              className="group block"
            >
              <Card className="relative h-full overflow-hidden transition-colors hover:bg-accent">
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  {topic.coverImage ? (
                    <Image
                      fill
                      src={topic.coverImage}
                      alt={topic.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Layers className="h-10 w-10 text-primary/40" />
                  )}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm"
                          aria-label={t(`type.${topic.type}.label`)}
                        >
                          {topic.type === 'premium' ? (
                            <span className="inline-flex items-center gap-1 rounded-md border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              <Sparkles className="h-3 w-3" />
                              {t('type.premium.label')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300">
                              <Info className="h-3 w-3" />
                              {t('type.lesson.label')}
                            </span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-left leading-relaxed">
                        {t(`type.${topic.type}.tip`)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0 text-xs text-muted-foreground">
                  {topic.description && <p className="break-words">{topic.description}</p>}
                  <div className="flex items-center gap-3">
                    {topic.lessonCount > 0 && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {t('lessonCount', { count: topic.lessonCount })}
                      </span>
                    )}
                    {typeof topic.learnNum === 'number' && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t('learnNum', { count: topic.learnNum })}
                      </span>
                    )}
                    <span
                      className={
                        topic.price > 0
                          ? 'ml-auto font-medium text-primary'
                          : 'ml-auto text-emerald-600'
                      }
                    >
                      {topic.price > 0 ? `¥${topic.price}` : t('free')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
