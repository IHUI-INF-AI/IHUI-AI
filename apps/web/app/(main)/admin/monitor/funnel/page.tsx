// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Filter } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { ConversionFunnel } from '@/components/earnings/ConversionFunnel'
import type { ConversionStageCode, ConversionStageStat } from '@/hooks/use-earnings'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

/**
 * 业务漏斗仪表盘(admin 监控子页)。
 *
 * 数据源 = `GET /api/earnings/funnel`(register→active→byok→vip,admin 专属端点)。
 *
 * 2026-10-31 之前这里调的是 `/api/admin/monitor/funnel/:id` —— 那条路由要求 UUID
 * 且按"单条告警"聚合,而本页传的是 'signup'/'purchase' 这类漏斗名 ⇒ **必 404、页面恒空**;
 * 假路由已一并摘除(apps/api/src/routes/admin-extended/monitor-routes.ts)。
 * 漏斗图本体复用共享组件 `@/components/earnings/ConversionFunnel`,不再自带第二份画法。
 */
export default function AdminMonitorFunnelPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'funnel'],
    queryFn: () => apiOrThrow<ConversionStageStat[]>('/api/earnings/funnel'),
  })

  const funnel = data ?? []
  const countOf = (stage: ConversionStageCode): number =>
    funnel.find((s) => s.stage === stage)?.count ?? 0

  const registerCount = countOf('register')
  const activeCount = countOf('active')
  const vipCount = countOf('vip')
  // 分母取不到(注册用户 0)时转化率是"没判",不是 0% ⇒ 显式未判定。
  const conversionRate = registerCount > 0 ? (vipCount / registerCount) * 100 : null

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Filter className="h-6 w-6 text-primary" />
            业务漏斗仪表盘
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            关键业务转化漏斗分析(注册 → 活跃 → BYOK → VIP)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">注册用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatNumber(registerCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">活跃用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success-text">{formatNumber(activeCount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">VIP 转化率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-text">
              {conversionRate === null ? '未判定' : `${conversionRate.toFixed(2)}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      ) : funnel.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">暂无漏斗数据</p>
      ) : (
        <ConversionFunnel data={funnel} loading={isLoading} />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
