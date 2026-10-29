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
import { PasskeyLoginButton } from './passkey-login-button'
import { QrTab } from './qr-tab'
import { ThirdPartyLoginButtons } from './third-party-login-buttons'
import type { LoginFormProps, LoginTab, ThirdPartyPlatform } from './types'

/**
 * 登录方式 Tab 选中态背景(2026-07-30 立,用户要求;2026-09-30 收口到具名档)
 * 亮色纯白 / 暗色纯黑 —— 取值改走 tokens.css 的 --color-selection(与同主题
 * --color-foreground 成对的 --color-selection-foreground 作前景),端里不得再写死
 * bg-white / dark:bg-black:三端(App 走 rnTokens.selection、小程序走同一对 CSS 变量)
 * 此前各取一档,暗色档案下 App=纯黑而小程序=--color-card(#1A1A1A),真机实拍分叉。
 * 新旧取值逐位同值(亮 hsl(0 0% 100%)=#FFFFFF、暗 hsl(0 0% 0%)=#000000)⇒ web 观感零变化。
 * 仅作用于登录场景的 TabsTrigger,不影响其他 Tabs。
 */
const loginTabActiveClassName =
  // 2026-09-21 立:h-8 TabsList(32px) - p-1(8px) = 24px 内容区,trigger 基类 py-1+行高20px=28px
  // 会溢出 4px 且 grid 隐式行从顶部排,溢出全堆底部 → 选中胶囊上 4px/下 0px 不对称。
  // h-6 py-0 让 trigger 正好填满 24px,四周均匀 4px 灰边(twMerge 覆盖基类 py-1)。
  // 前景与实底成对写(§4「品牌实底 + 其上文字必须成对」),值与基类 text-foreground 同档。
  'h-6 py-0 data-[state=active]:bg-selection data-[state=active]:text-selection-foreground'

/**
 * tab 键 → 标签文案键(2026-10-26 立)。这张表同时充当「哪些键是已知 tab」的判据:
 * 调用方传来的脏键不会被渲染成一个空白 tab。
 * tab 的**渲染顺序**由调用方传入的 tabs 数组决定 —— 地区优先级判据住在 region-policy.ts,
 * 组件不再自带顺序。
 */
const TAB_LABEL_KEYS: Record<LoginTab, string> = {
  email: 'auth.emailLogin',
  phone: 'auth.phoneCodeLogin',
  password: 'auth.passwordLogin',
  qr: 'auth.qrLogin',
}

