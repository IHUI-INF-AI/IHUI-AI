'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plus, Search, ChevronLeft, ChevronRight, Crown, UploadCloud } from 'lucide-react'
import { Button, Input } from '@ihui/ui'
import { fetchMembers, type Member, type MemberLevel, api, PAGE_SIZE } from './types'
import { MemberStats } from './MemberStats'
import { MembersTable } from './MembersTable'
import { MemberCreateDialog } from './MemberCreateDialog'
import { MemberImportDialog } from './MemberImportDialog'
import { MemberResetPwdDialog } from './MemberResetPwdDialog'

export default function AdminMembersPage() {
  const t = useTranslations('admin.members')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [resetTarget, setResetTarget] = React.useState<Member | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: levelsData } = useQuery({
    queryKey: ['admin', 'members', 'levels', 'all'],
    queryFn: () =>
      api<{ list: MemberLevel[] }>(`/api/admin/members/levels`).then((d) => d.list ?? []),
  })
  const levelMap = React.useMemo(() => {
    const m = new Map<string, string>()
    const levels = levelsData ?? []
    for (const l of levels) m.set(l.id, l.name)
    return m
  }, [levelsData])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'members', 'list', debounced, page],
    queryFn: () => fetchMembers({ page, search: debounced }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const members = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/members/levels">
              <Crown className="h-4 w-4" />
              {t('levels')}
            </Link>
          </Button>
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
          <Button onClick={() => setImportOpen(true)} variant="outline" size="sm">
            <UploadCloud className="h-4 w-4" />
            {t('importBtn')}
          </Button>
        </div>
      </div>

      <MemberStats t={t} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
      </div>

      <MembersTable
        members={members}
        isLoading={isLoading}
        error={error}
        levelMap={levelMap}
        onReset={setResetTarget}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
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

      <MemberCreateDialog
        open={open}
        onClose={() => setOpen(false)}
        levelsData={levelsData}
        t={t}
      />
      <MemberImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => setImportOpen(false)}
      />
      <MemberResetPwdDialog
        open={!!resetTarget}
        resetTarget={resetTarget}
        onClose={() => setResetTarget(null)}
        t={t}
      />
    </div>
  )
}
