'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

export interface QuickEntry {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

export interface AdSlot {
  image: string
  href: string
  alt?: string
}

export interface HotTag {
  label: string
  href: string
  count?: number
}

interface RightModuleProps {
  quickEntries?: QuickEntry[]
  ad?: AdSlot
  hotTags?: HotTag[]
  children?: React.ReactNode
  className?: string
}

function SectionBlock({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="border-b border-border/60 p-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function RightModule({ quickEntries, ad, hotTags, children, className }: RightModuleProps) {
  const t = useTranslations('operation.rightModule')

  const defaultQuickEntries: QuickEntry[] = [
    {
      label: t('defaultEntries.mall.label'),
      href: '/integral/mall',
      icon: ExternalLink,
      description: t('defaultEntries.mall.description'),
    },
    {
      label: t('defaultEntries.vip.label'),
      href: '/vip',
      icon: ExternalLink,
      description: t('defaultEntries.vip.description'),
    },
    {
      label: t('defaultEntries.invite.label'),
      href: '/invite',
      icon: ExternalLink,
      description: t('defaultEntries.invite.description'),
    },
    {
      label: t('defaultEntries.help.label'),
      href: '/help',
      icon: ExternalLink,
      description: t('defaultEntries.help.description'),
    },
  ]

  const defaultHotTags: HotTag[] = [
    { label: t('defaultTags.llm'), href: '/tag/llm', count: 328 },
    { label: t('defaultTags.tutorial'), href: '/tag/tutorial', count: 256 },
    { label: t('defaultTags.rag'), href: '/tag/rag', count: 192 },
    { label: t('defaultTags.agent'), href: '/tag/agent', count: 184 },
    { label: t('defaultTags.frontend'), href: '/tag/frontend', count: 167 },
    { label: t('defaultTags.backend'), href: '/tag/backend', count: 142 },
    { label: t('defaultTags.opensource'), href: '/tag/opensource', count: 98 },
  ]

  const entries = quickEntries ?? defaultQuickEntries
  const tags = hotTags ?? defaultHotTags

  return (
    <aside className={cn('flex w-full flex-col gap-4', className)}>
      <Card>
        <CardContent className="p-0">
          <SectionBlock title={t('quickEntries')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {entries.map((entry) => {
                const Icon = entry.icon
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-2.5 text-center transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium leading-tight">{entry.label}</span>
                    {entry.description && (
                      <span className="text-xs text-muted-foreground">{entry.description}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </SectionBlock>

          {ad && (
            <SectionBlock title={t('promotion')}>
              <Link
                href={ad.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/60"
              >
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    fill
                    src={ad.image}
                    alt={ad.alt ?? t('promotion')}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </div>
              </Link>
            </SectionBlock>
          )}

          {tags.length > 0 && (
            <SectionBlock title={t('hotTags')}>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Link
                    key={tag.href}
                    href={tag.href}
                    className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                  >
                    <span className="break-words">{tag.label}</span>
                    {tag.count !== undefined && (
                      <span className="text-xs text-muted-foreground/70">{tag.count}</span>
                    )}
                  </Link>
                ))}
              </div>
            </SectionBlock>
          )}

          {children && <SectionBlock title={t('more')}>{children}</SectionBlock>}
        </CardContent>
      </Card>
    </aside>
  )
}

export default RightModule
