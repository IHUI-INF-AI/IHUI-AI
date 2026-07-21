'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, ExternalLink, Gift, Shield } from 'lucide-react'

import { Card } from '@ihui/ui'
import { BrandIcon } from '@/components/ai/brand-icon'

import { PROJECT_PLUGINS, MARKET_PLUGINS, type ProjectPlugin, type MarketPlugin } from './plugins-data'

/**
 * 插件市场客户端组件(2026-07-22 立)
 *
 * 两段式布局:
 *  1. 本项目配置的插件 — 8 张卡片,点击进入对应路由
 *  2. 热门插件脚本市场 — 18 张卡片,点击访问官方网站(或内置路由)
 *
 * 卡片设计:
 *  - 圆角容器 rounded-lg(项目插件) / Card(市场插件),无 rounded-full / 胶囊
 *  - 项目插件: lucide-react 图标,hover 切换为 primary 色
 *  - 市场插件: 优先 BrandIcon(lobehub 官方矢量图标),无 vendor 时用 lucide 兜底
 *  - hover:bg-accent/40 + hover:shadow-md,无蓝色发光边框(符合用户偏好)
 *  - 标签 chip 用 bg-primary/8(项目) / bg-muted/60(市场)区分层级
 *  - icon + 中文 span 同行时父级加 [&>span]:translate-y-[0.5px] 视觉对齐
 */
export function PluginMarketplace() {
  const t = useTranslations('plugins')

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          title={t('sectionProject')}
          desc={t('sectionProjectDesc')}
          count={PROJECT_PLUGINS.length}
          totalLabel={t('total', { count: PROJECT_PLUGINS.length })}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PROJECT_PLUGINS.map((p) => (
            <ProjectPluginCard key={p.id} plugin={p} openLabel={t('open')} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title={t('sectionMarket')}
          desc={t('sectionMarketDesc')}
          count={MARKET_PLUGINS.length}
          totalLabel={t('total', { count: MARKET_PLUGINS.length })}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MARKET_PLUGINS.map((p) => (
            <MarketPluginCard key={p.id} plugin={p} visitLabel={t('visit')} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionHeader({
  title,
  desc,
  totalLabel,
}: {
  title: string
  desc: string
  count: number
  totalLabel: string
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
        {totalLabel}
      </span>
    </div>
  )
}

function ProjectPluginCard({ plugin, openLabel }: { plugin: ProjectPlugin; openLabel: string }) {
  const Icon = plugin.icon
  return (
    <Link href={plugin.href} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg">
      <Card className="flex h-full flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight">{plugin.name}</h3>
            <span className="mt-0.5 inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 [&>span]:translate-y-[0.5px]">
              <Shield className="mr-0.5 h-3 w-3" />
              <span>内置</span>
            </span>
          </div>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{plugin.description}</p>
        <div className="mt-auto flex flex-wrap gap-1">
          {plugin.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end text-xs font-medium text-primary [&>span]:translate-y-[0.5px]">
          <span>{openLabel}</span>
          <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}

function MarketPluginCard({ plugin, visitLabel }: { plugin: MarketPlugin; visitLabel: string }) {
  const isInternal = plugin.url.startsWith('/')
  const FallbackIcon = plugin.fallbackIcon

  const card = (
    <Card className="flex h-full flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {plugin.vendor ? <BrandIcon vendor={plugin.vendor} size={22} /> : <FallbackIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{plugin.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs [&>span]:translate-y-[0.5px]">
            {plugin.official && (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <Shield className="mr-0.5 h-3 w-3" />
                官方
              </span>
            )}
            {plugin.free && (
              <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                <Gift className="mr-0.5 h-3 w-3" />
                免费
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{plugin.description}</p>
      <div className="mt-auto flex flex-wrap gap-1">
        {plugin.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-end text-xs font-medium text-primary [&>span]:translate-y-[0.5px]">
        <span>{visitLabel}</span>
        <ExternalLink className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Card>
  )

  if (isInternal) {
    return (
      <Link href={plugin.url} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg">
        {card}
      </Link>
    )
  }
  return (
    <a
      href={plugin.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
    >
      {card}
    </a>
  )
}
