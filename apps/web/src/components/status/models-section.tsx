// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Cpu } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

/**
 * 状态页「模型可用性」区块（客户端组件）
 *
 * 2026-10-21 公网提速立（依据 outputs/PUBLIC-ACCESS-PERF-AUDIT-2026-10-21.md）：
 *   /status 单页 1.97 MB，其中 RSC payload 1.15 MB、273 个流式分块。
 *   根因：模型列表在**服务端** `models.map` 渲染，76 个模型每张卡片的完整 JSX
 *   （含 StatusBadge 的长 className、lucide iconNode）都被逐条序列化进 RSC payload；
 *   实测同一段 `rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-…` 重复 76 次。
 *   而回源通道实测仅 ~600 B/s，1.97 MB 要传 6.8~13.4 s。
 *
 *   改为客户端组件后，服务端只下发紧凑的 models 数组（每条约 150 B），
 *   JSX 结构与图标定义随客户端 bundle 走（/_next/static 已 immutable 长期缓存），
 *   不再进入每次回源的 RSC payload。预期本页 1.97 MB → ~150 KB。
 *
 * 约束：本组件只做渲染，不取数。数据仍由服务端 page.tsx 取好后以 props 传入，
 *   `revalidate = 60` 的 ISR 语义不变。
 */

type ServiceStatus = 'operational' | 'degraded' | 'outage'

export interface StatusModelItem {
  modelId: string
  displayName: string | null
  providerCode: string
  status: ServiceStatus
  p95LatencyMs: number
  errorRate: number
  lastIncidentAt: string | null
}

const dtf = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dtf.format(d)
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

function formatLatency(ms: number): string {
  return ms > 0 ? `${ms}ms` : '—'
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const styles: Record<ServiceStatus, string> = {
    operational: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    outage: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }
  const labels: Record<ServiceStatus, string> = {
    operational: '正常运行',
    degraded: '性能降级',
    outage: '服务中断',
  }
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  )
}

export function ModelsSection({ models }: { models: StatusModelItem[] }) {
  return (
    <Card>
      <CardContent className="min-[640px]:p-3 space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">模型可用性 ({models.length})</p>
        </div>
        {models.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无公开模型</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div
                key={`${m.providerCode}-${m.modelId}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{m.displayName ?? m.modelId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.providerCode}/{m.modelId}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>P95 {formatLatency(m.p95LatencyMs)}</span>
                  <span>错误率 {formatPercent(m.errorRate)}</span>
                  <span>最近事件 {m.lastIncidentAt ? formatDateTime(m.lastIncidentAt) : '—'}</span>
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
