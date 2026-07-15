'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Layers,
  BookOpen,
  Users,
  Loader2,
  PlayCircle,
  Sparkles,
  Info,
} from 'lucide-react'
import Image from 'next/image'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ihui/ui'
import { fetchPremiumLessons, loadTopic, type TopicLesson } from '../helpers'

export default function LearnTopicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'topic', id],
    queryFn: () => loadTopic(id),
  })

  const [premiumLessons, setPremiumLessons] = React.useState<TopicLesson[]>([])

  React.useEffect(() => {
    if (data?.source === 'premium') {
      fetchPremiumLessons(id)
        .then(setPremiumLessons)
        .catch(() => setPremiumLessons([]))
    } else {
      setPremiumLessons([])
    }
  }, [data, id])

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/learn/topic')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回专题列表
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '专题不存在'}
        </div>
      </div>
    )

  const topic = data.topic
  const source = data.source
  const coverImage = topic.coverImage ?? topic.image
  const lessons = source === 'premium' ? premiumLessons : (topic.lessonList ?? topic.lessons ?? [])
  const priceNum = topic.price === undefined ? undefined : Number(topic.price)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/learn/topic"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回专题列表
      </Link>

      {/* 专题信息 */}
      <Card className="relative overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row">
          <div className="relative flex h-40 w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 md:w-64">
            {coverImage ? (
              <Image src={coverImage} alt={topic.title} fill className="rounded-lg object-cover" />
            ) : (
              <Layers className="h-12 w-12 text-primary/40" />
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm"
                    aria-label={source === 'premium' ? '高级专题' : '课程专题'}
                  >
                    {source === 'premium' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <Sparkles className="h-3 w-3" />
                        高级专题
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        <Info className="h-3 w-3" />
                        课程专题
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-left leading-relaxed">
                  {source === 'premium'
                    ? '包含企业/部门定制内容,可能涉及付费。'
                    : '由运营精选的课程组合,免费学习。'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{topic.title}</h1>
            {topic.description && (
              <p className="text-sm text-muted-foreground">{topic.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {topic.lessonIds?.length ?? lessons.length} 门课程
              </span>
              {typeof topic.learnNum === 'number' && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {topic.learnNum} 人学
                </span>
              )}
              {typeof priceNum === 'number' && (
                <span className={priceNum > 0 ? 'font-medium text-primary' : 'text-emerald-600'}>
                  {priceNum > 0 ? `￥${priceNum}` : '免费'}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 包含的课程列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">包含课程</h2>
        {lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <PlayCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无课程</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => {
              const title = lesson.title ?? lesson.name ?? ''
              const cover = lesson.coverImage ?? lesson.image ?? lesson.cover
              return (
                <Link key={lesson.id} href={`/learn/${lesson.id}`} className="group block">
                  <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
                    <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      {cover ? (
                        <Image src={cover} alt={title} fill className="object-cover" />
                      ) : (
                        <PlayCircle className="h-10 w-10 text-primary/40" />
                      )}
                    </div>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 p-4 pt-0 text-sm">
                      {lesson.instructor && (
                        <p className="text-muted-foreground">{lesson.instructor}</p>
                      )}
                      {typeof lesson.price === 'number' && (
                        <span
                          className={
                            lesson.price > 0 ? 'font-medium text-primary' : 'text-emerald-600'
                          }
                        >
                          {lesson.price > 0 ? `￥${lesson.price}` : '免费'}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
