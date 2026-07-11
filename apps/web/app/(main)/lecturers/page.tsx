'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { GraduationCap, Search, Loader2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui'

interface Lecturer {
  id: string
  name: string
  avatar: string | null
  title: string | null
  intro: string | null
  sort: number
  status: number
}
interface LecturersResp {
  list: Lecturer[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function Avatar({
  name,
  avatar,
  className,
}: {
  name: string
  avatar: string | null
  className?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-medium text-primary',
        className,
      )}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}

export default function LecturersPage() {
  const t = useTranslations('lecturer')
  const [search, setSearch] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['lecturers'],
    queryFn: () => api<LecturersResp>('/api/live/lecturers').then((d) => d.list ?? []),
  })

  const list = data ?? []
  const kw = search.trim().toLowerCase()
  const filtered = kw
    ? list.filter((l) =>
        [l.name, l.title, l.intro].filter(Boolean).join(' ').toLowerCase().includes(kw),
      )
    : list

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <GraduationCap className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-9 pl-8"
          aria-label={t('search')}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <GraduationCap className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Link key={l.id} href={`/lecturers/${l.id}`} className="group block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
                  <Avatar name={l.name} avatar={l.avatar} className="h-12 w-12 text-base" />
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{l.name}</CardTitle>
                    {l.title ? (
                      <p className="truncate text-xs text-muted-foreground">{l.title}</p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                  <p className="line-clamp-2 text-sm text-muted-foreground">{l.intro ?? ''}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-primary transition-colors group-hover:underline">
                    {t('viewDetail')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
