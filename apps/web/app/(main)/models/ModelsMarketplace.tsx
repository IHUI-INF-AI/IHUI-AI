'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Cpu,
  Gift,
  Grid2x2,
  Heart,
  List,
  RotateCcw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'

import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { BrandIcon } from '@/components/ai/brand-icon'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import { cn } from '@/lib/utils'

import { ModelDetailDialog } from './ModelDetailDialog'
import { getFavoriteModelIds, toggleFavoriteModel } from './helpers'
import type { Model, QuickFilter, SortKey, ViewMode } from './types'

interface Props {
  list: Model[]
}

const QUICK_FILTERS: QuickFilter[] = [
  'favorite',
  'free',
  'longContext',
  'reasoning',
  'vision',
  'coding',
  'chinese',
  'openSource',
]

const SORT_KEYS: SortKey[] = ['recommended', 'priceAsc', 'priceDesc', 'contextDesc', 'nameAsc']

const INITIAL_PAGE_SIZE = 24
const PAGE_SIZE_STEP = 12

/**
 * 模型市场客户端组件
 *
 * 功能矩阵:
 * - 搜索(模糊匹配 name / id / provider / 厂商中文名)
 * - 快捷能力筛选(全部 / 收藏 / 免费 / 长上下文 / 推理 / 视觉 / 编程 / 中文优化 / 开源)
 * - 排序(推荐 / 价格↑ / 价格↓ / 上下文↑ / 名称 A-Z)
 * - 视图切换(网格 / 列表)
 * - 卡片点击 → 详情对话框
 * - "立即体验" → setModel + openPanel + router.push('/chat') SPA 导航,无全页刷新
 * - 加载更多(初始 24,每次 +12,避免 100+ 卡片一次性渲染卡顿)
 * - 空态带"重置筛选"按钮
 *
 * 项目规范遵守:
 * - 无 rounded-full 容器(改用 rounded-md / rounded-lg)
 * - 无单边 border 分割线(改用容器背景色对比 + gap)
 * - icon + 中文 span 父容器加 [&>span]:translate-y-[0.5px] 视觉居中
 * - 输入框 focus 用 ring/20,无蓝光描边
 */
