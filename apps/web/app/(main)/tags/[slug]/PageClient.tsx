'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Tag, FileText, FolderOpen, User, MessageSquare, FileCode, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface TagDetail {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string
}

interface TagResource {
  id: string
  resourceType: string
  resourceId: string
  createdAt: string
}

const RESOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderOpen,
  file: FileText,
  doc: FileCode,
  post: FileText,
  comment: MessageSquare,
  user: User,
}

function resourceHref(type: string, id: string): string | null {
  if (type === 'project') return `/workspace/${id}`
  if (type === 'doc') return `/docs`
  return null
}

const GROUP_KEY: Record<string, string> = {
  project: 'groupProject',
  file: 'groupFile',
  doc: 'groupDoc',
  post: 'groupPost',
  comment: 'groupComment',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function TagDetailPageClient() {
  const { slug } = useParams<{ slug: string }>()
  const t = useTranslations('tags')
  const locale = useLocale()

  const tagQuery = useQuery({
    queryKey: ['tags', 'detail', slug],
    queryFn: () => api<{ tag: TagDetail }>(`/api/tags/${slug}`),
  })

  const tag = tagQuery.data?.tag ?? null

  const resourcesQuery = useQuery({
    queryKey: ['tags', 'resources', tag?.id],
    queryFn: () => api<{ list: TagResource[] }>(`/api/tags/${tag!.id}/resources`),
    enabled: !!tag?.id,
  })

  const list: TagResource[] = resourcesQuery.data?.list ?? []

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })

  const groups = React.useMemo(() => {
    const map = new Map<string, TagResource[]>()
    for (const r of list) {
      const arr = map.get(r.resourceType) ?? []
      arr.push(r)
      map.set(r.resourceType, arr)
    }
    return Array.from(map.entries())
  }, [list])

  const groupLabel = (type: string) => t(GROUP_KEY[type] ?? 'groupOther')

  if (tagQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!tag) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-20 text-center">
        <Tag className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/tags"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Tag className="h-6 w-6 text-primary" />
          {tag.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('resourceCount', { count: list.length })}
          <span className="ml-2">· {t('usageCount', { count: tag.usageCount })}</span>
        </p>
        {tag.description && <p className="text-sm text-muted-foreground">{tag.description}</p>}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold">{t('resourcesTitle')}</h2>
        {resourcesQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('emptyResources')}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([type, items]) => {
              const Icon = RESOURCE_ICON[type] ?? FileText
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {groupLabel(type)}
                    <span className="font-normal">({items.length})</span>
                  </div>
                  <ul className="space-y-1 rounded-lg border border-border bg-card p-1.5">
                    {items.map((r) => {
                      const href = resourceHref(r.resourceType, r.resourceId)
                      const label = r.resourceId.slice(0, 8)
                      const inner = (
                        <>
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 break-words font-mono text-sm">
                            {label}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {dateFmt.format(new Date(r.createdAt))}
                          </span>
                        </>
                      )
                      return (
                        <li
                          key={r.id}
                          className="rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                        >
                          {href ? (
                            <Link
                              href={href}
                              className="flex items-center gap-3 transition-colors hover:text-primary"
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3">{inner}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
