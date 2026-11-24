// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { Badge } from '@/components/data'

import { COVERAGE_STATE_META, COVERAGE_STATE_ORDER } from './types'
import type { CoverageCatalog } from './types'

interface CoverageProbeSummaryProps {
  catalog: CoverageCatalog
}

/**
 * 目录统计条:总数 + 分域数 + 各状态分桶 + 事件总数。
 * 事件由后端 `events.count` 单独给出,不并进 `totals.apis`,所以单列一格。
 */
export function CoverageProbeSummary({ catalog }: CoverageProbeSummaryProps) {
  const totals = catalog.totals
  const activeStates = COVERAGE_STATE_ORDER.filter((state) => totals[state] > 0)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-stroke-subtle bg-muted/20 px-2.5 py-2">
      <span className="text-label text-foreground">
        <strong className="tabular-nums">{totals.apis}</strong> 条 API
      </span>
      <span className="text-[11px] text-muted-foreground">
        <strong className="tabular-nums text-foreground">{totals.domains}</strong> 个业务域
      </span>
      {activeStates.length > 0 ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {activeStates.map((state) => (
            <Badge key={state} variant={COVERAGE_STATE_META[state].badge}>
              {COVERAGE_STATE_META[state].label}
              <strong className="ml-1 tabular-nums">{totals[state]}</strong>
            </Badge>
          ))}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>事件</span>
        <strong className="tabular-nums text-foreground">{catalog.events.count}</strong>
      </span>
    </div>
  )
}
