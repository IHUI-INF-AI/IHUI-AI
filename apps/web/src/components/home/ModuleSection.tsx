'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronRight, FileText, type LucideIcon } from 'lucide-react'
import { Card } from '@ihui/ui-react'

export interface HomeItem {
  id: string
  title: string
  cover?: string
  meta?: string
  price?: string
  href: string
}

interface ModuleSectionProps {
  title: string
  englishTitle: string
  icon: LucideIcon
  href: string
  queryKey: readonly unknown[]
  queryFn: () => Promise<HomeItem[]>
  variant?: 'card' | 'list'
}

export function ModuleSection({
  title,
  englishTitle,
  icon: Icon,
  href,
  queryKey,
  queryFn,
  variant = 'card',
}: ModuleSectionProps) {
  const t = useTranslations('home.moduleSection')
  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-xs uppercase tracking-wide text-muted-foreground/50">
            {englishTitle}
          </span>
        </div>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          {t('viewMore')}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="p-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('noData')}
          </div>
        ) : variant === 'list' ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 py-2.5 transition-colors hover:text-primary"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  <span className="line-clamp-1 flex-1 text-sm">{item.title}</span>
                  {item.meta && (
                    <span className="shrink-0 text-xs text-muted-foreground/60">{item.meta}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {items.map((item) => (
              <ModuleItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function ModuleItemCard({ item }: { item: HomeItem }) {
  return (
    <Link
      href={item.href}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {item.cover ? (
          <Image
            src={item.cover}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform group-hover:scale-105"
            sizes="240px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted text-muted-foreground/30">
            <FileText className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <h3 className="line-clamp-1 text-sm font-medium">{item.title}</h3>
        {item.meta && <p className="line-clamp-1 text-xs text-muted-foreground">{item.meta}</p>}
        {item.price && <span className="text-sm font-semibold text-primary">{item.price}</span>}
      </div>
    </Link>
  )
}
