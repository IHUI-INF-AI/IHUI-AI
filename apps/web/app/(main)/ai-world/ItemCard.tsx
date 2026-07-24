'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import {
  Sparkles,
  Star,
  Eye,
  Github,
  FileText,
  Newspaper,
  Wrench,
  AppWindow,
  Calendar,
  ExternalLink,
} from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import type { AiWorldItem, ItemKind } from './types'
import { TrendingBadge } from './TrendingBadge'

const KIND_ICON: Record<ItemKind, React.ComponentType<{ className?: string }>> = {
  news: Newspaper,
  paper: FileText,
  project: Github,
  tool: Wrench,
  app: AppWindow,
}

const KIND_LABEL: Record<ItemKind, string> = {
  news: '资讯',
  paper: '论文',
  project: '项目',
  tool: '工具',
  app: '应用',
}

interface Props {
  item: AiWorldItem
  layout?: 'grid' | 'list'
}

export function ItemCard({ item, layout = 'grid' }: Props) {
  const locale = useLocale()
  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )
  const fmt = (v: string | null) => {
    if (!v) return ''
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
  }

  const KindIcon = KIND_ICON[item.kind] ?? Sparkles
  const date = fmt(item.publishedAt ?? item.fetchedAt)
  const stars = item.metadata && typeof item.metadata === 'object' && 'stars' in item.metadata
    ? Number(item.metadata.stars) || 0
    : 0
  const detailHref = `/ai-world/items/${item.id}`
  const externalHref = item.url ?? item.sourceUrl ?? '#'
  const isExternal = item.kind === 'project' || item.kind === 'news' || item.kind === 'paper'

  const Cover = (
    <div
      className={
        layout === 'grid'
          ? 'relative h-32 w-full bg-muted'
          : 'relative h-16 w-16 shrink-0 bg-muted'
      }
    >
      {item.coverImage ? (
        <Image
          fill
          src={item.coverImage}
          alt={item.title}
          className="h-full w-full object-cover"
          sizes={layout === 'grid' ? '(max-width: 768px) 100vw, 33vw' : '64px'}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <KindIcon className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
    </div>
  )

  const Meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5">
        <KindIcon className="h-3 w-3" />
        {KIND_LABEL[item.kind]}
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3 w-3" />
        {item.viewCount}
      </span>
      {stars > 0 && (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3" />
          {stars}
        </span>
      )}
      {date && (
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {date}
        </span>
      )}
      {item.source && <span className="text-muted-foreground/80">@{item.source}</span>}
      {item.trendingScore !== null && (
        <TrendingBadge
          score={item.trendingScore}
          metrics={item.trendingMetrics}
          updatedAt={item.trendingUpdatedAt}
        />
      )}
    </div>
  )

  const Title = (
    <h3 className={`line-clamp-2 font-medium ${layout === 'grid' ? 'text-sm' : 'text-sm'}`}>
      {item.title}
    </h3>
  )

  const Summary = item.summary ? (
    <p className={`line-clamp-2 text-xs text-muted-foreground ${layout === 'grid' ? '' : ''}`}>
      {item.summary}
    </p>
  ) : null

  if (layout === 'grid') {
    return (
      <Link
        href={isExternal ? externalHref : detailHref}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="block"
      >
        <Card className="overflow-hidden transition-colors hover:bg-accent/40">
          {Cover}
          <CardContent className="space-y-2 p-3">
            {Title}
            {Summary}
            {Meta}
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link
      href={isExternal ? externalHref : detailHref}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="block"
    >
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-start gap-3 p-3">
          <div className="overflow-hidden rounded-md">{Cover}</div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              {Title}
              {isExternal && (
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              )}
            </div>
            {Summary}
            {Meta}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
