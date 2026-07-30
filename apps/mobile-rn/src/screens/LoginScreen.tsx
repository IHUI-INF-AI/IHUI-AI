import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  loginByAccount,
  loginByEmailCode,
  loginBySms,
  sendEmailCode,
  sendSmsCode,
  type AuthUser,
} from '@ihui/api-client'
import { useLoginForm, type LoginApiResult } from '@ihui/shared/hooks'
import { LoginScreen as SharedLoginScreen } from '@ihui/rn-app'
import type { LoginTab, ThirdPartyLoginOption, ThirdPartyPlatform } from '@ihui/types'
import { Toolbar } from '../components/Toolbar'
import { useI18n, type Locale } from '../i18n'
import { useTheme } from '../context/ThemeContext'
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

// 第三方登录图标资源(8 平台)
// 使用 require() 加载静态资源:Metro 默认将 .svg/.png 视为 asset(require 返回 number),
// 共享 LoginScreen 组件通过 <Image source={number} /> 渲染(iOS 原生支持 SVG;Android
// 依赖 RN Image 解码能力)。不使用 react-native-svg-transformer —— 它会把 SVG 转为
// React 组件(非 number),与共享组件 <Image source={...} /> 不兼容,且 iconSource
// 类型契约为 number | { uri: string }(packages/types/src/app.ts),无法接受组件。
/* eslint-disable @typescript-eslint/no-require-imports */
const THIRD_PARTY_ICONS: Record<ThirdPartyPlatform, number> = {
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

// 第三方登录配置(对齐 web use-third-party-config.tsx PROVIDER_DEFS,8 平台)
// apple forceDisabled = true(对齐 web "Apple 登录即将上线")
// iconSource 未传时共享 LoginScreen 自动 fallback 到平台首字母(圆形按钮 + 居中字母)
const THIRD_PARTY_OPTIONS: ThirdPartyLoginOption[] = [
  {
    platform: 'wechat',
    label: '微信',
    iconSource: THIRD_PARTY_ICONS.wechat,
    enabled: true,
    brandColor: '#07C160',
  },
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
  {
    platform: 'alipay',
    label: '支付宝',
    iconSource: THIRD_PARTY_ICONS.alipay,
    enabled: true,
    brandColor: '#1677FF',
  },
  {
    platform: 'apple',
    label: 'Apple',
    iconSource: THIRD_PARTY_ICONS.apple,
    enabled: false,
    forceDisabled: true,
    disabledHint: 'Apple 登录即将上线',
    brandColor: '#000000',
  },
]

// 启用的 tab 列表(移动端去掉 qr tab,扫码体验差)
const TABS: readonly LoginTab[] = ['email', 'phone', 'password']

// 验证码倒计时秒数(对齐 web 60s)
const CODE_COUNTDOWN_SECONDS = 60

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>

export function LoginScreen() {
  const { t, locale, setLocale } = useI18n()
  const { resolvedTheme, setThemeMode } = useTheme()
  const navigation = useNavigation<LoginNavigationProp>()
  const fullUserRef = useRef<AuthUser | null>(null)

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
      const option = THIRD_PARTY_OPTIONS.find((o) => o.platform === platform)
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
        `${option.label} 登录请使用网页端,移动端暂未集成原生 SDK。\n您也可以使用"使用网页账号登录"按钮跳转网页端授权。`,
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
    [t, form],
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

  // ===== Toolbar 工具条(主题切换 + 语言切换 + 帮助) =====
  // theme:在 light/dark 间 toggle(忽略 system,登录页用显式切换更直观)
  // lang:循环切换 5 个 locale(zh-CN → en → ja → ko → zh-TW → zh-CN),Alert 确认
  const LOCALE_CYCLE: readonly Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
  const LOCALE_ICON: Record<Locale, string> = {
    'zh-CN': '中',
    en: 'EN',
    ja: '日',
    ko: '한',
    'zh-TW': '繁',
  }
  const toolbarItems = useMemo(
    () => [
      {
        key: 'theme',
        icon: resolvedTheme === 'dark' ? '☀' : '🌙',
        active: resolvedTheme === 'dark',
        onPress: () => {
          setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')
        },
      },
      {
        key: 'lang',
        icon: LOCALE_ICON[locale],
        onPress: () => {
          const idx = LOCALE_CYCLE.indexOf(locale)
          const safeIdx = idx < 0 ? 0 : idx
          const next = LOCALE_CYCLE[(safeIdx + 1) % LOCALE_CYCLE.length]
          if (next) void setLocale(next)
        },
      },
      {
        key: 'help',
        icon: '?',
        onPress: () => {
          Alert.alert(t('auth.helpTitle'), t('auth.helpBody'))
        },
      },
    ],
    [resolvedTheme, setThemeMode, locale, setLocale, t],
  )

  return (
    <View style={styles.container}>
      <View style={styles.toolbarWrap}>
        <Toolbar items={toolbarItems} separators={['lang']} style={styles.toolbar} />
      </View>
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
          // 第三方登录区
          thirdPartyOptions={THIRD_PARTY_OPTIONS}
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
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbarWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  toolbar: {
    alignSelf: 'flex-end',
  },
  body: {
    flex: 1,
  },
})
