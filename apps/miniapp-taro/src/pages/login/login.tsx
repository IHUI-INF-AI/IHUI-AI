import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useUserStore } from '@/stores/user'
import { sendSmsCode, loginBySms, loginByPassword } from '@/api'
import { getSsoLoginUrl } from '@/utils/sso'
import { useI18n } from '@/i18n'
import { useLoginForm, type LoginApiResult, type LoginUser } from '@ihui/shared/hooks'
import { credentialStorage } from '@/lib/credential-storage'
import type { UserInfo } from '@/utils/auth'

export default function Login() {
  const { t } = useI18n()
  const { setAuth } = useUserStore()
  const [loginType, setLoginType] = useState<'phone' | 'password'>('phone')

  // ===== 短信验证码登录状态(保持现状,未接入 useLoginForm) =====
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSmsLogging, setIsSmsLogging] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const codeBtnText = useMemo(
    () => (countdown > 0 ? `${countdown}s` : t('login.getCode')),
    [countdown, t],
  )
  const codeBtnDisabled = useMemo(() => countdown > 0 || phone.length !== 11, [countdown, phone])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function sendCode() {
    if (codeBtnDisabled) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: t('login.codeSent'), icon: 'success' })
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1 && timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已由 request 统一提示
    }
  }

  // ===== 短信验证码登录(逻辑保持不变,仅从原 handleLogin 拆出 phone 分支) =====
  async function handleSmsLogin() {
    if (isSmsLogging) return
    if (phone.length !== 11) {
      Taro.showToast({ title: t('login.phoneInvalid'), icon: 'none' })
      return
    }
    setIsSmsLogging(true)
    try {
      const res = await loginBySms(phone, code)
      setAuth(res.accessToken, res.user, res.refreshToken)
      Taro.showToast({ title: t('login.loginSuccess'), icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
    } catch {
      // 错误已统一提示
    } finally {
      setIsSmsLogging(false)
    }
  }

  // ===== 密码登录:用 @ihui/shared useLoginForm 替代本地 useState + handleLogin =====
  // loginByPassword 返回完整 UserInfo(含 phone/uuid/roleId 等扩展字段),
  // 通过 ref 暂存,onLoginSuccess 时优先使用完整 UserInfo 而非 hook 精简版 LoginUser。
  const lastLoginUserRef = useRef<UserInfo | undefined>(undefined)

  const loginApi = useCallback(async (account: string, password: string): Promise<LoginApiResult> => {
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
      // 错误已由 request 统一提示,返回空 error 避免重复 toast
      return { success: false, error: '' }
    }
  }, [])

  const handlePasswordLoginSuccess = useCallback(
    (accessToken: string, refreshToken: string, user?: LoginUser) => {
      // 优先使用 API 返回的完整 UserInfo(含 phone/uuid/roleId 等扩展字段)
      const fullUser: UserInfo | undefined = lastLoginUserRef.current ?? user
      if (fullUser) {
        setAuth(accessToken, fullUser, refreshToken)
      }
    },
    [setAuth],
  )

  const handlePasswordSuccess = useCallback(() => {
    Taro.showToast({ title: t('login.loginSuccess'), icon: 'success' })
    setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
  }, [t])

  const form = useLoginForm({
    loginApi,
    storage: credentialStorage,
    onLoginSuccess: handlePasswordLoginSuccess,
    onSuccess: handlePasswordSuccess,
  })

  // 密码登录本地校验错误(auth.invalidAccount / auth.invalidPassword)以 toast 提示
  useEffect(() => {
    if (form.error) {
      Taro.showToast({ title: t(form.error), icon: 'none' })
    }
  }, [form.error, t])

  // 登录按钮 loading 状态:phone 模式用短信登录 loading,password 模式用 form.loading
  const isLogging = loginType === 'phone' ? isSmsLogging : form.loading

  function handleLoginClick() {
    if (isLogging) return
    if (loginType === 'phone') {
      void handleSmsLogin()
    } else {
      void form.login()
    }
  }

  function handleWechatLogin() {
    // 跨端小程序登录:微信用 Taro.login,支付宝用 Taro.getAuthCode(由 miniAppLogin 自动适配)
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
      Taro.showToast({ title: t('login.wechatOnly'), icon: 'none' })
    }
  }

  /**
   * SSO 登录:跳 webview 加载 /sso/login?redirect=...
   * 用户在 web 端登录后,生成 sso_code 回跳小程序(通过 webview postMessage
   * 或在 redirect URL 里用 ihui-miniapp:// scheme 触发小程序回跳)。
   *
   * 简化实现:打开 webview 让用户登录,登录态会自动通过 web cookie 持久化,
   * 小程序下次启动时(如果 web cookie 共享)可直接调 /sso/redirect 拿 code。
   * 当前实现采用最简方案:webview 展示 SSO 登录页,登录成功后提示用户手动返回。
   * 真正的 code 回传需要 webview postMessage 或 scheme 跳转,留待联调时补完。
   */
  function handleSsoLogin() {
    // 小程序回调地址(用 webview 站内跳转协议)
    const redirectUri = 'ihui-miniapp://sso/callback'
    const ssoUrl = getSsoLoginUrl(redirectUri)
    const encoded = encodeURIComponent(ssoUrl)
    Taro.navigateTo({ url: `/pages/webview/index?url=${encoded}` })
  }

  // phone 输入框:phone 模式绑定本地 state,password 模式绑定 form.account
  const accountValue = loginType === 'phone' ? phone : form.account
  const onAccountInput = (e: { detail: { value: string } }) =>
    loginType === 'phone' ? setPhone(e.detail.value) : form.setAccount(e.detail.value)

  return (
    <View className="min-h-screen px-[48rpx] bg-card">
      <View className="pt-[160rpx] pb-[80rpx] text-center">
        <Text className="text-[56rpx] font-bold text-primary">{t('login.brand')}</Text>
        <Text className="block mt-[16rpx] text-[26rpx] text-muted-foreground">
          {t('login.slogan')}
        </Text>
      </View>

      <View className="flex mb-[48rpx] bg-muted rounded-md">
        <View
          className={`flex-1 text-center py-[20rpx] text-[30rpx] rounded-md ${
            loginType === 'phone' ? 'text-primary font-semibold bg-card' : 'text-muted-foreground'
          }`}
          onClick={() => setLoginType('phone')}
        >
          <Text>{t('login.phoneLogin')}</Text>
        </View>
        <View
          className={`flex-1 text-center py-[20rpx] text-[30rpx] rounded-md ${
            loginType === 'password'
              ? 'text-primary font-semibold bg-card'
              : 'text-muted-foreground'
          }`}
          onClick={() => setLoginType('password')}
        >
          <Text>{t('login.passwordLogin')}</Text>
        </View>
      </View>

      <View className="flex items-center h-[96rpx] mb-[32rpx] border border-solid border-[var(--color-border)] rounded-md px-[24rpx]">
        <Input
          className="flex-1 h-[96rpx] text-[30rpx]"
          type="number"
          maxlength={11}
          placeholder={t('login.phonePlaceholder')}
          value={accountValue}
          onInput={onAccountInput}
        />
      </View>

      {loginType === 'phone' ? (
        <View className="flex items-center h-[96rpx] mb-[32rpx] border border-solid border-[var(--color-border)] rounded-md px-[24rpx]">
          <Input
            className="flex-1 h-[96rpx] text-[30rpx]"
            type="number"
            maxlength={6}
            placeholder={t('login.codePlaceholder')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            className={`px-[20rpx] text-[26rpx] ${codeBtnDisabled ? 'text-muted-foreground' : 'text-primary'}`}
            onClick={sendCode}
          >
            <Text>{codeBtnText}</Text>
          </View>
        </View>
      ) : null}

      {loginType === 'password' ? (
        <View className="flex items-center h-[96rpx] mb-[32rpx] border border-solid border-[var(--color-border)] rounded-md px-[24rpx]">
          <Input
            className="flex-1 h-[96rpx] text-[30rpx]"
            password
            placeholder={t('login.passwordPlaceholder')}
            value={form.password}
            onInput={(e) => form.setPassword(e.detail.value)}
          />
        </View>
      ) : null}

      {loginType === 'password' ? (
        <View
          className="mb-[24rpx] text-right text-[26rpx] text-primary"
          onClick={() => Taro.navigateTo({ url: '/pages/forgot-password/index' })}
        >
          <Text>{t('login.forgotPassword')}</Text>
        </View>
      ) : null}

      <View
        className={`h-[96rpx] mt-[24rpx] rounded-[48rpx] flex items-center justify-center text-white text-[32rpx] bg-primary ${
          isLogging ? 'opacity-60' : ''
        }`}
        onClick={handleLoginClick}
      >
        <Text>{isLogging ? t('login.logging') : t('login.login')}</Text>
      </View>

      <View
        className="mt-[48rpx] text-center text-[28rpx] text-primary"
        onClick={handleWechatLogin}
      >
        <Text>{t('login.wechatLogin')}</Text>
      </View>

      <View
        className="mt-[48rpx] text-center text-[26rpx] text-muted-foreground pt-[32rpx]"
        onClick={handleSsoLogin}
      >
        <Text>{t('login.ssoLogin')}</Text>
        <Text className="block mt-[8rpx] text-[22rpx] text-muted-foreground">
          {t('login.ssoLoginHint')}
        </Text>
      </View>

      <View className="mt-[60rpx] text-center text-[22rpx] text-muted-foreground">
        <Text>{t('login.agreement')}</Text>
      </View>
    </View>
  )
}
