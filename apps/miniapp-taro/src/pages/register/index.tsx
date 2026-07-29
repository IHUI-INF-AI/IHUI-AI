import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { register, sendSmsCode } from '@/api'
import { useI18n } from '@/i18n'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'
import PhoneAreaCodePicker from '@/components/PhoneAreaCodePicker'
import PasswordVisibilityToggle from '@/components/PasswordVisibilityToggle'
import AuthButton from '@/components/AuthButton'
import './index.css'

export default function RegisterIndex() {
  const { t } = useI18n()

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
      Taro.showToast({ title: t(form.error), icon: 'none' })
    }
  }, [form.error, t])

  useEffect(() => {
    if (form.info) {
      Taro.showToast({ title: t(form.info), icon: 'success' })
    }
  }, [form.info, t])

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pages/about/protocol' : '/pages/about/privacy'
    Taro.navigateTo({
      url,
      fail: () => Taro.showToast({ title: '页面未注册', icon: 'none' }),
    })
  }

  function toLogin() {
    Taro.redirectTo({ url: '/pages/login/login' })
  }

  const codeBtnText = form.countdown > 0 ? `${form.countdown}秒后重新获取` : '发送验证码'

  return (
    <View className="container-ali">
      <View className="container1">
        <Image className="bg-image" src="/static/images/loginbackk.png" mode="aspectFill" />
        <View className="container-box">
          {/* 顶部 logo + 标题图 */}
          <View className="top_box">
            <View className="logobox">
              <Image className="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
            </View>
            <View className="titlebox">
              <Image className="titlebox-image" src="/static/images/loginengtexta.png" mode="aspectFit" />
              <Image className="titlebox-image1" src="/static/images/loginzhtext.png" mode="aspectFit" />
            </View>
          </View>

          <View className="center_box">
            {/* 手机号输入框 + 区号 */}
            <View className="input-wbox">
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
                    placeholder="手机号码"
                    placeholderStyle="color:#6B6980;font-size: 22rpx;font-weight: normal;"
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
                    placeholder="验证码"
                    placeholderStyle="color:#6B6980;font-size: 22rpx;font-weight: normal;"
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
                    placeholder="密码"
                    placeholderStyle="color:#6B6980;font-size: 22rpx;font-weight: normal;"
                    value={form.values.password}
                    onInput={(e) => form.setPassword(e.detail.value)}
                    onFocus={() => setIsPwdFocused(true)}
                    onBlur={() => setIsPwdFocused(false)}
                  />
                  <PasswordVisibilityToggle
                    visible={showPwd}
                    onToggle={() => setShowPwd((v) => !v)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 底部:注册按钮 + 协议 + 第三方绑定 + 登录链接 */}
          <View className="bottom_box">
            <AuthButton onClick={form.register} disabled={form.submitting} variant="register">
              {form.submitting ? '注册中…' : '注册'}
            </AuthButton>

            {/* 协议勾选:check-circle 16.5rpx 圆形 + #847CFF checked */}
            <View className="row-between">
              <View className="yiyue-box" onClick={() => form.setAgreed(!form.agreed)}>
                <View className={`check-circle ${form.agreed ? 'checked' : ''}`}>
                  {form.agreed ? <Text className="check-icon">✓</Text> : null}
                </View>
                <Text className="arge">
                  我已阅读并同意
                  <Text className="textItem" onClick={() => openAgreement('user')}>《用户协议》</Text>
                  <Text className="textItem" onClick={() => openAgreement('privacy')}>《隐私协议》</Text>
                  <Text className="textItem" onClick={() => openAgreement('privacy')}>《个人隐私》</Text>
                  <Text className="textItem" onClick={() => openAgreement('user')}>《软件使用协议》</Text>
                </Text>
              </View>
            </View>

            {/* 第三方快捷绑定(7 图标,wx + google 已有,其他占位) */}
            <View className="switch-login">
              <Text>第三方快捷绑定</Text>
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
                <Text className="has-account">已有账户?</Text>
                <Text className="to-login" onClick={toLogin}>登录</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
