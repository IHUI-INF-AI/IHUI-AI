// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Database,
  Cpu,
  Clock,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatGrid,
  StatCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
} from '@ihui/ui-react'
import type { SelectHTMLAttributes } from 'react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { buildQs } from '@/lib/edu'

interface AlgorithmRecordItem {
  id: string
  kind: string
  algName: string
  category: string | null
  provider: string
  product: string | null
  purpose: string | null
  recordNo: string
  batch: string | null
  sourceUrl: string | null
}

interface StatsData {
  totalAll: number
  updatedAt: string | null
}

interface KindCount {
  kind: string
  count: number
}

interface SearchResult {
  items: AlgorithmRecordItem[]
  total: number
  stats?: StatsData
  kindCounts?: KindCount[]
  batches?: string[]
}

const KIND_RECOMMEND = 'algorithm_recommend'
const KIND_DEEP = 'deep_synthesis'
const PAGE_SIZE = 20

function trimEmptyToUndefined(v: string): string | undefined {
  const s = v.trim()
  return s ? s : undefined
}

// ISO 日期时间 → 本地日期 YYYY-MM-DD（无法解析返回 '-'）
function formatLocalDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ModelRecordPage() {
  const t = useTranslations('settings')
  const [keyword, setKeyword] = React.useState('')
  const [kind, setKind] = React.useState('')
  const [batch, setBatch] = React.useState('')
  const [items, setItems] = React.useState<AlgorithmRecordItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [stats, setStats] = React.useState<StatsData | null>(null)
  const [kindCounts, setKindCounts] = React.useState<KindCount[]>([])
  const [batches, setBatches] = React.useState<string[]>([])
  const [copiedNo, setCopiedNo] = React.useState<string | null>(null)
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 组件卸载时清理复制提示定时器
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const runSearch = React.useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setError('')
      fetchApi<SearchResult>(
        '/algorithm-record/search' +
          buildQs({
            q: trimEmptyToUndefined(keyword),
            kind: trimEmptyToUndefined(kind),
            batch: trimEmptyToUndefined(batch),
            page: targetPage,
            pageSize: PAGE_SIZE,
          }),
      )
        .then((res) => {
          if (res.success) {
            setItems(res.data?.items ?? [])
            setTotal(res.data?.total ?? 0)
            setPage(targetPage)
            setStats(res.data?.stats ?? null)
            setKindCounts(res.data?.kindCounts ?? [])
            setBatches(res.data?.batches ?? [])
          } else {
            setError(t('modelRecordLoadFailed'))
            setItems([])
            setTotal(0)
          }
        })
        .catch(() => {
          setError(t('modelRecordLoadFailed'))
          setItems([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    },
    [keyword, kind, batch, t],
  )

  React.useEffect(() => {
    void runSearch(1)
    // 组件挂载时首次加载全量(默认无关键字、全部类型、全部批次)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runSearch(1)
  }

  const onKindChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'] = (e) => {
    setKind(e.target.value)
    void runSearch(1)
  }

  const onBatchChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'] = (e) => {
    setBatch(e.target.value)
    void runSearch(1)
  }

  const copyRecordNo = async (no: string) => {
    if (copiedNo === no) return
    const onCopied = () => {
      setCopiedNo(no)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedNo(null), 1500)
    }
    try {
      await navigator.clipboard.writeText(no)
      onCopied()
    } catch {
      // 降级:临时 textarea + execCommand('copy')
      try {
        const textarea = document.createElement('textarea')
        textarea.value = no
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        onCopied()
      } catch {
        // 复制不可用时静默忽略
      }
    }
  }

  // 概览统计:未加载成功时展示 '-' 而非报错
  const deepCount = stats ? (kindCounts.find((k) => k.kind === KIND_DEEP)?.count ?? 0) : '-'
  const recommendCount = stats
    ? (kindCounts.find((k) => k.kind === KIND_RECOMMEND)?.count ?? 0)
    : '-'
  const totalAll = stats?.totalAll ?? '-'
  const updatedAt = formatLocalDate(stats?.updatedAt ?? null)

  return (
    <div className="space-y-4 py-4">
      <BackButton />

      {/* 统计概览卡 */}
      <StatGrid cols={4}>
        <StatCard
          label={t('modelRecordStatsTotal')}
          value={totalAll}
          icon={<Database className="h-4 w-4 shrink-0" />}
        />
        <StatCard
          label={t('modelRecordStatsDeep')}
          value={deepCount}
          icon={<Cpu className="h-4 w-4 shrink-0" />}
        />
        <StatCard
          label={t('modelRecordStatsRecommend')}
          value={recommendCount}
          icon={<ShieldCheck className="h-4 w-4 shrink-0" />}
        />
        <StatCard
          label={t('modelRecordUpdatedAt')}
          value={updatedAt}
          icon={<Clock className="h-4 w-4 shrink-0" />}
        />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            {t('modelRecordCardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('modelRecordSearchPlaceholder')}
              className="h-9 min-w-[160px] flex-1"
            />
            <select
              value={kind}
              onChange={onKindChange}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
              aria-label={t('modelRecordAlgorithmType')}
            >
              <option value="">{t('modelRecordKindAll')}</option>
              <option value={KIND_RECOMMEND}>{t('modelRecordKindRecommend')}</option>
              <option value={KIND_DEEP}>{t('modelRecordKindDeep')}</option>
            </select>
            <select
              value={batch}
              onChange={onBatchChange}
              className="h-9 max-w-[200px] rounded-md border border-input bg-background px-3 text-sm outline-none"
              aria-label={t('modelRecordBatch')}
            >
              <option value="">{t('modelRecordFilterAllBatch')}</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <Button type="submit" size="default" className="px-3 text-xs">
              <Search className="h-4 w-4" />
              {t('modelRecordSearch')}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            {t('modelRecordCount', { total })}
          </p>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('modelRecordLoading')}
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('modelRecordEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('modelRecordModelName')}</TableHead>
                    <TableHead>{t('modelRecordAlgorithmType')}</TableHead>
                    <TableHead>{t('modelRecordApplicant')}</TableHead>
                    <TableHead>{t('modelRecordProduct')}</TableHead>
                    <TableHead>{t('modelRecordPurpose')}</TableHead>
                    <TableHead>{t('modelRecordNumber')}</TableHead>
                    <TableHead>{t('modelRecordBatch')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const copied = copiedNo === item.recordNo
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {item.algName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {item.category ?? '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {item.provider}
                        </TableCell>
                        <TableCell className="text-xs">{item.product ?? '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {item.purpose ?? '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-1 font-mono">
                            {item.recordNo}
                            <button
                              type="button"
                              onClick={() => void copyRecordNo(item.recordNo)}
                              aria-label={
                                copied ? t('modelRecordCopied') : t('modelRecordCopy')
                              }
                              className={
                                copied
                                  ? 'ml-0.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-normal text-emerald-600 transition-colors dark:text-emerald-400'
                                  : 'ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                              }
                            >
                              {copied ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copied && t('modelRecordCopied')}
                            </button>
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t('modelRecordSource')}
                                title={t('modelRecordSource')}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {item.batch ?? '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t('modelRecordPageInfo', { page, totalPages })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => void runSearch(Math.max(1, page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('modelRecordPrev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => void runSearch(Math.min(totalPages, page + 1))}
                >
                  {t('modelRecordNext')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('modelRecordNotice')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}