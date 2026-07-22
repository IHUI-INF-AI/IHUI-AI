'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { LeaderboardEntry, LeaderboardCategory } from '@/lib/ai-news-api'
import { ModelDetailDialog } from './ModelDetailDialog'

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

/** 把字符串数字("200K" / "1M" / "$3.00/1M")解析为数值用于排序 */
function parseNumeric(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw).trim().toLowerCase()
  // 提取数字部分(含小数)
  const m = s.match(/([\d.]+)\s*([km])?/)
  if (!m || !m[1]) return null
  const n = parseFloat(m[1])
  if (isNaN(n)) return null
  if (m[2] === 'k') return n * 1_000
  if (m[2] === 'm') return n * 1_000_000
  return n
}

/** 分类 Tab 配置 */
const CATEGORY_TABS: Array<{ key: LeaderboardCategory; label: string; icon: string }> = [
  { key: 'overall', label: '总榜', icon: '🏆' },
  { key: 'llm', label: '大语言模型', icon: '💬' },
  { key: 'image', label: '生图模型', icon: '🎨' },
  { key: 'video', label: '视频模型', icon: '🎬' },
  { key: 'multimodal', label: '多模态', icon: '🔮' },
  { key: 'agent', label: 'Agent', icon: '🤖' },
  { key: 'audio', label: '语音模型', icon: '🎵' },
  { key: 'embedding', label: '嵌入模型', icon: '📐' },
]

/** LLM 子分类 Tab */
const LLM_SUBCATS: Array<{ key: string; label: string }> = [
  { key: 'general', label: '通用对话' },
  { key: 'coding', label: '代码编程' },
  { key: 'reasoning', label: '推理思考' },
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
  // 列排序:默认按 Arena 评分降序(最高分在前)
  const [sortField, setSortField] = React.useState<SortField>('arenaScore')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  // 按当前 Tab 过滤
  const filtered = React.useMemo(() => {
    if (activeCategory === 'overall') {
      return entries.filter((e) => e.isOverall)
    }
    let list = entries.filter((e) => e.category === activeCategory && !e.isOverall)
    if (activeCategory === 'llm' && activeSubcat) {
      list = list.filter((e) => e.subcategory === activeSubcat)
    }
    return list
  }, [entries, activeCategory, activeSubcat])

  // 排序:null 值永远排末尾(不管 asc/desc)
  const sorted = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const getter = (e: LeaderboardEntry): number | string | null => {
      switch (sortField) {
        case 'arenaScore': return e.arenaScore
        case 'winRate': return e.winRate
        case 'voteCount': return e.voteCount
        case 'contextWindow': return parseNumeric(e.contextWindow)
        case 'maxOutput': return parseNumeric(e.maxOutput)
        case 'inputPrice': return parseNumeric(e.inputPrice)
        case 'outputPrice': return parseNumeric(e.outputPrice)
        case 'releaseDate': return e.releaseDate
      }
    }
    return [...filtered].sort((a, b) => {
      const va = getter(a)
      const vb = getter(b)
      // null 排末尾
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [filtered, sortField, sortDir])

  // 点击表头排序:同字段切方向,不同字段切字段并默认降序
  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // 切换分类时重置子分类 + 重置排序(避免切到生图榜后还按 LLM 的 arenaScore 排)
  React.useEffect(() => {
    if (activeCategory !== 'llm') setActiveSubcat('')
    setSortField('arenaScore')
    setSortDir('desc')
  }, [activeCategory])

  /** 渲染排序图标 */
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-0.5 inline h-2.5 w-2.5 text-muted-foreground/40" />
    return sortDir === 'asc'
      ? <ArrowUp className="ml-0.5 inline h-2.5 w-2.5 text-primary" />
      : <ArrowDown className="ml-0.5 inline h-2.5 w-2.5 text-primary" />
  }

  /** 可排序表头 props */
  function sortableTh(field: SortField, label: string, align: 'left' | 'right' = 'right') {
    return (
      <th
        className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} font-medium cursor-pointer select-none hover:text-foreground transition-colors`}
        onClick={() => toggleSort(field)}
        title={t('leaderboard.sortHint')}
      >
        <span className="inline-flex items-center">
          {label}
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* LLM 子分类 Tab */}
      {activeCategory === 'llm' ? (
        <div className="flex items-center gap-1 bg-muted/10 px-3 py-1.5">
          <span className="mr-1 text-[10px] text-muted-foreground">LLM 细分:</span>
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
              {sub.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* 表格 — 竖向排列模型行,参数横向排列 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">模型</th>
              <th className="px-3 py-2 text-left font-medium">厂商</th>
              {sortableTh('arenaScore', 'Arena 评分')}
              {sortableTh('winRate', '胜率')}
              {sortableTh('voteCount', '投票')}
              {sortableTh('contextWindow', '上下文')}
              {sortableTh('maxOutput', '最大输出')}
              {sortableTh('inputPrice', '输入价')}
              {sortableTh('outputPrice', '输出价')}
              <th className="px-3 py-2 text-center font-medium">变化</th>
              {sortableTh('releaseDate', '发布', 'left')}
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {t('leaderboard.empty')}
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
                    {/* 排名 */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold tabular-nums ${rankBg(idx)}`}>
                        {rank}
                      </span>
                    </td>
                    {/* 模型名 — 单行竖向排列,核心亮点移至详情弹窗 */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold leading-tight">{entry.modelName}</span>
                    </td>
                    {/* 厂商 */}
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{entry.vendor}</td>
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
        <span>📊 数据参考 arena.ai/leaderboard · Elo 评分 + Bootstrap 置信区间</span>
        <span className="ml-auto">{t('leaderboard.sortHint')} · 点击行查看模型详情 + 能力雷达图</span>
      </div>

      {/* 详情弹窗 */}
      {selectedEntry ? (
        <ModelDetailDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      ) : null}
    </section>
  )
}