const KNOWN_TAB_KEYS = Object.keys(TAB_LABEL_KEYS) as LoginTab[]

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
 *   - 协议模式:inline(红色提示 + 复选框)或 notice-dialog(弹窗);
 *     2026-10-27 协议票起,**未同意时进入扫码 tab 即按当前档要求一次同意**
 *     (弹窗档=弹同一扇 AgreementNoticeDialog;勾选框档=显示复选框 + 红提示)
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
    canAutoSubmitCredentials,
    thirdPartyFeaturedPlatform,
    thirdPartyFeaturedBackground,
    phoneDefaultAccount,
    thirdPartyColumns,
    thirdPartyPriorityPlatforms,
  } = props

  const enabledTabs: LoginTab[] = tabs ?? ['email', 'phone', 'password', 'qr']
  const renderableTabs = enabledTabs.filter((key) => KNOWN_TAB_KEYS.includes(key))
  // Passkey(WebAuthn)是 web 能力:只有调用方注入了 auth/options + auth/verify 才渲染。
  // 小程序/RN 无 WebAuthn,不注入即无入口(平台豁免见 PROJECT_PLAN G-874)。
  const passkeyEnabled =
    typeof apiClient.passkeyAuthOptions === 'function' &&
    typeof apiClient.passkeyAuthVerify === 'function'
  const [tab, setTab] = React.useState<LoginTab>(defaultTab ?? renderableTabs[0] ?? 'email')
  const [agreed, setAgreed] = React.useState(defaultAgreed)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)
  const [noticeOpen, setNoticeOpen] = React.useState(false)

  // 2026-10-26 地区优先:后端按来源 IP 判的地区与第三方凭据状态走同一条 GET,是**异步到达**的;
  // 到达后 tabs 会重排。用户还没手动切过时,选中项跟着挪到新首位;切过之后一律尊重用户的选择。
  // 调用方显式传了 defaultTab 时不自动挪(那是它自己的定向意图,不是地区排序的结果)。
  const userPickedTab = React.useRef(false)
  const autoFollowFirstTab = defaultTab === undefined
  const firstRenderableTab = renderableTabs[0]
  // 扫码 tab 里「换种方式登录」的落点:按当前顺序取第一个非扫码项,而不是硬写 email
  // (国内扫码排第一时,email 已不是次选位)。
  const nonQrTab = renderableTabs.find((key) => key !== 'qr')
  const switchAwayFromQr = React.useCallback(() => {
    if (nonQrTab) setTab(nonQrTab)
  }, [nonQrTab])
  React.useEffect(() => {
    if (!autoFollowFirstTab || userPickedTab.current || !firstRenderableTab) return
    setTab(firstRenderableTab)
  }, [autoFollowFirstTab, firstRenderableTab])

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

  // 2026-10-27 机主代裁(台账票「扫码登录路径从不触发协议同意」,方案①;落选方案②的理由进同笔
  // commit message):**扫码面板进入即要求一次协议同意** —— 此前协议门禁挂在"点提交"上,而扫码
  // 这条路径结构上没有提交动作(共享包以 tab!=='qr' 排除协议区),等于 2026-10-27 起国内访客
  // 的默认首屏整条不经过同意就能直接拿 token。现改为:
  //   · notice-dialog 档(现网唯一形态:web 弹窗 + 扩展 popup/sidepanel,×3 全部此档):
  //     未同意时进入扫码面板即弹一次既有 AgreementNoticeDialog —— 与提交流程**同一器物**,
  //     不新写弹窗;用户"不同意"即关窗且本次停留内不再骚扰,切走再切回且仍未同意才再问;
  //   · inline 档(现无任何消费者开放 qr;组合本身在改动前就没有同意通道,不是本次造成的缺口):
  //     同批把复选框在 qr 面板落位(见下方协议区条件),进入即置红提示,勾上即沉默。
  // 同意后(agreed=true)该档永不再弹;defaultAgreed=true 主机即刻沉默;showAgreement=false
  // 的主机已显式关闭协议面,不代为弹窗。
  React.useEffect(() => {
    if (tab !== 'qr' || !showAgreement || agreed) return
    if (agreementMode === 'notice-dialog') setNoticeOpen(true)
    else setShowAgreeErr(true)
  }, [tab, agreed, showAgreement, agreementMode])

  // 切 tab 时清空协议错误(避免上一次的红色状态残留)
  const handleTabChange = React.useCallback(
    (v: string) => {
      userPickedTab.current = true
      const next = v as LoginTab
      setTab(next)
      setShowAgreeErr(false)
      // 与下方 useEffect 同判据;切 tab 时在 commit 前即开弹窗,避免 Radix/happy-dom 下
      // 仅依赖 effect 时序导致「点扫码 tab 协议窗未即现」(qr-entry-agreement-prompt ③)。
      if (next === 'qr' && showAgreement && !agreed && agreementMode === 'notice-dialog') {
        setNoticeOpen(true)
      }
    },
    [agreed, showAgreement, agreementMode],
  )

  /**
   * 第三方按钮的同意门禁(2026-10-27 立)。
   * 未勾选协议时走与主登录按钮同一条提示路径(onRequireAgree → 红色提示 / 协议弹窗),
   * 且**不调用**调用方 onLogin —— 服务端通用回调 fail-closed,发起期没落同意记录必 403。
   * 已勾选时透传 agreementAccepted=true,由调用方在跳转厂商前写入同意记录。
   * 按钮本身在未同意时仍照常可见(点后才提示),不改布局。
   */
  const handleThirdPartyLogin = React.useCallback(
    (platform: ThirdPartyPlatform) => {
      if (!agreed) {
        handleRequireAgree()
        return
      }
      thirdParty?.onLogin(platform, true)
    },
    [agreed, handleRequireAgree, thirdParty],
  )

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
    // 必填:自动提交凭据的准入判定由调用方给(判据住在 @ihui/shared/auth/auto-login-policy)
    canAutoSubmitCredentials,
  }

  return (
    <div className={cn('login-form-scope space-y-4', className)}>
      <Tabs value={tab} onValueChange={handleTabChange}>
        {/* 2026-09-19 紧凑化:h-9→h-8(登录弹窗总高压到 95vh 内,用户要求禁滚动) */}
        <TabsList
          className="grid h-8 w-full"
          style={{ gridTemplateColumns: `repeat(${renderableTabs.length}, minmax(0, 1fr))` }}
        >
          {/* 顺序 = 调用方传入 tabs 的顺序(地区优先级由 planLoginRegion 决定),不再硬编码。 */}
          {renderableTabs.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              data-testid={`login-tab-${key}`}
              className={loginTabActiveClassName}
            >
              {t(TAB_LABEL_KEYS[key])}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Passkey 免密登录(g-874):web 注入 options/verify 后出现在表单顶部;扫码 tab 不重复展示 */}
        {passkeyEnabled && tab !== 'qr' && (
          <PasskeyLoginButton t={t} apiClient={apiClient} onSuccess={onSuccess} className="mt-2" />
        )}

        {renderableTabs.map((key) => (
          // 2026-09-19 紧凑化:mt-2→mt-1(覆盖 TabsContent 全局默认)
          <TabsContent key={key} value={key} className="mt-1">
            {key === 'email' && <EmailCodeLoginForm {...formBaseProps} />}
            {key === 'phone' && (
              <PhoneCodeLoginForm {...formBaseProps} defaultAccount={phoneDefaultAccount} />
            )}
            {key === 'password' && (
              <PasswordLoginForm
                {...formBaseProps}
                captchaEnabled={captchaEnabled}
                showForgotPassword={showForgotPassword}
                onForgotPassword={onForgotPassword}
                forgotPasswordHref={forgotPasswordHref}
              />
            )}
            {key === 'qr' && (
              <QrTab
                t={t}
                QrComponent={qrComponent}
                platforms={qrPlatforms}
                onSwitchMethod={switchAwayFromQr}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* 协议复选框:inline 档在 qr 面板同批落位(2026-10-27 协议票方案① —— 进入扫码即要求,
          勾选框是该档的同意通道;notice-dialog 档走弹窗,本区维持排除) */}
      {showAgreement &&
        (tab !== 'qr' || agreementMode === 'inline') &&
        agreementMode === 'inline' && (
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

      {/* 第三方登录区(qr tab 已经有自家平台 tab,不重复展示)。onLogin 换成同意门禁版本 */}
      {showThirdParty && thirdParty && tab !== 'qr' && (
        <ThirdPartyLoginButtons
          t={t}
          config={{ ...thirdParty, onLogin: handleThirdPartyLogin }}
          featuredPlatform={thirdPartyFeaturedPlatform}
          featuredBackground={thirdPartyFeaturedBackground}
          columns={thirdPartyColumns}
          priorityPlatforms={thirdPartyPriorityPlatforms}
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
