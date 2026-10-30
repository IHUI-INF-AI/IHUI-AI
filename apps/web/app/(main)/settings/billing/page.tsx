// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 账单与用量页(G4 计费弹性 · 账单/定价透明化改造,2026-10-30)
 *
 * 在原「订单 / 发票申请」两页签之上补两块透明面(入口沿用 helpers.ts 既有
 * `/settings/billing` 一枚,不新建重复入口):
 *   1. 计费规则区:listPricingRules(GET /api/pricing-rules,登录可见)渲染当前生效规则
 *      —— mode 徽标 / 基础价 / 档位系数表 / 错峰窗口人话说明(timeOfDayDescriptions,
 *      服务端拼好直接展示,前端不再各自解析 jsonb) / 生效版本与区间;
 *      空态 = 存量默认口径提示(未配置自定义规则时按"基础价 × 档位系数、无错峰"计费)。
 *   2. 我的用量区:近 30 天按日积分消耗(复用 GET /api/credits/usage/daily 的 90 天桶,
 *      截尾 30 天,不加第二次请求)+ 按模型用量与花费
 *      (GET /api/v1/ai/usage/stats?days=30,ai-service 端点无 api-client 封装,
 *      对齐 devices 页姿势用 fetchApi 直调,不改 api-client)。
 *
 * 透明性文案:每笔扣费 = 基础价 × 档位系数 × 错峰系数;规则带版本号与生效区间,
 * 历史扣费可按当时结算的规则版本回查(后端软下线纪律保证 ruleId 永远可回查)。
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { BarChart3, Receipt, ScrollText, ShoppingCart } from 'lucide-react'

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { buildQs, type PageData } from '@/lib/edu'
import {
  getDailyCreditsUsage,
  listPricingRules,
  type Order,
  type PricingRuleUserView,
} from '@ihui/api-client'
import { CreditsHeatmapCard } from '@/components/billing/credits-heatmap-card'

import { OrdersTab } from './OrdersTab'
import { InvoicesTab } from './InvoicesTab'
import { PAGE_SIZE } from './helpers'
import type { InvoiceApplication } from './types'

/** GET /api/v1/ai/usage/stats(ai-service)响应里用量区用到的行形状(其余字段不取) */
interface AiUsageRow {
  total_tokens: number
  cost: number
  calls?: number
}

/** GET /api/v1/ai/usage/stats?days=30 响应载荷(与 settings/usage 页同一数据源) */
interface AiUsageStats {
  total_tokens: number
  total_cost: number
  total_calls: number
  daily_breakdown: Record<string, AiUsageRow>
  model_breakdown: Record<string, AiUsageRow>
  provider_breakdown: Record<string, AiUsageRow>
}

/** 档位系数展示:统一 × 前缀(String 天然裁掉无意义尾零) */
function formatFactor(n: number): string {
  return `×${n}`
}

