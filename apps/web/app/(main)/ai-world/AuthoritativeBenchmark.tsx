// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Globe2,
  Info,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import type { AiWorldAuthoritativeLeaderboard } from '@ihui/types'
import raw from '@/data/authoritative-leaderboard.json'
import { apiOrThrow } from '@/lib/api'

type Data = AiWorldAuthoritativeLeaderboard

const VIEWS = [
  { key: 'cross' as const, label: '综合位次', icon: BarChart3 },
  { key: 'aa' as const, label: '智能指数', icon: Sparkles },
  { key: 'lmarena' as const, label: '人类偏好', icon: Users },
  { key: 'openrouter' as const, label: '真实用量', icon: Activity },
]

function rankClass(rank: number): string {
  if (rank === 1) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
  if (rank === 2) return 'bg-gray-200 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300'
  if (rank === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-500'
  return 'bg-muted/50 text-muted-foreground'
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-label font-semibold tabular-nums ${rankClass(rank)}`}
    >
      {rank}
    </span>
  )
}

function Tag({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'open' | 'cn'
}) {
  const cls =
    tone === 'open'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'cn'
        ? 'bg-red-500/10 text-red-700 dark:text-red-400'
        : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] leading-none ${cls}`}
    >
      {children}
    </span>
  )
}

function formatTokens(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return n.toLocaleString('en-US')
}

function formatVotes(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return n.toLocaleString('zh-CN')
}

function formatContext(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return n.toLocaleString('en-US')
}

function formatPrice(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  return n < 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(2).replace(/\.00$/, '')}`
}

function formatSigned(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
}

function formatSeconds(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  return `${n.toFixed(2)}s`
}

function PriceCell({ row }: { row: { inputPrice?: number | null; outputPrice?: number | null } }) {
  const input = formatPrice(row.inputPrice)
  const output = formatPrice(row.outputPrice)
  if (!input && !output) return <span className="text-muted-foreground">—</span>
  return <SourceValue value={`${input ?? '—'} / ${output ?? '—'}`} sub="输入 / 输出" />
}

function SourceValue({ value, sub }: { value: string | null; sub?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col leading-tight">
      <span className="tabular-nums font-medium">{value}</span>
      {sub ? (
        <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  )
}

function ModelCell({
  model,
  vendor,
  openWeights,
  cn,
  reasoning,
}: {
  model: string
  vendor: string
  openWeights?: boolean
  cn?: boolean
  reasoning?: boolean
}) {
  return (
    <div className="min-w-[150px]">
      <div className="flex flex-wrap items-center gap-1 font-medium">
        <span>{model}</span>
        {cn ? <Tag tone="cn">国产</Tag> : null}
        {openWeights ? <Tag tone="open">开源</Tag> : null}
        {reasoning ? <Tag>推理</Tag> : null}
      </div>
      <span className="mt-0.5 block text-[10px] text-muted-foreground">{vendor}</span>
    </div>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold" title={value}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground" title={detail}>
        {detail}
      </div>
    </div>
  )
}

function CrossTable({ data }: { data: Data }) {
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        先按覆盖榜单数（3/3
        优先），再按各榜百分位均值排序。同一模型在不同榜的档位或构建可能不同，各榜分别取最佳名次。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-16">覆盖</TableHead>
              <TableHead className="w-24">AA 智能</TableHead>
              <TableHead className="w-24">LMArena</TableHead>
              <TableHead className="w-24">OpenRouter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cross.map((r) => (
              <TableRow key={r.key} className="hover:bg-accent/40">
                <TableCell>
                  <RankBadge rank={r.rank} />
                </TableCell>
                <TableCell>
                  <ModelCell
                    model={r.model}
                    vendor={r.vendor}
                    openWeights={r.openWeights}
                    cn={r.cn}
                  />
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                      r.coverage >= 3
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {r.coverage}/3
                  </span>
                </TableCell>
                <TableCell>
                  <SourceValue
                    value={r.aa ? (r.aa.score?.toFixed(1) ?? null) : null}
                    sub={r.aa ? `#${r.aa.rank}` : undefined}
                  />
                </TableCell>
                <TableCell>
                  <SourceValue
                    value={r.lm ? (r.lm.score?.toFixed(1) ?? null) : null}
                    sub={r.lm ? `#${r.lm.rank}` : undefined}
                  />
                </TableCell>
                <TableCell>
                  <SourceValue
                    value={r.or ? formatTokens(r.or.tokens ?? 0) : null}
                    sub={
                      r.or ? `#${r.or.rank} · ${((r.or.share ?? 0) * 100).toFixed(1)}%` : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value ?? '—'}</div>
    </div>
  )
}

