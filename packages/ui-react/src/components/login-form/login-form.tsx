'use client'

import * as React from 'react'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'
import { cn } from '../../lib/utils'
import { AgreementCheckbox } from './agreement-checkbox'
import { AgreementNoticeDialog } from './agreement-notice-dialog'
import { EmailCodeLoginForm } from './email-code-login-form'
import { PasswordLoginForm } from './password-login-form'
import { PhoneCodeLoginForm } from './phone-code-login-form'
import { QrTab } from './qr-tab'
import { ThirdPartyLoginButtons } from './third-party-login-buttons'
import type { LoginFormProps, LoginTab } from './types'

/**
 * 共享 LoginForm 组件(2026-07-26 立)
 *
 * 单一来源(single source of truth):web 端 LoginFormContent 和扩展端
 * popup/sidepanel 都用这份。整合 4 tab + 8 第三方登录 + 协议复选框 + 协议弹窗。
 *
 * 视觉规范(对标 apps/web/src/components/login/LoginFormContent.tsx):
 *   - 容器:.login-form-scope space-y-4
 *   - 4 tab Tabs(网格 grid-cols-4)
 *   - 错误提示:每个 tab 独立,切换时清空
 *   - 协议状态:agreed / showAgreeErr / noticeOpen 三态联动
 *   - 协议模式:inline(红色提示)或 notice-dialog(弹窗)
 *   - 底部:第三方登录区 + "没有账号?立即注册"链接
 *
 * 共享包关键差异(2026-07-26):
 *   - i18n 函数由调用方注入(适配 web next-intl / 扩展自实现)
 *   - 登录 API 客户端由调用方注入(适配 web fetchApi / 扩展 chrome.runtime)
 *   - 第三方登录配置由调用方注入(图标 / 启用状态)
 *   - 图形验证码由调用方 apiClient.fetchCaptcha 提供
 *   - 不依赖 next/link / next/image / useSearchParams / useThirdPartyAuth
 *
 * i18n 完整 key 列表(与 packages/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json
 * auth.* 命名空间对齐):
 *   auth.emailLogin / phoneCodeLogin / passwordLogin / qrLogin
 *   auth.thirdPartyLogin / auth.noAccount / auth.registerNow
 *   auth.agreePrefix / termsOfService / privacyPolicy / and / agreeRequired
 *   auth.agreementNoticeTitle/Desc/Agree/Disagree/Safe/EnterHint
 *   common.open
 */
export function LoginForm(props: LoginFormProps) {
  const {
    t,
    apiClient,
    onSuccess,
    tabs,
    defaultTab,
    showThirdParty = true,
    thirdParty,
    showRegisterLink = true,
    onRegister,
    registerHref,
    showForgotPassword = false,
    onForgotPassword,
    forgotPasswordHref,
    showAgreement = true,
    agreementMode = 'notice-dialog',
    defaultAgreed = false,
    captchaEnabled = false,
    inputClassName,
    buttonClassName,
    className,
    qrComponent,
    qrPlatforms,
    enableCredentialPersistence = false,
  } = props

  const enabledTabs: LoginTab[] = tabs ?? ['email', 'phone', 'password', 'qr']
  const [tab, setTab] = React.useState<LoginTab>(defaultTab ?? enabledTabs[0] ?? 'email')
  const [agreed, setAgreed] = React.useState(defaultAgreed)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)
  const [noticeOpen, setNoticeOpen] = React.useState(false)

  const handleRequireAgree = React.useCallback(() => {
    setShowAgreeErr(true)
    if (agreementMode === 'notice-dialog') {
      setNoticeOpen(true)
    }
  }, [agreementMode])

  const handleAgreeNotice = React.useCallback(() => {
    setAgreed(true)
    setShowAgreeErr(false)
    setNoticeOpen(false)
  }, [])

  const handleCancelNotice = React.useCallback(() => {
    setNoticeOpen(false)
  }, [])

  const handleAgreedChange = React.useCallback((v: boolean) => {
    setAgreed(v)
    if (v) setShowAgreeErr(false)
  }, [])

  // 切 tab 时清空协议错误(避免上一次的红色状态残留)
  const handleTabChange = React.useCallback((v: string) => {
    setTab(v as LoginTab)
    setShowAgreeErr(false)
  }, [])

  const handleRegister = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onRegister) {
      onRegister()
    } else if (registerHref) {
      window.location.href = registerHref
    }
  }

  // 透传 props
  const formBaseProps = {
    t,
    apiClient,
    onSuccess,
    agreed,
    onAgreedChange: handleAgreedChange,
    onRequireAgree: handleRequireAgree,
    showAgreeErr,
    inputClassName,
    buttonClassName,
    // 2026-07-30:3 个 tab 共用同一份账号历史(email/phone/password 登录成功都写入同一 localStorage)
    enableCredentialPersistence,
  }

  return (
    <div className={cn('login-form-scope space-y-4', className)}>
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          {enabledTabs.includes('email') && (
            <TabsTrigger value="email" data-testid="login-tab-email">
              {t('auth.emailLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('phone') && (
            <TabsTrigger value="phone" data-testid="login-tab-phone">
              {t('auth.phoneCodeLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('password') && (
            <TabsTrigger value="password" data-testid="login-tab-password">
              {t('auth.passwordLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('qr') && (
            <TabsTrigger value="qr" data-testid="login-tab-qr">
              {t('auth.qrLogin')}
            </TabsTrigger>
          )}
        </TabsList>

        {enabledTabs.includes('email') && (
          <TabsContent value="email">
            <EmailCodeLoginForm {...formBaseProps} />
          </TabsContent>
        )}

        {enabledTabs.includes('phone') && (
          <TabsContent value="phone">
            <PhoneCodeLoginForm {...formBaseProps} />
          </TabsContent>
        )}

        {enabledTabs.includes('password') && (
          <TabsContent value="password">
            <PasswordLoginForm
              {...formBaseProps}
              captchaEnabled={captchaEnabled}
              showForgotPassword={showForgotPassword}
              onForgotPassword={onForgotPassword}
              forgotPasswordHref={forgotPasswordHref}
            />
          </TabsContent>
        )}

        {enabledTabs.includes('qr') && (
          <TabsContent value="qr">
            <QrTab
              t={t}
              QrComponent={qrComponent}
              platforms={qrPlatforms}
              onSwitchMethod={() => setTab('email')}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* 协议复选框(qr tab 不需要,因为不会触发提交) */}
      {showAgreement && tab !== 'qr' && agreementMode === 'inline' && (
        <div className="pt-1">
          <AgreementCheckbox
            t={t}
            checked={agreed}
            onChange={handleAgreedChange}
            error={showAgreeErr && !agreed}
          />
          {showAgreeErr && !agreed && (
            <p className="mt-1 text-xs text-destructive">{t('auth.agreeRequired')}</p>
          )}
        </div>
      )}

      {/* 第三方登录区(qr tab 已经有自家平台 tab,不重复展示) */}
      {showThirdParty && thirdParty && tab !== 'qr' && (
        <ThirdPartyLoginButtons t={t} config={thirdParty} />
      )}

      {/* 注册链接 */}
      {showRegisterLink && (onRegister || registerHref) && (
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <button
            type="button"
            onClick={handleRegister}
            className="font-medium text-primary hover:underline"
          >
            {t('auth.registerNow')}
          </button>
        </p>
      )}

      {/* 协议弹窗 */}
      <AgreementNoticeDialog
        t={t}
        open={noticeOpen}
        onAgree={handleAgreeNotice}
        onCancel={handleCancelNotice}
      />
    </div>
  )
}
