// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Sparkles,
  ExternalLink,
  Loader2,
  Wand2,
  Code,
  FileText,
  ChevronRight,
  Upload,
  BarChart3,
} from 'lucide-react'

import {
  listAiSkills,
  getAiSkillRecommendations,
  getAiSkillStats,
  importAiSkill,
  type AiSkillMeta,
  type PerSkillStats,
} from '@ihui/api-client/endpoints/ai-skills'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'
import { Tooltip } from '@/components/feedback'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  SearchInput,
} from '@ihui/ui-react'

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

const CATEGORY_ICON: Record<
  AiSkillMeta['category'],
  React.ComponentType<{ className?: string }>
> = {
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
  const r = await listAiSkills({ category: 'all' })
  if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
  return r.data
}

export default function AiSkillsPageClient() {
  const t = useTranslations('aiSkillsPage')
  const td = useTranslations('aiSkillDetail')
  const [activeTab, setActiveTab] = React.useState<TabKey>('all')
  // P3 #37(2026-09-16 立):Skill 市场产品化——热度排序(stats.perSkill 调用数)
  const [sortKey, setSortKey] = React.useState<'name' | 'hot'>('name')
  const [keyword, setKeyword] = React.useState('')
  const [importOpen, setImportOpen] = React.useState(false)
  const [importJson, setImportJson] = React.useState('')
  const [importing, setImporting] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-skills', 'list'],
    queryFn: fetchAll,
  })

  // 使用热度(skillName → 调用数/成功率),卡片徽章 + 热度排序数据源
  const statsQuery = useQuery({
    queryKey: ['ai-skills', 'stats'],
    queryFn: () => getAiSkillStats(),
    staleTime: 60_000,
  })
  const statsMap = React.useMemo(() => {
    const m = new Map<string, PerSkillStats>()
    // ApiResult 判别联合:narrow success 后才可访问 data
    const r = statsQuery.data
    if (r?.success) {
      for (const s of r.data.perSkill ?? []) m.set(s.skillName, s)
    }
    return m
  }, [statsQuery.data])

  const handleImport = async () => {
    if (!importJson.trim()) {
      toast.error(t('importJsonEmpty'))
      return
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(importJson.trim())
    } catch {
      toast.error(t('importJsonInvalid'))
      return
    }
    if (!parsed.name || typeof parsed.name !== 'string') {
      toast.error(t('importNameRequired'))
      return
    }
    setImporting(true)
    try {
      const r = await importAiSkill({
        name: parsed.name as string,
        description: (parsed.description as string) ?? '',
        icon: (parsed.icon as string) ?? 'wand2',
        category: (parsed.category as string) ?? 'ai-top',
        tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : [],
        promptTemplate: (parsed.promptTemplate as string) ?? '',
        sourceUrl: (parsed.sourceUrl as string) ?? '',
      })
      if (r.success) {
        toast.success(t('importSuccess', { name: parsed.name as string }))
        setImportOpen(false)
        setImportJson('')
      } else {
        toast.error(r.error ?? t('importFailed'))
      }
    } catch {
      toast.error(t('importFailed'))
    } finally {
      setImporting(false)
    }
  }

  const availableCount = data?.filter((s) => s.available).length ?? 0
  const comingCount = (data?.length ?? 0) - availableCount

  const filtered = React.useMemo(() => {
    const all = data ?? []
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
        // 已上线优先
        if (a.available !== b.available) return a.available ? -1 : 1
        // P3 #37:热度排序 = stats 调用数降序(无数据排最后);默认按名称
        if (sortKey === 'hot') {
          const ca = statsMap.get(a.name)?.callCount ?? -1
          const cb = statsMap.get(b.name)?.callCount ?? -1
          if (ca !== cb) return cb - ca
        }
        return a.name.localeCompare(b.name)
      })
  }, [data, activeTab, keyword, sortKey, statsMap])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4">
      <BackButton />
      {/* 顶部:标题 + 统计 */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1 rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90"
          >
            <Upload className="h-3.5 w-3.5" />
            {td('importBtn')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>{t('totalCount', { total: data?.length ?? 0, available: availableCount })}</span>
          <Badge variant="success">{t('availableCount', { count: availableCount })}</Badge>
          <Badge variant="default">{t('comingCount', { count: comingCount })}</Badge>
        </div>
      </header>

      {/* 推荐技能区 */}
      <RecommendSection />

      {/* 搜索框 + Tab 栏 */}
      <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
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
        <SearchInput
          wrapperClassName="w-full min-[640px]:max-w-xs"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
        {/* P3 #37:排序切换(名称 / 热度),热度=stats 调用数降序 */}
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { key: 'name', label: t('sortName') },
              { key: 'hot', label: t('sortHot') },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              aria-pressed={sortKey === opt.key}
              data-testid={`skills-sort-${opt.key}`}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                sortKey === opt.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表区 */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
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
        <div className="rounded-md border bg-card py-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard key={skill.id} skill={skill} stats={statsMap.get(skill.name)} />
          ))}
        </div>
      )}

      {/* 导入对话框 */}
      <Dialog
        open={importOpen}
        onOpenChange={(v) => {
          if (!v) setImportOpen(false)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('importTitle')}</DialogTitle>
            <DialogDescription>{t('importDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={t('importPlaceholder')}
              rows={10}
              className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-mono outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(false)
                setImportJson('')
              }}
            >
              {t('importCancel')}
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('importing')}
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {t('importConfirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SkillCardProps {
  skill: AiSkillMeta
  /** P3 #37:使用热度(stats.perSkill;有调用记录才显示徽章) */
  stats?: PerSkillStats
}

function SkillCard({ skill, stats }: SkillCardProps) {
  const t = useTranslations('aiSkillsPage')
  const td = useTranslations('aiSkillDetail')
  const Icon = CATEGORY_ICON[skill.category] ?? Wand2

  return (
    <Link
      href={`/ai-skills/${skill.id}`}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-accent/30"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cta/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
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
        {/* P3 #37:热度徽章(调用数/成功率;无调用记录不显示) */}
        {stats && stats.callCount > 0 && (
          <Tooltip
            content={t('hotBadgeTitle', {
              calls: stats.callCount,
              rate: Math.round(stats.successRate * 100),
            })}
          >
            <span
              className="inline-flex shrink-0 flex-col items-end text-[10px] tabular-nums text-muted-foreground"
              data-testid={`skill-hot-${skill.id}`}
            >
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground/80">
                <BarChart3 className="h-3 w-3" />
                {t('hotBadgeCalls', { calls: stats.callCount })}
              </span>
              <span>{t('hotBadgeRate', { rate: Math.round(stats.successRate * 100) })}</span>
            </span>
          </Tooltip>
        )}
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

function RecommendSection() {
  const t = useTranslations('aiSkillsPage')

  const { data: response, isLoading } = useQuery({
    queryKey: ['ai-skills', 'recommendations'],
    queryFn: () => getAiSkillRecommendations({ top_k: 6 }),
  })

  const recommendations = React.useMemo(() => {
    if (!response?.success || !response.data) return []
    return response.data.filter((s) => s.available)
  }, [response])

  // loading: 显示旋转加载图标
  if (isLoading) {
    return (
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">{t('recommendTitle')}</h2>
          </div>
          <Link
            href="/ai-skills"
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('recommendHint')}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </section>
    )
  }

  // error: 静默不显示
  if (response && !response.success) return null

  // empty: 不显示该区块
  if (recommendations.length === 0) return null

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">{t('recommendTitle')}</h2>
        </div>
        <Link
          href="/ai-skills"
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('recommendHint')}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
        {recommendations.map((skill) => {
          const Icon = CATEGORY_ICON[skill.category as keyof typeof CATEGORY_ICON] ?? Wand2
          return (
            <Link
              key={skill.skill_id}
              href={`/ai-skills/${skill.skill_id}`}
              className="group flex min-w-[200px] max-w-[240px] shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 hover:bg-accent/30"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cta/10 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {skill.name}
                  </span>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {t(
                      CATEGORY_LABEL_KEY[
                        skill.category as keyof typeof CATEGORY_LABEL_KEY
                      ] as 'categoryCode',
                    )}
                  </div>
                </div>
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {skill.description}
              </p>
              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* 推荐理由 */}
              {skill.reason && (
                <p className="text-[10px] leading-relaxed text-muted-foreground/60 italic">
                  {skill.reason}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
