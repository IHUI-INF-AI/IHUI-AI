'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import type { LeaderboardEntry, ModelCapabilities } from '@/lib/ai-news-api'
import { parseNumeric } from './text-utils'
import { PriceChart } from './PriceChart'

interface Props {
  entries: LeaderboardEntry[]
  open: boolean
  onClose: () => void
}

const RADAR_COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899']
const RADAR_LABELS: Array<{ key: keyof ModelCapabilities; label: string }> = [
  { key: 'coding', label: '代码' },
  { key: 'math', label: '数学' },
  { key: 'reasoning', label: '推理' },
  { key: 'creative', label: '创意' },
  { key: 'chinese', label: '中文' },
]

/** 多模型能力雷达叠加图(5 维,不同颜色叠加) */
function MultiRadar({ entries }: { entries: LeaderboardEntry[] }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 28
  const angleStep = (Math.PI * 2) / RADAR_LABELS.length
  const startAngle = -Math.PI / 2
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]
  const models = entries.filter((e) => e.capabilities)

  if (models.length === 0) return null

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px]" preserveAspectRatio="xMidYMid meet">
      {gridLevels.map((level, idx) => {
        const pts = RADAR_LABELS.map((_, i) => {
          const angle = startAngle + i * angleStep
          return `${cx + Math.cos(angle) * radius * level},${cy + Math.sin(angle) * radius * level}`
        }).join(' ')
        return <polygon key={idx} points={pts} fill="none" className="stroke-muted" strokeWidth={0.5} opacity={0.4} />
      })}
      {RADAR_LABELS.map((_, i) => {
        const angle = startAngle + i * angleStep
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * radius} y2={cy + Math.sin(angle) * radius} className="stroke-muted" strokeWidth={0.5} opacity={0.4} />
      })}
      {models.map((entry, mi) => {
        const caps = entry.capabilities!
        const pts = RADAR_LABELS.map((l, i) => {
          const val = caps[l.key] / 100
          const angle = startAngle + i * angleStep
          return `${cx + Math.cos(angle) * radius * val},${cy + Math.sin(angle) * radius * val}`
        }).join(' ')
        const color = RADAR_COLORS[mi % RADAR_COLORS.length]
        return <polygon key={entry.id} points={pts} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
      })}
      {RADAR_LABELS.map((l, i) => {
        const angle = startAngle + i * angleStep
        const labelR = radius + 14
        const x = cx + Math.cos(angle) * labelR
        const y = cy + Math.sin(angle) * labelR
        const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-muted-foreground" fontSize={9} fontWeight={500}>
            {l.label}
          </text>
        )
      })}
    </svg>
  )
}

/** side-by-side 模型对比弹窗 + 价格柱状图 + 能力雷达叠加 */
export function ModelCompareDialog({ entries, open, onClose }: Props) {
  const t = useTranslations('aiNews')

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const inputs = entries.map((e) => ({ id: e.id, val: parseNumeric(e.inputPrice) })).filter((x) => x.val !== null && x.val > 0)
  const outputs = entries.map((e) => ({ id: e.id, val: parseNumeric(e.outputPrice) })).filter((x) => x.val !== null && x.val > 0)
  const minInputId = inputs.length > 0 ? inputs.reduce((m, x) => x.val! < m.val! ? x : m).id : null
  const minOutputId = outputs.length > 0 ? outputs.reduce((m, x) => x.val! < m.val! ? x : m).id : null

  const rows: Array<{ label: string; render: (e: LeaderboardEntry) => string; hl?: (e: LeaderboardEntry) => boolean }> = [
    { label: t('detailDialog.rank'), render: (e) => e.arenaRank ? `#${e.arenaRank}` : '-' },
    { label: t('detailDialog.arenaScore'), render: (e) => e.arenaScore ? `${e.arenaScore}${e.scoreCi ? ` ±${e.scoreCi}` : ''}` : '-' },
    { label: t('detailDialog.winRate'), render: (e) => e.winRate !== null ? `${e.winRate.toFixed(1)}%` : '-' },
    { label: t('detailDialog.voteCount'), render: (e) => e.voteCount ? e.voteCount.toLocaleString() : '-' },
    { label: t('detailDialog.contextWindow'), render: (e) => e.contextWindow ?? '-' },
    { label: t('detailDialog.maxOutput'), render: (e) => e.maxOutput ?? '-' },
    { label: t('detailDialog.inputPrice'), render: (e) => e.inputPrice ?? '-', hl: (e) => e.id === minInputId },
    { label: t('detailDialog.outputPrice'), render: (e) => e.outputPrice ?? '-', hl: (e) => e.id === minOutputId },
    { label: t('detailDialog.releaseDate'), render: (e) => e.releaseDate ?? '-' },
    { label: t('detailDialog.license'), render: (e) => e.license ?? '-' },
  ]

  const hasCaps = entries.some((e) => e.capabilities)
  const capsModels = entries.filter((e) => e.capabilities)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center gap-2 bg-muted/30 px-5 py-3">
          <h3 className="text-sm font-semibold">{t('compare.label')}</h3>
          <span className="text-[10px] text-muted-foreground">{t('compare.selected', { count: entries.length })}</span>
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* side-by-side 对比表 */}
        <div className="overflow-x-auto px-5 py-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-28 px-2 py-2 text-left text-[10px] font-medium uppercase text-muted-foreground">{t('compare.colModel')}</th>
                {entries.map((e) => (
                  <th key={e.id} className="min-w-[120px] px-2 py-2 text-left">
                    <div className="text-xs font-semibold leading-tight">{e.modelName}</div>
                    <div className="text-[10px] text-muted-foreground">{e.vendor}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-muted/10' : ''}>
                  <td className="px-2 py-2 text-muted-foreground">{row.label}</td>
                  {entries.map((e) => (
                    <td key={e.id} className={`px-2 py-2 tabular-nums ${row.hl?.(e) ? 'font-bold text-emerald-600' : ''}`}>
                      {row.render(e)}
                      {row.hl?.(e) ? <span className="ml-1 text-[9px] text-emerald-500">{t('compare.cheapest')}</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 价格柱状图 */}
        <div className="px-5 py-3">
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t('compare.priceChartTitle')}</h4>
          <p className="mb-2 text-[10px] text-muted-foreground">{t('compare.priceChartHint')}</p>
          <PriceChart entries={entries} />
        </div>

        {/* 能力雷达叠加 */}
        {hasCaps ? (
          <div className="px-5 py-3">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{t('compare.capabilityOverlay')}</h4>
            <div className="flex flex-wrap items-center gap-4">
              <MultiRadar entries={entries} />
              <div className="flex flex-col gap-1">
                {capsModels.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                    <span className="max-w-[140px] truncate">{e.modelName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
