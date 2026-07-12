'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { MembersHeader } from './MembersHeader'
import { MembersFilter } from './MembersFilter'
import { MembersList } from './MembersList'
import { MembersPagination } from './MembersPagination'
import { PAGE_SIZE, api } from './helpers'
import type { MembersData, LevelItem } from './types'

export default function MembersPage() {
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [levelFilter, setLevelFilter] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: levels } = useQuery({
    queryKey: ['members', 'levels'],
    queryFn: () =>
      api<{ list: LevelItem[] }>(`/api/admin/members/levels`).then((d) => d.list ?? []),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['members', 'list', debounced, statusFilter, levelFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('username', debounced)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (levelFilter !== 'all') qs.set('levelId', levelFilter)
      return api<MembersData>(`/api/admin/members?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const members = data?.list ?? []
  const levelMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const l of levels ?? []) m.set(l.id, l.name)
    return m
  }, [levels])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <MembersHeader />
      <MembersFilter
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        levelFilter={levelFilter}
        setLevelFilter={(v) => {
          setLevelFilter(v)
          setPage(1)
        }}
        levels={levels}
      />
      <MembersList
        members={members}
        isLoading={isLoading}
        error={error as Error | null}
        levelMap={levelMap}
      />
      <MembersPagination
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        setPage={setPage}
      />
    </div>
  )
}
