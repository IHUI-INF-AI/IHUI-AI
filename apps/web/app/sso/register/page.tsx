'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'

import { useLoginDialogStore } from '@/stores/login-dialog'

export default function SsoRegisterPage() {
  const t = useTranslations('sso')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'
  const openDialog = useLoginDialogStore((s) => s.open)

  useEffect(() => {
    openDialog(
      'register',
      `/sso/login?redirect=${encodeURIComponent(redirectUrl)}&client_id=${clientId}`,
    )
  }, [openDialog, redirectUrl, clientId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm text-center">
        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">{t('registerTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { clientId })}</p>
        </div>

        <p className="text-sm text-muted-foreground">{t('dialogPrompt')}</p>

        <button
          type="button"
          onClick={() => {
            openDialog(
              'register',
              `/sso/login?redirect=${encodeURIComponent(redirectUrl)}&client_id=${clientId}`,
            )
            void router.replace('/')
          }}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('openDialog')}
        </button>

        <div className="text-xs text-muted-foreground/70">
          redirect: <code className="font-mono">{redirectUrl}</code>
        </div>
      </div>
    </div>
  )
}