export default function BillingPage() {
  const t = useTranslations('settings')
  // 登录态门(与签到助手同型):未就绪/未登录不发注定 401 的挂载请求
  const { allow } = useAuthGate()
  const locale = useLocale()
  const [tab, setTab] = React.useState<'orders' | 'invoices'>('orders')
  const [orderPage, setOrderPage] = React.useState(1)
  const [invoicePage, setInvoicePage] = React.useState(1)

  const currencyFmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }),
    [locale],
  )
  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )
  // 基础价:最多 6 位小数(basePrice 存分口径,尾零由 Intl 自动裁)
  const priceFmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }),
    [locale],
  )
  const dayFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale],
  )

  const ordersQuery = useQuery({
    queryKey: ['settings', 'billing', 'orders', orderPage],
    queryFn: async () => {
      const res = await fetchApi<PageData<Order>>(
        `/orders/me${buildQs({ page: orderPage, pageSize: PAGE_SIZE })}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: allow && tab === 'orders',
  })

  const invoicesQuery = useQuery({
    queryKey: ['settings', 'billing', 'invoices', invoicePage],
    queryFn: async () => {
      const res = await fetchApi<PageData<InvoiceApplication>>(
        `/invoices/applications${buildQs({ page: invoicePage, pageSize: PAGE_SIZE })}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: allow && tab === 'invoices',
  })

  // 按日积分消耗热力图(§D64 卡不取数,数据面 = GET /api/credits/usage/daily,UTC 分桶缺日补零)
  const dailyUsageQuery = useQuery({
    queryKey: ['settings', 'billing', 'credits-usage-daily'],
    queryFn: async () => {
      const res = await getDailyCreditsUsage({ days: 90 })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: allow,
  })
  const heatmapDayCounts = React.useMemo(() => {
    const buckets = dailyUsageQuery.data?.buckets
    if (!buckets || buckets.length === 0) return undefined
    return Object.fromEntries(buckets.map((b) => [b.date, b.count] as const))
  }, [dailyUsageQuery.data])
  // 会话视图取"当日新建会话数"(与积分消耗是两条独立序列);只递交日 >0 的日子,
  // 否则 90 天区间会把一串 0 排进列表(卡的会话视图是清单不是热力)
  const heatmapSessionCounts = React.useMemo(() => {
    const buckets = dailyUsageQuery.data?.buckets ?? []
    const hit = buckets.filter((b) => b.sessions > 0)
    if (hit.length === 0) return undefined
    return Object.fromEntries(hit.map((b) => [b.date, b.sessions] as const))
  }, [dailyUsageQuery.data])

  // ===== 计费规则区(G4:GET /api/pricing-rules,登录可见) =====
  const rulesQuery = useQuery({
    queryKey: ['settings', 'billing', 'pricing-rules'],
    queryFn: async () => {
      const res = await listPricingRules()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: allow,
  })

  // ===== 我的用量区:按模型用量与花费 =====
  // ai-service 端点没有 api-client 封装 ⇒ 按纪律 fetchApi 直调(对齐 devices 页姿势),不改 api-client。
  const aiUsageQuery = useQuery({
    queryKey: ['settings', 'billing', 'ai-usage-30d'],
    queryFn: async () => {
      const res = await fetchApi<AiUsageStats>('/api/v1/ai/usage/stats?days=30')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: allow,
  })

  // 近 30 天按日桶:复用 90 天查询截尾,避免对同端点发第二次请求
  const last30Buckets = React.useMemo(() => {
    const buckets = dailyUsageQuery.data?.buckets ?? []
    return buckets.slice(-30)
  }, [dailyUsageQuery.data])
  const last30Points = React.useMemo(
    () => last30Buckets.reduce((sum, b) => sum + b.points, 0),
    [last30Buckets],
  )
  const modelEntries = React.useMemo(
    () =>
      Object.entries(aiUsageQuery.data?.model_breakdown ?? {}).sort(
        (a, b) => b[1].cost - a[1].cost,
      ),
    [aiUsageQuery.data],
  )

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />

      {/* ===== 计费规则区(价格公示透明面) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            {t('billing.rulesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('billing.rulesDesc')}</p>
          {/* 透明性公式:每笔扣费的三个乘数一律可在下方规则里找到出处 */}
          <p
            data-testid="billing-formula"
            className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium"
          >
            {t('billing.formula')}
          </p>
          {rulesQuery.error ? (
            <Alert variant="danger" title={t('billing.loadFailed')} closable />
          ) : null}
          {rulesQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('billingLoading')}</p>
          ) : (rulesQuery.data?.length ?? 0) === 0 ? (
            /* 空态 = 存量默认口径提示(没有自定义规则不代表不计费) */
            <div
              data-testid="billing-rules-empty"
              className="py-6 text-center text-sm text-muted-foreground"
            >
              <p>{t('billing.emptyTitle')}</p>
              <p className="mt-1 text-xs">{t('billing.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(rulesQuery.data ?? []).map((rule: PricingRuleUserView) => (
                <div
                  key={rule.id}
                  data-testid={`pricing-rule-${rule.id}`}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{rule.displayName}</span>
                    <Badge variant="outline" data-testid={`pricing-rule-mode-${rule.id}`}>
                      {t(`billing.mode_${rule.mode}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t('billing.versionLabel')} v{rule.version}
                    </span>
                  </div>
                  <p className="text-xs">
                    {t('billing.basePriceLabel')}:{' '}
                    <span className="font-medium">
                      {rule.currency} {priceFmt.format(rule.basePrice)}{' '}
                      {t(`billing.unit_${rule.mode}`)}
                    </span>
                  </p>

                  {/* 档位系数表:未知档位按 ×1(服务端 tierMultipliers 只列显式档位) */}
                  <div>
                    <p className="mb-1 text-xs font-medium">{t('billing.tierTitle')}</p>
                    {Object.keys(rule.tierMultipliers ?? {}).length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('billing.tierNone')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('billing.tierColName')}</TableHead>
                            <TableHead>{t('billing.tierColFactor')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(rule.tierMultipliers).map(([tier, factor]) => (
                            <TableRow key={`${rule.id}-${tier}`}>
                              <TableCell className="text-xs">{tier}</TableCell>
                              <TableCell className="text-xs" data-testid="pricing-tier-factor">
                                {formatFactor(factor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* 错峰窗口:人话说明由服务端拼好(timeOfDayDescriptions),直接渲染 */}
                  <div>
                    <p className="mb-1 text-xs font-medium">{t('billing.offPeakTitle')}</p>
                    {rule.timeOfDayDescriptions.length > 0 ? (
                      <ul
                        data-testid={`pricing-rule-offpeak-${rule.id}`}
                        className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground"
                      >
                        {rule.timeOfDayDescriptions.map((desc) => (
                          <li key={desc}>{desc}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('billing.offPeakNone')}</p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t('billing.effectiveLabel')}:{' '}
                    {Number.isNaN(Date.parse(rule.effectiveFrom))
                      ? '—'
                      : dayFmt.format(new Date(rule.effectiveFrom))}{' '}
                    –{' '}
                    {rule.effectiveTo && !Number.isNaN(Date.parse(rule.effectiveTo))
                      ? t('billing.effectiveTo', {
                          date: dayFmt.format(new Date(rule.effectiveTo)),
                        })
                      : t('billing.effectiveLong')}
                  </p>
                </div>
              ))}
            </div>
          )}
          {/* 版本可追溯表述:结算历史里的 ruleId 永远可回查(后端软下线纪律) */}
          <p data-testid="billing-version-trace" className="text-xs text-muted-foreground">
            {t('billing.versionTrace')}
          </p>
        </CardContent>
      </Card>

      {/* ===== 我的用量区(近 30 天按日 / 按模型) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            {t('billing.usageTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('billing.usageDesc')}</p>
          {aiUsageQuery.error ? (
            <Alert variant="danger" title={t('billing.usageLoadFailed')} closable />
          ) : null}

          {/* 按日:积分(credits)消耗,UTC 分桶缺日补零 */}
          <div>
            <p className="mb-2 text-sm font-medium">{t('billing.dailyTitle')}</p>
            {dailyUsageQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('billingLoading')}
              </p>
            ) : last30Buckets.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('billing.usageEmpty')}
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('billing.dailyColDate')}</TableHead>
                      <TableHead>{t('billing.dailyColCount')}</TableHead>
                      <TableHead>{t('billing.dailyColPoints')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {last30Buckets.map((b) => (
                      <TableRow key={b.date} data-testid={`usage-daily-row-${b.date}`}>
                        <TableCell className="text-xs">{b.date}</TableCell>
                        <TableCell className="text-xs">{b.count}</TableCell>
                        <TableCell className="text-xs">{b.points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {last30Buckets.length > 0 ? (
              <p data-testid="billing-credits-total" className="mt-2 text-xs text-muted-foreground">
                {t('billing.dailyTotal', { points: last30Points })}
              </p>
            ) : null}
          </div>

          {/* 按模型:token 用量与花费(数据源 = ai-service /api/v1/ai/usage/stats) */}
          <div>
            <p className="mb-2 text-sm font-medium">{t('billing.modelTitle')}</p>
            {aiUsageQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('billingLoading')}
              </p>
            ) : modelEntries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('billing.usageEmpty')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('billing.modelColName')}</TableHead>
                      <TableHead>{t('billing.modelColTokens')}</TableHead>
                      <TableHead>{t('billing.modelColCalls')}</TableHead>
                      <TableHead>{t('billing.modelColCost')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelEntries.map(([model, m]) => (
                      <TableRow key={model} data-testid={`usage-model-row-${model}`}>
                        <TableCell className="max-w-[220px] truncate text-xs">{model}</TableCell>
                        <TableCell className="text-xs">{m.total_tokens}</TableCell>
                        <TableCell className="text-xs">{m.calls ?? '—'}</TableCell>
                        <TableCell className="text-xs">${m.cost.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 无数据时不渲染空壳卡片(卡内契约:dayCounts 缺省 → null;外层同步收起) */}
      {heatmapDayCounts ? (
        <Card>
          <CardContent>
            <CreditsHeatmapCard
              dayCounts={heatmapDayCounts}
              sessionCounts={heatmapSessionCounts}
              data-testid="settings-credits-heatmap"
            />
          </CardContent>
        </Card>
      ) : null}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'orders' | 'invoices')}>
        <TabsList>
          <TabsTrigger value="orders">{t('billingOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('billingInvoices')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                {t('billingOrders')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrdersTab
                t={t}
                list={ordersQuery.data?.list ?? []}
                isLoading={ordersQuery.isLoading}
                error={ordersQuery.error as Error | null}
                page={orderPage}
                total={ordersQuery.data?.total ?? 0}
                pageSize={PAGE_SIZE}
                currencyFmt={currencyFmt}
                dateFmt={dateFmt}
                onPageChange={setOrderPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                {t('billingInvoices')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoicesTab
                t={t}
                list={invoicesQuery.data?.list ?? []}
                isLoading={invoicesQuery.isLoading}
                error={invoicesQuery.error as Error | null}
                page={invoicePage}
                total={invoicesQuery.data?.total ?? 0}
                pageSize={PAGE_SIZE}
                currencyFmt={currencyFmt}
                dateFmt={dateFmt}
                onPageChange={setInvoicePage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
