'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { X, TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Copy } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/ai-news-api'
import { CapabilityRadar } from './CapabilityRadar'
import { getVendorPlatform, encodePrefill } from './vendor-platforms'
import { parseNumeric, highlight, CAPABILITY_THRESHOLDS } from './text-utils'

interface Props {
  entry: LeaderboardEntry
  open: boolean
  onClose: () => void
  /** 搜索关键词(可选):从 Leaderboard 搜索后打开弹窗时传入,高亮模型名/厂商名 */
  searchQuery?: string
}

/** 从模型数据自动提取能力标签(阈值引用 CAPABILITY_THRESHOLDS 配置常量) */
function extractCapabilityTags(entry: LeaderboardEntry): Array<{ key: string; label: string }> {
  const tags: Array<{ key: string; label: string }> = []
  const ctx = parseNumeric(entry.contextWindow)
  if (ctx !== null && ctx >= CAPABILITY_THRESHOLDS.longContext) tags.push({ key: 'tagLongContext', label: 'tagLongContext' })
  const out = parseNumeric(entry.maxOutput)
  if (out !== null && out >= CAPABILITY_THRESHOLDS.largeOutput) tags.push({ key: 'tagLargeOutput', label: 'tagLargeOutput' })
  const inPrice = parseNumeric(entry.inputPrice)
  if (inPrice !== null && inPrice < CAPABILITY_THRESHOLDS.lowCost) tags.push({ key: 'tagLowCost', label: 'tagLowCost' })
  if (entry.winRate !== null && entry.winRate > CAPABILITY_THRESHOLDS.highWinRate) tags.push({ key: 'tagHighWinRate', label: 'tagHighWinRate' })
  if (entry.arenaScore !== null && entry.arenaScore > CAPABILITY_THRESHOLDS.topTier) tags.push({ key: 'tagTopTier', label: 'tagTopTier' })
  if (entry.category === 'multimodal') tags.push({ key: 'tagMultimodal', label: 'tagMultimodal' })
  return tags
}

