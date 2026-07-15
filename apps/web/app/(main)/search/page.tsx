'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { SearchBar } from '@/components/business'
import { SearchControls } from './SearchControls'
import { SearchResultGroups } from './SearchResultGroups'
import { fetchSearch, sortResults } from './helpers'
import type { TabKey, SortKey } from './types'

function SearchContent() {
  const t = useTranslations('search')
  const tc = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [history, setHistory] = React.useState<string[]>([])
  const validTabs: TabKey[] = ['all', 'user', 'project', 'file']
  const validSorts: SortKey[] = ['relevance', 'time', 'name', 'size']
  const initTab = searchParams.get('tab') as TabKey
  const initSort = searchParams.get('sort') as SortKey
  const [tab, setTab] = React.useState<TabKey>(validTabs.includes(initTab) ? initTab : 'all')
  const [sort, setSort] = React.useState<SortKey>(
    validSorts.includes(initSort) ? initSort : 'relevance',
  )

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('searchHistory')
      if (stored) setHistory(JSON.parse(stored))
    } catch {
      /* ignore */
    }
  }, [])

  const handleSearch = (kw: string) => {
    const next = [kw, ...history.filter((h) => h !== kw)].slice(0, 10)
    setHistory(next)
    try {
      localStorage.setItem('searchHistory', JSON.stringify(next))
    } catch {
      /* ignore */
    }
    router.push(`/search?q=${encodeURIComponent(kw)}`)
  }

  const handleClearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem('searchHistory')
    } catch {
      /* ignore */
    }
  }

  // tab/sort 变化时同步到 URL(保留 q,去掉默认值参数)
  React.useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tab !== 'all') params.set('tab', tab)
    if (sort !== 'relevance') params.set('sort', sort)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
  }, [tab, sort, q, router])

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', q, tab],
    queryFn: () => fetchSearch(q, tab),
    enabled: q.trim().length > 0,
  })

  const { users, projects, files } = React.useMemo(() => sortResults(data, sort), [data, sort])
  const total = users.length + projects.length + files.length

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <SearchBar
        placeholder={tc('search')}
        onSearch={handleSearch}
        history={history}
        onHistoryClick={handleSearch}
        onClearHistory={handleClearHistory}
      />

      {data && total > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('resultsCount', {
            total,
            users: users.length,
            projects: projects.length,
            files: files.length,
          })}
        </p>
      )}

      <SearchControls tab={tab} setTab={setTab} sort={sort} setSort={setSort} />

      <SearchResultGroups
        q={q}
        tab={tab}
        isLoading={isLoading}
        error={error}
        users={users}
        projects={projects}
        files={files}
      />
    </div>
  )
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  )
}
