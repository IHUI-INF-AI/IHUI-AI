// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useUserStore } from '@/stores/user'
import {
  sendSmsCode,
  loginBySms,
  loginByPassword,
  sendEmailCode,
  loginByEmailCode,
} from '@/api'
import { getSsoLoginUrl } from '@/utils/sso'
import { useLoginForm, type LoginApiResult, type LoginUser } from '@ihui/shared/hooks'
import { credentialStorage } from '@/lib/credential-storage'
import type { UserInfo } from '@/utils/auth'
import PhoneAreaCodePicker from '@/components/PhoneAreaCodePicker'
import PasswordVisibilityToggle from '@/components/PasswordVisibilityToggle'
import LoginPopUp from '@/components/LoginPopUp'
import ThemeRoot from '@/components/ThemeRoot'
import './login.css'

/** 登录 tab(对齐 mobile-rn LoginScreen TABS:邮箱验证码/手机验证码/密码) */
type LoginTab = 'email' | 'phone' | 'password'
const LOGIN_TABS: readonly LoginTab[] = ['email', 'phone', 'password']

export default function Login() {
  const { t } = useI18n()
  const tt = useTt()
  const { setAuth } = useUserStore()
  const [loginType, setLoginType] = useState<LoginTab>('phone')

  // 视觉状态:区号 / 密码可见性 / 输入框聚焦 / 协议勾选
  const [phoneHead, setPhoneHead] = useState('+86')
  const [showPwd, setShowPwd] = useState(false)
  const [isPhoneFocused, setIsPhoneFocused] = useState(false)
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isEmailCodeFocused, setIsEmailCodeFocused] = useState(false)
  const [isPwdFocused, setIsPwdFocused] = useState(false)
  const [isAccountFocused, setIsAccountFocused] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [showAgreeErr, setShowAgreeErr] = useState(false)

  // 登录成功后的角色展示弹窗(可选增强,LoginPopUp)
  const [showLoginPopUp, setShowLoginPopUp] = useState(false)
  const [popupUser, setPopupUser] = useState<UserInfo | null>(null)

  // 内联错误提示(对齐 RN errorAlert)
  const [inlineError, setInlineError] = useState('')

  // ===== 短信验证码登录状态 =====
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSmsLogging, setIsSmsLogging] = useState(false)
  const [phoneCountdown, setPhoneCountdown] = useState(0)
  const phoneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ===== 邮箱验证码登录状态(对齐 RN email tab) =====
  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [emailLoading, setEmailLoading] = useState(false)
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phoneCodeBtnText = useMemo(
    () =>
      phoneCountdown > 0
        ? `${phoneCountdown}${tt('login.codeCountdownSuffix', '秒后重新获取')}`
        : t('login.getCode'),
    [phoneCountdown, tt, t],
  )
  const phoneCodeBtnDisabled = useMemo(
    () => phoneCountdown > 0 || phone.length !== 11,
    [phoneCountdown, phone],
  )

  const emailCodeBtnText = useMemo(
    () =>
      emailCountdown > 0
        ? `${emailCountdown}${tt('login.codeCountdownSuffix', '秒后重新获取')}`
        : t('login.getCode'),
    [emailCountdown, tt, t],
  )
  const emailCodeBtnDisabled = useMemo(
    () => emailCountdown > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [emailCountdown, email],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current)
      if (emailTimerRef.current) clearInterval(emailTimerRef.current)
    }
  }, [])

  // 协议校验(对齐 RN requireAgree:未勾选 → 阻止提交 + 显示红色提示)
  const requireAgree = useCallback((): boolean => {
    if (!isChecked) {
      setShowAgreeErr(true)
      return false
    }
    setShowAgreeErr(false)
    return true
  }, [isChecked])

  async function sendSms() {
    if (phoneCodeBtnDisabled) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: t('login.codeSent'), icon: 'success' })
      setPhoneCountdown(60)
      phoneTimerRef.current = setInterval(() => {
        setPhoneCountdown((prev) => {
          if (prev <= 1 && phoneTimerRef.current) {
            clearInterval(phoneTimerRef.current)
            phoneTimerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已由 request 统一提示
    }
  }

  async function sendEmail() {
    if (emailCodeBtnDisabled) return
    setEmailSending(true)
    try {
      await sendEmailCode(email)
      Taro.showToast({ title: t('login.codeSent'), icon: 'success' })
      setEmailCountdown(60)
      emailTimerRef.current = setInterval(() => {
        setEmailCountdown((prev) => {
          if (prev <= 1 && emailTimerRef.current) {
            clearInterval(emailTimerRef.current)
            emailTimerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已统一提示
    } finally {
      setEmailSending(false)
    }
  }

  // ===== 手机号验证码登录 =====
  async function handleSmsLogin() {
    if (isSmsLogging) return
    if (!requireAgree()) return
    if (phone.length !== 11) {
      Taro.showToast({ title: t('login.phoneInvalid'), icon: 'none' })
      return
    }
    setIsSmsLogging(true)
    try {
      const res = await loginBySms(phone, code)
      setAuth(res.accessToken, res.user, res.refreshToken)
      credentialStorage.saveLoginHistory(phone)
      setPopupUser(res.user ?? null)
      setShowLoginPopUp(true)
    } catch {
      // 错误已统一提示
    } finally {
      setIsSmsLogging(false)
    }
  }

  // ===== 邮箱验证码登录(对齐 RN /auth/login/email) =====
  async function handleEmailLogin() {
    if (emailLoading) return
    if (!requireAgree()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !emailCode) {
      Taro.showToast({ title: t('login.phoneInvalid'), icon: 'none' })
      return
    }
    setEmailLoading(true)
    try {
      const res = await loginByEmailCode(email, emailCode)
      setAuth(res.accessToken, res.user, res.refreshToken)
      credentialStorage.saveLoginHistory(email)
      setPopupUser(res.user ?? null)
      setShowLoginPopUp(true)
    } catch {
      // 错误已统一提示
    } finally {
      setEmailLoading(false)
    }
  }

  // ===== 密码登录:用 @ihui/shared useLoginForm 替代本地 useState + handleLogin =====
  const lastLoginUserRef = useRef<UserInfo | undefined>(undefined)

  const loginApi = useCallback(
    async (account: string, password: string): Promise<LoginApiResult> => {
      try {
        const res = await loginByPassword(account, password)
        lastLoginUserRef.current = res.user
        const user: LoginUser | undefined = res.user
          ? {
              id: String(res.user.id ?? ''),
              nickname: res.user.nickname ?? '',
              avatar: res.user.avatar,
            }
          : undefined
        return {
          success: true,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          user,
        }
      } catch {
        return { success: false, error: '' }
      }
    },
    [],
  )

  const handlePasswordLoginSuccess = useCallback(
    (accessToken: string, refreshToken: string, user?: LoginUser) => {
      const fullUser: UserInfo | undefined = lastLoginUserRef.current ?? user
      if (fullUser) {
        setAuth(accessToken, fullUser, refreshToken)
      }
    },
    [setAuth],
  )

  const handlePasswordSuccess = useCallback(() => {
    setPopupUser(lastLoginUserRef.current ?? null)
    setShowLoginPopUp(true)
  }, [])

  const form = useLoginForm({
    loginApi,
    storage: credentialStorage,
    onLoginSuccess: handlePasswordLoginSuccess,
    onSuccess: handlePasswordSuccess,
  })

  useEffect(() => {
    if (form.error) {
      setInlineError(translateError(form.error))
    }
  }, [form.error])

  function translateError(err: string | null): string {
    if (!err) return ''
    if (err.startsWith('auth.') || err.startsWith('login.')) {
      return t(err) !== err ? t(err) : ''
    }
    return err
  }

  const isLogging = loginType === 'phone' ? isSmsLogging : loginType === 'email' ? emailLoading : form.loading

  function handleLoginClick() {
    if (isLogging) return
    if (!requireAgree()) return
    if (loginType === 'phone') {
      void handleSmsLogin()
    } else if (loginType === 'email') {
      void handleEmailLogin()
    } else {
      void form.login()
    }
  }

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pages/about/protocol' : '/pages/about/privacy'
    Taro.navigateTo({ url })
  }

  function handleWechatLogin() {
    if (process.env.TARO_ENV === 'weapp' || process.env.TARO_ENV === 'alipay') {
      setIsSmsLogging(true)
      useUserStore
        .getState()
        .loginByMiniApp({ withProfile: false })
        .then(() => {
          Taro.showToast({ title: t('login.loginSuccess'), icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
        })
        .catch(() => {
          Taro.showToast({ title: t('login.wechatFailed'), icon: 'none' })
        })
        .finally(() => setIsSmsLogging(false))
    } else {
      // H5:走 SSO 网页授权(后端 wechat OAuth 链路)
      handleSsoLogin()
    }
  }

  function handleSsoLogin() {
    const redirectUri = 'ihui-miniapp://sso/callback'
    const ssoUrl = getSsoLoginUrl(redirectUri)
    const encoded = encodeURIComponent(ssoUrl)
    Taro.navigateTo({ url: `/pages/webview/index?url=${encoded}` })
  }

  // phone/email 输入框:绑定各自 state,password 模式绑定 form.account
  const accountValue = loginType === 'phone' ? phone : loginType === 'email' ? email : form.account
  const onAccountInput = (e: { detail: { value: string } }) => {
    const v = e.detail.value
    setInlineError('')
    if (loginType === 'phone') setPhone(v)
    else if (loginType === 'email') setEmail(v)
    else form.setAccount(v)
  }

  // ===== 历史账号下拉(账号/邮箱/手机号通用;对齐 RN HistoryDropdown) =====
  const historyList = useMemo(() => {
    const list = credentialStorage.loadLoginHistory()
    const current = loginType === 'phone' ? phone : loginType === 'email' ? email : form.account
    return list.filter((a) => a !== current && a.length > 0)
  }, [loginType, phone, email, form.account])
  const [historyOpen, setHistoryOpen] = useState(false)

  function removeHistory(account: string) {
    const next = credentialStorage.removeFromLoginHistory?.(account) ?? []
    void next
  }
  function clearHistory() {
    credentialStorage.clearLoginHistory?.()
  }

  // identityTypy 不在 UserInfo 类型中,用交叉类型 + typeof 守卫安全读取(禁 any)
  const popupUserExt = popupUser as (UserInfo & { identityTypy?: unknown }) | null
  const popupIdentityTypy =
    typeof popupUserExt?.identityTypy === 'number' ? popupUserExt.identityTypy : 0

  return (
    <ThemeRoot className="container-ali">
      <View className="login-page">
        {/* ===== 顶部:logo + 品牌(对齐 RN header) ===== */}
        <View className="login-header">
          <View className="login-logo-box">
            <Image className="login-logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
          </View>
          <Text className="login-welcome">{t('login.brand')}</Text>
        </View>

        {/* ===== 内联错误提示(对齐 RN errorAlert) ===== */}
        {inlineError ? (
          <View className="login-error-alert">
            <Image className="login-error-icon" src="/static/images/triangle-alert.svg" mode="aspectFit" />
            <Text className="login-error-text">{inlineError}</Text>
          </View>
        ) : null}

        {/* ===== 3 tab 切换(对齐 RN tabBar:分段控件) ===== */}
        <View className="login-tabbar">
          {LOGIN_TABS.map((tab) => {
            const active = tab === loginType
            const label =
              tab === 'email'
                ? tt('login.emailLogin', '邮箱登录')
                : tab === 'phone'
                  ? t('login.phoneLogin')
                  : t('login.passwordLogin')
            return (
              <View
                key={tab}
                className={`login-tab ${active ? 'login-tab-active' : ''}`}
                hoverClass="opacity-60"
                onClick={() => {
                  setLoginType(tab)
                  setShowAgreeErr(false)
                  setInlineError('')
                }}
              >
                <Text className={active ? 'login-tab-text-active' : ''}>{label}</Text>
              </View>
            )
          })}
        </View>

        {/* ===== 邮箱登录表单 ===== */}
        {loginType === 'email' ? (
          <View className="login-tabcontent">
            <View className="login-field">
              <Text className="login-label">{tt('login.email', '邮箱')}</Text>
              <View>
                <Input
                  className="login-input"
                  type="text"
                  placeholder={tt('login.emailPlaceholder', '请输入邮箱')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={email}
                  onInput={onAccountInput}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                />
                {historyOpen && isEmailFocused && historyList.length > 0 ? (
                  <HistoryDropdown
                    items={historyList}
                    onSelect={(v) => {
                      setEmail(v)
                      setHistoryOpen(false)
                    }}
                    onRemove={removeHistory}
                    onClear={clearHistory}
                    clearText={tt('login.clearHistory', '清空全部')}
                  />
                ) : null}
              </View>
            </View>
            <View className="login-field">
              <Text className="login-label">{tt('login.code', '验证码')}</Text>
              <View className="login-coderow">
                <Input
                  className="login-input login-code-input"
                  type="number"
                  maxlength={6}
                  placeholder={t('login.codePlaceholder')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={emailCode}
                  onInput={(e) => setEmailCode(e.detail.value)}
                  onFocus={() => setIsEmailCodeFocused(true)}
                  onBlur={() => setIsEmailCodeFocused(false)}
                />
                <View
                  className={`login-sendcode ${emailCodeBtnDisabled || emailSending ? 'login-sendcode-disabled' : ''}`}
                  hoverClass="opacity-60"
                  onClick={sendEmail}
                >
                  <Text>{emailSending ? tt('login.sending', '发送中…') : emailCodeBtnText}</Text>
                </View>
              </View>
            </View>

            <AgreementRow
              checked={isChecked}
              err={showAgreeErr}
              onChange={setIsChecked}
              onOpenTerms={() => openAgreement('user')}
              onOpenPrivacy={() => openAgreement('privacy')}
              tt={tt}
            />
            <PrimaryLoginButton onClick={() => void handleLoginClick()} loading={isLogging}>
              {isLogging ? t('login.logging') : t('login.login')}
            </PrimaryLoginButton>
          </View>
        ) : null}

        {/* ===== 手机号登录表单 ===== */}
        {loginType === 'phone' ? (
          <View className="login-tabcontent">
            <View className="login-field">
              <Text className="login-label">{tt('login.phone', '手机号')}</Text>
              <View className={`login-phone-row ${isPhoneFocused ? 'login-phone-row-focused' : ''}`}>
                <PhoneAreaCodePicker
                  value={phoneHead}
                  onChange={setPhoneHead}
                  focused={isPhoneFocused}
                />
                <Input
                  className="login-input login-phone-input"
                  type="number"
                  maxlength={11}
                  placeholder={t('login.phonePlaceholder')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={phone}
                  onInput={onAccountInput}
                  onFocus={() => {
                    setIsPhoneFocused(true)
                    setHistoryOpen(false)
                  }}
                  onBlur={() => setIsPhoneFocused(false)}
                />
              </View>
              {isPhoneFocused && historyList.length > 0 ? (
                <HistoryDropdown
                  items={historyList}
                  onSelect={(v) => {
                    setPhone(v.replace(/\D/g, '').slice(0, 11))
                    setHistoryOpen(false)
                  }}
                  onRemove={removeHistory}
                  onClear={clearHistory}
                  clearText={tt('login.clearHistory', '清空全部')}
                />
              ) : null}
            </View>
            <View className="login-field">
              <Text className="login-label">{tt('login.code', '验证码')}</Text>
              <View className="login-coderow">
                <Input
                  className="login-input login-code-input"
                  type="number"
                  maxlength={6}
                  placeholder={t('login.codePlaceholder')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={code}
                  onInput={(e) => setCode(e.detail.value)}
                  onFocus={() => setIsCodeFocused(true)}
                  onBlur={() => setIsCodeFocused(false)}
                />
                <View
                  className={`login-sendcode ${phoneCodeBtnDisabled ? 'login-sendcode-disabled' : ''}`}
                  hoverClass="opacity-60"
                  onClick={sendSms}
                >
                  <Text>{phoneCodeBtnText}</Text>
                </View>
              </View>
            </View>

            <AgreementRow
              checked={isChecked}
              err={showAgreeErr}
              onChange={setIsChecked}
              onOpenTerms={() => openAgreement('user')}
              onOpenPrivacy={() => openAgreement('privacy')}
              tt={tt}
            />
            <PrimaryLoginButton onClick={() => void handleLoginClick()} loading={isLogging}>
              {isLogging ? t('login.logging') : t('login.login')}
            </PrimaryLoginButton>
          </View>
        ) : null}

        {/* ===== 账号密码登录表单 ===== */}
        {loginType === 'password' ? (
          <View className="login-tabcontent">
            <View className="login-field">
              <Text className="login-label">{tt('login.account', '账号')}</Text>
              <View>
                <Input
                  className="login-input"
                  type="text"
                  placeholder={tt('login.accountPlaceholder', '手机号 / 邮箱 / 账号')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={form.account}
                  onInput={(e) => {
                    form.setAccount(e.detail.value)
                    setInlineError('')
                  }}
                  onFocus={() => {
                    setIsAccountFocused(true)
                    setHistoryOpen(true)
                  }}
                  onBlur={() => setIsAccountFocused(false)}
                />
                {historyOpen && historyList.length > 0 ? (
                  <HistoryDropdown
                    items={historyList}
                    onSelect={(v) => {
                      form.setAccount(v)
                      setHistoryOpen(false)
                    }}
                    onRemove={removeHistory}
                    onClear={clearHistory}
                    clearText={tt('login.clearHistory', '清空全部')}
                  />
                ) : null}
              </View>
            </View>
            <View className="login-field">
              <View className="login-label-row">
                <Text className="login-label">{t('login.phone')}</Text>
                <Text
                  className="login-forgot"
                  onClick={() => Taro.navigateTo({ url: '/pages/forgot-password/index' })}
                >
                  {t('login.forgotPassword')}
                </Text>
              </View>
              <View className="login-password-row">
                <Input
                  className="login-input login-password-input"
                  password={!showPwd}
                  placeholder={t('login.passwordPlaceholder')}
                  placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                  value={form.password}
                  onInput={(e) => form.setPassword(e.detail.value)}
                  onFocus={() => setIsPwdFocused(true)}
                  onBlur={() => setIsPwdFocused(false)}
                />
                <PasswordVisibilityToggle visible={showPwd} onToggle={() => setShowPwd((v) => !v)} />
              </View>
            </View>

            <AgreementRow
              checked={isChecked}
              err={showAgreeErr}
              onChange={setIsChecked}
              onOpenTerms={() => openAgreement('user')}
              onOpenPrivacy={() => openAgreement('privacy')}
              tt={tt}
              rightNode={
                <View className="login-autologin" hoverClass="opacity-60" onClick={() => form.setAutoLogin(!form.autoLogin)}>
                  <View
                    className={`custom-checkbox ${form.autoLogin ? 'custom-checkbox-checked' : ''}`}
                  >
                    {form.autoLogin ? <Text className="custom-checkmark">✓</Text> : null}
                  </View>
                  <Text className="login-autologin-text">{tt('login.autoLogin', '自动登录')}</Text>
                </View>
              }
            />
            <PrimaryLoginButton onClick={() => void handleLoginClick()} loading={isLogging}>
              {isLogging ? t('login.logging') : t('login.login')}
            </PrimaryLoginButton>
          </View>
        ) : null}

        {/* ===== 第三方登录区:微信主推按钮 + "或" + 图标网格(对齐 RN) ===== */}
        <View className="login-thirdparty">
          <View className="login-wechat-btn" hoverClass="opacity-60" onClick={handleWechatLogin}>
            <Image className="login-wechat-icon" src="/static/images/wx.svg" mode="aspectFit" />
            <Text>{t('login.wechatLogin')}</Text>
          </View>

          <View className="login-divider">
            <View className="login-divider-line" />
            <Text className="login-divider-text">{tt('login.or', '或')}</Text>
            <View className="login-divider-line" />
          </View>

          <View className="login-oauth-grid">
            <View className="login-oauth-btn" hoverClass="opacity-60" onClick={handleSsoLogin}>
              <Image className="login-oauth-icon" src="/static/images/google.svg" mode="aspectFit" />
            </View>
          </View>
        </View>

        {/* ===== SSO 按钮(弱化,轮廓样式;对齐 RN ssoBtn) ===== */}
        <View className="login-sso-btn" hoverClass="opacity-60" onClick={handleSsoLogin}>
          <Text>{tt('login.ssoLoginTitle', '智汇AI网页授权登录')}</Text>
        </View>

        {/* ===== 注册链接(对齐 RN registerRow) ===== */}
        <View className="login-register-row">
          <Text className="login-register-text">{tt('login.noAccount', '没有账号?')}</Text>
          <Text
            className="login-register-link"
            onClick={() => Taro.navigateTo({ url: '/pages/register/index' })}
          >
            {tt('login.registerNow', '立即注册')}
          </Text>
        </View>
      </View>

      {/* 登录后角色展示弹窗(可选增强) */}
      <LoginPopUp
        visible={showLoginPopUp}
        userInfo={{
          nickname: popupUser?.nickname || popupUser?.userName || '',
          avatar: popupUser?.avatar || '',
          isVip: popupUser?.isVip ? 1 : 0,
          identityTypy: popupIdentityTypy,
        }}
        onClose={() => {
          setShowLoginPopUp(false)
          Taro.reLaunch({ url: '/pages/index/index' })
        }}
        onUpgrade={() => {
          setShowLoginPopUp(false)
          Taro.navigateTo({ url: '/pages/vip/index' })
        }}
      />
    </ThemeRoot>
  )
}

/* ===== 协议同意行(对齐 RN AgreementRow:16×16 checkbox + 链接) ===== */
function AgreementRow({
  checked,
  err,
  onChange,
  onOpenTerms,
  onOpenPrivacy,
  tt,
  rightNode,
}: {
  checked: boolean
  err: boolean
  onChange: (v: boolean) => void
  onOpenTerms: () => void
  onOpenPrivacy: () => void
  tt: (k: string, fb: string) => string
  rightNode?: ReactNode
}) {
  return (
    <View className="login-agreement">
      <View className="login-agreement-main">
        <View
          className={`custom-checkbox ${err && !checked ? 'custom-checkbox-error' : ''} ${checked ? 'custom-checkbox-checked' : ''}`}
          hoverClass="opacity-60"
          onClick={() => onChange(!checked)}
        >
          {checked ? <Text className="custom-checkmark">✓</Text> : null}
        </View>
        <Text className="login-agreement-text">
          {tt('login.agreePrefix', '我已阅读并同意')}
          <Text className="textItem" onClick={onOpenTerms}>
            {tt('login.termsOfService', '《用户协议》')}
          </Text>
          {tt('login.and', '和')}
          <Text className="textItem" onClick={onOpenPrivacy}>
            {tt('login.privacyPolicy', '《隐私政策》')}
          </Text>
        </Text>
        {rightNode ? <View className="login-agreement-right">{rightNode}</View> : null}
      </View>
      {err && !checked ? (
        <Text className="login-agreement-error">{tt('login.agreeRequired', '请先阅读并同意服务协议和隐私政策')}</Text>
      ) : null}
    </View>
  )
}

/* ===== 主登录按钮(对齐 RN PrimaryLoginButton:橙底圆角) ===== */
function PrimaryLoginButton({
  children,
  onClick,
  loading,
}: {
  children: ReactNode
  onClick: () => void
  loading: boolean
}) {
  return (
    <View className={`login-primary-btn ${loading ? 'login-btn-disabled' : ''}`} hoverClass="opacity-60" onClick={loading ? undefined : onClick}>
      <Text className="login-primary-btn-text">{children}</Text>
    </View>
  )
}

/* ===== 历史账号下拉(对齐 RN HistoryDropdown) ===== */
function HistoryDropdown({
  items,
  onSelect,
  onRemove,
  onClear,
  clearText,
}: {
  items: string[]
  onSelect: (v: string) => void
  onRemove: (v: string) => void
  onClear: () => void
  clearText: string
}) {
  return (
    <View className="login-history-dropdown">
      {items.map((acc) => (
        <View key={acc} className="login-history-item">
          <Text className="login-history-item-main" onClick={() => onSelect(acc)} numberOfLines={1}>
            {acc}
          </Text>
          <Text className="login-history-item-del" onClick={() => onRemove(acc)}>
            ×
          </Text>
        </View>
      ))}
      {onClear ? (
        <View className="login-history-clear" hoverClass="opacity-60" onClick={onClear}>
          <Text>{clearText}</Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
