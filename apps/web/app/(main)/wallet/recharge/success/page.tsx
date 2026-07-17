'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'

function SuccessContent() {
  const t = useTranslations('wallet')
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('orderNo') ?? ''
  const amount = searchParams.get('amount')

  return (
    <div className="mx-auto w-full max-w-md py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
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

export default function RechargeSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
