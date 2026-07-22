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
 * 跨组件复用:Leaderboard 模型名/厂商名 + ApiRelaysSection 平台名/特点/计费。
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
