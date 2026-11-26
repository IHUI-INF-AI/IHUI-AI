// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  FileCheck2,
  BarChart3,
  ReceiptText,
  Layers,
  Landmark,
  Percent,
  ListChecks,
} from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { FeaturePageShell } from '@/components/layout'
import { api, rowsOf, FIN_RESOURCE, FIN_VIEW_PERM, type FinClient, type FinLedger } from './types'
import { ClientsTab, VouchersTab, ReportsTab, TaxTab } from './tabs'
import { LedgerTab } from './ledger-tab'
import { DocsTab } from './docs-tab'
import { TaxProfileTab } from './tax-profile-tab'
import { FilingBoard } from './filing-board'
import { FilingReturnReview } from './filing-review'
import { VoucherOpsTab } from './voucher-ops'
import { ClientOps } from './client-ops'
import { PeriodStatusCard } from './period-status'
import { StatementBulkCard } from './statement-bulk'
import { LedgerOpsCard } from './ledger-ops'
import { GapTab } from './gap-tab'

/**
 * 财务账套(2026-11-23 立):客户 → 账套 → 凭证/复核 → 报表/结账 → 税务申报。
 *
 * 之前的状况:后端 60+ 端点已齐,但 web 端一个入口都没有 —— 客户上线、凭证复核、
 * 月度结账、申报日历全靠手工调 API。本页把"会计每月真正要做的一条线"按顺序排开。
 */

type TabKey = 'clients' | 'ledger' | 'vouchers' | 'docs' | 'reports' | 'taxprofile' | 'tax' | 'gap'

export default function FinAccountingPage() {
  const t = useTranslations('finAccounting')
  const [tab, setTab] = React.useState<TabKey>('clients')

  const clientsQ = useQuery({
    queryKey: ['fin', 'clients'],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/clients?limit=50`),
  })
  const ledgersQ = useQuery({
    queryKey: ['fin', 'ledgers'],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers?limit=50`),
  })
  const clients = rowsOf<FinClient>(clientsQ.data)
  const ledgers = rowsOf<FinLedger>(ledgersQ.data)

  const tabs: Array<{
    key: TabKey
    label: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { key: 'clients', label: t('tabClients'), icon: BookOpen },
    { key: 'ledger', label: t('tabLedger'), icon: Layers },
    { key: 'vouchers', label: t('tabVouchers'), icon: FileCheck2 },
    { key: 'docs', label: t('tabDocs'), icon: Landmark },
    { key: 'reports', label: t('tabReports'), icon: BarChart3 },
    { key: 'taxprofile', label: t('tabTaxProfiles'), icon: Percent },
    { key: 'tax', label: t('tabTax'), icon: ReceiptText },
    { key: 'gap', label: '账簿/年结', icon: ListChecks },
  ]

  return (
    <FeaturePageShell title={t('title')} description={t('desc')}>
      <HasPermi
        code={FIN_VIEW_PERM}
        fallback={<p className="font-[weight:inherit] text-body text-muted-foreground">{t('noPerm')}</p>}
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label ${
                tab === key ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60'
              }`}
              onClick={() => setTab(key)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'clients' && (
          <div className="space-y-3">
            <ClientsTab />
            <ClientOps clients={clients} ledgers={ledgers} />
          </div>
        )}
        {tab === 'ledger' && (
          <div className="space-y-3">
            <LedgerTab ledgers={ledgers} />
            <LedgerOpsCard ledgers={ledgers} />
            <PeriodStatusCard ledgers={ledgers} />
          </div>
        )}
        {tab === 'vouchers' && (
          <div className="space-y-3">
            <VouchersTab ledgers={ledgers} />
            <VoucherOpsTab ledgers={ledgers} />
          </div>
        )}
        {tab === 'docs' && (
          <div className="space-y-3">
            <DocsTab ledgers={ledgers} />
            <StatementBulkCard ledgers={ledgers} />
          </div>
        )}
        {tab === 'reports' && <ReportsTab ledgers={ledgers} />}
        {tab === 'taxprofile' && (
          <div className="space-y-3">
            <TaxProfileTab clients={clients} ledgers={ledgers} />
            <FilingBoard clients={clients} />
          </div>
        )}
        {tab === 'tax' && (
          <div className="space-y-3">
            <TaxTab clients={clients} />
            <FilingReturnReview clients={clients} />
          </div>
        )}
        {tab === 'gap' && <GapTab ledgers={ledgers} />}
      </HasPermi>
    </FeaturePageShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
