'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Radio, Eye, User } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { Badge } from '@/components/data'
import { getFormatters } from '@/lib/date-utils'
import { getInitials } from '@/components/data/Avatar'
import type { AiLiveChannel } from '@/lib/ai-news-api'

interface Props {
  channels: AiLiveChannel[]
}

// 封面图占位:Image 加载完成前显示 shimmer,加载后淡入
function CoverImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [loaded, setLoaded] = React.useState(false)
  return (
    <>
      {!loaded ? (
        <div className="absolute inset-0 animate-skeleton-pulse bg-muted" aria-hidden />
      ) : null}
      <Image
        fill
        src={src}
        alt={alt}
        sizes={sizes}
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </>
  )
}

export function LiveChannelsBlock({ channels }: Props) {
  const t = useTranslations('aiNews')
  const locale = React.useMemo(() => {
    if (typeof document === 'undefined') return 'zh-CN'
    return document.documentElement.lang || 'zh-CN'
  }, [])
  const fmt = React.useMemo(() => getFormatters(locale), [locale])

  if (channels.length === 0) {
    return (
      <section
        aria-label={t('live.label')}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="p-8 text-center text-sm text-muted-foreground">{t('live.empty')}</div>
      </section>
    )
  }

  return (
    <section
      aria-label={t('live.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex flex-row items-center justify-between gap-3 p-6 pb-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Radio className="h-5 w-5 text-red-500" />
            {t('live.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('live.subtitle')}</p>
        </div>
        <Link
          href="/live"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('live.viewMore')}
        </Link>
      </div>
      <div className="grid gap-4 p-6 pt-3 md:grid-cols-2 lg:grid-cols-4">
        {channels.map((c) => (
          <Card key={c.id} className="overflow-hidden transition-colors hover:bg-accent">
            <Link href={`/live/${c.id}`} className="block">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {c.coverImage ? (
                  <CoverImage src={c.coverImage} alt={c.title} sizes="(max-width: 768px) 100vw, 280px" />
                ) : null}
                {c.isLive ? (
                  <div className="absolute left-2 top-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/95 px-2 py-0.5 text-xs font-medium text-white">
                      <span className="h-2 w-2 rounded-sm bg-white" />
                      {t('live.liveBadge')}
                    </span>
                  </div>
                ) : null}
                <div className="absolute right-2 top-2">
                  <Badge variant="default">{c.categoryName}</Badge>
                </div>
              </div>
              <CardContent className="space-y-2 p-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{c.title}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.intro}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-medium text-primary">
                      {getInitials(c.lecturerName)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {c.lecturerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {fmt.numberFormatter.format(c.viewCount)}
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}
