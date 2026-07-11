'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileCheck, Clock, ListChecks, Target, Loader2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface Paper {
  id: string
  title: string
  description?: string
  questionCount: number
  totalScore: number
  passScore: number
  duration: number
}
interface PapersData {
  list: Paper[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ExamPage() {
  const t = useTranslations('exam')
  const [page] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', 'papers', page],
    queryFn: () => api<PapersData>(`/api/exam/papers?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const papers = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileCheck className="h-7 w-7 text-primary" />
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
      ) : papers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <FileCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {papers.map((paper) => (
            <Card key={paper.id} className="flex h-full flex-col transition-colors hover:bg-accent">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{paper.title}</CardTitle>
                {paper.description && (
                  <p className="text-xs text-muted-foreground">{paper.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3 p-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    {t('questionCount', { count: paper.questionCount })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    {t('totalScore', { score: paper.totalScore })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    {t('passScore', { score: paper.passScore })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t('duration', { minutes: paper.duration })}
                  </span>
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/exam/${paper.id}`}>
                    {t('startExam')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