function AaTable({ data }: { data: Data }) {
  const [selected, setSelected] = React.useState<Data['aa'][number] | null>(null)
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        Artificial Analysis Intelligence Index
        v5.0.2。这里只放关键指标；点每行“详情”可看上下文、价格、速度、单任务成本和全部单项评测。同一模型家族取智能指数最高的一档。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-20">智能</TableHead>
              <TableHead className="w-20">通识</TableHead>
              <TableHead className="w-24">速度 / 首字</TableHead>
              <TableHead className="w-24">上下文</TableHead>
              <TableHead className="w-28">价格 $/M</TableHead>
              <TableHead className="w-14">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.aa.map((r) => (
              <TableRow key={`${r.rank}-${r.model}`} className="hover:bg-accent/40">
                <TableCell>
                  <RankBadge rank={r.rank} />
                </TableCell>
                <TableCell>
                  <ModelCell
                    model={r.model}
                    vendor={r.vendor}
                    openWeights={r.openWeights}
                    cn={r.cn}
                    reasoning={r.reasoning}
                  />
                </TableCell>
                <TableCell className="font-medium tabular-nums">{r.score.toFixed(1)}</TableCell>
                <TableCell>
                  <SourceValue value={formatSigned(r.omniscience)} sub="通识指数" />
                </TableCell>
                <TableCell>
                  <SourceValue
                    value={r.outputSpeed ? `${r.outputSpeed.toFixed(1)} tok/s` : null}
                    sub={r.ttft ? `首字 ${formatSeconds(r.ttft)}` : undefined}
                  />
                </TableCell>
                <TableCell>
                  <SourceValue value={formatContext(r.contextWindow)} sub="tokens" />
                </TableCell>
                <TableCell>
                  <PriceCell row={r} />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="rounded border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    详情
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.model ?? '模型详情'}</DialogTitle>
            <DialogDescription>
              {selected?.vendor ?? ''} · Artificial Analysis 官方数据
              {selected?.release ? ` · ${selected.release}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
                <DetailMetric label="智能指数" value={selected.score.toFixed(1)} />
                <DetailMetric label="通识指数" value={formatSigned(selected.omniscience)} />
                <DetailMetric
                  label="输出速度"
                  value={selected.outputSpeed ? `${selected.outputSpeed.toFixed(1)} tok/s` : null}
                />
                <DetailMetric label="首 token" value={formatSeconds(selected.ttft)} />
                <DetailMetric label="上下文" value={formatContext(selected.contextWindow)} />
                <DetailMetric label="输入价格 / M" value={formatPrice(selected.inputPrice)} />
                <DetailMetric label="输出价格 / M" value={formatPrice(selected.outputPrice)} />
                <DetailMetric label="缓存命中 / M" value={formatPrice(selected.cacheHitPrice)} />
                <DetailMetric label="单任务成本" value={formatPrice(selected.costPerTask)} />
                <DetailMetric
                  label="单任务耗时"
                  value={selected.timePerTask ? `${selected.timePerTask.toFixed(1)}s` : null}
                />
                <DetailMetric label="参数档位" value={selected.paramClass ?? null} />
                <DetailMetric label="价格档位" value={selected.priceClass ?? null} />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold">全部单项评测</h3>
                  <span className="text-[10px] text-muted-foreground">
                    百分比项为 0-100，Elo 等原始分原样展示；不是本站自建分
                  </span>
                </div>
                {selected.benchmarks?.length ? (
                  <div className="grid grid-cols-1 gap-1.5 min-[640px]:grid-cols-2">
                    {selected.benchmarks.map((b) => (
                      <div
                        key={b.key}
                        className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5"
                        title={b.key}
                      >
                        <span className="truncate text-[11px] text-muted-foreground">{b.label}</span>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums">
                          {b.score.toFixed(1)}
                          {b.unit === 'percent' ? '%' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">该模型没有公开单项评测分。</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LmarenaTable({ data }: { data: Data }) {
  const categories =
    data.lmarena.categories && data.lmarena.categories.length > 0
      ? data.lmarena.categories
      : [
          {
            id: 'overall',
            label: '全球总榜',
            count: data.lmarena.overallCount,
            votes: data.lmarena.overallVotes,
            rows: data.lmarena.overall,
          },
          {
            id: 'chinese',
            label: '中文榜',
            count: data.lmarena.chineseCount,
            votes: data.lmarena.chineseVotes,
            rows: data.lmarena.chinese,
          },
        ]
  const [scope, setScope] = React.useState(categories[0]?.id ?? 'overall')
  const active = categories.find((c) => c.id === scope) ?? categories[0]
  const rows = active?.rows ?? []
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={active?.id ?? 'overall'}
          onChange={(e) => setScope(e.target.value)}
          className="h-7 rounded-md border bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          aria-label="LMArena 分类榜"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}（{c.count}）
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground">
          {active?.count ?? 0} 个模型 · {formatVotes(active?.votes ?? 0)} 票 · 本页前{' '}
          {rows.length} 名
        </span>
      </div>
      <p className="text-label leading-relaxed text-muted-foreground">
        LMArena Text Arena 官方数据集，覆盖总榜、中文、编程、数学、创意写作、行业等全部分类。Elo
        来自盲测两两对比的人类偏好，不是正确率；分类榜每榜只展示前 50 名。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">Arena 分</TableHead>
              <TableHead className="w-28">95% CI</TableHead>
              <TableHead className="w-20">票数</TableHead>
              <TableHead className="w-16">方差</TableHead>
              <TableHead className="w-16">许可</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${active?.id}-${r.rank}-${r.model}`} className="hover:bg-accent/40">
                <TableCell>
                  <RankBadge rank={r.rank} />
                </TableCell>
                <TableCell>
                  <ModelCell
                    model={r.model}
                    vendor={r.vendor}
                    openWeights={r.open && r.license !== 'Unknown'}
                  />
                </TableCell>
                <TableCell>
                  <SourceValue value={r.score.toFixed(1)} sub={`±${r.ci.toFixed(2)}`} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {r.ciLow !== undefined && r.ciHigh !== undefined
                    ? `${r.ciLow.toFixed(1)}–${r.ciHigh.toFixed(1)}`
                    : '—'}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {r.votes.toLocaleString('zh-CN')}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {r.variance !== undefined ? r.variance.toFixed(2) : '—'}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {r.license === 'Proprietary' ? '闭源' : r.license === 'Unknown' ? '—' : '开源'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function OpenRouterTable({ data }: { data: Data }) {
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        OpenRouter 官方公开日榜，近 7 天 tokens
        累计。这是真实调用量，不代表模型能力；同一模型不同构建分开统计。官方 CSV
        只有日期、模型、名次、tokens、占比五列，没有价格、上下文或参数量，这里不补假数据。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">7 天 tokens</TableHead>
              <TableHead className="w-20">占比</TableHead>
              <TableHead className="w-32">构建 / 计费</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.openrouter.map((r) => (
              <TableRow key={r.slug} className="hover:bg-accent/40">
                <TableCell>
                  <RankBadge rank={r.rank} />
                </TableCell>
                <TableCell>
                  <ModelCell model={r.model} vendor={r.vendor} />
                </TableCell>
                <TableCell>
                  <SourceValue value={formatTokens(r.tokens)} />
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {(r.share * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {r.build ?? '—'} · {r.free ? '免费' : '付费'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SourcesFooter({ data }: { data: Data }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-label font-semibold">
        <Info className="h-3.5 w-3.5" />
        <span>数据来源与口径</span>
      </div>
      <div className="mt-2 grid gap-2 min-[768px]:grid-cols-3">
        {data.sources.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="group min-w-0 rounded-md border bg-card px-2.5 py-2 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-medium">{s.name}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{s.metric}</div>
            <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">数据 {s.asOf}</div>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{data.methodology}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        服务端每 6
        小时自动从三家官方源刷新一次快照；页面每次打开读取最新快照，不依赖重新构建。最近成功刷新{' '}
        {data.refresh.lastSuccessAt.slice(0, 16).replace('T', ' ')} UTC。
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        所有数据直接来自上述平台的官方页面或公开数据集；本页不做自建评测，也不生成新的能力分。各榜排名口径不同，不能把一个分数直接当成另一个榜单的分数。OpenRouter
        数据按 CC BY 4.0 署名。
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {data.sources.map((s) => (
          <a
            key={`${s.id}-dataset`}
            href={s.dataset ?? s.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            {s.name} {s.dataset ? '数据集' : '榜单'}
          </a>
        ))}
      </div>
    </div>
  )
}

export function AuthoritativeBenchmark() {
  const [view, setView] = React.useState<(typeof VIEWS)[number]['key']>('cross')
  const [data, setData] = React.useState<Data>(raw as Data)

  React.useEffect(() => {
    let cancelled = false
    apiOrThrow<Data>('/api/ai-world/authoritative-leaderboard')
      .then((next) => {
        if (cancelled) return
        if (next?.schemaVersion && Array.isArray(next.cross) && next.cross.length > 0) {
          setData(next)
        }
      })
      .catch(() => {
        // 接口不可用时保留构建期内置底稿，页面仍可用。
      })
    return () => {
      cancelled = true
    }
  }, [])

  const consensus = data.cross[0]
  const aaTop = data.aa[0]
  const lmTop = data.lmarena.overall[0]
  const lmCnTop = data.lmarena.chinese[0]
  const orTop = data.openrouter[0]
  const consensusDetail = consensus
    ? [
        consensus.aa ? `AA #${consensus.aa.rank}` : null,
        consensus.lm ? `偏好 #${consensus.lm.rank}` : null,
        consensus.or ? `用量 #${consensus.or.rank}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Card>
      <CardContent className="space-y-3 p-3 min-[640px]:p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <Trophy className="h-4 w-4" />
              <span>{data.title}</span>
            </h2>
            <p className="mt-0.5 text-label text-muted-foreground">{data.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-label text-muted-foreground/70">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                data.refresh.mode === 'auto'
                  ? data.refresh.stale
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
              title={`${data.refresh.schedule} ${data.refresh.timezone}`}
            >
              <RefreshCw className="h-3 w-3" />
              {data.refresh.mode === 'auto'
                ? data.refresh.stale
                  ? '自动同步 · 滞后'
                  : '自动同步'
                : '内置快照'}
            </span>
            <span className="hidden shrink-0 min-[640px]:inline">
              更新 {data.generatedAt.slice(0, 10)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 min-[1024px]:grid-cols-4">
          <MetricCard
            label="三榜共识"
            value={consensus?.model ?? '—'}
            detail={`${consensus?.coverage ?? 0}/3 覆盖 · ${consensusDetail}`}
          />
          <MetricCard
            label="智能指数第一"
            value={aaTop?.model ?? '—'}
            detail={`${aaTop?.score.toFixed(1) ?? '—'} / 100 · AA #${aaTop?.rank ?? '—'}`}
          />
          <MetricCard
            label="人类偏好第一"
            value={lmTop?.model ?? '—'}
            detail={`${lmTop?.score.toFixed(1) ?? '—'} Elo · 中文 #${lmCnTop?.rank ?? '—'} ${lmCnTop?.model ?? ''}`}
          />
          <MetricCard
            label="真实用量第一"
            value={orTop?.model ?? '—'}
            detail={`${orTop ? formatTokens(orTop.tokens) : '—'} tokens · ${orTop ? (orTop.share * 100).toFixed(1) : '—'}%`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          {VIEWS.map((v) => {
            const Icon = v.icon
            const active = view === v.key
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>

        {view === 'cross' ? <CrossTable data={data} /> : null}
        {view === 'aa' ? <AaTable data={data} /> : null}
        {view === 'lmarena' ? <LmarenaTable data={data} /> : null}
        {view === 'openrouter' ? <OpenRouterTable data={data} /> : null}

        <div className="flex items-start gap-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            三个榜单回答三个不同问题：AA 看综合能力，LMArena 看人类偏好，OpenRouter
            看真实用量。先看共识，再看单项，避免把一个榜单当成全部。
          </span>
        </div>

        <SourcesFooter data={data} />
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
