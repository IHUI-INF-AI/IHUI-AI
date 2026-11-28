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
  Layers,
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
import type { AiWorldAuthoritativeLeaderboard, AiWorldLeaderboardSourceId } from '@ihui/types'
import raw from '@/data/authoritative-leaderboard.json'
import { apiOrThrow } from '@/lib/api'

type Data = AiWorldAuthoritativeLeaderboard

const VIEWS = [
  { key: 'overall' as const, label: '全源平均', icon: Trophy },
  { key: 'cross' as const, label: '三家交叉', icon: BarChart3 },
  { key: 'aa' as const, label: '智能指数', icon: Sparkles },
  { key: 'lmarena' as const, label: '人类偏好', icon: Users },
  { key: 'openrouter' as const, label: '真实用量', icon: Activity },
  { key: 'boards' as const, label: '更多权威榜', icon: Layers },
]

const SOURCE_LABEL: Record<AiWorldLeaderboardSourceId, string> = {
  aa: 'AA',
  lmarena: 'LMArena',
  openrouter: 'OR',
  helm: 'HELM',
  opencompass: 'OpenCompass',
  superclue: 'SuperCLUE',
  livebench: 'LiveBench',
  swebench: 'SWE',
  epoch: 'Epoch',
}

const SOURCE_ORDER: AiWorldLeaderboardSourceId[] = [
  'aa',
  'lmarena',
  'openrouter',
  'helm',
  'opencompass',
  'superclue',
  'livebench',
  'swebench',
  'epoch',
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

function formatDuration(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null
  return n >= 120 ? `${(n / 60).toFixed(1)} 分钟` : `${n.toFixed(1)}s`
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

const VENDOR_LOGO: Record<string, string> = {
  openai: '/brands/models/openai-lobe.svg',
  google: '/brands/models/googlegemini.svg',
  anthropic: '/brands/models/anthropic.svg',
  deepseek: '/brands/models/deepseek.svg',
  'moonshot ai': '/brands/models/moonshotai.svg',
  moonshot: '/brands/models/moonshotai.svg',
  alibaba: '/brands/models/qwen.svg',
  qwen: '/brands/models/qwen.svg',
  mistral: '/brands/models/mistralai.svg',
  mistralai: '/brands/models/mistralai.svg',
  meta: '/brands/models/meta.svg',
  'z ai': '/brands/models/zhipu-lobe.svg',
  zhipu: '/brands/models/zhipu-lobe.svg',
  zai: '/brands/models/zhipu-lobe.svg',
  xai: '/brands/models/xai-lobe.svg',
  grok: '/brands/models/xai-lobe.svg',
  minimax: '/brands/models/minimax-lobe.svg',
  stepfun: '/brands/models/stepfun-lobe.svg',
  baidu: '/brands/models/baidu-lobe.svg',
  huawei: '/brands/models/huawei-lobe.svg',
  tencent: '/brands/models/tencent-lobe.svg',
}

const VENDOR_COLOR: Record<string, string> = {
  anthropic: '#D97757',
  google: '#4285F4',
  deepseek: '#4D6BFE',
  'moonshot ai': '#7C3AED',
  moonshot: '#7C3AED',
  meta: '#0866FF',
  mistral: '#FA520F',
  nvidia: '#76B900',
  amazon: '#FF9900',
  microsoft: '#00A4EF',
  cohere: '#39594D',
  minimax: '#E5484D',
  stepfun: '#12A594',
  xiaomi: '#FF6900',
  upstage: '#6B46C1',
  ai21: '#E11D48',
}

function vendorInitials(vendor: string): string {
  const words = vendor.trim().split(/[\s.]+/).filter(Boolean)
  if (words.length >= 2) {
    const first = words[0] ?? ''
    const second = words[1] ?? ''
    return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase()
  }
  return (vendor.trim().slice(0, 2) || 'AI').toUpperCase()
}

/** 厂商图标：有官方素材用素材，没有则用稳定的首字母色块，不伪造模型专属 logo。 */
function VendorLogo({ vendor }: { vendor: string }) {
  const key = vendor.trim().toLowerCase()
  const src = VENDOR_LOGO[key]
  if (src) {
    return (
      <img
        src={src}
        alt={`${vendor} logo`}
        title={`${vendor} 厂商图标`}
        className="h-6 w-6 shrink-0 rounded-md border border-border/60 bg-white object-contain p-0.5"
        loading="lazy"
      />
    )
  }
  const color = VENDOR_COLOR[key] ?? '#64748B'
  return (
    <span
      title={`${vendor} 厂商徽标`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {vendorInitials(vendor)}
    </span>
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
  openWeights?: boolean | null
  cn?: boolean
  reasoning?: boolean
}) {
  return (
    <div className="flex min-w-[170px] items-start gap-2">
      <VendorLogo vendor={vendor} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1 font-medium">
          <span>{model}</span>
          {cn ? <Tag tone="cn">国产</Tag> : null}
          {openWeights ? <Tag tone="open">开源</Tag> : null}
          {reasoning ? <Tag>推理</Tag> : null}
        </div>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">{vendor}</span>
      </div>
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

function OverallAllTable({ data }: { data: Data }) {
  const all = data.overallAll ?? []
  const [query, setQuery] = React.useState('')
  const [visible, setVisible] = React.useState(50)
  const normalized = query.trim().toLowerCase()
  const rows = normalized
    ? all.filter((row) => `${row.model} ${row.vendor}`.toLowerCase().includes(normalized))
    : all
  const shown = rows.slice(0, visible)
  if (all.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
        全源平均总榜正在生成；九源快照刷新后自动出现。
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        九家官方榜全源平均：每家榜内先按名次换百分位（第 1 名=100、末位=0），再对命中的榜等权平均。
        先按覆盖榜数降序，再按平均百分位降序，未上榜的榜不计 0；SWE-bench 取五个 subset
        中的最佳名次。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisible(50)
          }}
          placeholder="搜模型或厂商"
          className="h-7 w-44 rounded-md border bg-card px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <span className="text-[11px] text-muted-foreground">
          {rows.length === all.length
            ? `共 ${all.length} 个模型，覆盖 9 家官方榜`
            : `匹配 ${rows.length} / ${all.length} 个模型`}
        </span>
      </div>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 w-12 bg-card">位次</TableHead>
              <TableHead className="sticky left-12 z-10 min-w-52 bg-card">模型</TableHead>
              <TableHead className="w-24">平均百分位</TableHead>
              <TableHead className="w-16">覆盖</TableHead>
              <TableHead className="min-w-[420px]">九源名次</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.key} className="hover:bg-accent/40">
                <TableCell>
                  <RankBadge rank={row.rank} />
                </TableCell>
                <TableCell>
                  <ModelCell
                    model={row.model}
                    vendor={row.vendor}
                    openWeights={row.openWeights}
                    cn={row.cn}
                  />
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold tabular-nums">
                    {row.averagePercentile.toFixed(1)}
                  </span>
                  <span className="ml-0.5 text-[10px] text-muted-foreground">/100</span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                      row.coverage >= 5
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : row.coverage >= 3
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {row.coverage}/9
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {SOURCE_ORDER.map((id) => {
                      const source = row.sources[id]
                      if (!source) return null
                      return (
                        <span
                          key={id}
                          title={`${SOURCE_LABEL[id]} 第 ${source.rank} / ${source.total} 名，百分位 ${source.percentile}`}
                          className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">{SOURCE_LABEL[id]}</span>
                          <span className="tabular-nums">#{source.rank}</span>
                        </span>
                      )
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > visible ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((value) => value + 50)}
            className="rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            加载更多（还有 {rows.length - visible} 个）
          </button>
        </div>
      ) : null}
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
                <DetailMetric label="首答案 token" value={formatSeconds(selected.ttfa)} />
                <DetailMetric label="上下文" value={formatContext(selected.contextWindow)} />
                <DetailMetric label="输入价格 / M" value={formatPrice(selected.inputPrice)} />
                <DetailMetric label="输出价格 / M" value={formatPrice(selected.outputPrice)} />
                <DetailMetric label="缓存命中 / M" value={formatPrice(selected.cacheHitPrice)} />
                <DetailMetric label="缓存写入 / M" value={formatPrice(selected.cacheWritePrice)} />
                <DetailMetric label="单任务成本" value={formatPrice(selected.costPerTask)} />
                <DetailMetric label="单任务耗时" value={formatDuration(selected.timePerTask)} />
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
                        <span className="truncate text-[11px] text-muted-foreground">
                          {b.label}
                        </span>
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
  const [visible, setVisible] = React.useState(100)
  const active = categories.find((c) => c.id === scope) ?? categories[0]
  const rows = active?.rows ?? []
  const shown = rows.slice(0, visible)
  React.useEffect(() => {
    setVisible(100)
  }, [scope])
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
          {active?.count ?? 0} 个模型 · {formatVotes(active?.votes ?? 0)} 票 · 官方全量{' '}
          {active?.count ?? 0} 行，已载入 {rows.length} 行，已显示 {shown.length}
        </span>
      </div>
      <p className="text-label leading-relaxed text-muted-foreground">
        LMArena Text Arena 官方数据集，覆盖总榜、中文、编程、数学、创意写作、行业等全部分类。Elo
        来自盲测两两对比的人类偏好，不是正确率；所有分类均保留全量模型，页面按需加载，不截前 50。
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
            {shown.map((r) => (
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
      {visible < rows.length ? (
        <button
          type="button"
          onClick={() => setVisible((value) => value + 100)}
          className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          加载更多（已显示 {shown.length} / {rows.length}）
        </button>
      ) : null}
    </div>
  )
}

function OpenRouterTable({ data }: { data: Data }) {
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        OpenRouter 官方公开日榜，全部可用日期 tokens
        累计。这是真实调用量，不代表模型能力；同一模型不同构建分开统计。官方 CSV
        只有日期、模型、名次、tokens、占比五列，没有价格、上下文或参数量，这里不补假数据。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">累计 tokens</TableHead>
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

function BoardValue({ value, kind }: { value: unknown; kind?: string }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }
  if (kind === 'bool') {
    return <span className="text-[11px] text-muted-foreground">{value ? '是' : '否'}</span>
  }
  if (typeof value === 'string') {
    return <span className="text-xs text-muted-foreground">{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-[11px] text-muted-foreground">{value ? '是' : '否'}</span>
  }
  if (typeof value !== 'number') {
    return <span className="text-xs text-muted-foreground">{String(value)}</span>
  }
  if (!Number.isFinite(value)) {
    return <span className="text-muted-foreground">—</span>
  }
  if (kind === 'percent') {
    return <span className="tabular-nums">{value.toFixed(1)}%</span>
  }
  if (kind === 'usd') {
    return <span className="tabular-nums">${value.toFixed(2)}</span>
  }
  if (kind === 'tokens') {
    return <span className="tabular-nums">{formatTokens(value)}</span>
  }
  if (kind === 'seconds') {
    return <span className="tabular-nums">{value.toFixed(1)}s</span>
  }
  if (kind === 'int') {
    return <span className="tabular-nums">{value.toLocaleString('zh-CN')}</span>
  }
  if (kind === 'score') {
    return (
      <span className="font-medium tabular-nums">
        {Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}
      </span>
    )
  }
  return <span className="tabular-nums">{value}</span>
}

function BoardsTable({ data }: { data: Data }) {
  const boards = data.boards ?? []
  const [boardId, setBoardId] = React.useState(boards[0]?.id ?? '')
  const [query, setQuery] = React.useState('')
  const [visible, setVisible] = React.useState(50)
  const active = boards.find((board) => board.id === boardId) ?? boards[0]
  React.useEffect(() => {
    setVisible(50)
    setQuery('')
  }, [boardId])
  if (!active) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
        新增平台快照尚未就绪；接口恢复后会自动出现。
      </div>
    )
  }
  const normalized = query.trim().toLowerCase()
  const rows = normalized
    ? active.rows.filter((row) => `${row.model} ${row.vendor}`.toLowerCase().includes(normalized))
    : active.rows
  const shown = rows.slice(0, visible)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={active.id}
          onChange={(event) => setBoardId(event.target.value)}
          className="h-7 max-w-[260px] rounded-md border bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          aria-label="更多权威榜选择"
        >
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.shortName}（{board.boardSize}）
            </option>
          ))}
        </select>
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            active.live
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}
        >
          {active.live ? '官方接口刷新' : '官方页面快照'}
        </span>
        <span className="text-[11px] text-muted-foreground">
          数据日 {active.asOf || '—'} · 全量 {active.rows.length} 行
        </span>
        <a
          href={active.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          官方原榜 <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-label leading-relaxed text-muted-foreground">{active.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisible(50)
          }}
          placeholder="搜模型或厂商"
          className="h-7 w-44 rounded-md border bg-card px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <span className="text-[11px] text-muted-foreground">
          {rows.length === active.rows.length
            ? `共 ${active.rows.length} 行，全部来自官方源`
            : `匹配 ${rows.length} / ${active.rows.length} 行`}
        </span>
      </div>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 w-12 bg-card">位次</TableHead>
              <TableHead className="sticky left-12 z-10 min-w-52 bg-card">模型</TableHead>
              {active.columns.map((column) => (
                <TableHead key={column.key} className="whitespace-nowrap">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, index) => (
              <TableRow key={`${active.id}-${row.model}-${index}`} className="hover:bg-accent/40">
                <TableCell className="sticky left-0 z-10 bg-card">
                  <RankBadge rank={row.rank} />
                </TableCell>
                <TableCell className="sticky left-12 z-10 bg-card">
                  <ModelCell
                    model={row.model}
                    vendor={row.vendor}
                    openWeights={row.openWeights}
                    cn={row.cn}
                  />
                </TableCell>
                {active.columns.map((column) => (
                  <TableCell key={column.key} className="whitespace-nowrap">
                    <BoardValue value={row.values[column.key]} kind={column.kind} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">没有匹配的模型。</p> : null}
      {visible < rows.length ? (
        <button
          type="button"
          onClick={() => setVisible((value) => value + 100)}
          className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          加载更多（已显示 {visible} / {rows.length}）
        </button>
      ) : null}
      <p className="text-[10px] leading-relaxed text-muted-foreground">{active.note}</p>
      {active.dataset ? (
        <a
          href={active.dataset}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          官方数据集/接口 <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
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
        服务端每 6 小时自动从 AA、LMArena、OpenRouter、HELM、SuperCLUE、LiveBench、SWE-bench、Epoch
        官方源刷新一次快照；OpenCompass
        为官方页面快照并明确标注；页面每次打开读取最新快照，不依赖重新构建。最近成功刷新{' '}
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
  const [view, setView] = React.useState<(typeof VIEWS)[number]['key']>('overall')
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
  const overallTop = (data.overallAll ?? [])[0]
  const aaTop = data.aa[0]
  const lmTop = data.lmarena.overall[0]
  const lmCnTop = data.lmarena.chinese[0]
  const orTop = data.openrouter[0]

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
            label="全源平均第一"
            value={overallTop?.model ?? '—'}
            detail={`${overallTop ? overallTop.averagePercentile.toFixed(1) : '—'} / 100 · 覆盖 ${overallTop?.coverage ?? 0}/9 · 三交叉 #${consensus?.rank ?? '—'}`}
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

        {view === 'overall' ? <OverallAllTable data={data} /> : null}
        {view === 'cross' ? <CrossTable data={data} /> : null}
        {view === 'aa' ? <AaTable data={data} /> : null}
        {view === 'lmarena' ? <LmarenaTable data={data} /> : null}
        {view === 'openrouter' ? <OpenRouterTable data={data} /> : null}
        {view === 'boards' ? <BoardsTable data={data} /> : null}

        <div className="flex items-start gap-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            “全源平均”把 9 家官方榜的名次百分位等权平均，覆盖榜数优先、再看平均百分位；它是站内综合指数，不是任何一家官方总分。“三家交叉”只回答 AA、LMArena、OpenRouter
            三家可对齐榜单的交集：AA 看综合能力、LMArena 看人类偏好、OpenRouter 看真实用量。HELM、OpenCompass、SuperCLUE、LiveBench、SWE-bench、Epoch
            仍保留各自量纲，在“更多权威榜”里单榜全量看。
          </span>
        </div>

        <SourcesFooter data={data} />
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
