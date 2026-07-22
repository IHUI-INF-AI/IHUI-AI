'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, GitCompare, Search } from 'lucide-react'
import type { LeaderboardEntry, LeaderboardCategory } from '@/lib/ai-news-api'
import { ModelDetailDialog } from './ModelDetailDialog'
import { ModelCompareBar } from './ModelCompareBar'
import { ModelCompareDialog } from './ModelCompareDialog'
import { parseNumeric, highlight } from './text-utils'
// 向后兼容:旧导入 `import { parseNumeric } from './Leaderboard'` 仍可用
export { parseNumeric } from './text-utils'
import { toast } from 'sonner'

interface Props {
  entries: LeaderboardEntry[]
}

/** 可排序字段 */
type SortField =
  | 'arenaScore'
  | 'winRate'
  | 'voteCount'
  | 'contextWindow'
  | 'maxOutput'
  | 'inputPrice'
  | 'outputPrice'
  | 'releaseDate'

type SortDir = 'asc' | 'desc'

/** localStorage 排序偏好:按分类记忆 sortField + sortDir */
const SORT_PREF_KEY = 'leaderboard-sort-pref'
const DEFAULT_SORT = { field: 'arenaScore' as SortField, dir: 'desc' as SortDir }

function readSortPref(category: string): { field: SortField; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_PREF_KEY)
    if (!raw) return DEFAULT_SORT
    const all = JSON.parse(raw) as Record<string, { field: SortField; dir: SortDir }>
    return all[category] ?? DEFAULT_SORT
  } catch {
    return DEFAULT_SORT
  }
}

function writeSortPref(category: string, field: SortField, dir: SortDir) {
  try {
    const raw = localStorage.getItem(SORT_PREF_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, { field: SortField; dir: SortDir }>) : {}
    all[category] = { field, dir }
    localStorage.setItem(SORT_PREF_KEY, JSON.stringify(all))
  } catch {
    // SSR / 隐私模式 / 配额溢出,静默降级
  }
}

/** localStorage 对比列表:只存 id 数组,恢复时按 id 匹配 entries */
const COMPARE_KEY = 'ai-news-compare-list'

function readCompareList(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function writeCompareList(entries: LeaderboardEntry[]) {
  try {
    const ids = entries.map((e) => e.id)
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids))
  } catch {
    // SSR / 隐私模式 / 配额溢出,静默降级
  }
}

/** 分类 Tab 配置(labelKey 指向 i18n 键,运行时用 t() 读取) */
const CATEGORY_TABS: Array<{ key: LeaderboardCategory; labelKey: string; icon: string }> = [
  { key: 'overall', labelKey: 'leaderboard.categoryOverall', icon: '🏆' },
  { key: 'llm', labelKey: 'leaderboard.categoryLlm', icon: '💬' },
  { key: 'image', labelKey: 'leaderboard.categoryImage', icon: '🎨' },
  { key: 'video', labelKey: 'leaderboard.categoryVideo', icon: '🎬' },
  { key: 'multimodal', labelKey: 'leaderboard.categoryMultimodal', icon: '🔮' },
  { key: 'agent', labelKey: 'leaderboard.categoryAgent', icon: '🤖' },
  { key: 'audio', labelKey: 'leaderboard.categoryAudio', icon: '🎵' },
  { key: 'embedding', labelKey: 'leaderboard.categoryEmbedding', icon: '📐' },
]

/** LLM 子分类 Tab */
const LLM_SUBCATS: Array<{ key: string; labelKey: string }> = [
  { key: 'general', labelKey: 'leaderboard.subcatGeneral' },
  { key: 'coding', labelKey: 'leaderboard.subcatCoding' },
  { key: 'reasoning', labelKey: 'leaderboard.subcatReasoning' },
]

/** 排名颜色:Top 3 高亮 */
function rankBg(idx: number): string {
  if (idx === 0) return 'bg-amber-500 text-white'
  if (idx === 1) return 'bg-slate-400 text-white'
  if (idx === 2) return 'bg-orange-700 text-white'
  return 'bg-muted text-muted-foreground'
}

