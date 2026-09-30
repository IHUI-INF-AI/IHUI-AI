// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { XCircle, Loader2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

interface WrongRecord {
  recordId: string
  questionId: string
  answer: string
  isCorrect: boolean
}

interface WrongBookData {
  list: WrongRecord[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, opts)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function WrongBookPage() {
  const t = useTranslations('student')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'wrong-book', page],
    queryFn: () => api<WrongBookData>(`/api/edu/wrong-book?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // AI 讲解(与 /exam/wrong-questions 同一端点,结果持久化在错题行,G-978072)
  const [explain, setExplain] = React.useState<{ questionId: string; text: string } | null>(null)
  const explainMut = useMutation({
    mutationFn: (questionId: string) =>
      api<{ explanation: string }>(`/api/exam/wrong-questions/${questionId}/explain`, {
        method: 'POST',
      }),
    onSuccess: (d, questionId) => setExplain({ questionId, text: d.explanation }),
  })

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          <XCircle className="h-7 w-7 text-primary" />
          {t('wrongBookTitle')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <XCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {list.map((item) => (
              <Card key={item.recordId} className="transition-colors hover:bg-accent">
                <CardContent className="min-[640px]:p-3 space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        'bg-destructive/10 text-destructive',
                      )}
                    >
                      {t('incorrect')}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{t('questionId')}</span>
                      <span className="font-medium">{item.questionId}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">{t('myAnswer')}</span>
                      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-foreground">
                        {item.answer || '-'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={explainMut.isPending}
                    onClick={() =>
                      explain?.questionId === item.questionId
                        ? setExplain(null)
                        : explainMut.mutate(item.questionId)
                    }
                  >
                    {explainMut.isPending && explainMut.variables === item.questionId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {t('aiExplain')}
                  </Button>
                  {explain?.questionId === item.questionId && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                      {explain.text}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
