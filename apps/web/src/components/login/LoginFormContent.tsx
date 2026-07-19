'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { ThirdPartyLoginButtons } from './ThirdPartyLoginButtons'
import { QrCodeLogin } from './QrCodeLogin'
import { PasswordLoginForm } from './PasswordLoginForm'
import { EmailCodeLoginForm } from './EmailCodeLoginForm'
import { UsernameLoginForm } from './UsernameLoginForm'
import { SdkQrLogin } from './SdkQrLogin'
import { useLoginDialogStore } from '@/stores/login-dialog'

type LoginTab = 'password' | 'email' | 'username' | 'qr'

interface LoginFormContentProps {
  onSuccess?: () => void
}

export function LoginFormContent({ onSuccess }: LoginFormContentProps) {
  const t = useTranslations('auth')
  const qc = useQueryClient()
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [tab, setTab] = React.useState<LoginTab>('password')
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
          <TabsTrigger value="password">{t('passwordLogin')}</TabsTrigger>
          <TabsTrigger value="email">{t('emailLogin')}</TabsTrigger>
          <TabsTrigger value="username">{t('usernameLogin')}</TabsTrigger>
          <TabsTrigger value="qr">{t('qrLogin')}</TabsTrigger>
        </TabsList>

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

        <TabsContent value="username">
          <UsernameLoginForm
            active={tab === 'username'}
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
          <QrCodeLogin onSwitchMethod={() => setTab('password')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />
      <SdkQrLogin />

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
