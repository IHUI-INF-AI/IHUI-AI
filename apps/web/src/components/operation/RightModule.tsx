'use client'

import * as React from 'react'
import Link from 'next/link'
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

const DEFAULT_QUICK_ENTRIES: QuickEntry[] = [
  { label: '积分商城', href: '/integral/mall', icon: ExternalLink, description: '兑换好礼' },
  { label: '会员中心', href: '/vip', icon: ExternalLink, description: '尊享特权' },
  { label: '邀请好友', href: '/invite', icon: ExternalLink, description: '赚积分' },
  { label: '帮助中心', href: '/help', icon: ExternalLink, description: '使用指南' },
]

const DEFAULT_HOT_TAGS: HotTag[] = [
  { label: 'AI 大模型', href: '/tag/llm', count: 328 },
  { label: '教程', href: '/tag/tutorial', count: 256 },
  { label: 'RAG', href: '/tag/rag', count: 192 },
  { label: 'Agent', href: '/tag/agent', count: 184 },
  { label: '前端', href: '/tag/frontend', count: 167 },
  { label: '后端', href: '/tag/backend', count: 142 },
  { label: '开源', href: '/tag/opensource', count: 98 },
]

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

export function RightModule({
  quickEntries = DEFAULT_QUICK_ENTRIES,
  ad,
  hotTags = DEFAULT_HOT_TAGS,
  children,
  className,
}: RightModuleProps) {
  return (
    <aside className={cn('flex w-full flex-col gap-4', className)}>
      <Card>
        <CardContent className="p-0">
          <SectionBlock title="快捷入口">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {quickEntries.map((entry) => {
                const Icon = entry.icon
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-2.5 text-center transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium leading-tight">{entry.label}</span>
                    {entry.description && (
                      <span className="text-[10px] text-muted-foreground">{entry.description}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </SectionBlock>

          {ad && (
            <SectionBlock title="推广">
              <Link
                href={ad.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/60"
              >
                <div className="relative aspect-[16/9] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ad.image}
                    alt={ad.alt ?? '推广'}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </div>
              </Link>
            </SectionBlock>
          )}

          {hotTags.length > 0 && (
            <SectionBlock title="热门标签">
              <div className="flex flex-wrap gap-1.5">
                {hotTags.map((tag) => (
                  <Link
                    key={tag.href}
                    href={tag.href}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                  >
                    <span className="break-words">{tag.label}</span>
                    {tag.count !== undefined && (
                      <span className="text-[10px] text-muted-foreground/70">{tag.count}</span>
                    )}
                  </Link>
                ))}
              </div>
            </SectionBlock>
          )}

          {children && <SectionBlock title="更多">{children}</SectionBlock>}
        </CardContent>
      </Card>
    </aside>
  )
}

export default RightModule
