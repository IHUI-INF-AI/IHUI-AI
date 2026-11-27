// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ShieldCheck, TriangleAlert, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { AiModelGovernance, GovernanceIssue } from './types'

const SEVERITY_STYLE: Record<GovernanceIssue['severity'], { chip: string; icon: React.ReactNode }> =
  {
    critical: {
      chip: 'border-destructive/30 bg-destructive/10 text-destructive',
      icon: <TriangleAlert className="h-3.5 w-3.5" />,
    },
    warning: {
      chip: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      icon: <TriangleAlert className="h-3.5 w-3.5" />,
    },
    info: {
      chip: 'border-border bg-muted/60 text-muted-foreground',
      icon: <Info className="h-3.5 w-3.5" />,
    },
  }

export function AiModelHealth({ governance }: { governance: AiModelGovernance }) {
  const { summary, issues } = governance
  const actionable = issues.filter((issue) => issue.severity !== 'info')

  return (
    <Card className="border-border/80">
      <CardHeader className="px-4 pb-2 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-title">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            配置治理
            <span className="text-label font-normal text-muted-foreground">
              {summary.configs} 配置 · {summary.models} 模型 · {summary.providers} provider
            </span>
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
              actionable.length > 0
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            )}
          >
            {actionable.length > 0 ? (
              <>
                <TriangleAlert className="h-3 w-3" />
                {actionable.length} 项待处理
              </>
            ) : (
              <>
                <ShieldCheck className="h-3 w-3" />
                结构性检查通过
              </>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {issues.map((issue) => (
            <span
              key={issue.code}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]',
                SEVERITY_STYLE[issue.severity].chip,
              )}
              title={
                issue.configIds.length > 0
                  ? `配置 ID: ${issue.configIds.slice(0, 8).join(', ')}`
                  : undefined
              }
            >
              {SEVERITY_STYLE[issue.severity].icon}
              {issue.title}
              {issue.count > 0 && <span className="font-semibold tabular-nums">{issue.count}</span>}
            </span>
          ))}
          {issues.length === 0 && (
            <span className="text-label text-muted-foreground">
              没有发现重复配置、别名冲突、孤儿模型、公开停用或零价等结构性问题。
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
