'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { NotebookPen, Loader2, Trash2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface Note {
  id: string
  title: string
  content: string
  courseName?: string
  createdAt: string
  isPublic?: boolean
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduNotesPage() {
  const locale = useLocale()
  const t = useTranslations('eduNotesPage')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'notes', debounced],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (debounced) qs.set('search', debounced)
      return api<{ list: Note[] }>(`/api/edu/notes?${qs.toString()}`).then((d) => d.list ?? [])
    },
  })

  const delMut = useMutation({
    mutationFn: (nid: string) => api(`/api/edu/notes/${nid}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edu', 'notes'] }),
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

  const notes = data ?? []

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <NotebookPen className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error)?.message || tc('loadFailed')} />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <NotebookPen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className="flex flex-col transition-colors hover:bg-accent">
              <CardContent className="flex-1 space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 font-medium">{note.title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    disabled={delMut.isPending}
                    onClick={() => delMut.mutate(note.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{note.content}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{note.courseName ?? t('generalNote')}</span>
                  <span>{fmt(note.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
