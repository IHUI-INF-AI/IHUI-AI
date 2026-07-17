'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { HelpCircle, Loader2, Send, Search, MessageCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface QAItem {
  id: string
  question: string
  answer?: string
  author: string
  courseName?: string
  status: string
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function EduQAPage() {
  const locale = useLocale()
  const t = useTranslations('edu.qa')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [askText, setAskText] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'qa', debounced, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (debounced) qs.set('search', debounced)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: QAItem[] }>(`/api/edu/qa?${qs.toString()}`).then((d) => d.list ?? [])
    },
  })

  const askMut = useMutation({
    mutationFn: () =>
      api('/api/edu/qa', { method: 'POST', body: JSON.stringify({ question: askText }) }),
    onSuccess: () => {
      setAskText('')
      qc.invalidateQueries({ queryKey: ['edu', 'qa'] })
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const items = data ?? []

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HelpCircle className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="flex gap-2 p-4">
          <Input
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder={t('askPlaceholder')}
            className="h-9"
          />
          <Button
            size="sm"
            disabled={!askText.trim() || askMut.isPending}
            onClick={() => askMut.mutate()}
          >
            {askMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('askBtn')}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={cn(selectClass, 'w-32')} aria-label={t('statusAria')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('statusAll')}</SelectItem>
            <SelectItem value="answered">{t('statusAnswered')}</SelectItem>
            <SelectItem value="pending">{t('statusPending')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="transition-colors hover:bg-accent">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-start gap-2 font-medium">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item.question}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs',
                      item.status === 'answered'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600',
                    )}
                  >
                    {item.status === 'answered' ? t('answered') : t('pending')}
                  </span>
                </div>
                {item.answer && <p className="ml-6 text-sm text-muted-foreground">{item.answer}</p>}
                <div className="ml-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{item.author}</span>
                  {item.courseName && <span>· {item.courseName}</span>}
                  <span>· {fmt(item.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {askMut.isError && <Alert variant="danger" description={(askMut.error as Error)?.message} />}
    </div>
  )
}
