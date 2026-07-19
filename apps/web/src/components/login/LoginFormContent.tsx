'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Check } from 'lucide-react'

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

/** 隐私协议复选框(AI 登录框专用)
 *  - 严格按设计稿:复选框方块自带浅灰边框 + hover 描边色变深 + 勾选用对勾
 *  - 文字部分:前缀 + 蓝色链接(用户协议、隐私政策)
 *  - 未勾选时登录按钮 disabled
 */
function AgreementCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  error?: boolean
}) {
  const t = useTranslations('auth')
  return (
    <label className="group flex cursor-pointer items-start gap-2 select-none">
      <span
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
        className={[
          'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          error
            ? 'border-destructive'
            : checked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background group-hover:border-foreground/60',
        ].join(' ')}
        aria-checked={checked}
        role="checkbox"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs leading-5 text-muted-foreground">
        {t('agreePrefix')}
        <Link
          href="/agreement/user-agreement"
          target="_blank"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('termsOfService')}
        </Link>
        {t('and')}
        <Link
          href="/agreement/privacy-policy"
          target="_blank"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t('privacyPolicy')}
        </Link>
      </span>
    </label>
  )
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
    <div className="space-y-5">
      {/* 顶部已由 logo.png + welcome.svg 渲染图标和欢迎图,此处不再放文字标题,避免与图片重复 */}

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
            onRequireAgree={() => setShowAgreeErr(true)}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="email">
          <EmailCodeLoginForm
            active={tab === 'email'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onRequireAgree={() => setShowAgreeErr(true)}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="username">
          <UsernameLoginForm
            active={tab === 'username'}
            onSuccess={handleSuccess}
            agreed={agreed}
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

      <AgreementCheckbox
        checked={agreed}
        onChange={(v) => {
          setAgreed(v)
          if (v) setShowAgreeErr(false)
        }}
        error={showAgreeErr && !agreed}
      />

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
