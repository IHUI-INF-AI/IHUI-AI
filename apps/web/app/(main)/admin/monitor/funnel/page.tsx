// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Filter, TrendingDown } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'
// 真漏斗的形状与档位码只有这一份声明(端点 GET /api/earnings/funnel,
// 源:apps/api/src/routes/earnings-routes.ts;消费方另有 src/hooks/use-earnings.ts)。
// 此处 import 而非复抄,判据单源(AGENTS.md §0.6)。
import type { ConversionStageCode, ConversionStageStat } from '@/hooks/use-earnings'

interface FunnelStage {
  key: string
  label: string
  count: number
  rate: number
}

/** 由 stage 序列投影出的页面视图模型(汇总量 + 各档条形)。 */
interface FunnelView {
  stages: FunnelStage[]
  totalUsers: number
  convertedUsers: number
  conversionRate: number
  /** 分母(首档人数)不 &gt; 0 ⇒ 一切比值都无定义,读数走「未判定」而不是冒充 0。 */
  undetermined: boolean
}

/** 漏斗四档的档位码→显示名(顺序即漏斗顺序,与端点返回顺序一致)。 */
const STAGE_LABELS: Record<ConversionStageCode, string> = {
  register: '注册',
  active: '活跃',
  byok: '自带 Key',
  vip: '会员',
}

/**
 * 占比算式(全页唯一实现,禁止在 JSX 里再手抄一份):分母不 &gt; 0 时返回 0,
 * 绝不返回 NaN —— NaN.toFixed() 会渲染出字面量 "NaN"(2026-10 实测的假读数来源)。
 * 是否该显示数字由 undetermined 决定,不由这里的 0 决定。
 */
function rateOf(count: number, total: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(count) || total <= 0) return 0
  return (count / total) * 100
}

/**
 * 读数渲染唯一出口:分母缺失 ⇒ 如实「未判定」。
 * 把「无分母」伪装成「0%」是假档(同型判例:monitoring/panel-defs/panels/business-funnel.json
 * 因无事件源把两档从看板整体摘除,而不是补 0)。
 */
function readRate(rate: number, undetermined: boolean, digits: number): string {
  return undetermined ? '未判定' : `${rate.toFixed(digits)}%`
}

/**
 * stage 序列 → 页面汇总量的本地投影(单一实现;端点只给 [{stage,count}],不给汇总量)。
 * totalUsers = 首档人数;convertedUsers = 末档人数;转化率同 rateOf 算式。
 */
function projectFunnel(stats: ConversionStageStat[]): FunnelView {
  const totalUsers = stats[0]?.count ?? 0
  const convertedUsers = stats.at(-1)?.count ?? 0
  const undetermined = !Number.isFinite(totalUsers) || totalUsers <= 0
  return {
    stages: stats.map((s) => ({
      key: s.stage,
      label: STAGE_LABELS[s.stage] ?? s.stage,
      count: s.count,
      rate: rateOf(s.count, totalUsers),
    })),
    totalUsers,
    convertedUsers,
    conversionRate: rateOf(convertedUsers, totalUsers),
    undetermined,
  }
}

export default function AdminMonitorFunnelPage() {
  const { data, isLoading, isError } = useQuery({
    // 与 /earnings 页共用同一枚缓存键:同一个端点、同一份数据,不各存一份(§0.6)
    queryKey: ['earnings', 'funnel'],
    queryFn: () => apiOrThrow<ConversionStageStat[]>('/api/earnings/funnel'),
  })

  // 取数失败/未完成时不投影(空数组交给下游空态,错误态由 isError 分支如实显示)
  const view = data ? projectFunnel(data) : null
  const stages = view?.stages ?? []
  const maxCount = stages.length > 0 ? (stages[0]?.count ?? 1) : 1
  // 无分母 ⇒ 全部比值读数走「未判定」(算式与读法各只有一份实现)
  const undetermined = view?.undetermined ?? true

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
            <Filter className="h-6 w-6 text-primary" />
            业务漏斗仪表盘
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">关键业务转化漏斗分析</p>
        </div>
        {/* 档位选择器已摘除(2026-11-01):后端只有一套真漏斗 GET /api/earnings/funnel
            (register→active→byok→vip),原先的 signup/purchase/activation/retention 四档
            喂进 /api/admin/monitor/funnel/:id 一律 404,是从不产出数据的占位壳。 */}
      </div>

      {view && view.stages.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-label font-medium text-muted-foreground">总用户</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-display font-bold text-primary">{formatNumber(view.totalUsers)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-label font-medium text-muted-foreground">转化用户</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-display font-bold text-success-text">
                {formatNumber(view.convertedUsers)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-label font-medium text-muted-foreground">转化率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-display font-bold text-warning-text">
                {readRate(view.conversionRate, undetermined, 2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />
            漏斗各阶段
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-10 text-center text-sm text-danger-text">
              数据源不可达(GET /api/earnings/funnel 请求失败)
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            </div>
          ) : stages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无漏斗数据</p>
          ) : (
            <div className="space-y-3">
              {stages.map((s, i) => {
                const width = maxCount > 0 ? (s.count / maxCount) * 100 : 0
                const prev = i > 0 ? stages[i - 1] : undefined
                const dropRate =
                  prev && prev.count > 0 ? ((prev.count - s.count) / prev.count) * 100 : 0
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(s.count)}{' '}
                        <span className="text-xs">({readRate(s.rate, undetermined, 1)})</span>
                      </span>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-muted">
                      <div
                        className={cn(
                          'flex h-full items-center rounded-md px-2 text-label font-medium transition-all',
                          i === 0
                            ? 'bg-primary text-primary-foreground' /* r5-cta-exempt: 漏斗首段进度条填充,非主按钮;品牌墨底+配对前景是该图表的既有形态 until 2026-12-20 */
                            : i === stages.length - 1
                              ? 'bg-success-tint-strong text-success-deep-text' /* 字压在 25% 同色浓底上 ⇒ 必须用 deep 档(实测 5.01/5.39);角色档在这一底上只有 3.53/3.80 */
                              : 'bg-primary/70 text-primary-foreground',
                        )}
                        style={{ width: `${Math.max(width, 15)}%` }}
                      >
                        {readRate(s.rate, undetermined, 0)}
                      </div>
                    </div>
                    {i > 0 && dropRate > 0 && (
                      <div className="text-xs text-danger-text">↓ 流失 {dropRate.toFixed(1)}%</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
