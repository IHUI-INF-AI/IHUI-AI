// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‌​‍‌​‍​‌​​‌‌​‍‌ ⁠

import { useTt, useI18n, t } from '@/i18n'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { register, sendSmsCode } from '@/api'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'
import PhoneAreaCodePicker from '@/components/PhoneAreaCodePicker'
import PasswordVisibilityToggle from '@/components/PasswordVisibilityToggle'
import AuthButton from '@/components/AuthButton'
import ThemeRoot from '@/components/ThemeRoot'
import './index.css'

/** 把共享 hook 返回的通用错误 key(auth.*)映射到本页 register.* 文案(仅本页面用) */
function mapRegisterErrorKey(e: string, phone: string): { key: string; fb: string } | null {
  if (e === 'auth.invalidPhone') {
    return phone.trim()
      ? { key: 'register.phoneInvalid', fb: t('register.phoneInvalid') }
      : { key: 'register.enterPhone', fb: t('login.phonePlaceholder') }
  }
  if (e === 'auth.codePlaceholder')
    return { key: 'register.incomplete', fb: t('distribution.index.fillInfo') }
  if (e === 'auth.invalidPassword')
    return { key: 'register.pwdLength', fb: t('register.pwdLength') }
  if (e === 'auth.agreeRequired')
    return { key: 'register.agreeFirst', fb: t('register.agreeFirst') }
  return null
}

/** 把共享 hook 返回的通用成功 key(auth.*)映射到本页 register.* 文案 */
function mapRegisterInfoKey(e: string): { key: string; fb: string } | null {
  if (e === 'auth.codeSent') return { key: 'register.codeSent', fb: t('login.codeSent') }
  if (e === 'auth.registerSuccess') return { key: 'register.success', fb: t('register.success') }
  return null
}

export default function RegisterIndex() {
  const { t } = useI18n()
  const tt = useTt()

  // 视觉状态:区号 / 密码可见性(RN 输入框无聚焦样式,聚焦态仅区号选择器内部使用)
  const [phoneHead, setPhoneHead] = useState('+86')
  const [showPwd, setShowPwd] = useState(false)

  // 用 @ihui/shared useRegisterForm 替代本地 useState + onSendCode + onSubmit
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

  useEffect(() => {
    if (form.error) {
      const mapped = mapRegisterErrorKey(form.error, form.values.phone)
      Taro.showToast({ title: mapped ? tt(mapped.key, mapped.fb) : t(form.error), icon: 'none' })
    }
  }, [form.error, form.values.phone, t, tt])

  useEffect(() => {
    if (form.info) {
      const mapped = mapRegisterInfoKey(form.info)
      Taro.showToast({ title: mapped ? tt(mapped.key, mapped.fb) : t(form.info), icon: 'success' })
    }
  }, [form.info, t, tt])

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

  const codeBtnText =
    form.countdown > 0 ? `${form.countdown}秒后重新获取` : tt('register.getCode', '发送验证码')

  return (
    <ThemeRoot className="container-ali">
      <View className="container1">
        {/* 顶部:返回 + 标题(对齐 RN SharedRegisterScreen header) */}
        <View className="reg-header">
          <Text className="reg-back" onClick={toLogin}>
            {tt('common.back', '返回')}
          </Text>
          <Text className="reg-title">{tt('register.title', '注册')}</Text>
        </View>

        {/* 表单卡片(对齐 RN card) */}
        <View className="reg-card">
          {/* 手机号输入框 + 区号 */}
          <Text className="reg-label">{tt('register.phone', '手机号')}</Text>
          <View className="reg-input-box">
            <PhoneAreaCodePicker value={phoneHead} onChange={setPhoneHead} />
            <Input
              className="reg-input"
              type="number"
              maxlength={11}
              placeholder={tt('register.phonePlaceholder', '请输入手机号')}
              placeholderStyle="color: var(--color-text-tertiary);"
              value={form.values.phone}
              onInput={(e) => form.setPhone(e.detail.value)}
            />
          </View>

          {/* 验证码输入框 + 发送按钮(对齐 RN codeRow/codeBtn) */}
          <Text className="reg-label">{tt('register.code', '验证码')}</Text>
          <View className="reg-coderow">
            <View className="reg-input-box reg-input-box-flex">
              <Input
                className="reg-input"
                type="number"
                maxlength={6}
                placeholder={tt('register.codePlaceholder', '请输入验证码')}
                placeholderStyle="color: var(--color-text-tertiary);"
                value={form.values.code}
                onInput={(e) => form.setCode(e.detail.value)}
              />
            </View>
            <View
              className={`reg-codebtn ${form.countdown > 0 ? 'reg-codebtn-disabled' : ''}`}
              onClick={form.sendCode}
            >
              <Text className="reg-codebtn-text">{codeBtnText}</Text>
            </View>
          </View>

          {/* 密码输入框 + 可见性切换 */}
          <Text className="reg-label">{tt('register.password', '密码')}</Text>
          <View className="reg-input-box">
            <Input
              className="reg-input"
              password={!showPwd}
              maxlength={20}
              placeholder={tt('register.passwordPlaceholder', '请输入密码')}
              placeholderStyle="color: var(--color-text-tertiary);"
              value={form.values.password}
              onInput={(e) => form.setPassword(e.detail.value)}
            />
            <PasswordVisibilityToggle
              visible={showPwd}
              onToggle={() => setShowPwd((v) => !v)}
              label={showPwd ? tt('register.hide', '隐藏') : tt('register.show', '显示')}
            />
          </View>

          {/* 协议同意行(对齐 RN agreementRow) */}
          <View className="reg-agreement">
            <View className="reg-agreement-main">
              <View
                className={`reg-checkbox ${form.agreed ? 'reg-checkbox-checked' : ''}`}
                onClick={() => form.setAgreed(!form.agreed)}
              >
                {form.agreed ? <Text className="reg-checkmark">✓</Text> : null}
              </View>
              <Text className="reg-agreement-text">
                {tt('register.agreePrefix', '我已阅读并同意')}
                <Text className="reg-agreement-link" onClick={() => openAgreement('user')}>
                  {tt('register.userAgreement', '《用户协议》')}
                </Text>
                <Text className="reg-agreement-link" onClick={() => openAgreement('privacy')}>
                  {tt('register.privacyPolicy', '《隐私政策》')}
                </Text>
              </Text>
            </View>
          </View>

          {/* 注册按钮(对齐 RN submitBtn:品牌橙底) */}
          <AuthButton onClick={form.register} disabled={form.submitting} variant="register">
            {form.submitting ? tt('register.submitting', '注册中…') : tt('register.submit', '注册')}
          </AuthButton>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‌​‍‌​‍​‌​​‌‌​‍‌ ⁠
