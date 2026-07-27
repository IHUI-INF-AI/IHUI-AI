'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Search, Sparkles, ExternalLink, Loader2, Wand2, Code, FileText } from 'lucide-react'

import { listAiSkills, type AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import { Badge } from '@/components/data'
import { cn } from '@/lib/utils'

/**
 * AI Skills TOP 列表页 — 2026-07-23 新增
 *
 * 定位:把 Skill 库弹窗的 AI Skills TOP tab 升级为独立全屏页面。
 * 路由:`/ai-skills`(列表)+ `/ai-skills/[id]`(详情)。
 *
 * 行为:
 * - 顶部:标题 + 总数(19 个,真集成 X 个)+ 搜索框
 * - Tab 切换:全部 / 已上线 / 即将上线
 * - 列表:2-3 列响应式网格,每项 Card 含 icon/name/状态徽章/描述/tags
 * - 点击 → 跳到 `/ai-skills/[id]`
 */

type TabKey = 'all' | 'available' | 'coming'

const CATEGORY_ICON: Record<AiSkillMeta['category'], React.ComponentType<{ className?: string }>> = {
  code: Code,
  media: FileText,
  'ai-top': Sparkles,
}

const CATEGORY_LABEL_KEY: Record<AiSkillMeta['category'], string> = {
  code: 'categoryCode',
  media: 'categoryMedia',
  'ai-top': 'categoryAiTop',
}

async function fetchAll(): Promise<AiSkillMeta[]> {
  const r = await listAiSkills()
  if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
  return r.data
}

export default function AiSkillsPage() {
  const t = useTranslations('aiSkillsPage')
  const [activeTab, setActiveTab] = React.useState<TabKey>('all')
  const [keyword, setKeyword] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-skills', 'list'],
    queryFn: fetchAll,
  })

  const all = data ?? []
  const availableCount = all.filter((s) => s.available).length
  const comingCount = all.length - availableCount

  const filtered = React.useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return all
      .filter((s) => {
        if (activeTab === 'available' && !s.available) return false
        if (activeTab === 'coming' && s.available) return false
        if (!k) return true
        return (
          s.name.toLowerCase().includes(k) ||
          s.description.toLowerCase().includes(k) ||
          s.tags.some((tag) => tag.toLowerCase().includes(k))
        )
      })
      .sort((a, b) => {
        // 已上线优先 + 同状态按 name 升序
        if (a.available !== b.available) return a.available ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [all, activeTab, keyword])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* 顶部:标题 + 统计 */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>
            {t('totalCount', { total: all.length, available: availableCount })}
          </span>
          <Badge variant="success">{t('availableCount', { count: availableCount })}</Badge>
          <Badge variant="default">{t('comingCount', { count: comingCount })}</Badge>
        </div>
      </header>

      {/* 搜索框 + Tab 栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { key: 'all', label: t('tabAll') },
              { key: 'available', label: t('tabAvailable') },
              { key: 'coming', label: t('tabComingSoon') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
        </div>
      </div>

      {/* 列表区 */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="rounded-md border bg-card py-16 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SkillCardProps {
  skill: AiSkillMeta
}

function SkillCard({ skill }: SkillCardProps) {
  const t = useTranslations('aiSkillsPage')
  const td = useTranslations('aiSkillDetail')
  const Icon = CATEGORY_ICON[skill.category] ?? Wand2

  return (
    <Link
      href={`/ai-skills/${skill.id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-accent/30"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-tight text-foreground">
              {skill.name}
            </span>
            <Badge variant={skill.available ? 'success' : 'default'}>
              {skill.available ? td('statusAvailable') : td('statusComingSoon')}
            </Badge>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
            {t(CATEGORY_LABEL_KEY[skill.category] as 'categoryCode')}
          </div>
        </div>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {skill.description}
      </p>

      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5 text-[11px]">
        <span className="text-muted-foreground/70">{skill.id}</span>
        {skill.available ? (
          <span className="inline-flex items-center gap-0.5 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            {t('viewDetail')}
            <ExternalLink className="h-3 w-3" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
            {t('viewDetail')}
            <ExternalLink className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  )
}
