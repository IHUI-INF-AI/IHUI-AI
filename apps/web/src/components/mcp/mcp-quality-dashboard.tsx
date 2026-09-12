// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * MCP 质量看板区块(H8,2026-09-12 立)
 *
 * GET /api/mcp/quality/dashboard(经 next rewrites → ai-service 8803):
 * 各 server 运行时指标(调用/成功率/延迟)+ 质量分 + 安全分。
 * 失败降级:端点不可用 / 无数据时整个区块不渲染,不报错不崩溃。
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gauge } from 'lucide-react'

import {
  getMcpQualityDashboard,
  type McpQualityDashboardResponse,
} from '@ihui/api-client/endpoints/mcp'

import { Badge } from '@/components/data'
import { ScoringBadges } from '@/components/mcp/mcp-scoring-badges'

export function McpQualityDashboard() {
  const t = useTranslations('mcpStore')
  // 静默降级:失败 / 空数据 → data 为 null,区块整体不渲染
  const { data } = useQuery({
    queryKey: ['mcp-store', 'quality-dashboard'],
    queryFn: async (): Promise<McpQualityDashboardResponse | null> => {
      const r = await getMcpQualityDashboard()
      if (!r.success || !r.data) return null
      return r.data
    },
    retry: false,
    staleTime: 30_000,
  })

  if (!data || data.servers.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t('dashboardTitle')}</h2>
        <Badge variant="default">{data.count}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{t('dashboardSubtitle')}</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t('dashboardServer')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboardScoring')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboardCalls')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboardSuccessRate')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboardAvgLatency')}</th>
            </tr>
          </thead>
          <tbody>
            {data.servers.map((srv) => (
              <tr key={srv.key} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium text-foreground">{srv.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <ScoringBadges
                      score={srv.quality.score}
                      grade={srv.quality.grade}
                      securityScore={srv.security.score}
                      securityLevel={srv.security.level}
                    />
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{srv.metrics.calls}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {srv.metrics.success_rate === null
                    ? t('dashboardNoData')
                    : `${(srv.metrics.success_rate * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {srv.metrics.avg_latency_s === null
                    ? t('dashboardNoData')
                    : t('dashboardLatency', { value: srv.metrics.avg_latency_s })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
