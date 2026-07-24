import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useRef, useEffect, useCallback } from 'react'
import { register, sendSmsCode } from '@/api'
import { useI18n } from '@/i18n'

export default function RegisterIndex() {
  const { t } = useI18n()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const onSendCode = useCallback(async () => {
    if (countdown > 0) return
    if (!phone.trim()) {
      Taro.showToast({ title: tt('register.enterPhone', '请输入手机号'), icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: tt('register.phoneInvalid', '请输入正确的手机号'), icon: 'none' })
      return
    }
    try {
      await sendSmsCode(phone.trim())
      Taro.showToast({ title: tt('register.codeSent', '验证码已发送'), icon: 'success' })
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {
      // ignore
    }
  }, [phone, countdown, tt])

  const onSubmit = useCallback(async () => {
    if (!phone.trim() || !code.trim() || !password.trim()) {
      Taro.showToast({ title: tt('register.incomplete', '请填写完整信息'), icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: tt('register.phoneInvalid', '请输入正确的手机号'), icon: 'none' })
      return
    }
    if (password.length < 6 || password.length > 20) {
      Taro.showToast({ title: tt('register.pwdLength', '密码长度 6-20 位'), icon: 'none' })
      return
    }
    if (!agree) {
      Taro.showToast({ title: tt('register.agreeFirst', '请先阅读并同意用户协议'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await register({ phone: phone.trim(), code: code.trim(), password })
      Taro.showToast({ title: tt('register.success', '注册成功'), icon: 'success' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/login' }), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [phone, code, password, agree, tt])

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pages/about/protocol' : '/pages/about/privacy'
    Taro.navigateTo({
      url,
      fail: () => Taro.showToast({ title: tt('register.pageMissing', '页面未注册'), icon: 'none' }),
    })
  }

  function toLogin() {
    Taro.redirectTo({ url: '/pages/login/login' })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="py-[20rpx] px-[30rpx] bg-card">
        <Text className="text-[36rpx] font-bold text-foreground">
          {tt('register.title', '注册账号')}
        </Text>
      </View>
      <View className="p-[20rpx]">
        <View className="bg-card rounded-[12rpx] p-[24rpx] mb-[16rpx]">
          <Text className="block text-[28rpx] text-foreground font-medium mb-[16rpx]">
            {tt('register.phone', '手机号')}
          </Text>
          <Input
            className="h-[72rpx] bg-background rounded-[8rpx] px-[20rpx] text-[28rpx]"
            type="number"
            maxlength={11}
            placeholder={tt('register.phonePlaceholder', '请输入手机号')}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className="bg-card rounded-[12rpx] p-[24rpx] mb-[16rpx] relative">
          <Text className="block text-[28rpx] text-foreground font-medium mb-[16rpx]">
            {tt('register.code', '验证码')}
          </Text>
          <Input
            className="h-[72rpx] bg-background rounded-[8rpx] px-[20rpx] text-[28rpx] pr-[200rpx]"
            type="number"
            maxlength={6}
            placeholder={tt('register.codePlaceholder', '请输入验证码')}
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Text
            className={`absolute right-[40rpx] bottom-[40rpx] text-[26rpx] ${countdown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
            onClick={onSendCode}
          >
            {countdown > 0 ? `${countdown}s` : tt('register.getCode', '获取验证码')}
          </Text>
        </View>
        <View className="bg-card rounded-[12rpx] p-[24rpx] mb-[16rpx]">
          <Text className="block text-[28rpx] text-foreground font-medium mb-[16rpx]">
            {tt('register.password', '密码')}
          </Text>
          <View className="relative">
            <Input
              className="h-[72rpx] bg-background rounded-[8rpx] px-[20rpx] text-[28rpx] pr-[120rpx]"
              password={!showPwd}
              maxlength={20}
              placeholder={tt('register.passwordPlaceholder', '请设置密码')}
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
            <Text
              className="absolute right-[20rpx] top-1/2 -translate-y-1/2 text-[24rpx] text-primary"
              onClick={() => setShowPwd((v) => !v)}
            >
              {showPwd ? tt('register.hide', '隐藏') : tt('register.show', '显示')}
            </Text>
          </View>
          <Text className="block mt-[12rpx] text-[22rpx] text-muted-foreground">
            {tt('register.pwdHint', '6-20 位,建议字母数字组合')}
          </Text>
        </View>
        <View
          className={`w-full bg-primary text-foreground text-[30rpx] rounded-[8rpx] mt-[20rpx] py-[24rpx] text-center ${submitting ? 'opacity-60' : ''}`}
          onClick={onSubmit}
        >
          <Text>
            {submitting ? tt('register.submitting', '注册中…') : tt('register.submit', '注册')}
          </Text>
        </View>
        <View className="flex items-start mt-[24rpx] px-[8rpx]">
          <View className="py-[4rpx] pr-[12rpx]" onClick={() => setAgree((v) => !v)}>
            <View
              className={`w-[32rpx] h-[32rpx] border-[2rpx] rounded-[6rpx] bg-card flex items-center justify-center ${agree ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
            >
              {agree ? <Text className="text-foreground text-[22rpx] leading-none">✓</Text> : null}
            </View>
          </View>
          <Text className="flex-1 text-[24rpx] text-muted-foreground leading-[1.5]">
            {tt('register.agreePrefix', '我已阅读并同意')}
            <Text className="text-primary" onClick={() => openAgreement('user')}>
              {tt('register.userAgreement', '《用户协议》')}
            </Text>
            <Text className="text-primary" onClick={() => openAgreement('privacy')}>
              {tt('register.privacyPolicy', '《隐私协议》')}
            </Text>
          </Text>
        </View>
        <View className="flex items-center justify-center mt-[30rpx] text-[26rpx]">
          <Text className="text-muted-foreground">{tt('register.hasAccount', '已有账号?')}</Text>
          <Text className="text-primary ml-[8rpx]" onClick={toLogin}>
            {tt('register.toLogin', '去登录')}
          </Text>
        </View>
      </View>
    </View>
  )
}
