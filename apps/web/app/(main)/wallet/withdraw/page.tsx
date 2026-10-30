// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi, apiOrThrow } from '@/lib/api'
import { formatPrice } from '@ihui/shared/utils/format'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'

interface AvailableData {
  available: number
}

// message 一律写 i18n 键名(不带命名空间前缀),由渲染处 t() 解析。
// 原先把 'wallet.withdrawAmount' 这类键串塞进 min(),页面又直接渲染字段名 ⇒ 红字永远只写
// "提现金额",用户看不出错在哪。上限用可提现余额兜住,余额未到(还在加载)时不拦。
const makeWithdrawSchema = (max?: number) =>
  z.object({
    amount: z.coerce
      .number()
      .min(0.01, 'errAmountMin')
      .refine((n) => max === undefined || !(n > max), 'errAmountMax'),
    method: z.enum(['wechat', 'alipay', 'bank']),
    accountInfo: z.string().min(1, 'errAccountRequired'),
  })

type WithdrawValues = z.infer<ReturnType<typeof makeWithdrawSchema>>

export default function WithdrawPage() {
  const t = useTranslations('wallet')
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  // 2026-09-30 登录态门
  const { allow } = useAuthGate()
  const availableQ = useQuery({
    queryKey: ['wallet', 'withdrawal', 'available'],
    queryFn: () => apiOrThrow<AvailableData>('/api/finance/withdrawal/available'),
    enabled: allow,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawValues>({
    resolver: zodResolver(
      // 可提现余额（available）单位是「分」，表单金额按「元」填 ⇒ 上限也要折成元，
      // 否则用户填 100 元会被"100 分"的上限拦下（余额够却提不出来）。
      makeWithdrawSchema(availableQ.data ? Math.floor(availableQ.data.available) / 100 : undefined),
    ) as unknown as Resolver<WithdrawValues>,
    defaultValues: { amount: 0, method: 'wechat', accountInfo: '' },
  })

  const method = watch('method')

  const onSubmit = async (values: WithdrawValues) => {
    setServerError(null)
    setSubmitting(true)
    try {
      const r = await fetchApi('/api/finance/withdrawal/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 表单是「元」，后端 applyWithdrawal 全程按「分」运算（手续费 floor(amount*0.02)、
          // 余额冻结 token_quantity 都是分）⇒ 提交前必须折成分，否则提现 100 元只冻结 100 分。
          amount: Math.round(values.amount * 100),
          method: values.method,
          accountInfo: values.accountInfo,
        }),
      })
      if (r.success) {
        toast.success(t('withdrawSuccess'))
        router.push('/wallet/withdraw/records')
      } else {
        setServerError(r.error)
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('rechargeFailDesc'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-md space-y-4">
      <Link
        href="/wallet"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToWallet')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{t('withdrawTitle')}</h1>

      {/* 2026-09-30 登录态门 */}
      {!allow ? (
        <AuthGatePrompt message="请先登录后申请提现" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('withdrawTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">{t('availableAmount')}</div>
              {availableQ.isLoading ? (
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
              ) : availableQ.error ? (
                <div className="mt-1 text-sm text-destructive">
                  {(availableQ.error as Error).message}
                </div>
              ) : (
                <div className="mt-1 text-2xl font-bold">
                  ¥{formatPrice(availableQ.data?.available ?? 0)}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">{t('withdrawAmount')}</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder={t('withdrawAmount')}
                  {...register('amount')}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {t((errors.amount.message ?? 'errAmountMin') as Parameters<typeof t>[0])}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('withdrawMethod')}</Label>
                <Select
                  value={method}
                  onValueChange={(v) => setValue('method', v as 'wechat' | 'alipay' | 'bank')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wechat">{t('methodWechat')}</SelectItem>
                    <SelectItem value="alipay">{t('methodAlipay')}</SelectItem>
                    <SelectItem value="bank">{t('methodBank')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountInfo">{t('withdrawAccount')}</Label>
                <Input
                  id="accountInfo"
                  placeholder={t('withdrawAccount')}
                  {...register('accountInfo')}
                />
                {errors.accountInfo && (
                  <p className="text-xs text-destructive">
                    {t(
                      (errors.accountInfo.message ?? 'errAccountRequired') as Parameters<
                        typeof t
                      >[0],
                    )}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('withdrawBtn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
