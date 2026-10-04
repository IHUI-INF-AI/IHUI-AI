// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「account」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { ReactNode } from 'react'
import type { TFunction } from './app-shared.js'


/** 账号信息(平台注入,字段对齐 mobile-rn SettingsAccountScreen Account) */
export interface SettingsAccountItem {
  name: string
  email: string
  phone: string
}

/** SettingsAccountScreen props(表单屏,状态由 wrapper 管理) */
export interface SettingsAccountScreenProps {
  t: TFunction
  account: SettingsAccountItem | null
  loading: boolean
  saving: boolean
  error: string
  toast: string
  onNameChange: (text: string) => void
  onEmailChange: (text: string) => void
  onPhoneChange: (text: string) => void
  onSave: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 13(2026-07-29):登录/注册/资料编辑/换绑手机 */

/** 登录 tab key(对齐 web ui-react LoginFormProps.tabs,默认顺序 email/phone/password/qr) */
export type LoginTab = 'email' | 'phone' | 'password' | 'qr'

/** 第三方登录平台 key(对齐 web ui-react ThirdPartyPlatform) */
export type ThirdPartyPlatform =
  | 'wechat'
  | 'google'
  | 'github'
  | 'feishu'
  | 'dingtalk'
  | 'enterpriseWechat'
  | 'alipay'
  | 'apple'
  | 'oidc'
  | 'app'

/** 第三方登录配置项(wrapper 注入:平台 key + 文案 + 图标 + 是否启用) */
export interface ThirdPartyLoginOption {
  platform: ThirdPartyPlatform
  label: string
  /** RN Image source(如 require('../../assets/icons/wechat.png')) */
  iconSource?: number | { uri: string }
  /** RN 图标节点(react-native-svg-transformer 场景:require('*.svg') 返回 React 组件而非
   *  Image source 契约类型,须以节点方式渲染;存在时优先于 iconSource) */
  iconNode?: ReactNode
  /** 平台品牌色(十六进制,如 '#07C160'),用于无图标时的圆形按钮背景 */
  brandColor?: string
  /** 是否启用(未配置 OAuth 的平台设为 false,按钮置灰) */
  enabled: boolean
  /** 是否强制禁用(如 Apple "即将上线",显示 tooltip 但禁用点击) */
  forceDisabled?: boolean
  /** 禁用提示文案(forceDisabled=true 时显示) */
  disabledHint?: string
}

/** QR 扫码登录状态(wrapper 注入,驱动 QrTab UI) */
export type QrLoginStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'expired' | 'error'

/** QR 扫码登录配置(wrapper 注入,共享层只渲染占位 + 状态文案,不依赖任何 SDK) */
export interface QrLoginConfig {
  /** 当前状态 */
  status: QrLoginStatus
  /** 二维码图片源(RN Image source;null 则渲染占位图标) */
  qrSource?: number | { uri: string } | null
  /** 错误文案(status='error' 时显示) */
  errorText?: string
  /** 刷新回调(status='expired'/'error' 时显示刷新按钮) */
  onRefresh?: () => void
}

/** QR 扫码平台配置(平台注入,共享层渲染平台切换 tab + 二维码占位)
 * 2026-08-04 新增:对齐 web 端 qr-tab.tsx 的平台切换设计。
 * RN 端无法直接加载各厂商 SDK(WxLogin/WwLogin/DTFrameLogin/QRLogin 依赖 DOM),
 * 故共享层只渲染占位图标 + "打开网页"按钮(跳到 web 端完成扫码)。
 * web 平台后续可通过 renderQrPanel 注入真实 SDK 面板。 */
export interface QrPlatformOption {
  /** 平台 key(wechat/enterpriseWechat/dingtalk/feishu) */
  key: ThirdPartyPlatform
  /** 平台显示名称(如"微信"/"企业微信"/"钉钉"/"飞书") */
  label: string
  /** 平台图标(RN Image source;不传则 fallback 到首字母) */
  iconSource?: number | { uri: string } | null
  /** 品牌色(用于 fallback 圆角背景) */
  brandColor?: string
  /** web 端扫码页面 URL(用于"打开网页"按钮,原生平台点击后打开浏览器) */
  webUrl?: string
}

/** LoginScreen props(表单屏,状态由 wrapper 管理)
 *
 * 2026-07-30 升级:支持 4-tab(email/phone/password/qr)+ 第三方登录 + 协议同意,
 * 对齐 web ui-react LoginForm。新增字段全部可选,保持向后兼容(仅传 account/password
 * 的旧调用方仍可工作,渲染为单一 password tab)。 */
export interface LoginScreenProps {
  t: TFunction
  account: string
  password: string
  loading: boolean
  ssoLoading: boolean
  error: string
  onAccountChange: (text: string) => void
  onPasswordChange: (text: string) => void
  onLogin: () => void
  onSsoLogin: () => void
  colorScheme?: 'light' | 'dark'
  /** logo 图片源(RN Image source,如 require('../../assets/logo.png'))。
   * 不传则渲染深色方块+IHUI 文字作为 fallback,对齐 web AuthShell logo 占位。 */
  logoSource?: number | { uri: string }
  /**
   * 2026-09-29 新增:logo 的 ReactNode 通道,与下面的 welcomeNode 同形、优先级更高。
   * 存在的原因是实测出来的,不是审美:真机 release 包里 <Image source={本地 PNG require}>
   * 渲染为空白(布局仍占 53dp),而同屏走 react-native-svg 的图标全部正常 —— 已用同格
   * 对照实验钉死(枚 8a7926ead7)。故调用方应传 <SvgXml/>,不要再依赖 logoSource。
   * logoSource 保留是为了不破坏既有调用方与 <Image> 兜底分支。
   */
  logoNode?: ReactNode
  /** welcome 图标节点(logo 右侧的品牌文字图,对齐 web AuthShell 的 welcome.svg)。
   * 推荐用 react-native-svg 的 SvgXml 渲染 welcome.svg/baiwelcome.svg 内容。
   * 不传则 fallback 到纯文字 "IHUI AI"(不推荐 — 与 web 端视觉不一致)。 */
  welcomeNode?: ReactNode

