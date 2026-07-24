'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { PhoneRegisterForm } from './PhoneRegisterForm'
import { EmailRegisterForm } from './EmailRegisterForm'
import { useLoginDialogStore } from '@/stores/login-dialog'

type RegisterTab = 'phone' | 'email'

interface RegisterFormContentProps {
  onSuccess?: () => void
}

/**
 * 注册表单壳层:Tabs 切换"手机注册"和"邮箱注册"。
 * 共享 agreed / showAgreeErr 状态(切换 tab 时保留用户已勾选状态)。
 */
export function RegisterFormContent({ onSuccess }: RegisterFormContentProps) {
  const t = useTranslations('auth')
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [tab, setTab] = React.useState<RegisterTab>('phone')
  const [agreed, setAgreed] = React.useState(false)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as RegisterTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phone">{t('phoneRegister')}</TabsTrigger>
          <TabsTrigger value="email">{t('emailRegister')}</TabsTrigger>
        </TabsList>

        <TabsContent value="phone">
          <PhoneRegisterForm
            onSuccess={onSuccess ?? (() => setMode('login'))}
            agreed={agreed}
            onAgreedChange={setAgreed}
            showAgreeErr={showAgreeErr}
            setShowAgreeErr={setShowAgreeErr}
          />
        </TabsContent>

        <TabsContent value="email">
          <EmailRegisterForm
            onSuccess={onSuccess ?? (() => setMode('login'))}
            agreed={agreed}
            onAgreedChange={setAgreed}
            showAgreeErr={showAgreeErr}
            setShowAgreeErr={setShowAgreeErr}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
