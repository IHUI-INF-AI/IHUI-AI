import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useUserStore } from '@/stores/user'
import { sendSmsCode, loginBySms, loginByPassword, loginByWechat } from '@/api'
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
      setAuth(res.token, res.user)
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
            setAuth(data.token, data.user)
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

  return (
    <View className="min-h-screen px-[24px] bg-white">
      <View className="pt-[80px] pb-[40px] text-center">
        <Text className="text-[28px] font-bold text-[#07c160]">{t('login.brand')}</Text>
        <Text className="block mt-[8px] text-[13px] text-[#999]">{t('login.slogan')}</Text>
      </View>

      <View className="flex mb-[24px]">
        <View
          className={`flex-1 text-center py-[10px] text-[15px] border-b-[2px] border-solid ${
            loginType === 'phone'
              ? 'text-[#07c160] font-semibold border-[#07c160]'
              : 'text-[#999] border-transparent'
          }`}
          onClick={() => setLoginType('phone')}
        >
          <Text>{t('login.phoneLogin')}</Text>
        </View>
        <View
          className={`flex-1 text-center py-[10px] text-[15px] border-b-[2px] border-solid ${
            loginType === 'password'
              ? 'text-[#07c160] font-semibold border-[#07c160]'
              : 'text-[#999] border-transparent'
          }`}
          onClick={() => setLoginType('password')}
        >
          <Text>{t('login.passwordLogin')}</Text>
        </View>
      </View>

      <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
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
        <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            type="number"
            maxlength={6}
            placeholder={t('login.codePlaceholder')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            className={`px-[10px] text-[13px] ${codeBtnDisabled ? 'text-[#ccc]' : 'text-[#07c160]'}`}
            onClick={sendCode}
          >
            <Text>{codeBtnText}</Text>
          </View>
        </View>
      ) : null}

      {loginType === 'password' ? (
        <View className="flex items-center h-[48px] mb-[16px] border-b-[1px] border-solid border-[#eee]">
          <Input
            className="flex-1 h-[48px] text-[15px]"
            password
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>
      ) : null}

      <View
        className={`h-[48px] mt-[12px] rounded-[24px] flex items-center justify-center text-white text-[16px] bg-[#07c160] ${
          isLogging ? 'opacity-60' : ''
        }`}
        onClick={handleLogin}
      >
        <Text>{isLogging ? t('login.logging') : t('login.login')}</Text>
      </View>

      <View
        className="mt-[24px] text-center text-[14px] text-[#07c160]"
        onClick={handleWechatLogin}
      >
        <Text>{t('login.wechatLogin')}</Text>
      </View>

      <View className="mt-[30px] text-center text-[11px] text-[#999]">
        <Text>{t('login.agreement')}</Text>
      </View>
    </View>
  )
}