  // ===== 4-tab 扩展(可选,未传则只渲染 password tab,保持向后兼容) =====

  /** 启用的 tab 列表(默认 ['password'],传多个则渲染 tab 切换条)。
   * 对齐 web ui-react LoginFormProps.tabs,顺序:email/phone/password/qr。 */
  tabs?: readonly LoginTab[]
  /** 默认激活 tab(默认第一个 tab) */
  defaultTab?: LoginTab
  /** tab 切换回调(含初始激活的 defaultTab,每次 activeTab 变化都会触发;wrapper 可据此做 tab 进入时副作业) */
  onTabChange?: (tab: LoginTab) => void

  // ===== 邮箱验证码登录(email tab) =====

  email?: string
  emailCode?: string
  /** 邮箱验证码发送中(按钮 loading) */
  emailCodeSending?: boolean
  /** 邮箱验证码倒计时(>0 时按钮显示 "{n}s 后重发",禁用点击) */
  emailCountdown?: number
  onEmailChange?: (text: string) => void
  onEmailCodeChange?: (text: string) => void
  onSendEmailCode?: () => void
  onLoginByEmailCode?: () => void

  // ===== 手机验证码登录(phone tab) =====

  phone?: string
  phoneCode?: string
  phoneCodeSending?: boolean
  phoneCountdown?: number
  /** 手机号输入框前缀节点(区号展示,如 "+86",对齐 uniapp login 的 xiaicc 区号)
   * 不传则输入框独占一行(向后兼容)。2026-08-15 新增。 */
  phonePrefixNode?: ReactNode
  /** 区号选择列表(传 nations + phoneHead 则渲染可点击区号选择器,优先级高于 phonePrefixNode)
   * 2026-08-20 新增,对齐 uniapp login 的 nation-box + ChangePhone 现有模式:
   * 点击区号展开列表选择,选中项高亮。不传则回退到 phonePrefixNode / 无前缀。 */
  nations?: NationOption[]
  /** 当前选中区号(如 '+86');配合 nations 渲染区号选择器 */
  phoneHead?: string
  /** 区号列表是否展开(wrapper 管理,点击区号切换) */
  nationShow?: boolean
  /** 展开/收起区号列表回调 */
  onToggleNationShow?: () => void
  /** 选中区号回调(wrapper 更新 phoneHead 并收起列表) */
  onSelectNation?: (nation: NationOption) => void
  onPhoneChange?: (text: string) => void
  onPhoneCodeChange?: (text: string) => void
  onSendPhoneCode?: () => void
  onLoginByPhoneCode?: () => void

  // ===== 运营商一键登录(phone tab 内入口,wrapper 注?=====

