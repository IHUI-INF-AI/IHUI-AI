import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Platform, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Eye, EyeOff } from 'lucide-react-native'
import { SvgXml } from 'react-native-svg'
import {
  loginByAccount,
  loginByEmailCode,
  loginBySms,
  sendEmailCode,
  sendSmsCode,
  type AuthUser,
} from '@ihui/api-client'
import { useLoginForm, type LoginApiResult } from '@ihui/shared/hooks'
import { LoginScreen as SharedLoginScreen, getTokens } from '@ihui/rn-app'
import type {
  LoginTab,
  QrPlatformOption,
  ThirdPartyLoginOption,
  ThirdPartyPlatform,
} from '@ihui/types'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { WEB_BASE_URL } from '../lib/config'
import { credentialStorage } from '../lib/credential-storage'
import { exchangeSsoCode, extractSsoCode, openSsoLogin } from '../lib/sso'
import { rnAuthStore } from '../stores/auth-store'

// 顶层类型导入(用于 navigation 类型推断)
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * mobile-rn 登录页(2026-07-30 重构:4-tab + 协议同意 + 第三方登录区 + 忘记密码 + 注册链接)
 *
 * 本次升级:
 * - 复用 @ihui/rn-app.SharedLoginScreen(完整 4-tab 共享组件)
 * - 注入 4 tab:email/phone/password(去掉 qr,移动端扫码体验差,统一走账号体系)
 * - email/phone 验证码登录:本地 state 管理 + 调 @ihui/api-client 新增的 loginByEmailCode
 *   + 现有 loginBySms / sendEmailCode / sendSmsCode 方法
 * - 第三方登录区:8 平台配置(wechat/google/github/feishu/dingtalk/enterpriseWechat/alipay/apple),
 *   apple forceDisabled(对齐 web use-third-party-config)
 * - 协议同意:onAgreedChange + onOpenTerms(onNavigate('Agreement')) + onOpenPrivacy(navigate('Privacy'))
 * - 忘记密码:Alert 提示"请联系管理员或前往网页端自助重置"(无 ForgotPasswordScreen)
 * - 注册链接:navigate('Register')
 * - 保留现有 SSO 跳转链路(复用 useLoginForm.ssoLogin + lib/sso)
 *
 * 之前版本(2026-07-29)只传 account/password/ssoLogin/logoSource,渲染为单一 password tab,
 * 不符合"完美细致完整毫无遗漏对齐 web 端"要求。本次完整注入 4-tab + 第三方 + 协议 + 链接。
 */

// ===== 资源注入 =====

// logo 图片(对齐 web AuthShell /images/logo.png)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SOURCE = require('../../assets/images/logo.png')

