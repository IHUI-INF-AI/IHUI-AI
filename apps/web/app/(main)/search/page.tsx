'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Search, User, FolderOpen, FileText, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface UserResult {
  id: string
  nickname: string
  avatar?: string
  bio?: string
}
interface ProjectResult {
  id: string
  name: string
  description: string
  fileCount: number
  updatedAt: string
}
interface FileResult {
  id: string
  name: string
  size: number
  mimeType: string
  projectId: string
  createdAt: string
  projectName?: string | null
}
interface SearchResults {
  users: UserResult[]
  projects: ProjectResult[]
  files: FileResult[]
}

type TabKey = 'all' | 'user' | 'project' | 'file'
type SortKey = 'relevance' | 'time' | 'name' | 'size'

const TABS: { value: TabKey; labelKey: 'all' | 'users' | 'projects' | 'files' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'user', labelKey: 'users' },
  { value: 'project', labelKey: 'projects' },
  { value: 'file', labelKey: 'files' },
]

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const kw = keyword.trim()
  if (!kw) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(kw)})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === kw.toLowerCase() ? (
          <mark key={`part-${i}`} className="rounded bg-primary/20 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`part-${i}`}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function fetchSearch(q: string, type: TabKey): Promise<SearchResults> {
  const qs = new URLSearchParams({ q })
  if (type !== 'all') qs.set('type', type)
  const res = await fetchApi<SearchResults>(`/api/search?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

type IconType = React.ComponentType<{ className?: string }>

function EmptyState({ icon: Icon, text }: { icon: IconType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function ResultGroup({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: IconType
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        <span className="text-muted-foreground">({count})</span>
      </h2>
      {children}
    </section>
  )
}

function sortResults(data: SearchResults | undefined, sort: SortKey): SearchResults {
  if (!data) return { users: [], projects: [], files: [] }
  if (sort === 'relevance') return data
  const byProjectTime = (a: ProjectResult, b: ProjectResult) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  const byFileTime = (a: FileResult, b: FileResult) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  const users =
    sort === 'name'
      ? [...data.users].sort((a, b) => a.nickname.localeCompare(b.nickname))
      : data.users
  const projects = [...data.projects]
  const files = [...data.files]
  if (sort === 'time') {
    projects.sort(byProjectTime)
    files.sort(byFileTime)
  } else if (sort === 'name') {
    projects.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'size') {
    projects.sort((a, b) => b.fileCount - a.fileCount)
    files.sort((a, b) => b.size - a.size)
  }
  return { users, projects, files }
}

function SearchContent() {
  const t = useTranslations('search')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [input, setInput] = React.useState(q)
  const validTabs: TabKey[] = ['all', 'user', 'project', 'file']
  const validSorts: SortKey[] = ['relevance', 'time', 'name', 'size']
  const initTab = searchParams.get('tab') as TabKey
  const initSort = searchParams.get('sort') as SortKey
  const [tab, setTab] = React.useState<TabKey>(validTabs.includes(initTab) ? initTab : 'all')
  const [sort, setSort] = React.useState<SortKey>(
    validSorts.includes(initSort) ? initSort : 'relevance',
  )

  React.useEffect(() => setInput(q), [q])

  // tab/sort 变化时同步到 URL(保留 q,去掉默认值参数)
  React.useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (tab !== 'all') params.set('tab', tab)
    if (sort !== 'relevance') params.set('sort', sort)
    const qs = params.toString()
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sort, q])

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', q, tab],
    queryFn: () => fetchSearch(q, tab),
    enabled: q.trim().length > 0,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const kw = input.trim()
    if (kw) router.push(`/search?q=${encodeURIComponent(kw)}`)
  }

  const { users, projects, files } = React.useMemo(() => sortResults(data, sort), [data, sort])
  const total = users.length + projects.length + files.length
  const showGroup = (key: TabKey) => tab === 'all' || tab === key

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tc('search')}
          className="pl-9"
        />
      </form>

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

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.value}
              onClick={() => setTab(tabItem.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === tabItem.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`tabs.${tabItem.labelKey}`)}
            </button>
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {t('sort')}
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="rounded-md border bg-background px-2 py-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">{t('sortRelevance')}</SelectItem>
              <SelectItem value="time">{t('sortTime')}</SelectItem>
              <SelectItem value="name">{t('sortName')}</SelectItem>
              <SelectItem value="size">{t('sortSize')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {!q.trim() ? (
        <EmptyState icon={Search} text={t('emptyKeyword')} />
      ) : isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : total === 0 ? (
        <EmptyState icon={Search} text={t('emptyResult')} />
      ) : (
        <div key={tab} className="space-y-6 animate-in fade-in-0 duration-200">
          {showGroup('user') && users.length > 0 && (
            <ResultGroup icon={User} title={t('tabs.users')} count={users.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {users.map((u) => (
                  <Link key={u.id} href={`/user/${u.id}`} className="group block">
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm">
                            <Highlight text={u.nickname} keyword={q} />
                          </CardTitle>
                          {u.bio && (
                            <CardDescription className="text-xs">
                              <Highlight text={u.bio} keyword={q} />
                            </CardDescription>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </ResultGroup>
          )}

          {showGroup('project') && projects.length > 0 && (
            <ResultGroup icon={FolderOpen} title={t('tabs.projects')} count={projects.length}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <Link key={p.id} href={`/workspace/${p.id}`} className="group block">
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm">
                          <Highlight text={p.name} keyword={q} />
                        </CardTitle>
                        <CardDescription className="text-xs">
                          <Highlight text={p.description} keyword={q} />
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        {p.fileCount} files · {dateFmt.format(new Date(p.updatedAt))}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </ResultGroup>
          )}

          {showGroup('file') && files.length > 0 && (
            <ResultGroup icon={FileText} title={t('tabs.files')} count={files.length}>
              <ul className="divide-y rounded-lg border">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        <Highlight text={f.name} keyword={q} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(f.size)} · {dateFmt.format(new Date(f.createdAt))}
                      </p>
                    </div>
                    <Link
                      href={`/workspace/${f.projectId}?file=${f.id}`}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      {t('open')}
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
        </div>
      )}
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
