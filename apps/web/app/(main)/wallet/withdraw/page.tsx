// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi, apiOrThrow } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { WithdrawScreen as SharedWithdrawScreen } from '@ihui/rn-app/features/withdraw/WithdrawScreen'
import type { TFunction } from '@ihui/types'

interface AvailableData {
  available: number
}

/**
 * 钱包提现页(第 3 批薄壳化):版面/方式选择/账户输入/记录入口全部由共享屏
 * `@ihui/rn-app/features/withdraw/WithdrawScreen`(react-native-web)输出,web 侧只保留
 *   ① 鉴权门 + 可提现余额查询;② 校验与提交(金额折分);③ next-intl 词表注入。
 */
export default function WithdrawPage() {
  const t = useTranslations('wallet')
  const td = useTranslations('distribution')
  const router = useRouter()
  const { allow } = useAuthGate()
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState('wechat')
  const [accountInfo, setAccountInfo] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  // 2026-09-30 登录态门
  const availableQ = useQuery({
    queryKey: ['wallet', 'withdrawal', 'available'],
    queryFn: () => apiOrThrow<AvailableData>('/api/finance/withdrawal/available'),
    enabled: allow,
  })
  // 后端 available 单位是「分」,共享屏按「元」渲染 ⇒ 折元后再传。
  const availableYuan = availableQ.data ? Math.floor(availableQ.data.available) / 100 : 0

  const methods = [
    { id: 'wechat', label: t('methodWechat') },
    { id: 'alipay', label: t('methodAlipay') },
    { id: 'bank', label: t('methodBank') },
  ]

  const texts = {
    back: t('backToWallet'),
    title: t('withdrawTitle'),
    availableBalance: t('availableAmount'),
    amountLabel: t('withdrawAmount'),
    amountPlaceholder: td('withdrawAmountPlaceholder'),
    methodLabel: t('withdrawMethod'),
    accountLabel: t('withdrawAccount'),
    accountPlaceholder: t('withdrawAccount'),
    records: t('withdrawRecords'),
    submit: t('withdrawBtn'),
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 0.01) {
      setError(t('errAmountMin'))
      return
    }
    if (availableQ.data && amt > availableYuan) {
      setError(t('errAmountMax'))
      return
    }
    if (!accountInfo.trim()) {
      setError(t('errAccountRequired'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const r = await fetchApi('/api/finance/withdrawal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 表单是「元」，后端 applyWithdrawal 全程按「分」运算（手续费 floor(amount*0.02)、
          // 余额冻结 token_quantity 都是分）⇒ 提交前必须折成分，否则提现 100 元只冻结 100 分。
          amount: Math.round(amt * 100),
          method,
          accountInfo,
        }),
      })
      if (r.success) {
        toast.success(t('withdrawSuccess'))
        router.push('/wallet/withdraw/records')
      } else {
        setError(r.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rechargeFailDesc'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-md space-y-4">
      <Link
        href="/wallet"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToWallet')}
      </Link>

      <h1 className="text-display font-bold tracking-tight">{t('withdrawTitle')}</h1>

      {/* 2026-09-30 登录态门 */}
      {!allow ? (
        <AuthGatePrompt message="请先登录后申请提现" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <SharedWithdrawScreen
            t={t as unknown as TFunction}
            amount={amount}
            loading={availableQ.isLoading}
            error={error}
            success=""
            onAmountChange={setAmount}
            onSubmit={onSubmit}
            onBack={() => router.push('/wallet')}
            colorScheme="light"
            balance={availableYuan}
            methods={methods}
            method={method}
            onMethodChange={setMethod}
            accountInfo={accountInfo}
            onAccountInfoChange={setAccountInfo}
            onFillAll={() => setAmount(availableYuan > 0 ? availableYuan.toFixed(2) : '')}
            recordsLabel={t('withdrawRecords')}
            onRecords={() => router.push('/wallet/withdraw/records')}
            texts={texts}
            submitting={submitting}
          />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
