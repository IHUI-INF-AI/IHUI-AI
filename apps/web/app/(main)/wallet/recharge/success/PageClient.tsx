// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { QRCodeCanvas } from 'qrcode.react'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'

interface OrderDetail {
  order: { orderNo?: string; status?: string }
}

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 200 // 3s * 200 = 10 分钟,超时后仍可手动刷新

function SuccessContent() {
  const t = useTranslations('wallet')
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('orderNo') ?? ''
  const amount = searchParams.get('amount')
  const method = searchParams.get('method') ?? 'wechat'
  const codeUrl = searchParams.get('codeUrl') ?? ''
  const payUrl = searchParams.get('payUrl') ?? ''

  const [status, setStatus] = React.useState<'pending' | 'paid' | 'timeout'>('pending')

  React.useEffect(() => {
    if (!orderNo) return
    let stop = false
    let count = 0
    const poll = async () => {
      while (!stop && count < MAX_POLLS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        if (stop) break
        count++
        try {
          const r = await fetchApi<OrderDetail>(`/api/orders/${encodeURIComponent(orderNo)}`)
          const s = r.success ? r.data.order.status : undefined
          if (s === 'paid') {
            setStatus('paid')
            return
          }
          if (s === 'cancelled' || s === 'closed' || s === 'refunded') {
            setStatus('timeout')
            return
          }
        } catch {
          // 网络抖动忽略,下一轮继续
        }
      }
      if (!stop) setStatus('timeout')
    }
    poll()
    return () => {
      stop = true
    }
  }, [orderNo])

  const isAlipay = method === 'alipay' && !!payUrl

  if (status === 'paid') {
    return (
      <div className="px-4 py-4 mx-auto w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-6 px-4 py-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('rechargeSuccess')}</h1>
              <p className="text-sm text-muted-foreground">{t('rechargeSuccessDesc')}</p>
            </div>
            {(orderNo || amount) && (
              <div className="w-full space-y-1 rounded-md bg-muted/40 px-4 py-3 text-sm">
                {orderNo && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('rechargeOrderNo')}</span>
                    <span className="font-mono text-xs">{orderNo}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('rechargeAmount')}</span>
                    <span className="font-medium">{amount}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex w-full gap-2">
              <Link href="/wallet" className="flex-1">
                <Button variant="outline" className="w-full">
                  {t('backToWallet')}
                </Button>
              </Link>
              <Link href="/wallet" className="flex-1">
                <Button className="w-full">{t('viewRecords')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!orderNo || (!codeUrl && !payUrl)) {
    // 无支付凭据(如直接访问本页):退化为只读状态页,轮询订单
    return (
      <div className="px-4 py-4 mx-auto w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-6 px-4 py-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight">等待支付确认</h1>
              <p className="text-sm text-muted-foreground">
                {status === 'timeout'
                  ? '长时间未检测到支付,如已完成支付请刷新本页或联系客服'
                  : '订单已创建,正在等待支付结果…'}
              </p>
              {orderNo && <p className="font-mono text-xs text-muted-foreground">{orderNo}</p>}
            </div>
            <Link href="/wallet" className="w-full">
              <Button variant="outline" className="w-full">
                {t('backToWallet')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 px-4 py-6 text-center">
          <h1 className="text-xl font-bold tracking-tight">
            {isAlipay ? '支付宝扫码支付' : '微信扫码支付'}
          </h1>
          {amount && (
            <p className="text-sm text-muted-foreground">
              金额：<span className="font-bold text-foreground">¥{amount}</span>
            </p>
          )}
          <div className="flex justify-center rounded-lg border border-border bg-white p-3">
            <QRCodeCanvas value={isAlipay ? payUrl : codeUrl} size={240} level="M" />
          </div>
          <p className="text-xs text-muted-foreground">
            {isAlipay
              ? '请用支付宝扫描二维码完成支付'
              : '请用微信扫描二维码完成支付，支付完成后本页自动更新'}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {status === 'timeout'
              ? '长时间未检测到支付,如已完成支付请刷新本页'
              : '等待支付确认中…'}
          </p>
          {orderNo && <p className="font-mono text-xs text-muted-foreground">订单号：{orderNo}</p>}
          <Link href="/wallet" className="w-full">
            <Button variant="outline" className="w-full">
              {t('backToWallet')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RechargeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