/** 模型详情弹窗:评分 + 核心参数 + 能力雷达图 + 官方 Key + 一键导入 */
export function ModelDetailDialog({ entry, open, onClose, searchQuery = '' }: Props) {
  const router = useRouter()
  const t = useTranslations('aiNews.detailDialog')

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const capabilityTags = React.useMemo(() => extractCapabilityTags(entry), [entry])

  if (!open) return null

  const rankDelta = entry.rankDelta
  const caps = entry.capabilities
  const platform = getVendorPlatform(entry.vendor)

  const paramRows = [
    { label: t('arenaScore'), value: entry.arenaScore ? `${entry.arenaScore}${entry.scoreCi ? ` ±${entry.scoreCi}` : ''}` : null },
    { label: t('rank'), value: entry.arenaRank ? `#${entry.arenaRank}` : null },
    { label: t('rankDelta'), value: rankDelta !== null ? (rankDelta > 0 ? `↑${rankDelta}` : rankDelta < 0 ? `↓${Math.abs(rankDelta)}` : t('stable')) : null },
    { label: t('winRate'), value: entry.winRate ? `${entry.winRate.toFixed(1)}%` : null },
    { label: t('voteCount'), value: entry.voteCount ? entry.voteCount.toLocaleString() : null },
    { label: t('contextWindow'), value: entry.contextWindow },
    { label: t('maxOutput'), value: entry.maxOutput },
    { label: t('inputPrice'), value: entry.inputPrice },
    { label: t('outputPrice'), value: entry.outputPrice },
    { label: t('releaseDate'), value: entry.releaseDate },
    { label: t('license'), value: entry.license },
  ].filter((r) => r.value)

  function handleQuickImport() {
    if (!platform) return
    const payload = encodePrefill({
      providerCode: platform.providerCode,
      name: `${entry.vendor} ${entry.modelName}`,
      baseUrlOverride: platform.defaultBaseUrl,
      apiFormat: platform.apiFormat,
      modelName: entry.modelName,
      vendor: entry.vendor,
    })
    router.push(`/settings/llm?prefill=${payload}`)
  }

  async function handleCopyBaseUrl() {
    if (!platform?.defaultBaseUrl) return
    try {
      await navigator.clipboard.writeText(platform.defaultBaseUrl)
      toast.success(t('baseUrlCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  async function handleCopyAndImport() {
    if (!platform?.defaultBaseUrl) return
    try {
      await navigator.clipboard.writeText(platform.defaultBaseUrl)
      const payload = encodePrefill({
        providerCode: platform.providerCode,
        name: `${entry.vendor} ${entry.modelName}`,
        baseUrlOverride: platform.defaultBaseUrl,
        apiFormat: platform.apiFormat,
        modelName: entry.modelName,
        vendor: entry.vendor,
      })
      toast.success(t('copyAndImport'), { description: platform.defaultBaseUrl })
      window.open(`/settings/llm?prefill=${payload}`, '_blank')
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-3 bg-muted/30 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">{highlight(entry.modelName, searchQuery)}</h3>
              {rankDelta !== null && rankDelta > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                  <TrendingUp className="h-2.5 w-2.5" />{rankDelta}
                </span>
              ) : rankDelta !== null && rankDelta < 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                  <TrendingDown className="h-2.5 w-2.5" />{Math.abs(rankDelta)}
                </span>
              ) : rankDelta === 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Minus className="h-2.5 w-2.5" />{t('stable')}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{highlight(entry.vendor, searchQuery)}</span>
              <span>·</span>
              <span>{entry.arenaRank ? `#${entry.arenaRank}` : '-'}</span>
              {entry.arenaScore ? (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground">{entry.arenaScore}{entry.scoreCi ? ` ±${entry.scoreCi}` : ''}</span>
                </>
              ) : null}
            </div>
            {capabilityTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {capabilityTags.map((tag) => (
                  <span
                    key={tag.key}
                    className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {t(tag.label)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          {/* 左:核心参数 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">{t('coreParams')}</h4>
            <div className="space-y-1.5">
              {paramRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
            {entry.highlight ? (
              <div className="mt-3 rounded-md bg-primary/5 px-3 py-2">
                <p className="text-[10px] font-medium text-muted-foreground">{t('highlight')}</p>
                <p className="mt-0.5 text-xs leading-relaxed">{entry.highlight}</p>
              </div>
            ) : null}
          </div>

          {/* 右:能力雷达图 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">{t('capabilityRadar')}</h4>
            {caps ? (
              <div className="rounded-md bg-muted/20 p-3">
                <CapabilityRadar capabilities={caps} size={200} />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                {t('noCapabilityData')}
              </div>
            )}
          </div>
        </div>

        {/* 官方资源 + 一键导入 */}
        {platform ? (
          <div className="mx-5 mb-5 rounded-lg border bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">{t('officialResources')}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {platform.officialKeyUrl ? (
                    <a
                      href={platform.officialKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      <span>{t('getApiKey')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {platform.docsUrl ? (
                    <a
                      href={platform.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span>{t('officialDocs')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {platform.defaultBaseUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyBaseUrl}
                        className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                        title={platform.defaultBaseUrl}
                      >
                        <span>{t('copyBaseUrl')}</span>
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyAndImport}
                        className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
                        title={platform.defaultBaseUrl}
                      >
                        <span>{t('copyAndImport')}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </>
                  ) : null}
                </div>
                {platform.note ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">{platform.note}</p>
                ) : null}
              </div>
              {platform.defaultBaseUrl ? (
                <button
                  type="button"
                  onClick={handleQuickImport}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Zap className="h-3 w-3" />
                  <span>{t('quickImport')}</span>
                </button>
              ) : (
                <span className="shrink-0 rounded-md bg-muted px-3 py-1.5 text-[10px] text-muted-foreground">
                  {t('noQuickImport')}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
