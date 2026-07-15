'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@ihui/ui'
import { Check, Star, Award, FileText, Clock, Loader2 } from 'lucide-react'
import { CommentItem } from '@/components/business'
import { Empty } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface CourseTabData {
  id: string
  title: string
  description: string
  instructor: string
  objectives?: string[]
  level?: string
}

interface CourseTabsProps {
  course: CourseTabData
  className?: string
}

interface Comment {
  id: string
  name: string
  content: string
  time: string
  likes: number
  liked?: boolean
}
interface ApiComment {
  id: string
  content: string
  createdAt?: string
  likeCount?: number
  likedByMe?: boolean
  authorName?: string | null
  nickname?: string | null
}
interface Assignment {
  id: string
  title: string
  deadline?: string
  status?: string
  score?: number | null
}
interface Grade {
  score?: number
  totalScore?: number
  passed?: boolean
  rank?: number
}
interface Certificate {
  certificateNo?: string | null
  issuedAt?: string | null
  status?: string
}
interface Rating {
  average: number
  total: number
  distribution: number[]
}

const HOMEWORK_STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: 'statusPending', cls: 'bg-amber-500/10 text-amber-600' },
  submitted: { labelKey: 'statusSubmitted', cls: 'bg-primary/10 text-primary' },
  graded: { labelKey: 'statusGraded', cls: 'bg-emerald-500/10 text-emerald-600' },
}

const commentDateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function mapComment(c: ApiComment, anonymous: string): Comment {
  return {
    id: c.id,
    name: c.authorName ?? c.nickname ?? anonymous,
    content: c.content,
    time: c.createdAt ? commentDateFmt.format(new Date(c.createdAt)) : '',
    likes: c.likeCount ?? 0,
    liked: c.likedByMe,
  }
}

const LoadingRow = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center py-8 text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    {text}
  </div>
)

export function CourseTabs({ course, className }: CourseTabsProps) {
  const locale = useLocale()
  const t = useTranslations('course.tabs')
  const tCommon = useTranslations('common')
  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const [comments, setComments] = React.useState<Comment[]>([])
  const [homework, setHomework] = React.useState<Assignment[]>([])
  const [rating, setRating] = React.useState<Rating | null>(null)
  const [certificate, setCertificate] = React.useState<Certificate | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    const cid = course.id
    const p1 = fetchApi<{ list?: ApiComment[] }>(
      `/api/comments?topicType=course&topicId=${encodeURIComponent(cid)}`,
    )
      .then((r) => {
        const list = r.success ? r.data?.list : undefined
        if (!cancelled && list) setComments(list.map((c) => mapComment(c, t('anonymous'))))
      })
      .catch(() => {})
    const p2 = fetchApi<{ list?: Assignment[] }>(`/api/edu/courses/${cid}/assignments`)
      .then((r) => {
        const list = r.success ? r.data?.list : undefined
        if (!cancelled && list) setHomework(list)
      })
      .catch(() => {})
    const p3 = fetchApi<Grade>(`/api/edu/courses/${cid}/grade`)
      .then((r) => {
        if (cancelled || !r.success || !r.data) return
        const { score, totalScore } = r.data
        if (score && totalScore && score > 0) {
          setRating({
            average: Math.round((score / totalScore) * 5 * 10) / 10,
            total: 0,
            distribution: [],
          })
        }
      })
      .catch(() => {})
    const p4 = fetchApi<Certificate>(`/api/edu/courses/${cid}/certificate`)
      .then((r) => {
        if (!cancelled && r.success && r.data) setCertificate(r.data)
      })
      .catch(() => {})
    Promise.allSettled([p1, p2, p3, p4]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [course.id, t])

  return (
    <div className={cn('space-y-3', className)}>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="text-xs">
            {t('overview')}
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs">
            {t('comments')}
          </TabsTrigger>
          <TabsTrigger value="homework" className="text-xs">
            {t('homework')}
          </TabsTrigger>
          <TabsTrigger value="rating" className="text-xs">
            {t('rating')}
          </TabsTrigger>
          <TabsTrigger value="certificate" className="text-xs">
            {t('certificate')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('intro')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {course.description || t('noIntro')}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('instructor')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {course.instructor?.slice(0, 2) ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{course.instructor}</p>
                {course.level && <p className="text-xs text-muted-foreground">{course.level}</p>}
              </div>
            </CardContent>
          </Card>
          {course.objectives && course.objectives.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('objectives')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {course.objectives.map((obj, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{obj}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-3 space-y-3">
          {loading ? (
            <LoadingRow text={tCommon('loading')} />
          ) : comments.length === 0 ? (
            <Empty title={t('noComments')} />
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                name={c.name}
                content={c.content}
                time={c.time}
                likes={c.likes}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="homework" className="mt-3 space-y-2">
          {loading ? (
            <LoadingRow text={tCommon('loading')} />
          ) : homework.length === 0 ? (
            <Empty title={t('noHomework')} />
          ) : (
            homework.map((hw) => {
              const st = HOMEWORK_STATUS[hw.status ?? ''] ?? {
                labelKey: 'statusUnknown',
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <div
                  key={hw.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{hw.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hw.deadline && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {dateFmt.format(new Date(hw.deadline))}
                      </span>
                    )}
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', st.cls)}>
                      {t(st.labelKey)}
                    </span>
                    {hw.score !== null && hw.score !== undefined && (
                      <span className="text-xs font-medium text-primary">
                        {hw.score}
                        {t('scoreUnit')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="rating" className="mt-3">
          {loading ? (
            <LoadingRow text={tCommon('loading')} />
          ) : !rating ? (
            <Empty title={t('noRating')} />
          ) : (
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{rating.average}</p>
                  <div className="mt-1 flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-3 w-3',
                          s <= Math.round(rating.average)
                            ? 'fill-primary text-primary'
                            : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                  {rating.total > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('ratersCount', { count: rating.total })}
                    </p>
                  )}
                </div>
                {rating.total > 0 && (
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((star, i) => (
                      <div key={star} className="flex items-center gap-2">
                        <span className="w-3 text-xs text-muted-foreground">{star}</span>
                        <Star className="h-3 w-3 fill-muted-foreground text-muted-foreground" />
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${((rating.distribution[i] ?? 0) / rating.total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-muted-foreground">
                          {rating.distribution[i] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="certificate" className="mt-3">
          <Card>
            <CardContent className="space-y-3 p-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('certTitle')}</p>
              <p className="text-xs text-muted-foreground">
                {certificate?.certificateNo ? t('certAcquired') : t('certPending')}
              </p>
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">{t('certPreview')}</p>
                <p className="mt-1 text-base font-semibold text-primary">{course.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('certStudent')} · {course.instructor}
                </p>
                {certificate?.certificateNo && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('certNo', { no: certificate.certificateNo })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
