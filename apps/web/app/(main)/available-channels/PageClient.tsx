// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 可用渠道公示页(2026-09-16 立)。
 *
 * 用户侧透明化:展示平台在售的每个上游渠道(按 provider_code 聚合)及其
 * 已上架模型数量、模型清单、价格区间与倍率区间。
 * 数据源 GET /api/relay/channels/public(公开,只暴露聚合信息,不泄漏上游 Key 与选路细节)。
 */
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Server, RefreshCw } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { fetchApi } from '@/lib/api'

/** 与 relay-public.ts 的 ChannelAcc 输出一致 */
interface PublicChannel {
  providerCode: string
  channelName: string
  modelCount: number
  models: string[]
  modelsTruncated: boolean
  minInputPricePer1k: number
  maxInputPricePer1k: number
  minOutputPricePer1k: number
  maxOutputPricePer1k: number
  minMultiplier: number
  maxMultiplier: number
  visibility: 'public'
}

/** 分/千 token → 显示(保留 4 位有效小数,避免极低价显示为 0) */
function price(v: number): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return n >= 1 ? n.toFixed(2) : n.toFixed(4)
}

/** 倍率区间显示:min === max 时只显示一个值 */
function multiplierRange(min: number, max: number): string {
  const a = Number(min ?? 1).toFixed(2)
  const b = Number(max ?? 1).toFixed(2)
  return a === b ? `×${a}` : `×${a} ~ ×${b}`
}

export default function AvailableChannelsClient() {
  const t = useTranslations('availableChannels')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['relay', 'channels', 'public'],
    queryFn: async () => {
      const r = await fetchApi<{ channels: PublicChannel[] }>('/api/relay/channels/public')
      if (!r.success) throw new Error(r.error)
      return r.data.channels
    },
  })

  const channels = data ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          <span>{t('refresh')}</span>
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          <span>{t('loading')}</span>
        </div>
      ) : channels.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
          {channels.map((c) => (
            <Card key={c.providerCode}>
              <CardContent className="min-[640px]:p-3 space-y-3 p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-1.5">
                    <Server className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.channelName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.providerCode}</p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                    {t('models')} {c.modelCount}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{t('inputPrice')}</dt>
                    <dd className="tabular-nums">
                      {price(c.minInputPricePer1k)} ~ {price(c.maxInputPricePer1k)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('outputPrice')}</dt>
                    <dd className="tabular-nums">
                      {price(c.minOutputPricePer1k)} ~ {price(c.maxOutputPricePer1k)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">{t('multiplier')}</dt>
                    <dd className="tabular-nums">
                      {multiplierRange(c.minMultiplier, c.maxMultiplier)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1">
                  {c.models.slice(0, 8).map((m) => (
                    <span
                      key={m}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                  {(c.modelsTruncated || c.models.length > 8) && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t('moreModels', { count: c.modelCount - Math.min(8, c.models.length) })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
