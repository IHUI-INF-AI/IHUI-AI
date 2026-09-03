// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { View, Text, Input, Image } from '@tarojs/components'
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

  // 视觉状态:区号 / 密码可见性 / 输入框聚焦(对齐 register.vue)
  const [phoneHead, setPhoneHead] = useState('+86')
  const [showPwd, setShowPwd] = useState(false)
  const [isPhoneFocused, setIsPhoneFocused] = useState(false)
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const [isPwdFocused, setIsPwdFocused] = useState(false)

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
        <Image className="bg-image" src="/static/images/loginbackk.png" mode="aspectFill" />
        <View className="container-box">
          {/* 顶部 logo + 标题图 */}
          <View className="top_box">
            <View className="logobox">
              <Image className="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
            </View>
            <View className="titlebox">
              <Image
                className="titlebox-image"
                src="/static/images/loginengtexta.png"
                mode="aspectFit"
              />
              <Image
                className="titlebox-image1"
                src="/static/images/loginzhtext.png"
                mode="aspectFit"
              />
              <Text className="page-title">{tt('register.title', '注册')}</Text>
            </View>
          </View>

          <View className="center_box">
            {/* 手机号输入框 + 区号 */}
            <View className="input-wbox">
              <Text className="field-label">{tt('register.phone', '手机号')}</Text>
              <View className={`input-nbox ${isPhoneFocused ? 'input-nbox-focused' : ''}`}>
                <View className="input-box">
                  <View className="input-icon" />
                  <PhoneAreaCodePicker
                    value={phoneHead}
                    onChange={setPhoneHead}
                    focused={isPhoneFocused}
                  />
                  <Input
                    className="input iponeinput input-text"
                    type="number"
                    maxlength={11}
                    placeholder={tt('register.phonePlaceholder', '请输入手机号')}
                    placeholderStyle="color: var(--color-muted-foreground);font-size: 22rpx;font-weight: normal;"
                    value={form.values.phone}
                    onInput={(e) => form.setPhone(e.detail.value)}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => setIsPhoneFocused(false)}
                  />
                </View>
              </View>
            </View>

            {/* 验证码输入框 */}
            <View className="input-wbox">
              <Text className="field-label">{tt('register.code', '验证码')}</Text>
              <View
                className={`input-nbox ${isCodeFocused ? 'input-nbox-focused' : ''}`}
                style={{ marginTop: '18rpx' }}
              >
                <View className="input-box">
                  <View className="input-icon" />
                  <Input
                    className="input input-text"
                    type="number"
                    maxlength={6}
                    placeholder={tt('register.codePlaceholder', '请输入验证码')}
                    placeholderStyle="color: var(--color-muted-foreground);font-size: 22rpx;font-weight: normal;"
                    value={form.values.code}
                    onInput={(e) => form.setCode(e.detail.value)}
                    onFocus={() => setIsCodeFocused(true)}
                    onBlur={() => setIsCodeFocused(false)}
                  />
                  <View className="send-code" onClick={form.sendCode}>
                    <Text>{codeBtnText}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 密码输入框 + 可见性切换 */}
            <View className="input-wbox">
              <Text className="field-label">{tt('register.password', '密码')}</Text>
              <View
                className={`input-nbox ${isPwdFocused ? 'input-nbox-focused' : ''}`}
                style={{ marginTop: '18rpx' }}
              >
                <View className="input-box">
                  <View className="input-icon" />
                  <Input
                    className="input input-text"
                    password={!showPwd}
                    maxlength={20}
                    placeholder={tt('register.passwordPlaceholder', '请输入密码')}
                    placeholderStyle="color: var(--color-muted-foreground);font-size: 22rpx;font-weight: normal;"
                    value={form.values.password}
                    onInput={(e) => form.setPassword(e.detail.value)}
                    onFocus={() => setIsPwdFocused(true)}
                    onBlur={() => setIsPwdFocused(false)}
                  />
                  <PasswordVisibilityToggle
                    visible={showPwd}
                    onToggle={() => setShowPwd((v) => !v)}
                    label={showPwd ? tt('register.hide', '隐藏') : tt('register.show', '显示')}
                  />
                </View>
              </View>
              <Text className="field-hint">
                {tt('register.pwdHint', '6-20 位,建议字母和数字组合')}
              </Text>
            </View>
          </View>

          {/* 底部:注册按钮 + 协议 + 第三方绑定 + 登录链接 */}
          <View className="bottom_box">
            <AuthButton onClick={form.register} disabled={form.submitting} variant="register">
              {form.submitting
                ? tt('register.submitting', '注册中…')
                : tt('register.submit', '注册')}
            </AuthButton>

            {/* 协议勾选:check-circle 16.5rpx 圆形 + #847CFF checked */}
            <View className="row-between">
              <View className="yiyue-box" onClick={() => form.setAgreed(!form.agreed)}>
                <View className={`check-circle ${form.agreed ? 'checked' : ''}`}>
                  {form.agreed ? <Text className="check-icon">✓</Text> : null}
                </View>
                <Text className="arge">
                  {tt('register.agreePrefix', '我已阅读并同意')}
                  <Text className="textItem" onClick={() => openAgreement('user')}>
                    {tt('register.userAgreement', '《用户协议》')}
                  </Text>
                  <Text className="textItem" onClick={() => openAgreement('privacy')}>
                    {tt('register.privacyPolicy', '《隐私政策》')}
                  </Text>
                </Text>
              </View>
            </View>

            {/* 第三方快捷绑定(7 图标,wx + google 已有,其他占位) */}
            <View className="switch-login">
              <Text>{tt('register.text1', '第三方快捷绑定')}</Text>
            </View>
            <View className="icon-all">
              <View className="icon-all-box">
                <Image className="bind-icon" src="/static/images/wx.svg" mode="aspectFit" />
              </View>
              <View className="icon-all-box">
                <View className="bind-icon" />
              </View>
              <View className="icon-all-box">
                <View className="bind-icon" />
              </View>
              <View className="icon-all-box">
                <View className="bind-icon" />
              </View>
              <View className="icon-all-box">
                <View className="bind-icon" />
              </View>
              <View className="icon-all-box">
                <Image className="bind-icon" src="/static/images/google.svg" mode="aspectFit" />
              </View>
              <View className="icon-all-box">
                <View className="bind-icon" />
              </View>
            </View>

            {/* 已有账户?登录 */}
            <View className="logintext">
              <View className="textoo">
                <Text className="has-account">{tt('register.hasAccount', '已有账户?')}</Text>
                <Text className="to-login" onClick={toLogin}>
                  {tt('register.toLogin', '登录')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
