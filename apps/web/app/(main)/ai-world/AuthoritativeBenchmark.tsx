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
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import raw from '@/data/authoritative-leaderboard.json'

type CrossSource = { rank: number; score?: number; tokens?: number; share?: number }
type CrossRow = {
  rank: number
  key: string
  model: string
  vendor: string
  cn: boolean
  openWeights: boolean
  coverage: number
  aa: CrossSource | null
  lm: CrossSource | null
  or: CrossSource | null
}
type AaRow = {
  rank: number
  model: string
  vendor: string
  score: number
  openWeights: boolean
  cn: boolean
}
type LmRow = {
  rank: number
  model: string
  vendor: string
  score: number
  ci: number
  votes: number
  license: string
  open: boolean
}
type OrRow = {
  rank: number
  model: string
  vendor: string
  tokens: number
  share: number
  slug: string
  build: string | null
  free: boolean
}
type Source = {
  id: string
  name: string
  metric: string
  url: string
  dataset?: string
  asOf: string
  boardSize: number
  note: string
}
type Data = {
  generatedAt: string
  title: string
  subtitle: string
  sources: Source[]
  methodology: string
  cross: CrossRow[]
  aa: AaRow[]
  lmarena: { overall: LmRow[]; chinese: LmRow[]; overallVotes: number; chineseVotes: number }
  openrouter: OrRow[]
}

const data = raw as Data

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
}: {
  model: string
  vendor: string
  openWeights?: boolean
  cn?: boolean
}) {
  return (
    <div className="min-w-[150px]">
      <div className="flex flex-wrap items-center gap-1 font-medium">
        <span>{model}</span>
        {cn ? <Tag tone="cn">国产</Tag> : null}
        {openWeights ? <Tag tone="open">开源</Tag> : null}
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
      <div
        className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-tight"
        title={value}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground" title={detail}>
        {detail}
      </div>
    </div>
  )
}

function CrossTable() {
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

function AaTable() {
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        Artificial Analysis Intelligence Index
        v5.0.2，同一模型家族取最高档位；分数越高表示综合能力越强。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">智能指数</TableHead>
              <TableHead className="w-28">类型</TableHead>
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
                  />
                </TableCell>
                <TableCell className="font-medium tabular-nums">{r.score.toFixed(1)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.openWeights ? <Tag tone="open">开源权重</Tag> : <Tag>闭源</Tag>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LmarenaTable() {
  const [scope, setScope] = React.useState<'overall' | 'chinese'>('overall')
  const rows = scope === 'overall' ? data.lmarena.overall : data.lmarena.chinese
  const votes = scope === 'overall' ? data.lmarena.overallVotes : data.lmarena.chineseVotes
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
          <button
            type="button"
            onClick={() => setScope('overall')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              scope === 'overall'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            全球总榜
          </button>
          <button
            type="button"
            onClick={() => setScope('chinese')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              scope === 'chinese'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            中文榜
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {scope === 'overall' ? '427 个模型' : '399 个模型'} · {formatVotes(votes)} 票
        </span>
      </div>
      <p className="text-label leading-relaxed text-muted-foreground">
        LMArena Text Arena 官方数据集，Elo 来自盲测两两对比的人类偏好，不是正确率。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">Arena 分</TableHead>
              <TableHead className="w-20">票数</TableHead>
              <TableHead className="w-16">许可</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${scope}-${r.rank}-${r.model}`} className="hover:bg-accent/40">
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
                  {r.votes.toLocaleString('zh-CN')}
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

function OpenRouterTable() {
  return (
    <div className="space-y-2">
      <p className="text-label leading-relaxed text-muted-foreground">
        OpenRouter 官方公开日榜，近 7 天 tokens
        累计。这是真实调用量，不代表模型能力；同一模型不同构建分开统计。
      </p>
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">位次</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="w-24">7 天 tokens</TableHead>
              <TableHead className="w-20">占比</TableHead>
              <TableHead className="w-28">构建</TableHead>
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
                  {r.build ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SourcesFooter() {
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
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            更新 {data.generatedAt.slice(0, 10)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
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

        {view === 'cross' ? <CrossTable /> : null}
        {view === 'aa' ? <AaTable /> : null}
        {view === 'lmarena' ? <LmarenaTable /> : null}
        {view === 'openrouter' ? <OpenRouterTable /> : null}

        <div className="flex items-start gap-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            三个榜单回答三个不同问题：AA 看综合能力，LMArena 看人类偏好，OpenRouter
            看真实用量。先看共识，再看单项，避免把一个榜单当成全部。
          </span>
        </div>

        <SourcesFooter />
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
