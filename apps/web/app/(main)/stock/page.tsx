'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  LineChart,
  TrendingUp,
  Loader2,
  History,
  Coins,
  Clock,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton, Empty } from '@/components/common'
import { cn } from '@/lib/utils'

/** 单次分析结果（与后端 StockAnalysisResult 对应；createdAt 经 JSON 序列化为 ISO 字符串） */
interface StockAnalysisResult {
  symbol: string
  analysis: string
  conversationId: string
  tokensUsed: number
  createdAt: string
  error?: string
  mock?: boolean
}

/** Token 余额 */
interface TokenBalance {
  total: number
  used: number
  remaining: number
}

/** 历史记录分页响应 */
interface StockHistoryData {
  list: StockAnalysisResult[]
  total: number
  page?: number
  pageSize?: number
}

/** 分析请求错误（区分余额不足与一般错误） */
interface AnalyseError {
  kind: 'balance' | 'general'
  message: string
}

const HISTORY_PAGE_SIZE = 10
const QUESTION_MAX_LENGTH = 2000

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

async function fetchBalance(): Promise<TokenBalance> {
  const res = await fetchApi<TokenBalance>('/api/stock/token-balance')
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function fetchHistory(): Promise<StockHistoryData> {
  const qs = new URLSearchParams({ page: '1', pageSize: String(HISTORY_PAGE_SIZE) })
  const res = await fetchApi<StockHistoryData>(`/api/stock/history?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export default function StockAnalysePage() {
  const t = useTranslations('eduAi.stock')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const [symbol, setSymbol] = React.useState('')
  const [question, setQuestion] = React.useState('')
  const [analysing, setAnalysing] = React.useState(false)
  const [result, setResult] = React.useState<StockAnalysisResult | null>(null)
  const [analyseError, setAnalyseError] = React.useState<AnalyseError | null>(null)
  const [detail, setDetail] = React.useState<StockAnalysisResult | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  const balanceQuery = useQuery({
    queryKey: ['stock', 'balance'],
    queryFn: fetchBalance,
  })

  const historyQuery = useQuery({
    queryKey: ['stock', 'history'],
    queryFn: fetchHistory,
  })

  const balance = balanceQuery.data
  const balanceTotal = balance?.total ?? 0
  const balanceUsed = balance?.used ?? 0
  const balanceRemaining = balance?.remaining ?? 0
  const usedPct =
    balanceTotal > 0 ? Math.min(100, Math.max(0, (balanceUsed / balanceTotal) * 100)) : 0

  const canAnalyse = symbol.trim().length > 0 && question.trim().length > 0 && !analysing
  const isMock = Boolean(result?.mock || result?.error)
  const historyList = historyQuery.data?.list ?? []

  const handleAnalyse = async (): Promise<void> => {
    if (!canAnalyse) return
    setAnalysing(true)
    setAnalyseError(null)
    setResult(null)
    try {
      const res = await fetchApi<StockAnalysisResult>('/api/stock/analyse', {
        method: 'POST',
        body: JSON.stringify({ symbol: symbol.trim(), question: question.trim() }),
      })
      if (!res.success) {
        setAnalyseError({
          kind: res.status === 402 ? 'balance' : 'general',
          message: res.error,
        })
        return
      }
      setResult(res.data)
      // 成功后刷新余额与历史
      void queryClient.invalidateQueries({ queryKey: ['stock', 'balance'] })
      void queryClient.invalidateQueries({ queryKey: ['stock', 'history'] })
    } catch (e) {
      setAnalyseError({ kind: 'general', message: (e as Error).message })
    } finally {
      setAnalysing(false)
    }
  }

  const openDetail = (item: StockAnalysisResult): void => {
    setDetail(item)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LineChart className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* Token 余额卡 */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Coins className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('tokenBalance')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {balanceQuery.isError ? (
            <Alert variant="danger" description={(balanceQuery.error as Error).message} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('total')}</p>
                  <p className="mt-0.5 text-lg font-semibold">
                    {balanceQuery.isLoading ? '—' : balanceTotal.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('used')}</p>
                  <p className="mt-0.5 text-lg font-semibold">
                    {balanceQuery.isLoading ? '—' : balanceUsed.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('remaining')}</p>
                  <p className="mt-0.5 text-lg font-semibold text-emerald-600">
                    {balanceQuery.isLoading ? '—' : balanceRemaining.toLocaleString()}
                  </p>
                </div>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(usedPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    'h-full rounded transition-all',
                    usedPct >= 90 ? 'bg-rose-500' : usedPct >= 60 ? 'bg-amber-500' : 'bg-primary',
                  )}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 分析区 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="stock-symbol">{t('symbol')}</Label>
            <Input
              id="stock-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t('symbolPlaceholder')}
              maxLength={20}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-question">{t('question')}</Label>
            <textarea
              id="stock-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('questionPlaceholder')}
              maxLength={QUESTION_MAX_LENGTH}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-right text-xs text-muted-foreground">
              {question.length}/{QUESTION_MAX_LENGTH}
            </p>
          </div>

          <Button
            onClick={() => {
              void handleAnalyse()
            }}
            disabled={!canAnalyse}
            className="gap-1.5"
          >
            {analysing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {analysing ? t('analysing') : t('analyse')}
          </Button>

          {analyseError && (
            <Alert
              variant={analyseError.kind === 'balance' ? 'warning' : 'danger'}
              title={analyseError.kind === 'balance' ? t('needBalance') : t('error')}
              description={analyseError.message}
              closable
              onClose={() => setAnalyseError(null)}
            />
          )}
        </CardContent>
      </Card>

      {/* 结果区 */}
      {result && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('result')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isMock && (
              <Alert variant="warning" title={t('mockWarning')} description={result.error} />
            )}
            {result.analysis ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {result.analysis}
              </p>
            ) : (
              !isMock && <Empty icon={LineChart} title={t('empty')} />
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {t('tokensUsed')}: {result.tokensUsed.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {t('time')}: {formatTime(result.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 历史记录 */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <History className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('history')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {tc('loading')}
            </div>
          ) : historyQuery.isError ? (
            <Alert variant="danger" description={(historyQuery.error as Error).message} />
          ) : historyList.length === 0 ? (
            <Empty icon={History} title={t('noHistory')} />
          ) : (
            <ul className="divide-y">
              {historyList.map((item) => (
                <li key={item.conversationId}>
                  <button
                    type="button"
                    onClick={() => openDetail(item)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                      {item.symbol}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-sm">
                        {item.analysis || t('empty')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatTime(item.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                      {t('viewHistory')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 历史详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm">
                {detail?.symbol}
              </span>
              {t('result')}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {detail ? (
                <>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" />
                    {t('tokensUsed')}: {detail.tokensUsed.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(detail.createdAt)}
                  </span>
                </>
              ) : (
                tc('loading')
              )}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              {detail.analysis ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {detail.analysis}
                </p>
              ) : (
                <Empty icon={LineChart} title={t('empty')} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
