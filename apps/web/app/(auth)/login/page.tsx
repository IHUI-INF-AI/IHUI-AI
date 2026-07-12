'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { ThirdPartyLoginButtons, QrCodeLogin } from '@/components/login'
import { PasswordLoginForm } from './PasswordLoginForm'
import { EmailCodeLoginForm } from './EmailCodeLoginForm'
import { UsernameLoginForm } from './UsernameLoginForm'
import { SdkQrLogin } from './SdkQrLogin'

type LoginTab = 'password' | 'email' | 'username' | 'qr'

export default function LoginPage() {
  const t = useTranslations('auth')
  const [tab, setTab] = React.useState<LoginTab>('password')

  return (
    <div className="space-y-4 p-6">
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
          <PasswordLoginForm active={tab === 'password'} />
        </TabsContent>

        <TabsContent value="email">
          <EmailCodeLoginForm active={tab === 'email'} />
        </TabsContent>

        <TabsContent value="username">
          <UsernameLoginForm active={tab === 'username'} />
        </TabsContent>

        <TabsContent value="qr">
          <QrCodeLogin onSwitchMethod={() => setTab('password')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />
      <SdkQrLogin />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t('registerNow')}
        </Link>
      </p>
    </div>
  )
}
