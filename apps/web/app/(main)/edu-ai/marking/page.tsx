'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, Loader2, CheckCircle, XCircle, Lightbulb, PenLine } from 'lucide-react'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

/** 学科选项(可选,供 AI 判断评分侧重) */
const SUBJECT_OPTIONS = ['数学', '物理', '化学', '生物', '英语', '历史', '地理'] as const

interface GradeRequestPayload {
  subject?: string
  question: string
  studentAnswer: string
  referenceAnswer?: string
  maxScore: number
}

interface GradeResult {
  score: number
  comment: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  maxScore: number
  error?: string
}

function isGradeResult(value: unknown): value is GradeResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'score' in value &&
    typeof (value as GradeResult).score === 'number'
  )
}

function isDataWrapped(value: unknown): value is { data: GradeResult } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    isGradeResult((value as { data: unknown }).data)
  )
}

async function gradeAnswer(body: GradeRequestPayload, token: string | null): Promise<GradeResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${AI_SERVICE_URL}/api/ai-marking/grade`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    const message =
      typeof json === 'object' && json !== null && 'message' in json
        ? String((json as Record<string, unknown>).message)
        : undefined
    throw new Error(message ?? `AI 批改请求失败:${res.status}`)
  }
  const result = isGradeResult(json) ? json : isDataWrapped(json) ? json.data : undefined
  if (!result) {
    throw new Error('AI 批改返回格式异常')
  }
  return result
}

function SectionList({
  icon,
  iconClass,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  items: string[]
}) {
  const Icon = icon
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={`${i}-${item}`} className="flex items-start gap-2 text-sm">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function EduAiMarkingPage() {
  const t = useTranslations('eduAi.marking')
  const token = useAuthStore((s) => s.token)

  const [subject, setSubject] = React.useState('')
  const [question, setQuestion] = React.useState('')
  const [studentAnswer, setStudentAnswer] = React.useState('')
  const [referenceAnswer, setReferenceAnswer] = React.useState('')
  const [maxScore, setMaxScore] = React.useState(t('defaultMax'))

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<GradeResult | null>(null)

  const canSubmit = question.trim().length > 0 && studentAnswer.trim().length > 0 && !loading

  async function handleGrade() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const parsedMax = Number.parseInt(maxScore.trim(), 10)
      const resultData = await gradeAnswer(
        {
          subject: subject || undefined,
          question: question.trim(),
          studentAnswer: studentAnswer.trim(),
          referenceAnswer: referenceAnswer.trim() || undefined,
          maxScore: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100,
        },
        token,
      )
      if (resultData.error) {
        throw new Error(resultData.error)
      }
      setResult(resultData)
    } catch (e) {
      setError((e as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PenLine className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 min-[768px]:p-6">
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mk-subject">{t('subject')}</Label>
              <select
                id="mk-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t('subject')}</option>
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mk-max">{t('maxScore')}</Label>
              <Input
                id="mk-max"
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mk-question">{t('question')}</Label>
            <textarea
              id="mk-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('questionPlaceholder')}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mk-answer">{t('studentAnswer')}</Label>
            <textarea
              id="mk-answer"
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              placeholder={t('studentAnswerPlaceholder')}
              rows={5}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mk-reference">{t('referenceAnswer')}</Label>
            <textarea
              id="mk-reference"
              value={referenceAnswer}
              onChange={(e) => setReferenceAnswer(e.target.value)}
              placeholder={t('referenceAnswer')}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleGrade} disabled={!canSubmit}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? t('grading') : t('gradeBtn')}
            </Button>
            {error && <Alert variant="danger" description={error} className="flex-1" />}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('grading')}
        </div>
      ) : result ? (
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 p-4">
              <Sparkles className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('score')}</p>
                <p className="text-3xl font-bold tracking-tight">
                  {result.score}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    / {result.maxScore}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('comment')}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {result.comment}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
            <Card>
              <CardContent className="space-y-2 p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  {t('strengths')}
                </h3>
                <SectionList
                  icon={CheckCircle}
                  iconClass="text-emerald-600"
                  items={result.strengths}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  {t('weaknesses')}
                </h3>
                <SectionList icon={XCircle} iconClass="text-rose-600" items={result.weaknesses} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  {t('suggestions')}
                </h3>
                <SectionList
                  icon={Lightbulb}
                  iconClass="text-amber-600"
                  items={result.suggestions}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        !error && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        )
      )}
    </div>
  )
}
