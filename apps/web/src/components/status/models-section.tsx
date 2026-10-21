// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useState } from 'react'
import { Cpu } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { getPublicStatusModels } from '@ihui/api-client'
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
 *
 * 2026-10-21 第二轮（首轮只压掉 payload，HTML 没压掉，不够）：
 *   首轮把 76 张卡片改客户端组件后实测 1.97 MB → 1.05 MB，**只降了一半**，因为
 *   漏算了一半：客户端组件在 **SSR 阶段照样输出 DOM**。此时 RSC payload 只剩 311 KB，
 *   而 HTML 仍有约 740 KB —— 真凶是**模型数量本身**：API 实测返回 **1162 个**模型
 *   （213 KB JSON），远非首轮注释里写的 76 个；1162 张卡片全部进了 HTML。
 *   而回源通道实测仅 ~600 B/s，1.05 MB 要传约 30 分钟 ⇒ 公网 /status 事实上打不开。
 *
 *   本轮根因级改法：**服务端只 SSR 前 N 条**（异常优先排序，保证首屏与 SEO 见到的是
 *   最有信息量的那批），其余在用户点「展开全部」时才由客户端拉全量。
 *   注意 page.tsx 的 `overallStatus()` 仍用**全量** models 计算整体状态 —— 整体徽章
 *   的正确性不依赖本组件的渲染条数，故截断渲染不影响判定。
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** api-client 已解信封,载荷形如 { models: [...] };逐条校验后再落到 state。 */
function pickModels(payload: unknown): StatusModelItem[] | null {
  if (!isRecord(payload)) return null
  const arr = payload.models
  if (!Array.isArray(arr)) return null
  const out: StatusModelItem[] = []
  for (const it of arr) {
    if (!isRecord(it) || typeof it.modelId !== 'string') continue
    out.push({
      modelId: it.modelId,
      displayName: typeof it.displayName === 'string' ? it.displayName : null,
      providerCode: typeof it.providerCode === 'string' ? it.providerCode : '',
      status: (it.status as ServiceStatus) ?? 'operational',
      p95LatencyMs: typeof it.p95LatencyMs === 'number' ? it.p95LatencyMs : 0,
      errorRate: typeof it.errorRate === 'number' ? it.errorRate : 0,
      lastIncidentAt: typeof it.lastIncidentAt === 'string' ? it.lastIncidentAt : null,
    })
  }
  return out
}

export function ModelsSection({
  models,
  total,
}: {
  /** 服务端 SSR 下来的子集（异常优先的前 N 条）。 */
  models: StatusModelItem[]
  /** 服务端取到的全量条数 —— 标题与「还有 N 个」用它，不受渲染截断影响。 */
  total: number
}) {
  const [allModels, setAllModels] = useState<StatusModelItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const list = allModels ?? models
  const hidden = Math.max(0, total - list.length)

  async function expandAll() {
    if (loading) return
    setLoading(true)
    setFailed(false)
    try {
      // 同源反代(生产构建 NEXT_PUBLIC_API_BASE_URL 置空 ⇒ 浏览器走 /api/* 到 8802),
      // 不跨域,也不受页面 60s ISR 缓存影响。端点经 @ihui/api-client 统一层(守门
      // check-direct-backend-calls:端内禁止裸 fetch 直连后端)。
      const r = await getPublicStatusModels()
      if (!r.success) throw new Error(r.error)
      const parsed = pickModels(r.data as unknown)
      if (!parsed) throw new Error('unexpected payload')
      setAllModels(parsed)
    } catch {
      // 展开失败不得让已渲染部分消失:保持当前 list,只提示可重试。
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">模型可用性 ({total})</p>
        </div>
        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无公开模型</p>
        ) : (
          <>
            <div className="space-y-2">
              {list.map((m) => (
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
            {hidden > 0 || failed ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="xs" onClick={expandAll} disabled={loading}>
                  {loading ? '加载中…' : `展开全部（还有 ${hidden} 个）`}
                </Button>
                {failed ? (
                  <span className="text-xs text-rose-600 dark:text-rose-400">
                    加载失败,可重试
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