  /** 手机号 tab 内运营商一键登录入口节点(可?传则渲染在主登录按钮下方;未传不渲染) */
  carrierOneClickEntry?: ReactNode

  // ===== QR 扫码登录(qr tab) =====

  /** QR 登录配置(传则渲染 QR 占位 + 状态文案;不传则 qr tab 显示"暂未启用") */
  qrConfig?: QrLoginConfig

  /** QR 扫码平台列表(传则渲染平台切换 tab;不传则 qr tab 只显示单平台占位)
   * 2026-08-04 新增:对齐 web 端 qr-tab.tsx 的平台切换设计。
   * 4 个平台:微信/企业微信/钉钉/飞书 */
  qrPlatforms?: QrPlatformOption[]

  /** QR 面板渲染函数(平台注入,接收 platform key + refreshKey,返回二维码面板 ReactNode)
   * 2026-08-04 新增:mobile-rn 端可注入 WebView 加载 web 端二维码面板(显示真实二维码);
   * web 端可注入 SDK 面板(WxLogin/DTFrameLogin 等)。
   * 不传则共享层渲染 ▦ 占位图标(无真实二维码)。 */
  renderQrPanel?: (platform: ThirdPartyPlatform, refreshKey: number) => ReactNode

  // ===== 第三方登录区 =====

  /** 第三方登录选项列表(传则渲染第三方登录区;不传则不显示) */
  thirdPartyOptions?: ThirdPartyLoginOption[]
  /** 第三方登录点击回调(wrapper 实现 OAuth flow,如 WebBrowser.openAuthSessionAsync) */
  onThirdPartyLogin?: (platform: ThirdPartyPlatform) => void
  /** 当前正在登录的第三方平台 key(对应按钮 loading) */
  thirdPartyLoadingPlatform?: ThirdPartyPlatform | null

  // ===== 协议同意 =====

  /** 是否已同意协议(双向绑定) */
  agreed?: boolean
  /** 协议同意回调(用户切换复选框时触发) */
  onAgreedChange?: (agreed: boolean) => void
  /** 服务条款链接回调(wrapper 注入导航跳转,如 navigate('Agreement')) */
  onOpenTerms?: () => void
  /** 隐私政策链接回调 */
  onOpenPrivacy?: () => void
  /** 协议未勾选时的提示文案(由 wrapper 控制是否显示,共享层不维护) */
  agreementError?: string

  // ===== 忘记密码 + 注册链接(password tab 独有) =====

  /** 忘记密码回调(传则 password tab 右上角显示"忘记密码"链接) */
  onForgotPassword?: () => void
  /** 注册回调(传则卡片底部显示"还没有账号?立即注册") */
  onRegister?: () => void

  // ===== 密码显示/隐藏 图标(可选,对齐 web lucide Eye/EyeOff 视觉) =====

  /** 密码"显示"状态图标(眼睛睁开)。
   * 推荐 lucide-react-native 的 `<Eye />` 组件,与 web 端 lucide-react 同源视觉 100% 一致。
   * 不传则 fallback 到 emoji 👁(不推荐 — emoji 在 Windows 渲染为损坏图)。
   * 类型为 ReactNode 而非 ImageSource,以支持 SVG 组件(lucide-react-native 基于 react-native-svg)。 */
  eyeIconShow?: ReactNode
  /** 密码"隐藏"状态图标(眼睛闭起)。
   * 推荐 lucide-react-native 的 `<EyeOff />` 组件。 */
  eyeIconHide?: ReactNode

  // ===== 自动登录 + 历史账号(2026-09-04,对齐 web 密码登录功能) =====

