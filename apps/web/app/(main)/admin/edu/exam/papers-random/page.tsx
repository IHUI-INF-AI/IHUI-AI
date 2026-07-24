'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, Shuffle, Wand2 } from 'lucide-react'
import { eduApi, selectClass } from '@/lib/edu'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
} from '@ihui/ui-react'

interface Paper {
  id: string
  title: string
  isPublished: boolean
}

interface RandForm {
  paperId: string
  singleCount: string
  multiCount: string
  judgmentCount: string
  fillCount: string
  subjectiveCount: string
  scorePerQuestion: string
}
const EMPTY: RandForm = {
  paperId: '',
  singleCount: '5',
  multiCount: '3',
  judgmentCount: '5',
  fillCount: '3',
  subjectiveCount: '2',
  scorePerQuestion: '5',
}

export default function EduExamPapersRandomPage() {
  const t = useTranslations('admin.edu.exam.papersRandom')
  const qc = useQueryClient()
  const [form, setForm] = React.useState<RandForm>(EMPTY)
  const [result, setResult] = React.useState<string | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        paperId: form.paperId,
        scorePerQuestion: Number(form.scorePerQuestion) || 5,
        counts: {
          single_choice: Number(form.singleCount) || 0,
          multi_choice: Number(form.multiCount) || 0,
          judgment: Number(form.judgmentCount) || 0,
          fill_blank: Number(form.fillCount) || 0,
          subjective: Number(form.subjectiveCount) || 0,
        },
      }
      return eduApi(`/api/admin/edu/exam/papers/random-assemble`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (d: unknown) => {
      toast.success(t('success'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', form.paperId] })
      setResult(JSON.stringify(d, null, 2))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totalQ =
    (Number(form.singleCount) || 0) +
    (Number(form.multiCount) || 0) +
    (Number(form.judgmentCount) || 0) +
    (Number(form.fillCount) || 0) +
    (Number(form.subjectiveCount) || 0)
  const totalScore = totalQ * (Number(form.scorePerQuestion) || 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="r-paper">{t('targetPaper')}</Label>
            <Select value={form.paperId} onValueChange={(v) => setForm({ ...form, paperId: v })}>
              <SelectTrigger className={selectClass} id="r-paper">
                <SelectValue placeholder={t('selectPaper')} />
              </SelectTrigger>
              <SelectContent>
                {papers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="r-single">{t('singleCount')}</Label>
              <Input
                id="r-single"
                type="number"
                min="0"
                value={form.singleCount}
                onChange={(e) => setForm({ ...form, singleCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-multi">{t('multiCount')}</Label>
              <Input
                id="r-multi"
                type="number"
                min="0"
                value={form.multiCount}
                onChange={(e) => setForm({ ...form, multiCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-judge">{t('judgmentCount')}</Label>
              <Input
                id="r-judge"
                type="number"
                min="0"
                value={form.judgmentCount}
                onChange={(e) => setForm({ ...form, judgmentCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-fill">{t('fillCount')}</Label>
              <Input
                id="r-fill"
                type="number"
                min="0"
                value={form.fillCount}
                onChange={(e) => setForm({ ...form, fillCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-subj">{t('subjectiveCount')}</Label>
              <Input
                id="r-subj"
                type="number"
                min="0"
                value={form.subjectiveCount}
                onChange={(e) => setForm({ ...form, subjectiveCount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-score">{t('scorePerQuestion')}</Label>
              <Input
                id="r-score"
                type="number"
                min="0"
                value={form.scorePerQuestion}
                onChange={(e) => setForm({ ...form, scorePerQuestion: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-md bg-muted/40 px-4 py-3 text-sm">
            <Shuffle className="h-4 w-4 text-muted-foreground" />
            <span>{t('summary', { totalQ, totalScore })}</span>
          </div>
          <Button onClick={() => mut.mutate()} disabled={!form.paperId || mut.isPending}>
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {t('startRandom')}
          </Button>
          {result && (
            <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {result}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
