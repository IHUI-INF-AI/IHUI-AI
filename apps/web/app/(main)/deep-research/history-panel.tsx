// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { History } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * 研究任务本地历史(2026-09-07 工作线 B)。
 * 后端 research.py 无列表端点(运行态在进程内),v1 用 localStorage 记录本机发起的
 * research_id,支持回看(点击 → 父组件按 id 重新拉快照,断点续跑语义与后端一致)。
 */
export interface DeepResearchHistoryItem {
  researchId: string
  query: string
  savedAt: number
}

const STORAGE_KEY = 'deep_research_history'
const MAX_HISTORY = 20

/** 读取本地历史(新→旧) */
export function loadDeepResearchHistory(): DeepResearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (it): it is DeepResearchHistoryItem =>
        !!it &&
        typeof it === 'object' &&
        typeof (it as DeepResearchHistoryItem).researchId === 'string' &&
        typeof (it as DeepResearchHistoryItem).query === 'string',
    )
  } catch {
    return []
  }
}

/** 追加一条历史(去重置顶,超量裁剪) */
export function appendDeepResearchHistory(item: DeepResearchHistoryItem): void {
  if (typeof window === 'undefined') return
  const next = [
    item,
    ...loadDeepResearchHistory().filter((it) => it.researchId !== item.researchId),
  ].slice(0, MAX_HISTORY)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 存储满/隐私模式:历史不可用,不阻塞主流程
  }
}

export interface HistoryPanelProps {
  activeId: string | null
  onSelect: (item: DeepResearchHistoryItem) => void
}

/** 历史任务列表面板:点击回看对应研究(重新拉快照渲染) */
export function HistoryPanel({ activeId, onSelect }: HistoryPanelProps) {
  const t = useTranslations('deepResearch')
  const [items, setItems] = React.useState<DeepResearchHistoryItem[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setItems(loadDeepResearchHistory())
    setMounted(true)
  }, [])

  if (!mounted || items.length === 0) return null
  return (
    <div className="rounded-xl border p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4" aria-hidden="true" />
        {t('historyTitle')}
      </h2>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.researchId}>
            <button
              type="button"
              onClick={() => onSelect(it)}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                activeId === it.researchId && 'bg-accent',
              )}
            >
              <span className="line-clamp-1 font-medium">{it.query}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(it.savedAt))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default HistoryPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
