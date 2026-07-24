'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Search, User, FolderOpen, FileText, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@ihui/ui-react'
import { escapeRegExp, formatSize } from './helpers'
import type { UserResult, ProjectResult, FileResult, TabKey } from './types'

type IconType = React.ComponentType<{ className?: string }>

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

interface Props {
  q: string
  tab: TabKey
  isLoading: boolean
  error: unknown
  users: UserResult[]
  projects: ProjectResult[]
  files: FileResult[]
}

export function SearchResultGroups({ q, tab, isLoading, error, users, projects, files }: Props) {
  const t = useTranslations('search')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const total = users.length + projects.length + files.length
  const showGroup = (key: TabKey) => tab === 'all' || tab === key

  if (!q.trim()) return <EmptyState icon={Search} text={t('emptyKeyword')} />
  if (isLoading)
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  if (error)
    return <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
  if (total === 0) return <EmptyState icon={Search} text={t('emptyResult')} />

  return (
    <div key={tab} className="space-y-6 animate-in fade-in-0 duration-200">
      {showGroup('user') && users.length > 0 && (
        <ResultGroup icon={User} title={t('tabs.users')} count={users.length}>
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <Link key={u.id} href={`/user/${u.id}`} className="group block">
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
  )
}
