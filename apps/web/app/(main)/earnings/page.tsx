'use client'

/**
 * 挣钱中心 — 小白用户一眼看到钱从哪来
 *
 * 4 概览卡片 + BYOK 抽成趋势 + 引流统计 + 转化漏斗 + 配置 BYOK CTA
 * emerald 色系(挣钱主题),数据来自 useEarnings hook(API 未就绪 fallback mock)
 */
import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Coins, KeyRound, Loader2, ArrowRight, Sparkles } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { Alert } from '@/components/feedback'
import { useEarnings } from '@/hooks/use-earnings'
import { EarningsOverview } from '@/components/earnings/EarningsOverview'
import { ByokIncomeChart } from '@/components/earnings/ByokIncomeChart'
import { ReferralStats } from '@/components/earnings/ReferralStats'
import { ConversionFunnel } from '@/components/earnings/ConversionFunnel'
import { BackButton } from '@/components/common'

export default function EarningsPage() {
  const t = useTranslations('earnings')
  const { overview, byokTrend, referral, funnel, loading } = useEarnings()

  return (
    <Container maxWidth="xl" padding={false} className="space-y-4 py-6">
      <BackButton />
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coins className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            {t('title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>

      {/* 概览卡片 */}
      <EarningsOverview data={overview} loading={loading} />

      {/* BYOK 抽成趋势 + 引流统计(两栏) */}
      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <ByokIncomeChart data={byokTrend} loading={loading} />
        <ReferralStats data={referral} loading={loading} />
      </div>

      {/* 转化漏斗 */}
      <ConversionFunnel data={funnel} loading={loading} />

      {/* 配置 BYOK CTA */}
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 min-[640px]:flex-row min-[640px]:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('configureByok')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('configureByokDesc')}</p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
            <Link href="/settings/llm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              {t('configureByok')}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* mock 数据提示(数据未就绪时) */}
      {overview === null && !loading && (
        <Alert variant="info" title={t('mockDataNote')} description={t('mockDataNoteDesc')} />
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      )}
    </Container>
  )
}
