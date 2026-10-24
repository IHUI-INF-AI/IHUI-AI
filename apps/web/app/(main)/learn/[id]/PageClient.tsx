// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Clock, Users, PlayCircle, Play, Check, Loader2 } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { ProgressBar } from '@/components/common'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  title: string
  duration?: string
  videoUrl?: string | null
}
interface Chapter {
  id: string
  title: string
  sections: Section[]
}
interface LessonDetail {
  id: string
  title: string
  instructor: string
  description: string
  students: number
  price: string | number
  cover: string | null
  signedUp?: boolean
  progress?: number
}
interface SectionProgress {
  sectionId: string | null
  progress: number
  status: number
}

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('learn')
  // G-921 ①:付费小节播放链接是服务端短时签名 URL;过期/被拒时 <video> 会触发 error,
  // 必须可见(不能静默黑屏)。复用 common.loadFailed 既有五语言键,不新增文案。
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [playError, setPlayError] = useState(false)

  // 章节+小节在响应顶层(lesson 体内没有 chapters 字段),videoUrl 随小节一起下发
  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'lesson', id],
    queryFn: () =>
      apiOrThrow<{ lesson: LessonDetail; chapters: Chapter[] }>(`/api/learn/lessons/${id}`),
  })

  const { data: progressData } = useQuery({
    queryKey: ['learn', 'lesson', id, 'progress'],
    queryFn: () =>
      apiOrThrow<{ progress: number; sectionProgress: SectionProgress[] }>(
        `/api/learn/lessons/${id}/progress`,
      ),
    enabled: Boolean(data?.lesson.signedUp),
    retry: false,
  })

  const signUpMut = useMutation({
    mutationFn: () => apiOrThrow(`/api/learn/lessons/${id}/sign-up`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn', 'lesson', id] }),
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>{t('loading')}</span>
      </div>
    )

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* back-label-exempt: 箭头位已是矢量 ArrowLeft,文字是标签 until 2026-12-31 */}
        <button
          type="button"
          onClick={() => router.push('/learn')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('detail.back')}</span>
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )
  }

  const lesson = data.lesson
  const chapters = data.chapters ?? []
  const allSections = chapters.flatMap((c) => c.sections)
  const totalSections = allSections.length
  const progress = lesson.progress ?? progressData?.progress ?? 0
  const price = Number(lesson.price ?? 0)
  const completedIds = new Set(
    (progressData?.sectionProgress ?? [])
      .filter((p) => p.status === 2 && p.sectionId)
      .map((p) => p.sectionId as string),
  )
  const activeSection = allSections.find((s) => s.id === activeSectionId) ?? null

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-6xl space-y-4">
      {/* back-label-exempt: 箭头位已是矢量 ArrowLeft,文字是标签 until 2026-12-31 */}
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t('detail.back')}</span>
      </Link>

      <div className="flex flex-col gap-6 min-[1024px]:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-3">
            {activeSection?.videoUrl ? (
              /* eslint-disable-next-line jsx-a11y/media-has-caption -- 课程视频源现读只有 `videoUrl` 一个字段(无字幕轨数据),补 `<track>` 等于挂一条指向不存在资源的空轨;真出口是给课程数据加字幕轨,不是在这里凑一条 */
              <video
                key={activeSection.id}
                src={activeSection.videoUrl}
                poster={lesson.cover ?? undefined}
                controls
                playsInline
                preload="metadata"
                onError={() => setPlayError(true)}
                className="aspect-video w-full rounded-lg bg-black"
              />
            ) : lesson.cover ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {/* 封面来自课程数据(任意远程 URL,未必在 remotePatterns 白名单),显式 unoptimized 不走优化管线 */}
                <Image
                  src={lesson.cover}
                  alt={lesson.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                <PlayCircle className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            {activeSection?.videoUrl && playError && (
              <p className="text-xs text-destructive">{tc('loadFailed')}</p>
            )}
            <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              {lesson.title}
            </h1>
            <p className="text-sm text-muted-foreground">{lesson.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {lesson.instructor && (
                <span className="font-medium text-foreground">{lesson.instructor}</span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{t('signupCount', { count: lesson.students })}</span>
              </span>
              {activeSection?.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{activeSection.duration}</span>
                </span>
              )}
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('chapters')}</h2>
              <span className="text-sm text-muted-foreground">({totalSections})</span>
            </div>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <div className="space-y-2">
                {chapters.map((chapter) => (
                  <details key={chapter.id} className="group rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                      <span>{chapter.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {chapter.sections.length}
                      </span>
                    </summary>
                    <div className="space-y-1 px-4 pb-4">
                      {chapter.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setActiveSectionId(sec.id)
                            setPlayError(false)
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors',
                            activeSection?.id === sec.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-accent/50',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            {completedIds.has(sec.id) ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : sec.videoUrl ? (
                              <Play className="h-3.5 w-3.5 shrink-0" />
                            ) : null}
                            <span className="truncate">{sec.title}</span>
                          </span>
                          {sec.duration && (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{sec.duration}</span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="w-full shrink-0 min-[1024px]:w-72">
          <Card className={cn('sticky top-4 z-10')}>
            <CardHeader>
              <CardTitle className="text-2xl">{price > 0 ? formatCNY(price) : t('free')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{t('detail.studentsLabel')}</span>
                  </span>
                  <span className="text-foreground">{lesson.students}</span>
                </div>
              </div>

              {lesson.signedUp && (
                <ProgressBar value={progress} showLabel label={t('progress')} size="md" />
              )}

              {/* 付费课 → 购买确认页(buyconfirm 此前全站无入口,付费课买不了,G-978073);
                  已报名 → 开始学习(视频播放+AI 助教学习页,/learn 与 /edu/courses 同一 lessons 表);免费课 → 报名 */}
              {price > 0 && !lesson.signedUp ? (
                <Button className="w-full" size="lg" asChild>
                  <Link href={`/learn/buyconfirm?courseId=${lesson.id}`}>{t('buyNow')}</Link>
                </Button>
              ) : lesson.signedUp ? (
                <>
                  <Button className="w-full" size="lg" asChild>
                    <Link href={`/edu/courses/${lesson.id}/learn`}>{t('startLearning')}</Link>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">{t('signedUp')}</p>
                </>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={signUpMut.isPending}
                  onClick={() => signUpMut.mutate()}
                >
                  {signUpMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('signUp')}
                </Button>
              )}
              {signUpMut.isError && (
                <p className="text-xs text-destructive">{(signUpMut.error as Error)?.message}</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌﻿‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‌‌️‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
