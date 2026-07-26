/**
 * LoginForm — IHUI AI 统一登录表单(2026-07-26 立,共享包)
 *
 * 抽到 packages/ui-react,web + extension 共用同一份组件,真正"一模一样"。
 *
 * 视觉规范(对齐 web 端原 LoginFormContent 2026-07-20 修订):
 *   - 4 tab 切换(email / phone / password / qr),TabsList grid-cols-4
 *   - tab 切换显示对应登录子表单(PasswordLoginForm / EmailCodeLoginForm /
 *     PhoneCodeLoginForm / QrCodeLogin)
 *   - 第三方登录按钮群(3 列网格 8 个平台,接 ThirdPartyConfig 注入)
 *   - 注册/忘记密码链接(底部)
 *   - 可选协议复选框(显示在所有子表单底部,根据 showAgreement 切换)
 *   - 可选协议弹窗(3 步 Enter 流程,showAgreement && agreementMode="notice-dialog" 时启用)
 *
 * Props 控制显隐(2026-07-26 共享设计):
 *   - tabs?: LoginTab[] — 默认 ['email', 'phone', 'password', 'qr']
 *   - defaultTab?: LoginTab — 默认 tabs[0]
 *   - showThirdParty?: boolean — 默认 true
 *   - thirdParty?: ThirdPartyConfig — 第三方登录配置(由 useThirdPartyAuth 注入)
 *   - showRegisterLink?: boolean — 默认 true
 *   - showForgotPassword?: boolean — 默认 true
 *   - onForgotPassword?: () => void — web 端切换到 forgot 模式,extension 跳网页
 *   - onRegister?: () => void — web 端切换到 register 模式,extension 跳网页
 *   - showAgreement?: boolean — 默认 false
 *   - agreementMode?: 'inline' | 'notice-dialog' — 默认 'inline'
 *   - qrComponent?: React.ComponentType — web 端用本地厂商 SDK QrCodeLogin 覆盖默认占位
 *   - onSuccess?: (data) => void — 登录成功回调
 *   - apiClient: LoginApiClient — API 客户端注入
 *   - t: TFunc — i18n 函数注入
 *
 * 共享包不依赖 next-intl / next/image / react-hook-form / @ihui/api-client,
 * 所有跨端差异通过 props 注入。
 */
import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'
import { PasswordLoginForm } from './password-tab'
import { EmailCodeLoginForm } from './email-code-tab'
import { PhoneCodeLoginForm } from './phone-code-tab'
import { QrCodeLogin } from './qr-tab'
import { ThirdPartyLoginButtons } from './third-party-buttons'
import { AgreementCheckbox } from './agreement-checkbox'
import { AgreementNoticeDialog } from './agreement-notice-dialog'
import type { LoginApiClient, LoginResult, LoginTab, TFunc, ThirdPartyConfig } from './types'

const DEFAULT_TABS: LoginTab[] = ['email', 'phone', 'password', 'qr']

export interface LoginFormProps {
  /** i18n 函数 */
  t: TFunc
  /** API 客户端 */
  apiClient: LoginApiClient
  /** 登录成功回调 */
  onSuccess?: (data: NonNullable<LoginResult['data']>) => void | Promise<void>

  /** 启用的 tab 列表,默认 4 个全开;扩展端 popup 可传 ['password'] */
  tabs?: LoginTab[]
  /** 默认 tab,默认 tabs[0] */
  defaultTab?: LoginTab

  /** 是否显示第三方登录,默认 true */
  showThirdParty?: boolean
  /** 第三方登录配置(由 useThirdPartyAuth 注入) */
  thirdParty?: ThirdPartyConfig

  /** 是否显示"立即注册"链接,默认 true */
  showRegisterLink?: boolean
  /** 注册链接回调 */
  onRegister?: () => void
  /** 注册链接 URL(用于 <a target="_blank">,与 onRegister 二选一,onRegister 优先) */
  registerHref?: string

  /** 是否显示"忘记密码"链接,默认 true */
  showForgotPassword?: boolean
  /** 忘记密码链接回调(在 PasswordLoginForm 内部用) */
  onForgotPassword?: () => void

  /** 是否显示协议复选框,默认 false(扩展端默认 false,web 端按需开) */
  showAgreement?: boolean
  /** 协议模式:'inline' 行内复选框 / 'notice-dialog' 弹窗(3 步 Enter),默认 'inline' */
  agreementMode?: 'inline' | 'notice-dialog'
  /** 协议复选框状态(controlled),未同意时尝试 submit 触发 onRequireAgreement 回调 */
  agreementChecked?: boolean
  onAgreementChange?: (v: boolean) => void
  /** 提交时未同意协议回调(父组件打开弹窗或提示) */
  onRequireAgreement?: () => void

  /** 自定义 QrCode 组件(web 端用本地厂商 SDK,扩展端用默认占位) */
  qrComponent?: React.ComponentType<{ t: TFunc; onOpenWeb?: () => void }>

  /** 输入框 className,默认 h-10 */
  inputClassName?: string
  /** 提交按钮 className,默认 h-10 w-full */
  buttonClassName?: string

  /** 容器 className(由 AuthShell 包裹时,本组件不渲染外壳) */
  className?: string
}

