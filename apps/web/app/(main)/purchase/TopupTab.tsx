// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 统一购买页 — 充值 Tab(2026-09-16 立)。
 *
 * 与既有 /wallet/recharge 保持同一资金链路(不新增支付通道、不改变记账):
 *   POST /api/payments/{wechat|alipay}/create?amount=N → 跳转支付结果页轮询。
 * 本 Tab 的价值在于把"快捷金额档位 + 金额校验 + 支付方式 + 到账说明"
 * 集中到购买中枢,用户不必在充值页/订阅页之间来回找。
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Wallet } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

/** 快捷金额档位(元) */
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000] as const
const MIN_YUAN = 1
const MAX_YUAN = 50000
const DEFAULT_YUAN = 100

interface PaymentCreateData {
  outTradeNo: string
  codeUrl?: string
  payUrl?: string
  mock?: boolean
}

export function TopupTab() {
  const t = useTranslations('purchase')
  const router = useRouter()
  const toast = useToast()
  const [amount, setAmount] = React.useState<number>(DEFAULT_YUAN)
  const [amountText, setAmountText] = React.useState<string>(String(DEFAULT_YUAN))
  const [method, setMethod] = React.useState<'wechat' | 'alipay'>('wechat')
  const [submitting, setSubmitting] = React.useState(false)

  const pickQuick = (v: number) => {
    setAmount(v)
    setAmountText(String(v))
  }

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许整数元,避免小数触发后端 int 校验失败
    const raw = e.target.value.replace(/[^\d]/g, '')
    setAmountText(raw)
    setAmount(raw ? Number.parseInt(raw, 10) : 0)
  }

  const invalid = !Number.isFinite(amount) || amount < MIN_YUAN || amount > MAX_YUAN

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid) {
      toast.error(t('amountRange', { min: MIN_YUAN, max: MAX_YUAN }))
      return
    }
    setSubmitting(true)
    try {
      // 2026-09-18 修复(与 /wallet/recharge 同源):微信金额单位为分、带 orderType=2 才入账、
      // 微信走 native 扫码下单;支付凭据透传到结果页展示,不再"下单即成功"。
      const r =
        method === 'wechat'
          ? await fetchApi<PaymentCreateData>(
              `/api/payments/wechat/native?amount=${amount * 100}&orderType=2&description=${encodeURIComponent('余额充值')}`,
              { method: 'POST' },
            )
          : await fetchApi<PaymentCreateData>(
              `/api/payments/alipay/create?amount=${amount}&orderType=2&subject=${encodeURIComponent('余额充值')}`,
              { method: 'POST' },
            )
      if (!r.success) {
        toast.error(r.error)
        return
      }
      if (r.data.mock || (!r.data.codeUrl && !r.data.payUrl)) {
        toast.error('支付通道暂未开通（商户配置缺失），请联系管理员。')
        return
      }
      const params = new URLSearchParams({
        orderNo: r.data.outTradeNo,
        amount: String(amount),
        method,
      })
      if (r.data.codeUrl) params.set('codeUrl', r.data.codeUrl)
      if (r.data.payUrl) params.set('payUrl', r.data.payUrl)
      router.push(`/wallet/recharge/success?${params.toString()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="purchase-amount">{t('amount')}</Label>
            <Input
              id="purchase-amount"
              inputMode="numeric"
              value={amountText}
              onChange={onAmountChange}
              placeholder={String(DEFAULT_YUAN)}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="xs"
                  variant={amount === v ? 'default' : 'outline'}
                  onClick={() => pickQuick(v)}
                >
                  <span>¥{v}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-method">{t('payMethod')}</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v === 'alipay' ? 'alipay' : 'wechat')}
            >
              <SelectTrigger id="purchase-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wechat">{t('wechat')}</SelectItem>
                <SelectItem value="alipay">{t('alipay')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(
              'flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 p-3',
              'text-xs text-muted-foreground',
            )}
          >
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p>{t('topupNote')}</p>
              <p>
                {t('redeemHint')}{' '}
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => router.push('/models/redeem')}
                >
                  <span>{t('goRedeem')}</span>
                </Button>
              </p>
            </div>
          </div>

          <Button type="submit" size="default" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>{t('creating')}</span>
              </>
            ) : (
              <span>{t('payNow')}</span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
