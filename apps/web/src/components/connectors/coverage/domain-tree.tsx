// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, Radar } from 'lucide-react'

import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import { COVERAGE_STATE_META, resolveApiStatus } from './types'
import type { CoverageApi, CoverageDomain, CoverageProbeItem } from './types'

interface CoverageDomainTreeProps {
  domain: CoverageDomain
  /** 目录全量 API 清单(本组件按 domain.key 自行过滤) */
  apis: CoverageApi[]
  /** 探测回填结果,按 api_id 索引 */
  overrides: Record<string, CoverageProbeItem>
  /** 全局探测进行中(禁用分域探测入口) */
  probing: boolean
  /** 无可用连接器实例(禁用探测,标签页仍可浏览) */
  probeDisabled: boolean
  onProbeDomain: (key: string) => void
  onPlanDomain: (key: string) => void
}

/** 单条 API 行:方法 + 名称 + 有效状态 + 路径/scope;探测回填优先于目录自带状态 */
function ApiRow({
  api,
  override,
}: {
  api: CoverageApi
  override: CoverageProbeItem | null
}) {
  const status = resolveApiStatus(api, override)
  const meta = COVERAGE_STATE_META[status.state]

  return (
    <li className="rounded-md bg-muted/20 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {api.method}
        </span>
        <span className="text-label font-medium text-foreground">{api.name}</span>
        <Badge variant={meta.badge}>{meta.label}</Badge>
        {api.read ? <span className="text-[10px] text-muted-foreground">只读</span> : null}
        {api.event ? <span className="text-[10px] text-muted-foreground">回调</span> : null}
      </div>
      <p className="mt-0.5 break-all text-[11px] text-muted-foreground">{api.path}</p>
      {api.scope ? <p className="break-all text-[11px] text-muted-foreground">scope:{api.scope}</p> : null}
      {status.missing_scope ? (
        <p className="break-all text-[11px] text-destructive">缺 scope:{status.missing_scope}</p>
      ) : null}
      {status.reason ? <p className="break-all text-[11px] text-muted-foreground">{status.reason}</p> : null}
    </li>
  )
}

/**
 * 单个业务域的可折叠树:域头(计数 + 枚举完整性 + 分域探测/按域接入),展开后逐条列出该域 API。
 * 默认折叠——域多时先看域级汇总,按需展开,避免一次铺满上千条。
 */
export function CoverageDomainTree({
  domain,
  apis,
  overrides,
  probing,
  probeDisabled,
  onProbeDomain,
  onPlanDomain,
}: CoverageDomainTreeProps) {
  const [expanded, setExpanded] = React.useState(false)

  const domainApis = React.useMemo(
    () => apis.filter((api) => api.domain === domain.key),
    [apis, domain.key],
  )

  const stateCounts = React.useMemo(() => {
    let available = 0
    let denied = 0
    for (const api of domainApis) {
      const state = resolveApiStatus(api, overrides[api.id] ?? null).state
      if (state === 'available') available += 1
      else if (state === 'permission_denied') denied += 1
    }
    return { available, denied }
  }, [domainApis, overrides])

  const totalCount = domain.count || domainApis.length

  return (
    <div className="rounded-md border border-stroke-subtle">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-0.5 text-left transition-colors hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-label font-medium text-foreground">{domain.label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{totalCount}</span>
          {!domain.complete ? <Badge variant="warning">未完整枚举</Badge> : null}
          {stateCounts.available > 0 ? <Badge variant="success">可用 {stateCounts.available}</Badge> : null}
          {stateCounts.denied > 0 ? <Badge variant="danger">权限不足 {stateCounts.denied}</Badge> : null}
        </button>
        <Button
          size="xs"
          variant="ghost"
          disabled={probeDisabled || probing}
          onClick={() => onProbeDomain(domain.key)}
        >
          <Radar className="h-3.5 w-3.5" />
          <span>探测本域</span>
        </Button>
        <Button size="xs" variant="outline" onClick={() => onPlanDomain(domain.key)}>
          <span>按域接入</span>
        </Button>
      </div>

      {expanded ? (
        <div className="px-2 pb-2">
          {domain.reason ? (
            <p className="mb-1.5 text-[11px] text-muted-foreground">备注:{domain.reason}</p>
          ) : null}
          {domainApis.length > 0 ? (
            <ul className="space-y-1">
              {domainApis.map((api) => (
                <ApiRow key={api.id} api={api} override={overrides[api.id] ?? null} />
              ))}
            </ul>
          ) : expanded ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">该域暂无可展示的 API 条目</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
