'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { ThirdPartyLoginButtons } from './ThirdPartyLoginButtons'
import { QrCodeLogin } from './QrCodeLogin'
import { PasswordLoginForm } from '../../../app/(auth)/login/PasswordLoginForm'
import { EmailCodeLoginForm } from '../../../app/(auth)/login/EmailCodeLoginForm'
import { UsernameLoginForm } from '../../../app/(auth)/login/UsernameLoginForm'
import { SdkQrLogin } from '../../../app/(auth)/login/SdkQrLogin'
import { useLoginDialogStore } from '@/stores/login-dialog'

type LoginTab = 'password' | 'email' | 'username' | 'qr'

interface LoginFormContentProps {
  variant: 'page' | 'dialog'
  onSuccess?: () => void
}

export function LoginFormContent({ variant, onSuccess }: LoginFormContentProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const qc = useQueryClient()
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [tab, setTab] = React.useState<LoginTab>('password')

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess()
      qc.invalidateQueries({ queryKey: ['header'] })
      qc.invalidateQueries({ queryKey: ['announcements'] })
    } else {
      router.push('/')
    }
  }
  const wrapperCls = variant === 'page' ? 'space-y-4 p-6' : 'space-y-5'

  const registerLink =
    variant === 'page' ? (
      <Link href="/register" className="font-medium text-primary hover:underline">
        {t('registerNow')}
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => setMode('register')}
        className="font-medium text-primary hover:underline"
      >
        {t('registerNow')}
      </button>
    )

  return (
    <div className={wrapperCls}>
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{t('loginTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as LoginTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="password">{t('passwordLogin')}</TabsTrigger>
          <TabsTrigger value="email">{t('emailLogin')}</TabsTrigger>
          <TabsTrigger value="username">{t('usernameLogin')}</TabsTrigger>
          <TabsTrigger value="qr">{t('qrLogin')}</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <PasswordLoginForm active={tab === 'password'} onSuccess={handleSuccess} />
        </TabsContent>

        <TabsContent value="email">
          <EmailCodeLoginForm active={tab === 'email'} onSuccess={handleSuccess} />
        </TabsContent>

        <TabsContent value="username">
          <UsernameLoginForm active={tab === 'username'} onSuccess={handleSuccess} />
        </TabsContent>

        <TabsContent value="qr">
          <QrCodeLogin onSwitchMethod={() => setTab('password')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />
      <SdkQrLogin />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')} {registerLink}
      </p>
    </div>
  )
}