// welcome 品牌文字图(对齐 web AuthShell /images/welcome.svg + /images/baiwelcome.svg)
// 像素艺术 "IHUI INF.AI" 文字,浅色主题用黑字(welcome),深色主题用白字(baiwelcome)
// 用 SvgXml 渲染(RN <Image> 不支持 SVG),尺寸 447×67 等比缩放到 width 280
const WELCOME_SVG_LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" version="1.1" width="447" height="67" viewBox="0 0 447 67"><g><g><path d="M301.75,53L301.75,40.5L306.75,40.5L306.75,53L301.75,53ZM311.75,53L311.75,40.5L316.75,40.5L316.75,45.5L319.25,45.5L319.25,40.5L324.25,40.5L324.25,53L319.25,53L319.25,48L316.75,48L316.75,53L311.75,53ZM331.75,53L331.75,50.5L329.25,50.5L329.25,40.5L334.25,40.5L334.25,50.5L336.75,50.5L336.75,40.5L341.75,40.5L341.75,50.5L339.25,50.5L339.25,53L331.75,53ZM346.75,53L346.75,40.5L351.75,40.5L351.75,53L346.75,53ZM366.75,53L366.75,40.5L371.75,40.5L371.75,53L366.75,53ZM376.75,53L376.75,40.5L381.75,40.5L381.75,43L384.25,43L384.25,45.5L386.75,45.5L386.75,40.5L391.75,40.5L391.75,53L386.75,53L386.75,50.5L384.25,50.5L384.25,48L381.75,48L381.75,53L376.75,53ZM396.75,53L396.75,40.5L406.75,40.5L406.75,43L401.75,43L401.75,45.5L406.75,45.5L406.75,48L401.75,48L401.75,53L396.75,53ZM411.75,53L411.75,50.5L416.75,50.5L416.75,53L411.75,53ZM421.75,53L421.75,43L424.25,43L424.25,40.5L431.75,40.5L431.75,43L434.25,43L434.25,53L429.25,53L429.25,48L426.75,48L426.75,53L421.75,53ZM426.75,45.5L429.25,45.5L429.25,43.1L426.75,43.1L426.75,45.5ZM439.25,53L439.25,40.5L444.25,40.5L444.25,53L439.25,53Z" fill="#8D83FF" fill-opacity="1"/></g><g><path d="M13.75,55L13.75,48.125L6.875,48.125L6.875,20.625L13.75,20.625L13.75,48.125L20.625,48.125L20.625,55L13.75,55ZM34.375,48.125L34.375,20.625L41.25,20.625L41.25,48.125L34.375,48.125ZM27.5,55L27.5,48.125L20.625,48.125L20.625,27.5L27.5,27.5L27.5,48.125L34.375,48.125L34.375,55L27.5,55ZM55,55L55,20.625L75.625,20.625L75.625,27.5L61.875,27.5L61.875,34.375L75.625,34.375L75.625,41.25L61.875,41.25L61.875,48.125L75.625,48.125L75.625,55L55,55ZM89.375,55L89.375,20.625L96.25,20.625L96.25,48.125L110,48.125L110,55L89.375,55ZM144.375,34.375L144.375,27.5L130.625,27.5L130.625,20.625L144.375,20.625L144.375,27.5L151.25,27.5L151.25,34.375L144.375,34.375ZM130.625,55L130.625,48.125L123.75,48.125L123.75,27.5L130.625,27.5L130.625,48.125L144.375,48.125L144.375,55L130.625,55ZM144.375,48.125L144.375,41.25L151.25,41.25L151.25,48.125L144.375,48.125ZM171.875,55L171.875,48.125L165,48.125L165,27.5L171.875,27.5L171.875,20.625L185.625,20.625L185.625,27.5L192.5,27.5L192.5,48.125L185.625,48.125L185.625,55L171.875,55ZM171.875,47.849998L185.625,47.849998L185.625,27.775L171.875,27.775L171.875,47.849998ZM206.25,55L206.25,20.625L213.125,20.625L213.125,27.5L220,27.5L220,34.375L226.875,34.375L226.875,41.25L220,41.25L220,34.375L213.125,34.375L213.125,55L206.25,55ZM233.75,55L233.75,34.375L226.875,34.375L226.875,27.5L233.75,27.5L233.75,20.625L240.625,20.625L240.625,55L233.75,55ZM254.375,55L254.375,20.625L275,20.625L275,27.5L261.25,27.5L261.25,34.375L275,34.375L275,41.25L261.25,41.25L261.25,48.125L275,48.125L275,55L254.375,55Z" fill="#000000" fill-opacity="1"/></g></g></svg>`
const WELCOME_SVG_DARK = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" version="1.1" width="447" height="67" viewBox="0 0 447 67"><defs><clipPath id="master_svg0_2003_34410"><rect x="0" y="0" width="447" height="67" rx="0"/></clipPath></defs><g clip-path="url(#master_svg0_2003_34410)"><g><path d="M301.75,53L301.75,40.5L306.75,40.5L306.75,53L301.75,53ZM311.75,53L311.75,40.5L316.75,40.5L316.75,45.5L319.25,45.5L319.25,40.5L324.25,40.5L324.25,53L319.25,53L319.25,48L316.75,48L316.75,53L311.75,53ZM331.75,53L331.75,50.5L329.25,50.5L329.25,40.5L334.25,40.5L334.25,50.5L336.75,50.5L336.75,40.5L341.75,40.5L341.75,50.5L339.25,50.5L339.25,53L331.75,53ZM346.75,53L346.75,40.5L351.75,40.5L351.75,53L346.75,53ZM366.75,53L366.75,40.5L371.75,40.5L371.75,53L366.75,53ZM376.75,53L376.75,40.5L381.75,40.5L381.75,43L384.25,43L384.25,45.5L386.75,45.5L386.75,40.5L391.75,40.5L391.75,53L386.75,53L386.75,50.5L384.25,50.5L384.25,48L381.75,48L381.75,53L376.75,53ZM396.75,53L396.75,40.5L406.75,40.5L406.75,43L401.75,43L401.75,45.5L406.75,45.5L406.75,48L401.75,48L401.75,53L396.75,53ZM411.75,53L411.75,50.5L416.75,50.5L416.75,53L411.75,53ZM421.75,53L421.75,43L424.25,43L424.25,40.5L431.75,40.5L431.75,43L434.25,43L434.25,53L429.25,53L429.25,48L426.75,48L426.75,53L421.75,53ZM426.75,45.5L429.25,45.5L429.25,43.1L426.75,43.1L426.75,45.5ZM439.25,53L439.25,40.5L444.25,40.5L444.25,53L439.25,53Z" fill="#8D83FF" fill-opacity="1"/></g><g><path d="M13.75,55L13.75,48.125L6.875,48.125L6.875,20.625L13.75,20.625L13.75,48.125L20.625,48.125L20.625,55L13.75,55ZM34.375,48.125L34.375,20.625L41.25,20.625L41.25,48.125L34.375,48.125ZM27.5,55L27.5,48.125L20.625,48.125L20.625,27.5L27.5,27.5L27.5,48.125L34.375,48.125L34.375,55L27.5,55ZM55,55L55,20.625L75.625,20.625L75.625,27.5L61.875,27.5L61.875,34.375L75.625,34.375L75.625,41.25L61.875,41.25L61.875,48.125L75.625,48.125L75.625,55L55,55ZM89.375,55L89.375,20.625L96.25,20.625L96.25,48.125L110,48.125L110,55L89.375,55ZM144.375,34.375L144.375,27.5L130.625,27.5L130.625,20.625L144.375,20.625L144.375,27.5L151.25,27.5L151.25,34.375L144.375,34.375ZM130.625,55L130.625,48.125L123.75,48.125L123.75,27.5L130.625,27.5L130.625,48.125L144.375,48.125L144.375,55L130.625,55ZM144.375,48.125L144.375,41.25L151.25,41.25L151.25,48.125L144.375,48.125ZM171.875,55L171.875,48.125L165,48.125L165,27.5L171.875,27.5L171.875,20.625L185.625,20.625L185.625,27.5L192.5,27.5L192.5,48.125L185.625,48.125L185.625,55L171.875,55ZM171.875,47.849998L185.625,47.849998L185.625,27.775L171.875,27.775L171.875,47.849998ZM206.25,55L206.25,20.625L213.125,20.625L213.125,27.5L220,27.5L220,34.375L226.875,34.375L226.875,41.25L220,41.25L220,34.375L213.125,34.375L213.125,55L206.25,55ZM233.75,55L233.75,34.375L226.875,34.375L226.875,27.5L233.75,27.5L233.75,20.625L240.625,20.625L240.625,55L233.75,55ZM254.375,55L254.375,20.625L275,20.625L275,27.5L261.25,27.5L261.25,34.375L275,34.375L275,41.25L261.25,41.25L261.25,48.125L275,48.125L275,55L254.375,55Z" fill="#FFFFFF" fill-opacity="1"/></g></g></svg>`

// 第三方登录图标资源(8 平台)
// 使用 require() 加载静态资源:Metro 默认将 .svg/.png 视为 asset(require 返回 number),
// 共享 LoginScreen 组件通过 <Image source={number} /> 渲染(iOS 原生支持 SVG;Android
// 依赖 RN Image 解码能力)。不使用 react-native-svg-transformer —— 它会把 SVG 转为
// React 组件(非 number),与共享组件 <Image source={...} /> 不兼容,且 iconSource
// 类型契约为 number | { uri: string }(packages/types/src/app.ts),无法接受组件。
/* eslint-disable @typescript-eslint/no-require-imports */
// Partial<'app'> 平台是本站 App 扫码登录,共享组件 fallback 到首字母,不需要图标资源
const THIRD_PARTY_ICONS: Partial<Record<ThirdPartyPlatform, number>> = {
  wechat: require('../../assets/images/common/wx.svg'),
  google: require('../../assets/images/common/google.svg'),
  github: require('../../assets/images/common/github.svg'),
  feishu: require('../../assets/images/common/feishu.png'),
  dingtalk: require('../../assets/images/dingtalk.svg'),
  enterpriseWechat: require('../../assets/images/enterprise-wechat.svg'),
  alipay: require('../../assets/images/common/ZFB.svg'),
  apple: require('../../assets/images/common/apple.svg'),
}
/* eslint-enable @typescript-eslint/no-require-imports */

// 扫码登录平台配置(4 平台:微信/企微/钉钉/飞书,对齐 web 端 qr-tab 平台切换)
// 2026-08-04 新增:RN 端无法直接加载各厂商 SDK(WxLogin/WwLogin/DTFrameLogin/QRLogin 依赖 DOM),
// 共享 QrTabContent 渲染平台切换 tab + 二维码占位 + "打开网页扫码"按钮(Linking.openURL 跳 web)。
// webUrl 拼接 WEB_BASE_URL + web 端相对路径,RN Linking 需要完整 URL。
const QR_PLATFORMS: QrPlatformOption[] = [
  {
    key: 'wechat',
    label: '微信',
    iconSource: THIRD_PARTY_ICONS.wechat,
    brandColor: '#07C160',
    webUrl: `${WEB_BASE_URL}/login?method=qr&platform=wechat`,
  },
  {
    key: 'enterpriseWechat',
    label: '企业微信',
    iconSource: THIRD_PARTY_ICONS.enterpriseWechat,
    brandColor: '#2DC100',
    webUrl: `${WEB_BASE_URL}/login?method=qr&platform=enterpriseWechat`,
  },
  {
    key: 'dingtalk',
    label: '钉钉',
    iconSource: THIRD_PARTY_ICONS.dingtalk,
    brandColor: '#0089FF',
    webUrl: `${WEB_BASE_URL}/login?method=qr&platform=dingtalk`,
  },
  {
    key: 'feishu',
    label: '飞书',
    iconSource: THIRD_PARTY_ICONS.feishu,
    brandColor: '#3370FF',
    webUrl: `${WEB_BASE_URL}/login?method=qr&platform=feishu`,
  },
]

// 第三方登录配置:按平台 + locale 动态生成(2026-08-04 用户需求)
// - 国内版(zh-*):安卓 = 微信/飞书/钉钉/企微(4个);iOS = 微信/飞书/钉钉/企微/苹果(5个,苹果为主排首位)
// - 国际版(en/ko/ja):Google/GitHub(2个)
// - alipay 全平台不显示(移动端支付场景走原生 SDK,不在登录页展示)
// 判定逻辑:locale 以 'zh' 开头 = 国内版,其余 = 国际版
function isInternationalLocale(locale: string): boolean {
  return !locale.toLowerCase().startsWith('zh')
}

function buildThirdPartyOptions(locale: string): ThirdPartyLoginOption[] {
  const isIOS = Platform.OS === 'ios'
  const isInternational = isInternationalLocale(locale)

  if (isInternational) {
    // 国际版:Google + GitHub
    return [
      {
        platform: 'google',
        label: 'Google',
        iconSource: THIRD_PARTY_ICONS.google,
        enabled: true,
        brandColor: '#4285F4',
      },
      {
        platform: 'github',
        label: 'GitHub',
        iconSource: THIRD_PARTY_ICONS.github,
        enabled: true,
        brandColor: '#181717',
      },
    ]
  }

  // 国内版:iOS 苹果为主排首位,其余平台按 微信/飞书/钉钉/企微 顺序
  const domesticOptions: ThirdPartyLoginOption[] = [
    {
      platform: 'wechat',
      label: '微信',
      iconSource: THIRD_PARTY_ICONS.wechat,
      enabled: true,
      brandColor: '#07C160',
    },
    {
      platform: 'feishu',
      label: '飞书',
      iconSource: THIRD_PARTY_ICONS.feishu,
      enabled: true,
      brandColor: '#3370FF',
    },
    {
      platform: 'dingtalk',
      label: '钉钉',
      iconSource: THIRD_PARTY_ICONS.dingtalk,
      enabled: true,
      brandColor: '#0089FF',
    },
    {
      platform: 'enterpriseWechat',
      label: '企业微信',
      iconSource: THIRD_PARTY_ICONS.enterpriseWechat,
      enabled: true,
      brandColor: '#2DC100',
    },
  ]

  if (isIOS) {
    // iOS 国内版:苹果为主排首位
    return [
      {
        platform: 'apple',
        label: 'Apple',
        iconSource: THIRD_PARTY_ICONS.apple,
        enabled: true,
        brandColor: '#000000',
      },
      ...domesticOptions,
    ]
  }

  // 安卓国内版:微信/飞书/钉钉/企微
  return domesticOptions
}

// 启用的 tab 列表(4 tab 完整版:邮箱/验证码/密码/扫码)
// qr tab:显示二维码供其他设备扫码登录(平板/另一台手机扫当前设备)
const TABS: readonly LoginTab[] = ['email', 'phone', 'password', 'qr']

// 验证码倒计时秒数(对齐 web 60s)
const CODE_COUNTDOWN_SECONDS = 60

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>

export function LoginScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<LoginNavigationProp>()
  const fullUserRef = useRef<AuthUser | null>(null)

  // 第三方登录方式:按平台 + locale 动态生成
  // 国内安卓:微信/飞书/钉钉/企微(4);国内 iOS:苹果为主 + 微信/飞书/钉钉/企微(5);国际版:Google/GitHub(2)
  const thirdPartyOptions = useMemo(() => buildThirdPartyOptions(locale), [locale])

  // ===== 账号密码登录 + SSO(复用共享 hook) =====
  const form = useLoginForm({
    loginApi: async (account, password): Promise<LoginApiResult> => {
      const res = await loginByAccount(account, password)
      if (res.success) {
        const user = res.data.user
        fullUserRef.current = user
        return {
          success: true,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          user: {
            id: user.id,
            nickname: user.nickname ?? user.username ?? '',
            avatar: user.avatar,
          },
        }
      }
      return { success: false, error: res.error }
    },
    storage: credentialStorage,
    onLoginSuccess: async (accessToken, refreshToken) => {
      const user = fullUserRef.current
      if (user) {
        await rnAuthStore.getState().setAuth({ token: accessToken, refreshToken, user })
      }
      fullUserRef.current = null
    },
    ssoLogin: async (): Promise<LoginApiResult> => {
      const redirectUrl = await openSsoLogin()
      if (!redirectUrl) return { success: false, error: '用户取消授权' }
      const code = extractSsoCode(redirectUrl)
      if (!code) return { success: false, error: 'SSO 回跳未包含 code' }
      const data = await exchangeSsoCode(code)
      if (!data) return { success: false, error: 'SSO 换取 token 失败' }
      fullUserRef.current = data.user
      return {
        success: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          nickname: data.user.nickname,
          avatar: data.user.avatar,
        },
      }
    },
  })

  // ===== email tab 本地 state =====
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSending, setEmailCodeSending] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [emailLoading, setEmailLoading] = useState(false)

  // ===== phone tab 本地 state =====
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCodeSending, setPhoneCodeSending] = useState(false)
  const [phoneCountdown, setPhoneCountdown] = useState(0)
  const [phoneLoading, setPhoneLoading] = useState(false)

  // ===== 协议同意 state =====
  const [agreed, setAgreed] = useState(false)
  const [agreementError, setAgreementError] = useState('')

  // ===== 第三方登录 loading 平台标识 =====
  const [thirdPartyLoadingPlatform, setThirdPartyLoadingPlatform] =
    useState<ThirdPartyPlatform | null>(null)

  // ===== 倒计时 effect(60s 邮箱/短信验证码) =====
  useEffect(() => {
    if (emailCountdown <= 0) return
    const timer = setInterval(() => {
      setEmailCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [emailCountdown])

  useEffect(() => {
    if (phoneCountdown <= 0) return
    const timer = setInterval(() => {
      setPhoneCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [phoneCountdown])

  // ===== 共用:检查协议同意 =====
  const checkAgreement = useCallback((): boolean => {
    if (!agreed) {
      setAgreementError(t('auth.agreeRequired'))
      return false
    }
    setAgreementError('')
    return true
  }, [agreed, t])

  // ===== email 验证码登录回调 =====
  const handleSendEmailCode = useCallback(async () => {
    if (!email.trim()) {
      form.setError('auth.invalidEmail')
      return
    }
    setEmailCodeSending(true)
    form.clearError()
    try {
      const res = await sendEmailCode(email.trim())
      if (res.success) {
        setEmailCountdown(CODE_COUNTDOWN_SECONDS)
      } else {
        form.setError(res.error ?? 'auth.loginFailed')
      }
    } catch {
      form.setError('auth.loginFailed')
    } finally {
      setEmailCodeSending(false)
    }
  }, [email, form])

  const handleLoginByEmailCode = useCallback(async () => {
    if (!checkAgreement()) return
    if (!email.trim() || !emailCode.trim()) {
      form.setError('auth.invalidCredentials')
      return
    }
    setEmailLoading(true)
    form.clearError()
    try {
      const res = await loginByEmailCode(email.trim(), emailCode.trim())
      if (res.success && res.data.accessToken) {
        fullUserRef.current = res.data.user
        await rnAuthStore.getState().setAuth({
          token: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          user: res.data.user,
        })
      } else {
        form.setError(res.error ?? 'auth.loginFailed')
      }
    } catch {
      form.setError('auth.loginFailed')
    } finally {
      setEmailLoading(false)
    }
  }, [email, emailCode, checkAgreement, form])

  // ===== phone 验证码登录回调 =====
  const handleSendPhoneCode = useCallback(async () => {
    if (!phone.trim()) {
      form.setError('auth.invalidPhone')
      return
    }
    setPhoneCodeSending(true)
    form.clearError()
    try {
      const res = await sendSmsCode(phone.trim())
      if (res.success) {
        setPhoneCountdown(CODE_COUNTDOWN_SECONDS)
      } else {
        form.setError(res.error ?? 'auth.loginFailed')
      }
    } catch {
      form.setError('auth.loginFailed')
    } finally {
      setPhoneCodeSending(false)
    }
  }, [phone, form])

  const handleLoginByPhoneCode = useCallback(async () => {
    if (!checkAgreement()) return
    if (!phone.trim() || !phoneCode.trim()) {
      form.setError('auth.invalidCredentials')
      return
    }
    setPhoneLoading(true)
    form.clearError()
    try {
      const res = await loginBySms(phone.trim(), phoneCode.trim())
      if (res.success && res.data.accessToken) {
        fullUserRef.current = res.data.user
        await rnAuthStore.getState().setAuth({
          token: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          user: res.data.user,
        })
      } else {
        form.setError(res.error ?? 'auth.loginFailed')
      }
    } catch {
      form.setError('auth.loginFailed')
    } finally {
      setPhoneLoading(false)
    }
  }, [phone, phoneCode, checkAgreement, form])

  // ===== password 登录回调(注入协议检查) =====
  const handlePasswordLogin = useCallback(async () => {
    if (!checkAgreement()) return
    await form.login()
  }, [checkAgreement, form])

  // ===== 第三方登录回调 =====
  // 移动端未集成各平台原生 SDK,统一提示用户使用网页端登录(对齐 sso.ts 跳转策略)
  // 后续可扩展:用 expo-web-browser.openAuthSessionAsync 跳 OAuth flow
  const handleThirdPartyLogin = useCallback(
    (platform: ThirdPartyPlatform) => {
      const option = thirdPartyOptions.find((o) => o.platform === platform)
      if (!option || !option.enabled || option.forceDisabled) {
        Alert.alert(
          t('auth.thirdPartyLogin'),
          option?.disabledHint ?? t('auth.googleNotConfigured'),
        )
        return
      }
      setThirdPartyLoadingPlatform(platform)
      // 当前 mobile-rn 暂未集成各平台原生 SDK,统一引导走 SSO 跳 web
      Alert.alert(
        t('auth.thirdPartyLogin'),
        `${option.label} 登录请使用网页端,移动端暂未集成原生 SDK。\n您也可以使用"使用其他方式登录"按钮跳转网页端授权。`,
        [
          { text: '取消', onPress: () => setThirdPartyLoadingPlatform(null), style: 'cancel' },
          {
            text: '前往网页端',
            onPress: () => {
              setThirdPartyLoadingPlatform(null)
              void form.ssoLoginAction()
            },
          },
        ],
      )
    },
    [t, form, thirdPartyOptions],
  )

  // ===== 协议同意回调 =====
  const handleAgreedChange = useCallback((next: boolean) => {
    setAgreed(next)
    if (next) setAgreementError('')
  }, [])

  const handleOpenTerms = useCallback(() => {
    navigation.navigate('Agreement')
  }, [navigation])

  const handleOpenPrivacy = useCallback(() => {
    navigation.navigate('Privacy')
  }, [navigation])

  // ===== 忘记密码回调 =====
  // mobile-rn 无 ForgotPasswordScreen,提示用户走网页端或联系管理员
  const handleForgotPassword = useCallback(() => {
    Alert.alert(
      t('auth.forgotPassword'),
      '移动端暂未提供找回密码功能,您可以通过以下方式重置密码:\n\n1. 联系管理员重置\n2. 前往 IHUI AI 网页端自助重置',
      [{ text: '我知道了' }],
    )
  }, [t])

  // ===== 注册回调 =====
  const handleRegister = useCallback(() => {
    navigation.navigate('Register')
  }, [navigation])

  // hook 的 error 为 i18n key(auth.*)时走 t() 翻译,后端错误消息原样透传
  const translateError = (err: string | null): string => {
    if (!err) return ''
    if (err.startsWith('auth.')) return t(err)
    return err
  }

  // 合并 loading 状态(任意 tab 登录中均禁用切换)
  const unifiedLoading = form.loading || emailLoading || phoneLoading

  // 密码眼睛图标颜色(对齐 web text-muted-foreground,根据主题动态切换)
  // 使用 lucide-react-native 的 Eye/EyeOff 组件,与 web 端 lucide-react 同源视觉 100% 一致
  const eyeIconColor = getTokens(resolvedTheme).text.secondary

  // welcome 品牌文字图(对齐 web AuthShell welcome.svg/baiwelcome.svg)
  // 浅色主题用黑字,深色主题用白字;SvgXml 渲染,width 280 等比缩放(447×67 → 280×42)
  const welcomeXml = resolvedTheme === 'dark' ? WELCOME_SVG_DARK : WELCOME_SVG_LIGHT

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <SharedLoginScreen
          t={t}
          // 基础字段
          account={form.account}
          password={form.password}
          loading={unifiedLoading}
          ssoLoading={form.ssoLoading}
          error={translateError(form.error)}
          onAccountChange={form.setAccount}
          onPasswordChange={form.setPassword}
          onLogin={handlePasswordLogin}
          onSsoLogin={form.ssoLoginAction}
          colorScheme={resolvedTheme}
          logoSource={LOGO_SOURCE}
          // welcome 品牌文字图(对齐 web AuthShell,替代纯文字 "IHUI AI")
          welcomeNode={<SvgXml xml={welcomeXml} width={280} height={42} />}
          // 4-tab 配置
          tabs={TABS}
          defaultTab="password"
          // email tab
          email={email}
          emailCode={emailCode}
          emailCodeSending={emailCodeSending}
          emailCountdown={emailCountdown}
          onEmailChange={setEmail}
          onEmailCodeChange={setEmailCode}
          onSendEmailCode={handleSendEmailCode}
          onLoginByEmailCode={handleLoginByEmailCode}
          // phone tab
          phone={phone}
          phoneCode={phoneCode}
          phoneCodeSending={phoneCodeSending}
          phoneCountdown={phoneCountdown}
          onPhoneChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 11))}
          onPhoneCodeChange={(v) => setPhoneCode(v.replace(/\D/g, '').slice(0, 6))}
          onSendPhoneCode={handleSendPhoneCode}
          onLoginByPhoneCode={handleLoginByPhoneCode}
          // 第三方登录区(按平台 + locale 动态生成)
          thirdPartyOptions={thirdPartyOptions}
          onThirdPartyLogin={handleThirdPartyLogin}
          thirdPartyLoadingPlatform={thirdPartyLoadingPlatform}
          // 协议同意
          agreed={agreed}
          onAgreedChange={handleAgreedChange}
          onOpenTerms={handleOpenTerms}
          onOpenPrivacy={handleOpenPrivacy}
          agreementError={agreementError}
          // 忘记密码 + 注册
          onForgotPassword={handleForgotPassword}
          onRegister={handleRegister}
          // 密码显示/隐藏图标(对齐 web lucide Eye/EyeOff,解决 emoji 在 Windows 渲染损坏)
          eyeIconShow={<Eye size={18} color={eyeIconColor} />}
          eyeIconHide={<EyeOff size={18} color={eyeIconColor} />}
          // 扫码登录平台切换(4 平台:微信/企微/钉钉/飞书)
          qrPlatforms={QR_PLATFORMS}
          qrConfig={{ status: 'idle' }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
})
