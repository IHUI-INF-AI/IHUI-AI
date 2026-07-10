'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { XCircle, Loader2 } from 'lucide-react'

import { Button } from '@ihui/ui'

function FailContent() {
  const t = useTranslations('wallet')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('orderNo') ?? ''

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-16 text-center">
      <XCircle className="h-16 w-16 text-red-500" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('rechargeFail')}</h1>
        <p className="text-sm text-muted-foreground">{t('rechargeFailDesc')}</p>
        {orderNo && <p className="font-mono text-xs text-muted-foreground">{orderNo}</p>}
      </div>
      <div className="flex gap-2">
        <Link href="/wallet">
          <Button variant="outline">{t('backToWallet')}</Button>
        </Link>
        <Button onClick={() => router.push('/wallet/recharge')}>{tCommon('retry')}</Button>
      </div>
    </div>
  )
}

export default function RechargeFailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading...
        </div>
      }
    >
      <FailContent />
    </Suspense>
  )
}