export function LoginForm(props: LoginFormProps) {
  const {
    t,
    apiClient,
    onSuccess,
    tabs = DEFAULT_TABS,
    defaultTab,
    showThirdParty = true,
    thirdParty,
    showRegisterLink = true,
    onRegister,
    registerHref,
    showForgotPassword = true,
    onForgotPassword,
    showAgreement = false,
    agreementMode = 'inline',
    agreementChecked: agreementCheckedProp,
    onAgreementChange,
    onRequireAgreement,
    qrComponent: QrComponent,
    inputClassName = 'h-10',
    buttonClassName = 'h-10 w-full',
    className,
  } = props

  const [tab, setTab] = React.useState<LoginTab>(defaultTab ?? tabs[0] ?? 'email')
  // 内部协议状态(若外部未传 agreementChecked)
  const [internalAgreed, setInternalAgreed] = React.useState(false)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)
  const [noticeOpen, setNoticeOpen] = React.useState(false)

  const agreementChecked = agreementCheckedProp ?? internalAgreed
  const setAgreementChecked = (v: boolean) => {
    if (onAgreementChange) onAgreementChange(v)
    else setInternalAgreed(v)
    if (v) setShowAgreeErr(false)
  }

  // 包装子表单的 onSuccess:协议校验 + 透传
  const wrapOnSuccess = (original?: (data: NonNullable<LoginResult['data']>) => void | Promise<void>) =>
    async (data: NonNullable<LoginResult['data']>) => {
      if (showAgreement && !agreementChecked) {
        onRequireAgreement?.()
        if (agreementMode === 'notice-dialog') {
          setNoticeOpen(true)
        } else {
          setShowAgreeErr(true)
        }
        return
      }
      await original?.(data)
      await onSuccess?.(data)
    }

  const handleAgree = () => {
    setAgreementChecked(true)
    setShowAgreeErr(false)
    setNoticeOpen(false)
  }

  const handleCancelNotice = () => {
    setNoticeOpen(false)
  }

  return (
    <div className={['login-form-scope', 'space-y-4', className].filter(Boolean).join(' ')}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as LoginTab)}>
        {tabs.length > 1 && (
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.includes('email') && (
              <TabsTrigger value="email" data-testid="login-tab-email">
                {t('auth.emailLogin')}
              </TabsTrigger>
            )}
            {tabs.includes('phone') && (
              <TabsTrigger value="phone" data-testid="login-tab-phone">
                {t('auth.phoneCodeLogin')}
              </TabsTrigger>
            )}
            {tabs.includes('password') && (
              <TabsTrigger value="password" data-testid="login-tab-password">
                {t('auth.passwordLogin')}
              </TabsTrigger>
            )}
            {tabs.includes('qr') && (
              <TabsTrigger value="qr" data-testid="login-tab-qr">
                {t('auth.qrLogin')}
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {tabs.includes('email') && (
          <TabsContent value="email">
            <EmailCodeLoginForm
              active={tab === 'email'}
              apiClient={apiClient}
              t={t}
              onSuccess={wrapOnSuccess()}
              inputClassName={inputClassName}
              buttonClassName={buttonClassName}
            />
          </TabsContent>
        )}

        {tabs.includes('phone') && (
          <TabsContent value="phone">
            <PhoneCodeLoginForm
              active={tab === 'phone'}
              apiClient={apiClient}
              t={t}
              onSuccess={wrapOnSuccess()}
              inputClassName={inputClassName}
              buttonClassName={buttonClassName}
            />
          </TabsContent>
        )}

        {tabs.includes('password') && (
          <TabsContent value="password">
            <PasswordLoginForm
              active={tab === 'password'}
              apiClient={apiClient}
              t={t}
              onSuccess={wrapOnSuccess()}
              onForgotPassword={showForgotPassword ? onForgotPassword : undefined}
              inputClassName={inputClassName}
              buttonClassName={buttonClassName}
            />
          </TabsContent>
        )}

        {tabs.includes('qr') && (
          <TabsContent value="qr">
            {QrComponent ? (
              <QrComponent t={t} onOpenWeb={onRegister} />
            ) : (
              <QrCodeLogin t={t} onOpenWeb={onRegister} />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* 单 tab 模式(扩展端 popup 常用):不显示第三方 + 注册链接,极简 */}
      {tabs.length === 1 && showThirdParty === false && showRegisterLink === false ? null : (
        <>
          {showThirdParty && thirdParty && thirdParty.providers.length > 0 && (
            <ThirdPartyLoginButtons config={thirdParty} t={t} />
          )}

          {showRegisterLink && (
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.noAccount')}{' '}
              {onRegister ? (
                <button
                  type="button"
                  onClick={onRegister}
                  className="font-medium text-primary hover:underline"
                  data-testid="register-link"
                >
                  {t('auth.registerNow')}
                </button>
              ) : registerHref ? (
                <a
                  href={registerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {t('auth.registerNow')}
                </a>
              ) : null}
            </p>
          )}
        </>
      )}

      {showAgreement && (
        <>
          <div className="space-y-1.5">
            <AgreementCheckbox
              checked={agreementChecked}
              onChange={setAgreementChecked}
              error={showAgreeErr && !agreementChecked}
              t={t}
            />
            {showAgreeErr && !agreementChecked && (
              <p className="text-xs text-destructive">{t('auth.agreeRequired')}</p>
            )}
          </div>
          {agreementMode === 'notice-dialog' && (
            <AgreementNoticeDialog
              open={noticeOpen}
              onAgree={handleAgree}
              onCancel={handleCancelNotice}
              t={t}
            />
          )}
        </>
      )}

      {/*
       * 单 tab 模式且无三方无注册链接时,提交按钮已在 PasswordLoginForm 内部
       * (因为 wrapOnSuccess 已把协议校验和 onSuccess 串起来)。
       * 但 wrapOnSuccess 注入到子表单的 onSuccess 还需要父级传入 onSuccess
       * 才会真正触发业务成功回调,这里再补一个 fallback 提示。
       */}
    </div>
  )
}
