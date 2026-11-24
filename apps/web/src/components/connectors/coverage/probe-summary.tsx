// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 目录覆盖总数条:所有数字直接取接口 totals,前端不二次汇总、不补假数。
 */
import { Badge } from '@/components/data'

import type { CoverageCatalog, CoverageStateCounts } from './types'
import { COVERAGE_STATE_META } from './types'

interface SummaryItem {
  key: string
  label: string
  value: number
  state: keyof CoverageStateCounts | null
}

/** 顶部展示的分桶(与任务口径一致;error/unjudged 不在总数条单列) */
const SUMMARY_BUCKETS: { state: keyof CoverageStateCounts; label: string }[] = [
  { state: 'available', label: '可用' },
  { state: 'permission_denied', label: '权限不足' },
  { state: 'need_user_token', label: '需用户授权' },
  { state: 'need_admin', label: '需管理员' },
  { state: 'unsupported', label: '不支持' },
  { state: 'unprobed', label: '未探测' },
]

export function CoverageProbeSummary({ catalog }: { catalog: CoverageCatalog }) {
  const { totals } = catalog
  // 事件/回调条目单独计数,不计入 totals.apis;旧进程缺 events 字段时容错为 0
  const eventCount = catalog.events?.count ?? catalog.events?.items?.length ?? 0
  const items: SummaryItem[] = [
    { key: 'apis', label: '目录总数', value: totals.apis, state: null },
    ...SUMMARY_BUCKETS.map((bucket) => ({
      key: bucket.state,
      label: COVERAGE_STATE_META[bucket.state].label,
      value: totals[bucket.state],
      state: bucket.state,
    })),
    { key: 'events', label: '事件', value: eventCount, state: null },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-1.5 rounded-md border border-stroke-subtle bg-muted/20 px-2.5 py-1.5"
        >
          <span className="text-body font-semibold tabular-nums text-foreground">{item.value}</span>
          <span className="text-[11px] text-muted-foreground">{item.label}</span>
          {item.state ? (
            <Badge variant={COVERAGE_STATE_META[item.state].badge}>{item.label}</Badge>
          ) : null}
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