/** 排名变化箭头 */
function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[10px] text-muted-foreground/40">NEW</span>
  if (delta > 0) return <span className="inline-flex items-center text-[10px] font-medium text-emerald-600"><TrendingUp className="h-2.5 w-2.5" />{delta}</span>
  if (delta < 0) return <span className="inline-flex items-center text-[10px] font-medium text-rose-600"><TrendingDown className="h-2.5 w-2.5" />{Math.abs(delta)}</span>
  return <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />
}

/** 格式化投票数 */
function formatVotes(n: number | null): string {
  if (n === null) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

/**
 * 大模型排行榜(参考 arena.ai/leaderboard)。
 * 竖向排列模型行(排名 + 模型名 + 厂商 + 评分 + 胜率 + 价格 + 上下文 + 发布时间)。
 * 分类 Tab 切换(总榜 + 6 类 + Agent),LLM 类有子分类 Tab。
 */
export function Leaderboard({ entries }: Props) {
  const t = useTranslations('aiNews')
  const [activeCategory, setActiveCategory] = React.useState<LeaderboardCategory>('overall')
  const [activeSubcat, setActiveSubcat] = React.useState<string>('general')
  const [selectedEntry, setSelectedEntry] = React.useState<LeaderboardEntry | null>(null)
  // 列排序:从 localStorage 恢复 overall 分类的偏好
  const [sortField, setSortField] = React.useState<SortField>(() => readSortPref('overall').field)
  const [sortDir, setSortDir] = React.useState<SortDir>(() => readSortPref('overall').dir)
  const [compareList, setCompareList] = React.useState<LeaderboardEntry[]>([])
  const [showCompareDialog, setShowCompareDialog] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [activeVendor, setActiveVendor] = React.useState<string | null>(null)

  // 按当前 Tab 过滤 + 搜索 + 厂商筛选
  const filtered = React.useMemo(() => {
    let list: LeaderboardEntry[]
    if (activeCategory === 'overall') {
      list = entries.filter((e) => e.isOverall)
    } else {
      list = entries.filter((e) => e.category === activeCategory && !e.isOverall)
      if (activeCategory === 'llm' && activeSubcat) {
        list = list.filter((e) => e.subcategory === activeSubcat)
      }
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((e) =>
        e.modelName.toLowerCase().includes(q) ||
        e.vendor.toLowerCase().includes(q)
      )
    }
    if (activeVendor) {
      list = list.filter((e) => e.vendor === activeVendor)
    }
    return list
  }, [entries, activeCategory, activeSubcat, searchQuery, activeVendor])

  // 当前分类下唯一厂商列表(用于厂商筛选 chip)
  const vendors = React.useMemo(() => {
    const set = new Set<string>()
    filtered.forEach((e) => set.add(e.vendor))
    return Array.from(set).sort()
  }, [filtered])

  // 排序:null 值永远排末尾(不管 asc/desc)
  const sorted = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    // 预计算每项的数值化字段,避免 sort 回调内重复 parseNumeric
    const cache = new Map<string, Record<SortField, number | string | null>>()
    for (const e of filtered) {
      cache.set(e.id, {
        arenaScore: e.arenaScore,
        winRate: e.winRate,
        voteCount: e.voteCount,
        contextWindow: parseNumeric(e.contextWindow),
        maxOutput: parseNumeric(e.maxOutput),
        inputPrice: parseNumeric(e.inputPrice),
        outputPrice: parseNumeric(e.outputPrice),
        releaseDate: e.releaseDate,
      })
    }
    return [...filtered].sort((a, b) => {
      const va = cache.get(a.id)![sortField]
      const vb = cache.get(b.id)![sortField]
      // null 排末尾
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [filtered, sortField, sortDir])

  // 点击表头排序:同字段切方向,不同字段切字段并默认降序 + 写入 localStorage
  function toggleSort(field: SortField) {
    if (field === sortField) {
      const next: SortDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(next)
      writeSortPref(activeCategory, field, next)
    } else {
      setSortField(field)
      setSortDir('desc')
      writeSortPref(activeCategory, field, 'desc')
    }
  }

  /** 切换对比列表(最多 5 个) */
  function toggleCompare(entry: LeaderboardEntry) {
    setCompareList((prev) => {
      const exists = prev.some((e) => e.id === entry.id)
      let next: LeaderboardEntry[]
      if (exists) {
        next = prev.filter((e) => e.id !== entry.id)
      } else {
        if (prev.length >= 5) {
          toast.error(t('compare.maxToast'))
          return prev
        }
        next = [...prev, entry]
      }
      writeCompareList(next)
      return next
    })
  }

  // 切换分类时重置子分类 + 恢复该分类的排序偏好 + 重置搜索/厂商筛选
  React.useEffect(() => {
    if (activeCategory !== 'llm') setActiveSubcat('')
    const pref = readSortPref(activeCategory)
    setSortField(pref.field)
    setSortDir(pref.dir)
    setSearchQuery('')
    setActiveVendor(null)
  }, [activeCategory])

  // 从 localStorage 恢复对比列表(按 id 匹配 entries)
  React.useEffect(() => {
    const ids = readCompareList()
    if (ids.length > 0) {
      const restored = entries.filter((e) => ids.includes(e.id))
      if (restored.length > 0) setCompareList(restored)
    }
  }, [entries])

  /** 渲染排序图标 */
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-0.5 inline h-2.5 w-2.5 text-muted-foreground/40" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-0.5 inline h-2.5 w-2.5 text-primary" />
      : <ArrowDown className="ml-0.5 inline h-2.5 w-2.5 text-primary" />
  }

  /** 可排序表头 props */
  function sortableTh(field: SortField, labelKey: string, align: 'left' | 'right' = 'right') {
    return (
      <th
        className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-medium cursor-pointer select-none hover:text-foreground transition-colors`}
        onClick={() => toggleSort(field)}
        title={t('leaderboard.sortHint')}
      >
        <span className="inline-flex items-center">
          {t(labelKey)}
          <SortIcon field={field} />
        </span>
      </th>
    )
  }

  return (
    <section
      aria-label={t('leaderboard.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 bg-primary/5 px-5 py-3">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t('leaderboard.title')}</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">{t('leaderboard.subtitle')}</span>
      </div>

      {/* 分类 Tab */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 px-3 py-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveCategory(tab.key)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              activeCategory === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <span className="text-[10px]">{tab.icon}</span>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* LLM 子分类 Tab */}
      {activeCategory === 'llm' ? (
        <div className="flex items-center gap-1 bg-muted/10 px-3 py-1.5">
          <span className="mr-1 text-[10px] text-muted-foreground">{t('leaderboard.llmSubcatLabel')}</span>
          {LLM_SUBCATS.map((sub) => (
            <button
              key={sub.key}
              type="button"
              onClick={() => setActiveSubcat(sub.key)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                activeSubcat === sub.key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t(sub.labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {/* 搜索 + 厂商筛选 */}
      <div className="space-y-2 border-b bg-muted/10 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('leaderboard.searchPlaceholder')}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-7 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          ) : null}
        </div>
        {vendors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveVendor(null)}
              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                activeVendor === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {t('leaderboard.allVendors')}
            </button>
            {vendors.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveVendor((cur) => (cur === v ? null : v))}
                className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  activeVendor === v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 表格 — 竖向排列模型行,参数横向排列 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2 text-center">
                <GitCompare className="inline h-3 w-3 text-muted-foreground" />
              </th>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{t('leaderboard.colModel')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('leaderboard.colVendor')}</th>
              {sortableTh('arenaScore', 'leaderboard.colArenaScore')}
              {sortableTh('winRate', 'leaderboard.colWinRate')}
              {sortableTh('voteCount', 'leaderboard.colVoteCount')}
              {sortableTh('contextWindow', 'leaderboard.colContextWindow')}
              {sortableTh('maxOutput', 'leaderboard.colMaxOutput')}
              {sortableTh('inputPrice', 'leaderboard.colInputPrice')}
              {sortableTh('outputPrice', 'leaderboard.colOutputPrice')}
              <th className="px-3 py-2 text-center font-medium">{t('leaderboard.colChange')}</th>
              {sortableTh('releaseDate', 'leaderboard.colReleaseDate', 'left')}
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {searchQuery || activeVendor ? (
                    <div className="space-y-2">
                      <p>{t('leaderboard.noMatch')}</p>
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setActiveVendor(null) }}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        {t('leaderboard.clearFilter')}
                      </button>
                    </div>
                  ) : (
                    t('leaderboard.empty')
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((entry, idx) => {
                const rank = entry.arenaRank ?? idx + 1
                return (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="cursor-pointer border-b border-muted/30 transition-colors last:border-0 hover:bg-accent/30"
                  >
                    {/* 对比勾选 */}
                    <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={compareList.some((c) => c.id === entry.id)}
                        onChange={() => toggleCompare(entry)}
                        className="h-3.5 w-3.5 cursor-pointer accent-primary"
                        aria-label={t('compare.label')}
                      />
                    </td>
                    {/* 排名 */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold tabular-nums ${rankBg(idx)}`}>
                        {rank}
                      </span>
                    </td>
                    {/* 模型名 — 单行竖向排列,核心亮点移至详情弹窗 */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold leading-tight">{highlight(entry.modelName, searchQuery)}</span>
                    </td>
                    {/* 厂商 */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{highlight(entry.vendor, searchQuery)}</td>
                    {/* Arena 评分 */}
                    <td className="px-3 py-2.5 text-right">
                      {entry.arenaScore ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold tabular-nums">{entry.arenaScore}</span>
                          {entry.scoreCi ? (
                            <span className="text-[9px] text-muted-foreground">±{entry.scoreCi}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    {/* 胜率 */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {entry.winRate !== null ? `${entry.winRate.toFixed(1)}%` : '-'}
                    </td>
                    {/* 投票数 */}
                    <td className="px-3 py-2.5 text-right text-[10px] tabular-nums text-muted-foreground">
                      {formatVotes(entry.voteCount) || '-'}
                    </td>
                    {/* 上下文窗口 */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {entry.contextWindow ?? '-'}
                    </td>
                    {/* 最大输出 */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {entry.maxOutput ?? '-'}
                    </td>
                    {/* 输入价 */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {entry.inputPrice ?? '-'}
                    </td>
                    {/* 输出价 */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {entry.outputPrice ?? '-'}
                    </td>
                    {/* 排名变化 */}
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <RankDelta delta={entry.rankDelta} />
                      </div>
                    </td>
                    {/* 发布时间 */}
                    <td className="px-3 py-2.5 text-[10px] tabular-nums text-muted-foreground">
                      {entry.releaseDate ?? '-'}
                    </td>
                    {/* 展开箭头 */}
                    <td className="px-3 py-2.5">
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 底部说明 */}
      <div className="flex items-center gap-2 bg-muted/10 px-4 py-2 text-[10px] text-muted-foreground">
        <span>{t('leaderboard.footerDataRef')}</span>
        <span className="ml-auto">{t('leaderboard.sortHint')} · {t('leaderboard.footerClickHint')}</span>
      </div>

      {/* 对比栏 */}
      {compareList.length >= 2 ? (
        <ModelCompareBar
          entries={compareList}
          onRemove={(id) =>
            setCompareList((prev) => {
              const next = prev.filter((e) => e.id !== id)
              writeCompareList(next)
              return next
            })
          }
          onClear={() => {
            setCompareList([])
            writeCompareList([])
          }}
          onCompare={() => setShowCompareDialog(true)}
        />
      ) : null}

      {/* 对比弹窗 */}
      <ModelCompareDialog
        entries={compareList}
        open={showCompareDialog}
        onClose={() => setShowCompareDialog(false)}
      />

      {/* 详情弹窗 */}
      {selectedEntry ? (
        <ModelDetailDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          searchQuery={searchQuery}
        />
      ) : null}
    </section>
  )
}
