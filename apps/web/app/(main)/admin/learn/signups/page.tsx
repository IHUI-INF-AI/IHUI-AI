'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui'
import { SignupFilter } from './SignupFilter'
import { SignupTable } from './SignupTable'
import { PAGE_SIZE, api } from './helpers'
import type { SignupRow, SignupsData } from './types'

export default function AdminLearnSignupsPage() {
  const t = useTranslations('admin.learn')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'signups', debounced, statusFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debounced) qs.set('search', debounced)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      return api<SignupsData>(`/api/admin/learn/signups?${qs.toString()}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      api<{ signup: SignupRow }>(`/api/admin/learn/signups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(t('signupsUpdateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'signups'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('signupsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('signupsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearnSignups')}
          </Link>
        </Button>
      </div>

      <SignupFilter
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        t={t}
      />

      <SignupTable
        rows={rows}
        isLoading={isLoading}
        error={error}
        pending={updateMut.isPending}
        onStatusChange={(id, status) => updateMut.mutate({ id, status })}
        t={t}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('signupsTotal', { total })}</span>
        <div className="flex items-center gap-2">
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
      </div>
    </div>
  )
}