export function ModelsMarketplace({ list }: Props) {
  const t = useTranslations('models')
  const router = useRouter()
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const setModel = useChatStore((s) => s.setModel)

  const [query, setQuery] = React.useState('')
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter | 'all'>('all')
  const [sortKey, setSortKey] = React.useState<SortKey>('recommended')
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_PAGE_SIZE)
  const [selected, setSelected] = React.useState<Model | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  // 收藏模型 id 集合(localStorage 持久化)
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(() => getFavoriteModelIds())
  // 收藏状态变更标记,触发筛选重算
  const [favoriteTick, setFavoriteTick] = React.useState(0)

  // 收集所有能力标签(用于卡片 tag 展示,不再单独提供筛选,filter 由 quickFilter 承担)
  const allCapabilities = React.useMemo(() => {
    const set = new Set<string>()
    list.forEach((m) => m.features.forEach((f) => set.add(f)))
    return Array.from(set).sort()
  }, [list])

  const matchesQuickFilter = React.useCallback(
    (m: Model, filter: QuickFilter | 'all'): boolean => {
      if (filter === 'all') return true
      switch (filter) {
        case 'free':
          return m.inputPrice === 0
        case 'longContext':
          return m.contextLength >= 200000
        case 'reasoning':
          return m.features.some((f) => f === 'Reasoning')
        case 'vision':
          return m.features.some((f) => f === 'Vision' || f === 'Multimodal')
        case 'coding':
          return m.features.some((f) => f === 'Coding')
        case 'chinese':
          return m.features.some((f) => f === 'Chinese-Optimized' || f === 'Bilingual')
        case 'openSource':
          return m.features.some((f) => f === 'Open Source')
        case 'favorite':
          return favoriteIds.has(m.id)
        default:
          return true
      }
    },
    // favoriteTick 用于在 favoriteIds 变化时让 useMemo/useCallback 重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favoriteTick],
  )

  const handleToggleFavorite = React.useCallback((modelId: string) => {
    const ids = toggleFavoriteModel(modelId)
    setFavoriteIds(new Set(ids))
    setFavoriteTick((t) => t + 1)
  }, [])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((m) => {
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        t(`providers.${m.provider}`).toLowerCase().includes(q) ||
        m.features.some((f) => f.toLowerCase().includes(q))
      const matchFilter = matchesQuickFilter(m, quickFilter)
      return matchQuery && matchFilter
    })
  }, [list, query, quickFilter, matchesQuickFilter, t])

  const sorted = React.useMemo(() => {
    const arr = [...filtered]
    switch (sortKey) {
      case 'recommended':
        return arr.sort((a, b) => {
          if (a.highlight !== b.highlight) return a.highlight ? -1 : 1
          const pa = a.popularity ?? 50
          const pb = b.popularity ?? 50
          if (pa !== pb) return pb - pa
          return a.name.localeCompare(b.name, 'zh-CN')
        })
      case 'priceAsc':
        return arr.sort(
          (a, b) => a.inputPrice - b.inputPrice || a.name.localeCompare(b.name, 'zh-CN'),
        )
      case 'priceDesc':
        return arr.sort(
          (a, b) => b.inputPrice - a.inputPrice || a.name.localeCompare(b.name, 'zh-CN'),
        )
      case 'contextDesc':
        return arr.sort((a, b) => b.contextLength - a.contextLength)
      case 'nameAsc':
        return arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      default:
        return arr
    }
  }, [filtered, sortKey])

  // 筛选 / 排序变化时重置分页
  React.useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE)
  }, [query, quickFilter, sortKey])

  const visible = React.useMemo(
    () => sorted.slice(0, Math.min(visibleCount, sorted.length)),
    [sorted, visibleCount],
  )

  const freeTotal = React.useMemo(() => list.filter((m) => m.inputPrice === 0).length, [list])
  const highlightTotal = React.useMemo(() => list.filter((m) => m.highlight).length, [list])
  const favoriteTotal = React.useMemo(
    () => list.filter((m) => favoriteIds.has(m.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, favoriteTick],
  )

  const handleTryModel = React.useCallback(
    (m: Model) => {
      setModel(m.id)
      openPanel()
      router.push('/chat')
    },
    [setModel, openPanel, router],
  )

  const handleCardClick = React.useCallback((m: Model) => {
    setSelected(m)
    setDialogOpen(true)
  }, [])

  const handleResetFilters = React.useCallback(() => {
    setQuery('')
    setQuickFilter('all')
    setSortKey('recommended')
  }, [])

  const handleLoadMore = React.useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE_STEP)
  }, [])

  return (
    <div className="space-y-4">
      {/* 工具栏:搜索 + 排序 + 视图切换 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-9 w-[140px] gap-1.5 rounded-md text-xs">
              <SelectValue placeholder={t('sort.recommended')} />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {t(`sort.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
            <button
              type="button"
              aria-label={t('view.grid')}
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors',
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Grid2x2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t('view.list')}
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors',
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 快捷能力筛选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={quickFilter === 'all'}
          onClick={() => setQuickFilter('all')}
          label={t('market.allCapabilities')}
        />
        {QUICK_FILTERS.map((f) => (
          <FilterChip
            key={f}
            active={quickFilter === f}
            onClick={() => setQuickFilter(f)}
            label={t(`quickFilters.${f}`)}
            icon={f === 'favorite' ? <Heart className="h-3 w-3" /> : undefined}
          />
        ))}
      </div>

      {/* 结果统计 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground [&>span]:translate-y-[0.5px]">
        <span>{t('market.resultCount', { count: filtered.length, total: list.length })}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="inline-flex items-center gap-0.5">
          <Gift className="h-3 w-3 text-emerald-500" />
          {t('market.freeCount', { count: freeTotal })}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="inline-flex items-center gap-0.5">
          <Sparkles className="h-3 w-3 text-amber-500" />
          {t('market.highlightCount', { count: highlightTotal })}
        </span>
        {favoriteTotal > 0 && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Heart className="h-3 w-3 text-rose-500" />
              {t('market.favoriteCount', { count: favoriteTotal })}
            </span>
          </>
        )}
      </div>

      {/* 卡片网格 / 列表 */}
      {visible.length === 0 ? (
        <EmptyState onReset={handleResetFilters} />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <ModelCardGrid
              key={m.id}
              model={m}
              allCapabilities={allCapabilities}
              isFavorite={favoriteIds.has(m.id)}
              onCardClick={handleCardClick}
              onTry={handleTryModel}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((m) => (
            <ModelCardList
              key={m.id}
              model={m}
              isFavorite={favoriteIds.has(m.id)}
              onCardClick={handleCardClick}
              onTry={handleTryModel}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* 加载更多 */}
      {visible.length < sorted.length && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={handleLoadMore} className="gap-1.5">
            {t('market.loadMore', { count: sorted.length - visible.length })}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 详情对话框 */}
      <ModelDetailDialog model={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

/* ---------------- Sub Components ---------------- */

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors [&>span]:translate-y-[0.5px]',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ModelCardGrid({
  model,
  allCapabilities: _allCapabilities,
  isFavorite,
  onCardClick,
  onTry,
  onToggleFavorite,
}: {
  model: Model
  allCapabilities: string[]
  isFavorite: boolean
  onCardClick: (m: Model) => void
  onTry: (m: Model) => void
  onToggleFavorite: (id: string) => void
}) {
  const t = useTranslations('models')
  const outputPrice = model.outputPrice ?? model.inputPrice * 3
  const vendorLabel = t(`providers.${model.provider}`)
  const description = model.description ? t(model.description) : t('market.defaultDescription')

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onCardClick(model)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick(model)
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring/20"
    >
      {/* 收藏星标按钮(右上角) */}
      <FavoriteStar
        isFavorite={isFavorite}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(model.id)
        }}
        className="absolute right-3 top-3"
      />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <BrandIcon vendor={model.provider} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold leading-tight [&>span]:translate-y-[0.5px]">
            <span className="truncate">
              {model.name.startsWith('model.') ? t(model.name) : model.name}
            </span>
            {model.highlight && (
              <Sparkles
                className="h-3 w-3 shrink-0 text-amber-500"
                aria-label={t('detail.highlight')}
              />
            )}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{vendorLabel}</p>
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{description}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-muted-foreground [&>span]:translate-y-[0.5px]">
            <Cpu className="h-3 w-3" />
            <span>{t('contextLength')}</span>
          </div>
          <div className="mt-0.5 truncate font-medium text-foreground">
            {formatContext(model.contextLength)}
          </div>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-muted-foreground [&>span]:translate-y-[0.5px]">
            <Zap className="h-3 w-3" />
            <span>{t('market.inputPrice')}</span>
          </div>
          <div className="mt-0.5 truncate font-medium text-foreground">
            {model.inputPrice === 0 ? t('free') : `$${model.inputPrice.toFixed(2)}`}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs [&>span]:translate-y-[0.5px]">
        <span className="text-muted-foreground">{t('market.outputPrice')}</span>
        <span className="font-medium text-foreground">
          {outputPrice === 0 ? t('free') : `$${outputPrice.toFixed(2)}`}
          <span className="ml-1 text-muted-foreground">{t('perMillion')}</span>
        </span>
      </div>

      {model.features.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.features.slice(0, 4).map((f) => (
            <span
              key={f}
              className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-auto h-8 w-full gap-1.5 text-xs [&>span]:translate-y-[0.5px]"
        onClick={(e) => {
          e.stopPropagation()
          onTry(model)
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t('market.tryNow')}</span>
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </Card>
  )
}

function ModelCardList({
  model,
  isFavorite,
  onCardClick,
  onTry,
  onToggleFavorite,
}: {
  model: Model
  isFavorite: boolean
  onCardClick: (m: Model) => void
  onTry: (m: Model) => void
  onToggleFavorite: (id: string) => void
}) {
  const t = useTranslations('models')
  const vendorLabel = t(`providers.${model.provider}`)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onCardClick(model)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick(model)
        }
      }}
      className="group flex cursor-pointer items-center gap-3 p-3 transition-all hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/20"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <BrandIcon vendor={model.provider} size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 [&>span]:translate-y-[0.5px]">
          <span className="truncate text-sm font-semibold">
            {model.name.startsWith('model.') ? t(model.name) : model.name}
          </span>
          {model.highlight && (
            <Sparkles
              className="h-3 w-3 shrink-0 text-amber-500"
              aria-label={t('detail.highlight')}
            />
          )}
          <span className="truncate text-xs text-muted-foreground">{vendorLabel}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground [&>span]:translate-y-[0.5px]">
          <span className="inline-flex items-center gap-0.5">
            <Cpu className="h-3 w-3" />
            {formatContext(model.contextLength)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Zap className="h-3 w-3" />
            {model.inputPrice === 0 ? t('free') : `$${model.inputPrice.toFixed(2)}`}
            <span className="text-muted-foreground/70">/{t('perMillion').replace('/', '')}</span>
          </span>
          {model.features.slice(0, 2).map((f) => (
            <span
              key={f}
              className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <FavoriteStar
        isFavorite={isFavorite}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(model.id)
        }}
        className="shrink-0"
      />

      <Button
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2.5 text-xs [&>span]:translate-y-[0.5px]"
        onClick={(e) => {
          e.stopPropagation()
          onTry(model)
        }}
      >
        <Sparkles className="h-3 w-3" />
        <span>{t('market.tryNow')}</span>
      </Button>
    </Card>
  )
}

/** 收藏星标按钮:点击切换收藏状态,stopPropagation 防止触发卡片点击 */
function FavoriteStar({
  isFavorite,
  onClick,
  className,
}: {
  isFavorite: boolean
  onClick: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? '取消收藏' : '收藏模型'}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-accent',
        isFavorite ? 'text-rose-500' : 'text-muted-foreground/60 hover:text-rose-500',
        className,
      )}
    >
      <Heart
        className={cn(
          'h-3.5 w-3.5 transition-transform hover:scale-110',
          isFavorite && 'fill-current',
        )}
      />
    </button>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  const t = useTranslations('models')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Search className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{t('market.empty')}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t('market.resetFilters')}
      </Button>
    </div>
  )
}

function formatContext(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}
