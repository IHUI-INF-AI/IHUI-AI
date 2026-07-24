import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useUserStore } from '@/stores/user'
import { sendSmsCode, loginBySms, loginByPassword, loginByWechat } from '@/api'
import { getSsoLoginUrl } from '@/utils/sso'
import { useI18n } from '@/i18n'

export default function Login() {
  const { t } = useI18n()
  const { setAuth } = useUserStore()
  const [loginType, setLoginType] = useState<'phone' | 'password'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [isLogging, setIsLogging] = useState(false)
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

  async function handleLogin() {
    if (isLogging) return
    if (phone.length !== 11) {
      Taro.showToast({ title: t('login.phoneInvalid'), icon: 'none' })
      return
    }
    setIsLogging(true)
    try {
      const res =
        loginType === 'phone'
          ? await loginBySms(phone, code)
          : await loginByPassword(phone, password)
      setAuth(res.accessToken, res.user, res.refreshToken)
      Taro.showToast({ title: t('login.loginSuccess'), icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
    } catch {
      // 错误已统一提示
    } finally {
      setIsLogging(false)
    }
  }

  function handleWechatLogin() {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.login({
        success: async (res) => {
          try {
            const data = await loginByWechat(res.code)
            setAuth(data.accessToken, data.user, data.refreshToken)
            Taro.reLaunch({ url: '/pages/index/index' })
          } catch {
            Taro.showToast({ title: t('login.wechatFailed'), icon: 'none' })
          }
        },
      })
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

  return (
    <View className="min-h-screen px-[24px] bg-card">
      <View className="pt-[80px] pb-[40px] text-center">
        <Text className="text-[28px] font-bold text-primary">{t('login.brand')}</Text>
        <Text className="block mt-[8px] text-[13px] text-muted-foreground">{t('login.slogan')}</Text>
      </View>

      <View className="flex mb-[24px] bg-muted rounded-md">
        <View
          className={`flex-1 text-center py-[10px] text-[15px] rounded-md ${
            loginType === 'phone'
              ? 'text-primary font-semibold bg-card'
              : 'text-muted-foreground'
          }`}
          onClick={() => setLoginType('phone')}
        >
          <Text>{t('login.phoneLogin')}</Text>
        </View>
        <View
          className={`flex-1 text-center py-[10px] text-[15px] rounded-md ${
            loginType === 'password'
              ? 'text-primary font-semibold bg-card'
              : 'text-muted-foreground'
          }`}
          onClick={() => setLoginType('password')}
        >
          <Text>{t('login.passwordLogin')}</Text>
        </View>
      </View>

      <View className="flex items-center h-[48px] mb-[16px] border border-solid border-[var(--color-border)] rounded-md px-[12px]">
        <Input
          className="flex-1 h-[48px] text-[15px]"
          type="number"
          maxlength={11}
          placeholder={t('login.phonePlaceholder')}
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />
      </View>

      {loginType === 'phone' ? (
        <View className="flex items-center h-[48px] mb-[16px] border border-solid border-[var(--color-border)] rounded-md px-[12px]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            type="number"
            maxlength={6}
            placeholder={t('login.codePlaceholder')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            className={`px-[10px] text-[13px] ${codeBtnDisabled ? 'text-muted-foreground' : 'text-primary'}`}
            onClick={sendCode}
          >
            <Text>{codeBtnText}</Text>
          </View>
        </View>
      ) : null}

      {loginType === 'password' ? (
        <View className="flex items-center h-[48px] mb-[16px] border border-solid border-[var(--color-border)] rounded-md px-[12px]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            password
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>
      ) : null}

      {loginType === 'password' ? (
        <View
          className="mb-[12px] text-right text-[13px] text-primary"
          onClick={() => Taro.navigateTo({ url: '/pages/forgot-password/index' })}
        >
          <Text>{t('login.forgotPassword')}</Text>
        </View>
      ) : null}

      <View
        className={`h-[48px] mt-[12px] rounded-[24px] flex items-center justify-center text-white text-[16px] bg-primary ${
          isLogging ? 'opacity-60' : ''
        }`}
        onClick={handleLogin}
      >
        <Text>{isLogging ? t('login.logging') : t('login.login')}</Text>
      </View>

      <View
        className="mt-[24px] text-center text-[14px] text-primary"
        onClick={handleWechatLogin}
      >
        <Text>{t('login.wechatLogin')}</Text>
      </View>

      <View
        className="mt-[24px] text-center text-[13px] text-muted-foreground pt-[16px]"
        onClick={handleSsoLogin}
      >
        <Text>{t('login.ssoLogin')}</Text>
        <Text className="block mt-[4px] text-[11px] text-muted-foreground">{t('login.ssoLoginHint')}</Text>
      </View>

      <View className="mt-[30px] text-center text-[11px] text-muted-foreground">
        <Text>{t('login.agreement')}</Text>
      </View>
    </View>
  )
}
