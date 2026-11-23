// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 对账汇总卡(2026-11-23 拆出):账面银行余额 / 已匹配净额 / 差额 / 未匹配笔数。
 *
 * 拆出来是因为 docs-tab 主文件顶到了单文件行数闸;这张卡只依赖 ledgerId + period,
 * 单独一文件后可复用(报表页/看板也能直接挂)。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { api, FIN_RESOURCE } from './types'
import { Card, Empty } from './tabs'

interface ReconSummary {
  period: string
  statementCount: number
  inTotal: string
  outTotal: string
  netTotal: string
  matchedCount: number
  unmatchedCount: number
  ignoredCount: number
  unmatchedNet: string
  bookBankBalance: string
  matchedNet: string
  gap: string
}

const money2 = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 银行对账口径汇总(差额为 0 绿,否则黄) */
export function ReconCard({ ledgerId, period }: { ledgerId: string; period: string }) {
  const t = useTranslations('finAccounting')
  const reconQ = useQuery({
    queryKey: ['fin', 'reconcile', ledgerId, period],
    queryFn: () =>
      api<ReconSummary>(`${FIN_RESOURCE}/ledgers/${ledgerId}/reconcile?period=${period}`),
    enabled: !!ledgerId && !!period,
  })
  const recon = reconQ.data
  const zeroGap = recon ? Number(recon.gap) === 0 : false

  return (
    <Card title={t('reconcileTitle')}>
      {!recon ? (
        <Empty text={t('loading')} />
      ) : (
        <div className="flex flex-wrap gap-4 text-xs tabular-nums">
          <span>
            {t('bookBankBalance')}: <b>{money2(Number(recon.bookBankBalance))}</b>
          </span>
          <span>
            {t('matchedNet')}: <b>{money2(Number(recon.matchedNet))}</b>
          </span>
          <span className={zeroGap ? 'text-success' : 'text-warning'}>
            {t('gap')}: <b>{money2(Number(recon.gap))}</b>
          </span>
          <span className="text-muted-foreground">
            {t('unmatchedCount')}: {recon.unmatchedCount}
          </span>
          <span className="text-muted-foreground">
            {t('matched')}: {recon.matchedCount} · {t('ignored')}: {recon.ignoredCount}
          </span>
        </div>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
