import type { Metadata } from 'next'
import * as React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Tag, FileText, FolderOpen, User, MessageSquare, FileCode } from 'lucide-react'

import { fetchApiServer } from '@/lib/api-server'

export const revalidate = 60

interface TagDetail {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string
}

// 后端 tag_relations 表返回:id / tagId / resourceType / resourceId / createdBy / createdAt
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

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const r = await fetchApiServer<{ tag: TagDetail }>(`/api/tags/${slug}`)
  if (!r.success || !r.data.tag) return { title: '标签详情 | IHUI AI' }
  const tag = r.data.tag
  const title = `${tag.name} - 标签 | IHUI AI`
  const description = tag.description ?? `标签 ${tag.name} 下共 ${tag.usageCount} 次使用`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function TagDetailPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'tags' })

  const tagResp = await fetchApiServer<{ tag: TagDetail }>(`/api/tags/${slug}`)
  if (!tagResp.success || !tagResp.data.tag) notFound()
  const tag = tagResp.data.tag

  const resourcesResp = await fetchApiServer<{ list: TagResource[] }>(
    `/api/tags/${tag.id}/resources`,
  )
  const list: TagResource[] = resourcesResp.success ? (resourcesResp.data.list ?? []) : []

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })

  // 按 resourceType 分组,保持出现顺序
  const groups = (() => {
    const map = new Map<string, TagResource[]>()
    for (const r of list) {
      const arr = map.get(r.resourceType) ?? []
      arr.push(r)
      map.set(r.resourceType, arr)
    }
    return Array.from(map.entries())
  })()

  const groupLabel = (type: string) => t(GROUP_KEY[type] ?? 'groupOther')

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
