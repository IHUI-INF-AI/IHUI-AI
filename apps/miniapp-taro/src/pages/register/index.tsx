import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { register, sendSmsCode } from '@/api'
import { useI18n } from '@/i18n'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'

export default function RegisterIndex() {
  const { t } = useI18n()
  const [showPwd, setShowPwd] = useState(false)

  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  // 用 @ihui/shared useRegisterForm 替代本地 useState + onSendCode + onSubmit
  // type='phone' + enableCode + enableAgreement + 无确认密码字段,密码长度限制 6-20
  const form = useRegisterForm({
    type: 'phone',
    enableCode: true,
    enableConfirmPassword: false,
    enableAgreement: true,
    maxPasswordLength: 20,
    phoneRegex: /^1\d{10}$/,
    registerApi: async (v: RegisterFormValues): Promise<RegisterApiResult> => {
      try {
        await register({ phone: v.phone.trim(), code: v.code.trim(), password: v.password })
        return { success: true }
      } catch {
        // 错误已由 request 统一提示,返回空 error 避免重复 toast
        return { success: false, error: '' }
      }
    },
    sendCodeApi: async (v: RegisterFormValues): Promise<SendCodeApiResult> => {
      try {
        await sendSmsCode(v.phone.trim())
        return { success: true }
      } catch {
        return { success: false, error: '' }
      }
    },
    onSuccess: () => {
      setTimeout(() => Taro.redirectTo({ url: '/pages/login/login' }), 800)
    },
  })

  // hook 校验/调用错误以 toast 提示(与 login.tsx 适配模式一致)
  useEffect(() => {
    if (form.error) {
      Taro.showToast({ title: t(form.error), icon: 'none' })
    }
  }, [form.error, t])

  // hook 成功提示(注册成功 / 验证码已发送)以 success toast 显示
  useEffect(() => {
    if (form.info) {
      Taro.showToast({ title: t(form.info), icon: 'success' })
    }
  }, [form.info, t])

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
            value={form.values.phone}
            onInput={(e) => form.setPhone(e.detail.value)}
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
            value={form.values.code}
            onInput={(e) => form.setCode(e.detail.value)}
          />
          <Text
            className={`absolute right-[40rpx] bottom-[40rpx] text-[26rpx] ${form.countdown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
            onClick={form.sendCode}
          >
            {form.countdown > 0 ? `${form.countdown}s` : tt('register.getCode', '获取验证码')}
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
              value={form.values.password}
              onInput={(e) => form.setPassword(e.detail.value)}
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
          className={`w-full bg-primary text-foreground text-[30rpx] rounded-[8rpx] mt-[20rpx] py-[24rpx] text-center ${form.submitting ? 'opacity-60' : ''}`}
          onClick={form.register}
        >
          <Text>
            {form.submitting ? tt('register.submitting', '注册中…') : tt('register.submit', '注册')}
          </Text>
        </View>
        <View className="flex items-start mt-[24rpx] px-[8rpx]">
          <View className="py-[4rpx] pr-[12rpx]" onClick={() => form.setAgreed(!form.agreed)}>
            <View
              className={`w-[32rpx] h-[32rpx] border-[2rpx] rounded-[6rpx] bg-card flex items-center justify-center ${form.agreed ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
            >
              {form.agreed ? <Text className="text-foreground text-[22rpx] leading-none">✓</Text> : null}
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
