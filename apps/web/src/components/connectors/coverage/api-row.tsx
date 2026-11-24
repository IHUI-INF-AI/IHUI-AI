// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 目录单条 API 行:方法 / 路径 / 名称 / 读写事件标记 / 权限点 / 文档外链 / 状态徽章。
 * 失败态悬停展示原始平台错误码、缺失权限与原因,不得把错误显示成可用。
 */
import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/data'
import { Tooltip } from '@/components/feedback'

import type { CoverageApi, CoverageProbeItem } from './types'
import { COVERAGE_STATE_META, FAILURE_STATES, resolveApiStatus } from './types'

interface ApiRowProps {
  api: CoverageApi
  override?: CoverageProbeItem | null
}

type DataBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'

function methodVariant(method: string): DataBadgeVariant {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'success'
    case 'POST':
      return 'primary'
    case 'DELETE':
      return 'danger'
    case 'PUT':
    case 'PATCH':
      return 'warning'
    default:
      return 'default'
  }
}

export function CoverageApiRow({ api, override }: ApiRowProps) {
  const status = resolveApiStatus(api, override)
  const meta = COVERAGE_STATE_META[status.state]
  const showDetail = FAILURE_STATES.has(status.state) || Boolean(status.reason)

  const detailLines: string[] = []
  if (status.reason) detailLines.push(`原因:${status.reason}`)
  if (status.platform_code) detailLines.push(`平台错误码:${status.platform_code}`)
  if (status.missing_scope) detailLines.push(`缺失权限:${status.missing_scope}`)
  if (status.http_code !== null && status.http_code !== undefined) {
    detailLines.push(`HTTP ${status.http_code}`)
  }

  const badge = (
    <Badge variant={meta.badge}>{meta.label}</Badge>
  )

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-stroke-subtle bg-card px-3 py-2">
      <Badge variant={methodVariant(api.method)} className="shrink-0 font-mono text-[10px]">
        {api.method.toUpperCase()}
      </Badge>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-0 truncate text-label font-medium text-foreground">{api.name}</span>
          {api.read && <Badge variant="default">读</Badge>}
          {api.event && <Badge variant="default">事件</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            {api.path}
          </code>
          {api.scope ? (
            <span className="hidden min-w-0 truncate text-[10px] text-muted-foreground min-[720px]:inline">
              权限点:{api.scope}
            </span>
          ) : null}
        </div>
      </div>

      {api.doc_url ? (
        <a
          href={api.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="查看官方文档"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      <div className="shrink-0">
        {showDetail && detailLines.length > 0 ? (
          <Tooltip content={<div className="space-y-0.5">{detailLines.map((line) => <div key={line}>{line}</div>)}</div>}>
            {badge}
          </Tooltip>
        ) : (
          badge
        )}
      </div>
    </li>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
