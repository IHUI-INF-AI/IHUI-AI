// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按业务域折叠的目录分组:域名 + 条数 + 状态聚合徽章,展开后逐条列出 API。
 * 分域探测 / 按域接入入口挂在分组头部。
 */
import * as React from 'react'
import { ChevronDown, ChevronRight, Loader2, Plug, Radar } from 'lucide-react'

import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import type { CoverageApi, CoverageDomain, CoverageProbeItem } from './types'
import { CoverageApiRow } from './api-row'

interface DomainTreeProps {
  domain: CoverageDomain
  apis: CoverageApi[]
  overrides: Record<string, CoverageProbeItem | null>
  probing: boolean
  probeDisabled: boolean
  onProbeDomain: (domainKey: string) => void
  onPlanDomain: (domainKey: string) => void
}

export function CoverageDomainTree({
  domain,
  apis,
  overrides,
  probing,
  probeDisabled,
  onProbeDomain,
  onPlanDomain,
}: DomainTreeProps) {
  const [open, setOpen] = React.useState(false)
  const domainApis = apis.filter((api) => api.domain === domain.key)

  return (
    <section className="rounded-lg border border-stroke-subtle bg-card">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-label font-semibold text-foreground">{domain.label}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {domain.count} 条
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Badge variant="success">可用 {domain.available}</Badge>
            <Badge variant="danger">权限 {domain.permission_denied}</Badge>
            <Badge variant="default">未探测 {domain.unprobed}</Badge>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={probing || probeDisabled}
          onClick={() => onProbeDomain(domain.key)}
        >
          {probing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radar className="mr-1.5 h-3.5 w-3.5" />
          )}
          {probing ? '探测中' : '探测'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onPlanDomain(domain.key)}>
          <Plug className="mr-1.5 h-3.5 w-3.5" />
          按域接入
        </Button>
      </div>

      {open && domainApis.length > 0 ? (
        <ul className="space-y-1.5 px-3 pb-3">
          {domainApis.map((api) => (
            <CoverageApiRow key={api.id} api={api} override={overrides[api.id] ?? null} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
