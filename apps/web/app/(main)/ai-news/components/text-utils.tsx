'use client'

import * as React from 'react'

/**
 * 把字符串数字("200K" / "1M" / "$3.00/1M")解析为数值用于排序。
 * 跨组件复用:Leaderboard 表头排序 + ApiRelaysSection 排序。
 */
export function parseNumeric(raw: string | number | null | undefined): number | null {
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

/**
 * 高亮搜索关键词:大小写不敏感,匹配部分用 <mark> 包裹。
 * 跨组件复用:Leaderboard 模型名/厂商名 + ApiRelaysSection 平台名/特点/计费 + ModelDetailDialog 模型名/厂商名。
 *
 * - 正则特殊字符自动转义(防注入)
 * - 支持多次匹配(split 后逐段渲染)
 * - dark mode 适配(bg-yellow-200/70 light + bg-yellow-500/30 dark)
 */
export function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="rounded-sm bg-yellow-200/70 px-0.5 text-foreground dark:bg-yellow-500/30">{part}</mark>
      : part
  )
}

/**
 * 能力标签阈值配置(2026-07-22 立升级:从硬编码提取为可配置常量)。
 * ModelDetailDialog 的 extractCapabilityTags 引用此配置,方便后续调整或 i18n 化。
 *
 * - longContext: 上下文窗口 ≥ 100K tokens
 * - largeOutput: 最大输出 ≥ 8K tokens
 * - lowCost: 输入价 < $1/1M tokens
 * - highWinRate: 胜率 > 70%
 * - topTier: Arena 评分 > 1300
 * - multimodal: 多模态分类(无阈值,匹配 category)
 */
export const CAPABILITY_THRESHOLDS = {
  longContext: 100_000,
  largeOutput: 8_000,
  lowCost: 1,
  highWinRate: 70,
  topTier: 1300,
} as const

/** 能力标签 key 列表(用于 i18n 翻译 key 映射) */
export const CAPABILITY_TAG_KEYS = [
  'tagLongContext',
  'tagLargeOutput',
  'tagLowCost',
  'tagHighWinRate',
  'tagTopTier',
  'tagMultimodal',
] as const
