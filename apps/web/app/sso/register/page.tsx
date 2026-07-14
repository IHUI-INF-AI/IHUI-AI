'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'
import { RegisterFormContent } from '@/components/login/RegisterFormContent'

export default function SsoRegisterPage() {
  const t = useTranslations('sso')
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">{t('registerTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { clientId })}</p>
        </div>

        <RegisterFormContent variant="page" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('alreadyHaveAccount')}</span>
          <Link
            href={`/sso/login?redirect=${encodeURIComponent(redirectUrl)}&client_id=${clientId}`}
            className="font-medium text-primary hover:underline"
          >
            {t('toLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
