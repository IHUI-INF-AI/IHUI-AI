// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { saveRechargeQr } from '@/lib/recharge-qr-session'
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

const rechargeSchema = z.object({
  amount: z.coerce.number().int().min(1, 'wallet.rechargeAmount'),
  method: z.enum(['wechat', 'alipay']),
})

type RechargeValues = z.infer<typeof rechargeSchema>

interface PaymentCreateData {
  outTradeNo: string
  amount?: number
  codeUrl?: string
  payUrl?: string
  mock?: boolean
}

export default function RechargePage() {
  const t = useTranslations('wallet')
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RechargeValues>({
    resolver: zodResolver(rechargeSchema) as unknown as Resolver<RechargeValues>,
    defaultValues: { amount: 0, method: 'wechat' },
  })

  const method = watch('method')

  const onSubmit = async (values: RechargeValues) => {
    setServerError(null)
    setSubmitting(true)
    try {
      // 2026-09-18 修复:
      // 1) 微信端点金额单位是"分",此前直接传元导致充 100 元实际只下 1 元订单;
      // 2) 必须带 orderType=2(token 充值订单),否则支付成功后回调不充值入账;
      // 3) 微信改用 native 下单返回 code_url(PC 扫码),原 jsapi 需微信内 openId,PC 网页根本付不了。
      const r =
        values.method === 'wechat'
          ? await fetchApi<PaymentCreateData>(
              `/api/payments/wechat/native?amount=${values.amount * 100}&orderType=2&description=${encodeURIComponent('余额充值')}`,
              { method: 'POST' },
            )
          : await fetchApi<PaymentCreateData>(
              `/api/payments/alipay/create?amount=${values.amount}&orderType=2&subject=${encodeURIComponent('余额充值')}`,
              { method: 'POST' },
            )
      if (!r.success) {
        setServerError(r.error)
        return
      }
      if (r.data.mock || (!r.data.codeUrl && !r.data.payUrl)) {
        setServerError('支付通道暂未开通（商户配置缺失），订单未创建。请联系管理员配置支付商户。')
        return
      }
      // W-07:二维码凭据写入本标签页 sessionStorage(按 orderNo 键),URL 只允许携带 orderNo;
      // 金额/支付方式由成功页向服务端订单详情核对,不再信任 URL 参数。
      saveRechargeQr(r.data.outTradeNo, { codeUrl: r.data.codeUrl, payUrl: r.data.payUrl })
      router.push(`/wallet/recharge/success?orderNo=${encodeURIComponent(r.data.outTradeNo)}`)
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
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToWallet')}
      </Link>

      <h1 className="text-display font-bold tracking-tight">{t('rechargeTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rechargeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-body text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">{t('rechargeAmount')}</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step={1}
                placeholder={t('rechargeAmount')}
                {...register('amount')}
              />
              {errors.amount && (
                <p className="text-label text-destructive">{t('rechargeAmount')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('rechargeMethod')}</Label>
              <Select
                value={method}
                onValueChange={(v) => setValue('method', v as 'wechat' | 'alipay')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wechat">{t('methodWechat')}</SelectItem>
                  <SelectItem value="alipay">{t('methodAlipay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('rechargeBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
