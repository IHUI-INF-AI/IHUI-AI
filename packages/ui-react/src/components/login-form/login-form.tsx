// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 登录方式 Tab 选中态背景(2026-07-30 立,用户要求)
 * 亮色模式纯白 / 暗色模式纯黑,覆盖 TabsTrigger 默认的 bg-background(浅灰/深灰)。
 * 仅作用于登录场景的 TabsTrigger,不影响其他 Tabs。
 */
const loginTabActiveClassName =
  // 2026-09-21 立:h-8 TabsList(32px) - p-1(8px) = 24px 内容区,trigger 基类 py-1+行高20px=28px
  // 会溢出 4px 且 grid 隐式行从顶部排,溢出全堆底部 → 选中胶囊上 4px/下 0px 不对称。
  // h-6 py-0 让 trigger 正好填满 24px,四周均匀 4px 灰边(twMerge 覆盖基类 py-1)。
  'h-6 py-0 data-[state=active]:bg-white dark:data-[state=active]:bg-black'

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
    thirdPartyFeaturedPlatform,
    thirdPartyFeaturedBackground,
    phoneDefaultAccount,
    thirdPartyColumns,
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
        {/* 2026-09-19 紧凑化:h-9→h-8(登录弹窗总高压到 95vh 内,用户要求禁滚动) */}
        <TabsList
          className="grid h-8 w-full"
          style={{ gridTemplateColumns: `repeat(${enabledTabs.length}, minmax(0, 1fr))` }}
        >
          {enabledTabs.includes('email') && (
            <TabsTrigger
              value="email"
              data-testid="login-tab-email"
              className={loginTabActiveClassName}
            >
              {t('auth.emailLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('phone') && (
            <TabsTrigger
              value="phone"
              data-testid="login-tab-phone"
              className={loginTabActiveClassName}
            >
              {t('auth.phoneCodeLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('password') && (
            <TabsTrigger
              value="password"
              data-testid="login-tab-password"
              className={loginTabActiveClassName}
            >
              {t('auth.passwordLogin')}
            </TabsTrigger>
          )}
          {enabledTabs.includes('qr') && (
            <TabsTrigger value="qr" data-testid="login-tab-qr" className={loginTabActiveClassName}>
              {t('auth.qrLogin')}
            </TabsTrigger>
          )}
        </TabsList>

        {enabledTabs.includes('email') && (
          // 2026-09-19 紧凑化:mt-2→mt-1(覆盖 TabsContent 全局默认)
          <TabsContent value="email" className="mt-1">
            <EmailCodeLoginForm {...formBaseProps} />
          </TabsContent>
        )}

        {enabledTabs.includes('phone') && (
          <TabsContent value="phone" className="mt-1">
            <PhoneCodeLoginForm {...formBaseProps} defaultAccount={phoneDefaultAccount} />
          </TabsContent>
        )}

        {enabledTabs.includes('password') && (
          <TabsContent value="password" className="mt-1">
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
          <TabsContent value="qr" className="mt-1">
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
        <ThirdPartyLoginButtons
          t={t}
          config={thirdParty}
          featuredPlatform={thirdPartyFeaturedPlatform}
          featuredBackground={thirdPartyFeaturedBackground}
          columns={thirdPartyColumns}
        />
      )}

      {/* 注册链接 */}
      {showRegisterLink && (onRegister || registerHref) && (
        // 2026-09-18 呼吸感:mt-3 让本行与上方(第三方图标网格/QrTab)的间距
        // 从 16px 拉到 28px(16+12),与"登录按钮→第三方登录标题"的 28px 节奏对齐
        // (用户反馈这行字憋得难受;Tailwind v4 space-y 用前元素 margin-block-end,
        // 本行自身 mt 叠加不冲突)。qr tab 场景上一兄弟是 QrTab,同样受益。
        // 2026-09-19 紧凑化:mt-3→mt-2(整体高度让位于"视口内完整显示"硬需求)
        <p className="mt-1 text-center text-sm text-muted-foreground">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
