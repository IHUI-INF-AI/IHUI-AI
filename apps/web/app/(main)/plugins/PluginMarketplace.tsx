'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, ExternalLink, Gift, Search, Shield, X } from 'lucide-react'

import { Card } from '@ihui/ui'
import { BrandIcon } from '@/components/ai/brand-icon'
import { Input } from '@ihui/ui'

import {
  PROJECT_PLUGINS,
  MARKET_PLUGINS,
  type ProjectPlugin,
  type MarketPlugin,
  type PluginCategory,
} from './plugins-data'

type Filter = 'all' | 'builtin' | 'market' | PluginCategory
type Sort = 'default' | 'name'

interface CategoryOption {
  key: Filter
  label: string
  count: number
}

/**
 * 插件市场客户端组件(2026-07-22 重构)
 *
 * 配套能力:
 *  - 实时搜索(名称 / 描述 / 标签)
 *  - 分类筛选(全部 / 内置 / 市场 / MCP / Agent / 工作流 / 工具 / 模型 / IDE / 知识 / 创作)
 *  - 排序(默认 / 字母)
 *  - 空状态提示
 *
 * 卡片设计:
 *  - 圆角 rounded-lg,无 rounded-full
 *  - hover:bg-accent/40 + hover:shadow-md,无蓝色发光边框
 *  - icon + 中文 span 同行 [&>span]:translate-y-[0.5px] 视觉对齐
 */
export function PluginMarketplace() {
  const t = useTranslations('plugins')

  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [sort, setSort] = React.useState<Sort>('default')

  // 合并两类插件为统一列表,带 source 标记
  const allPlugins = React.useMemo(() => {
    const project = PROJECT_PLUGINS.map((p) => ({ ...p, source: 'project' as const }))
    const market = MARKET_PLUGINS.map((p) => ({ ...p, source: 'market' as const }))
    return [...project, ...market]
  }, [])

  // 分类选项 + 计数
  const categories = React.useMemo<CategoryOption[]>(() => {
    const counts: Record<string, number> = {
      all: allPlugins.length,
      builtin: PROJECT_PLUGINS.length,
      market: MARKET_PLUGINS.length,
      mcp: 0,
      agent: 0,
      workflow: 0,
      tool: 0,
      model: 0,
      ide: 0,
      knowledge: 0,
      creation: 0,
    }
    for (const p of allPlugins) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return [
      { key: 'all' as Filter, label: t('catAll'), count: counts.all },
      { key: 'builtin' as Filter, label: t('catBuiltin'), count: counts.builtin },
      { key: 'market' as Filter, label: t('catMarket'), count: counts.market },
      { key: 'mcp' as Filter, label: t('catMcp'), count: counts.mcp },
      { key: 'agent' as Filter, label: t('catAgent'), count: counts.agent },
      { key: 'workflow' as Filter, label: t('catWorkflow'), count: counts.workflow },
      { key: 'tool' as Filter, label: t('catTool'), count: counts.tool },
      { key: 'model' as Filter, label: t('catModel'), count: counts.model },
      { key: 'ide' as Filter, label: t('catIde'), count: counts.ide },
      { key: 'knowledge' as Filter, label: t('catKnowledge'), count: counts.knowledge },
      { key: 'creation' as Filter, label: t('catCreation'), count: counts.creation },
    ].filter((c) => c.count > 0)
  }, [allPlugins, t])

  // 过滤 + 排序
  const filtered = React.useMemo(() => {
    let list = allPlugins
    if (filter === 'builtin') {
      list = list.filter((p) => p.source === 'project')
    } else if (filter === 'market') {
      list = list.filter((p) => p.source === 'market')
    } else if (filter !== 'all') {
      list = list.filter((p) => p.category === filter)
    }

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }

    if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }

    return list
  }, [allPlugins, filter, query, sort])

  // 按来源分组渲染
  const projectList = filtered.filter((p) => p.source === 'project')
  const marketList = filtered.filter((p) => p.source === 'market')

  return (
    <div className="space-y-6">
      {/* 工具栏:搜索 + 排序 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-9 pr-9 [&>span]:translate-y-[0.5px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('clear')}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
          <span className="text-xs text-muted-foreground">{t('sortLabel')}</span>
          <div className="flex rounded-md bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setSort('default')}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                sort === 'default' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('sortDefault')}
            </button>
            <button
              type="button"
              onClick={() => setSort('name')}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                sort === 'name' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('sortName')}
            </button>
          </div>
        </div>
      </div>

      {/* 分类筛选标签 */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setFilter(cat.key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors [&>span]:translate-y-[0.5px]',
              filter === cat.key
                ? 'bg-foreground/10 text-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span>{cat.label}</span>
            <span className="text-[10px] opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* 统计行 */}
      <div className="text-xs text-muted-foreground [&>span]:translate-y-[0.5px]">
        <span>{t('resultCount', { count: filtered.length })}</span>
      </div>

      {/* 空状态 */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t('emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{t('emptyDesc')}</p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="mt-4 rounded-md bg-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/15"
          >
            {t('emptyReset')}
          </button>
        </div>
      )}

      {/* 项目内置插件区 */}
      {projectList.length > 0 && (
        <section>
          <SectionHeader
            title={t('sectionProject')}
            desc={t('sectionProjectDesc')}
            count={projectList.length}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projectList.map((p) => (
              <ProjectPluginCard key={p.id} plugin={p} openLabel={t('open')} builtinLabel={t('builtin')} />
            ))}
          </div>
        </section>
      )}

      {/* 市场插件区 */}
      {marketList.length > 0 && (
        <section>
          <SectionHeader
            title={t('sectionMarket')}
            desc={t('sectionMarketDesc')}
            count={marketList.length}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {marketList.map((p) => (
              <MarketPluginCard
                key={p.id}
                plugin={p}
                visitLabel={t('visit')}
                officialLabel={t('official')}
                freeLabel={t('free')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ title, desc, count }: { title: string; desc: string; count: number }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
        <span>{count}</span>
      </span>
    </div>
  )
}

function ProjectPluginCard({
  plugin,
  openLabel,
  builtinLabel,
}: {
  plugin: ProjectPlugin
  openLabel: string
  builtinLabel: string
}) {
  const Icon = plugin.icon
  return (
    <Link
      href={plugin.href}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
    >
      <Card className="flex h-full flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight">{plugin.name}</h3>
            <span className="mt-0.5 inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 [&>span]:translate-y-[0.5px]">
              <Shield className="mr-0.5 h-3 w-3" />
              <span>{builtinLabel}</span>
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

function MarketPluginCard({
  plugin,
  visitLabel,
  officialLabel,
  freeLabel,
}: {
  plugin: MarketPlugin
  visitLabel: string
  officialLabel: string
  freeLabel: string
}) {
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
                {officialLabel}
              </span>
            )}
            {plugin.free && (
              <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                <Gift className="mr-0.5 h-3 w-3" />
                {freeLabel}
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
      <Link
        href={plugin.url}
        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
      >
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

// 局部 cn 工具(避免引入额外依赖,保持最小化)
function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
