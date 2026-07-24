'use client'

import * as React from 'react'
import { Loader2, CheckCircle2, Brain, Calendar, Flame, Gauge } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui-react'
import {
  getDueReviews,
  getReviewStats,
  submitReview,
  type ReviewQuestion,
  type ReviewStats,
  type ReviewResult,
} from '@/api/edu-api'

const QUALITY_OPTIONS: { value: number; label: string; tone: string }[] = [
  { value: 0, label: '完全忘记', tone: 'bg-destructive/10 text-destructive hover:bg-destructive/20' },
  { value: 2, label: '失败', tone: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20' },
  { value: 3, label: '勉强', tone: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' },
  { value: 4, label: '良好', tone: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' },
  { value: 5, label: '完美', tone: 'bg-primary/10 text-primary hover:bg-primary/20' },
]

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-xl font-semibold leading-none">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReviewPage() {
  const [reviews, setReviews] = React.useState<ReviewQuestion[]>([])
  const [stats, setStats] = React.useState<ReviewStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [index, setIndex] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<ReviewResult | null>(null)
  const [reviewedCount, setReviewedCount] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([getDueReviews(1, 20), getReviewStats()])
      .then(([due, st]) => {
        if (cancelled) return
        setReviews(due?.list ?? [])
        setStats(st ?? null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const current = reviews[index]

  async function handleQuality(quality: number) {
    if (!current) return
    setSubmitting(true)
    try {
      const r = await submitReview(current.id, quality)
      setResult(r)
      setRevealed(true)
      setReviewedCount((c) => c + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    setRevealed(false)
    setResult(null)
    setIndex((i) => i + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const finished = !current

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Brain className="h-7 w-7 text-primary" />
          今日复习
        </h1>
        <p className="text-sm text-muted-foreground">
          基于 SM-2 间隔重复算法,巩固长期记忆。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Brain} label="待复习" value={stats?.totalDue ?? 0} />
        <StatCard icon={CheckCircle2} label="今日已复习" value={reviewedCount} />
        <StatCard icon={Flame} label="连续天数" value={stats?.streak ?? 0} />
        <StatCard
          icon={Gauge}
          label="平均难度"
          value={stats?.avgEaseFactor?.toFixed(2) ?? '—'}
          hint="ease factor"
        />
      </div>

      {finished ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">今日复习已完成</h2>
            <p className="text-sm text-muted-foreground">
              已完成 {reviewedCount} 道题,继续保持节奏!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                第 {index + 1} / {reviews.length} 题
              </span>
              {current.subject && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {current.subject}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">题目</div>
              <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                {current.question}
              </div>
            </div>

            {!revealed ? (
              <>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">回想后自评</div>
                  <div className="flex flex-wrap gap-2">
                    {QUALITY_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleQuality(opt.value)}
                        className={`rounded-md border border-transparent px-3 text-xs font-medium ${opt.tone}`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {submitting && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    提交中…
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">答案</div>
                  <div className="rounded-lg bg-emerald-500/5 p-4 text-sm leading-relaxed">
                    {current.answer}
                  </div>
                </div>
                {current.explanation && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">解析</div>
                    <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                      {current.explanation}
                    </div>
                  </div>
                )}
                {result && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">下次复习</div>
                      <div className="mt-1 font-medium">
                        {new Intl.DateTimeFormat('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                        }).format(new Date(result.nextReview))}
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">间隔(天)</div>
                      <div className="mt-1 font-medium">{result.interval}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="text-muted-foreground">难度因子</div>
                      <div className="mt-1 font-medium">
                        {result.easeFactor.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleNext}>
                    下一题
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        复习进度:{Math.min(index + (revealed ? 1 : 0), reviews.length)} / {reviews.length}
      </div>
    </div>
  )
}