  /** 自动登录勾选状态(password tab 协议行右侧复选框) */
  autoLogin?: boolean
  /** 自动登录勾选回调 */
  onAutoLoginChange?: (v: boolean) => void
  /** 账号登录历史(最新在前,最多 5;账号/邮箱/手机号输入框聚焦时展示下拉) */
  loginHistory?: string[]
  /** 删除单条历史账号(可选;下拉 X 按钮;未传则不渲染删除) */
  onRemoveLoginHistory?: (account: string) => void
  /** 清空全部历史账号(可选;下拉底部"清空";未传则不渲染清空) */
  onClearLoginHistory?: () => void
}

/** RegisterScreen props(表单屏) */
export interface RegisterScreenProps {
  t: TFunction
  account: string
  password: string
  confirmPassword: string
  loading: boolean
  error: string
  onAccountChange: (text: string) => void
  onPasswordChange: (text: string) => void
  onConfirmPasswordChange: (text: string) => void
  onRegister: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
  /** 是否显示协议同意行(默认 false,启用后需配合 agreed/onAgreedChange) */
  enableAgreement?: boolean
  /** 协议是否已勾选(仅 enableAgreement=true 时有意义) */
  agreed?: boolean
  /** 协议勾选状态变更回调 */
  onAgreedChange?: (v: boolean) => void
  /** 是否显示协议未勾选错误(提交失败时置 true) */
  showAgreeErr?: boolean
  /** 服务条款点击回调 */
  onOpenTerms?: () => void
  /** 隐私政策点击回调 */
  onOpenPrivacy?: () => void
}

/** 性别(0=保密,1=男,2=女) */
export type Gender = 0 | 1 | 2

/** 国家区号选项 */
export interface NationOption {
  id: number
  title: string
  content: string
}

/** ChangePhoneScreen props(表单屏,状态由 wrapper 管理) */
export interface ChangePhoneScreenProps {
  t: TFunction
  phoneNumber: string
  codeValue: string
  phoneHead: string
  nationShow: boolean
  codeMin: number
  sendCodeShow: boolean
  tip: string
  submitting: boolean
  nations: NationOption[]
  onPhoneChange: (text: string) => void
  onCodeChange: (text: string) => void
  onToggleNationShow: () => void
  onSelectNation: (nation: NationOption) => void
  onSendCode: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 银行卡数据 */
export interface BankCardItem {
  id: string
  number: string
  holder: string
  bankName: string
  isDefault: boolean
}

/** BankCardScreen props */
export interface BankCardScreenProps {
  t: TFunction
  items: BankCardItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 实名认证状态值 */
export type RealNameAuthStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

/** 实名认证数据 */
export interface RealNameAuthItem {
  status: RealNameAuthStatus
  name?: string
  idNumber?: string
  reason?: string
}

/** RealNameAuthScreen props */
export interface RealNameAuthScreenProps {
  t: TFunction
  status: RealNameAuthItem | null
  name: string
  idNumber: string
  loading: boolean
  submitting: boolean
  error: string
  onNameChange: (name: string) => void
  onIdNumberChange: (idNumber: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 安全设置数据 */
export interface SecuritySettingsItem {
  passwordEnabled: boolean
  biometricEnabled: boolean
  twoFactorEnabled: boolean
  loginAlert: boolean
}

/** SecuritySettingsScreen props */
export interface SecuritySettingsScreenProps {
  t: TFunction
  settings: SecuritySettingsItem | null
  loading: boolean
  error: string
  onToggle: (key: keyof SecuritySettingsItem, value: boolean) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 实名认证状态(字段对齐 mobile-rn IdentityVerifyScreen VerifyStatus) */
export type IdentityVerifyStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

/** IdentityVerifyScreen props(注入式:wrapper 保留 API 调用 + 状态管理) */
export interface IdentityVerifyScreenProps {
  t: TFunction
  status: IdentityVerifyStatus
  reason: string
  loading: boolean
  submitting: boolean
  error: string
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface AppPermissionScreenProps {
  t: TFunction
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface BusinessLicenseScreenProps {
  t: TFunction
  onBack: () => void
  title?: string
  imageSource: number | { uri: string }
  previewVisible: boolean
  onPreviewVisibleChange: (v: boolean) => void
  colorScheme?: 'light' | 'dark'
}

export interface ChangePwdScreenProps {
  t: TFunction
  onBack: () => void
  oldPwd: string
  newPwd: string
  confirmPwd: string
  showOld: boolean
  showNew: boolean
  showConfirm: boolean
  submitting: boolean
  onOldChange: (v: string) => void
  onNewChange: (v: string) => void
  onConfirmChange: (v: string) => void
  onToggleOld: () => void
  onToggleNew: () => void
  onToggleConfirm: () => void
  onSubmit: () => void
  colorScheme?: 'light' | 'dark'
}

/** 账号注销 Screen Props */
export interface AccountCancelScreenProps {
  t: TFunction
  phone: string
  confirmText: string
  smsCode: string
  countdown: number
  showConfirmModal: boolean
  confirmCountdown: number
  submitting: boolean
  onPhoneChange: (text: string) => void
  onConfirmTextChange: (text: string) => void
  onSmsCodeChange: (text: string) => void
  onSendSms: () => void
  onSubmit: () => void
  onCloseModal: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
