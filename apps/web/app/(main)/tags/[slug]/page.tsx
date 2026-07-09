'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

// 后端 tag_relations 表返回：id / tagId / resourceType / resourceId / createdBy / createdAt
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

// 按 resourceType 映射跳转链接
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

export default function TagDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const t = useTranslations('tags')
  const locale = useLocale()

  const { data: tag, isLoading, error } = useQuery({
    queryKey: ['tags', slug],
    queryFn: () => api<{ tag: TagDetail }>(`/api/tags/${slug}`).then((d) => d.tag),
  })

  const { data: resources } = useQuery({
    queryKey: ['tags', slug, 'resources'],
    queryFn: () =>
      api<{ list: TagResource[] }>(`/api/tags/${tag!.id}/resources`).then((d) => d.list ?? []),
    enabled: !!tag?.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const list = React.useMemo(() => resources ?? [], [resources])

  // 按 resourceType 分组，保持出现顺序
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button
        type="button"
        onClick={() => router.push('/tags')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </button>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error || !tag ? (
        <div className="py-10 text-center text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Tag className="h-6 w-6 text-primary" />
              {tag.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('resourceCount', { count: list.length })}
              <span className="ml-2">· {t('usageCount', { count: tag.usageCount })}</span>
            </p>
            {tag.description && (
              <p className="text-sm text-muted-foreground">{tag.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">{t('resourcesTitle')}</h2>
            {list.length === 0 ? (
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
                      <ul className="divide-y rounded-lg border">
                        {items.map((r) => {
                          const href = resourceHref(r.resourceType, r.resourceId)
                          const label = r.resourceId.slice(0, 8)
                          const inner = (
                            <>
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate font-mono text-sm">
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
                              className="px-4 py-2.5 transition-colors hover:bg-muted/30"
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
        </>
      )}
    </div>
  )
}
