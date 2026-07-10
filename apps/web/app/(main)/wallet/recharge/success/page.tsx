'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@ihui/ui'

function SuccessContent() {
  const t = useTranslations('wallet')
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('orderNo') ?? ''

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-16 text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('rechargeSuccess')}</h1>
        <p className="text-sm text-muted-foreground">{t('rechargeSuccessDesc')}</p>
        {orderNo && <p className="font-mono text-xs text-muted-foreground">{orderNo}</p>}
      </div>
      <Link href="/wallet">
        <Button>{t('backToWallet')}</Button>
      </Link>
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
