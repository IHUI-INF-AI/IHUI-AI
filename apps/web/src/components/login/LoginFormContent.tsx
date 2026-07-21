'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { ThirdPartyLoginButtons } from './ThirdPartyLoginButtons'
import { QrCodeLogin } from './QrCodeLogin'
import { PasswordLoginForm } from './PasswordLoginForm'
import { EmailCodeLoginForm } from './EmailCodeLoginForm'
import { PhoneCodeLoginForm } from './PhoneCodeLoginForm'
import { useLoginDialogStore } from '@/stores/login-dialog'

type LoginTab = 'email' | 'phone' | 'password' | 'qr'

interface LoginFormContentProps {
  onSuccess?: () => void
}

export function LoginFormContent({ onSuccess }: LoginFormContentProps) {
  const t = useTranslations('auth')
  const qc = useQueryClient()
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [tab, setTab] = React.useState<LoginTab>('email')
  const [agreed, setAgreed] = React.useState(false)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)

  const handleSuccess = () => {
    onSuccess?.()
    qc.invalidateQueries({ queryKey: ['header'] })
    qc.invalidateQueries({ queryKey: ['announcements'] })
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as LoginTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email" data-testid="login-tab-email">
            {t('emailLogin')}
          </TabsTrigger>
          <TabsTrigger value="phone" data-testid="login-tab-phone">
            {t('phoneCodeLogin')}
          </TabsTrigger>
          <TabsTrigger value="password" data-testid="login-tab-password">
            {t('passwordLogin')}
          </TabsTrigger>
          <TabsTrigger value="qr" data-testid="login-tab-qr">
            {t('qrLogin')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <EmailCodeLoginForm
            active={tab === 'email'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={() => setShowAgreeErr(true)}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="phone">
          <PhoneCodeLoginForm
            active={tab === 'phone'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={() => setShowAgreeErr(true)}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="password">
          <PasswordLoginForm
            active={tab === 'password'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={() => setShowAgreeErr(true)}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="qr">
          <QrCodeLogin onSwitchMethod={() => setTab('email')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={() => setMode('register')}
          className="font-medium text-primary hover:underline"
        >
          {t('registerNow')}
        </button>
      </p>
    </div>
  )
}
