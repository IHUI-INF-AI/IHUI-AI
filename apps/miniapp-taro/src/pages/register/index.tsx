// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/register/RegisterScreen.tsx
import { useTt, useI18n, t } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import { View, Text, Input } from '@tarojs/components'
// 描边画在外层容器 `.reg-input-box` 上 ⇒ 走 hook 文档的 WRAP 形态②:handlers 留 Input、focusStyle 铺容器。
import { useFieldFocus } from '@/hooks/use-field-focus'
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
import BackChevron from '@/components/BackChevron'
import AgreementRow from './agreement-row'
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

  // 聚焦态描边:三个输入盒的描边都在外层 .reg-input-box 上,故各取一份运行时聚焦档
  const ffPhone = useFieldFocus()
  const ffCode = useFieldFocus()
  const ffPwd = useFieldFocus()
  const ffConfirm = useFieldFocus()

  // 用 @ihui/shared useRegisterForm 替代本地 useState + onSendCode + onSubmit
  const form = useRegisterForm({
    type: 'phone',
    enableCode: true,
    enableConfirmPassword: true,
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
        return { success: false, error: 'register.sendCodeFailed' }
      }
    },
    onSuccess: () => {
      setTimeout(goToLogin, 800)
    },
  })

  useEffect(() => {
    if (!form.error) return
    // 验证码发送失败 / 未勾协议:共享屏用行内红字,这里同样走行内,不弹 toast(同一错误不提示两次)
    if (form.error === 'register.sendCodeFailed' || form.error === 'auth.agreeRequired') return
    const mapped = mapRegisterErrorKey(form.error, form.values.phone)
    Taro.showToast({ title: mapped ? tt(mapped.key, mapped.fb) : t(form.error), icon: 'none' })
  }, [form.error, form.values.phone, t, tt])

  useEffect(() => {
    if (form.info) {
      const mapped = mapRegisterInfoKey(form.info)
      Taro.showToast({ title: mapped ? tt(mapped.key, mapped.fb) : t(form.info), icon: 'success' })
    }
  }, [form.info, t, tt])

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pkg-about/about/protocol' : '/pkg-about/about/privacy'
    Taro.navigateTo({
      url,
      fail: () => Taro.showToast({ title: tt('register.pageMissing', '页面未注册'), icon: 'none' }),
    })
  }

  function toLogin() {
    goToLogin()
  }

  const codeBtnText =
    form.countdown > 0
      ? tt('register.resendIn', `${form.countdown}s 后重发`, { countdown: form.countdown })
      : tt('register.getCode', '发送验证码')

  return (
    <ThemeRoot className="container-ali">
      <View className="container1">
        {/* 顶部:返回 + 标题(对齐 RN SharedRegisterScreen header) */}
        <View className="reg-header">
          <BackChevron onTap={toLogin} />
          <Text className="reg-title">{tt('register.title', '注册')}</Text>
        </View>

        {/* 表单卡片(对齐 RN card) */}
        <View className="reg-card">
          {/* 手机号输入框 + 区号 */}
          <Text className="reg-label">{tt('register.phone', '手机号')}</Text>
          <View className="reg-input-box" style={ffPhone.focusStyle}>
            <PhoneAreaCodePicker value={phoneHead} onChange={setPhoneHead} />
            <Input
              className="reg-input"
              {...ffPhone.spread}
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
            <View className="reg-input-box reg-input-box-flex" style={ffCode.focusStyle}>
              <Input
                className="reg-input"
                {...ffCode.spread}
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
              hoverClass="opacity-60"
              onClick={form.sendCode}
            >
              <Text className="reg-codebtn-text">{codeBtnText}</Text>
            </View>
          </View>
          {form.error === 'register.sendCodeFailed' ? (
            <Text className="block mt-[12rpx] text-[length:26rpx] text-[color:var(--color-danger)]">
              {t('register.sendCodeFailed')}
            </Text>
          ) : null}

          {/* 密码输入框 + 可见性切换 */}
          <Text className="reg-label">{tt('register.password', '密码')}</Text>
          <View className="reg-input-box" style={ffPwd.focusStyle}>
            <Input
              className="reg-input"
              {...ffPwd.spread}
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

          {/* 确认密码(对齐共享屏 confirmPassword:同款输入盒 + 占位符) */}
          <Text className="reg-label">{tt('register.confirmPassword', '确认密码')}</Text>
          <View className="reg-input-box" style={ffConfirm.focusStyle}>
            <Input
              className="reg-input"
              {...ffConfirm.spread}
              password
              maxlength={20}
              placeholder={tt('register.confirmPasswordPlaceholder', '请再次输入密码')}
              placeholderStyle="color: var(--color-text-tertiary);"
              value={form.values.confirmPassword}
              onInput={(e) => form.setConfirmPassword(e.detail.value)}
            />
          </View>

          {/* 协议同意行(对齐 RN agreementRow) */}
          <AgreementRow
            agreed={form.agreed}
            showError={form.error === 'auth.agreeRequired'}
            onToggle={() => {
              form.setAgreed(!form.agreed)
              if (form.error) form.clearError()
            }}
            onOpenTerms={() => openAgreement('user')}
            onOpenPrivacy={() => openAgreement('privacy')}
          />

          {/* 注册按钮(对齐 RN submitBtn:品牌灰蓝底) */}
          <AuthButton onClick={form.register} disabled={form.submitting} variant="register">
            {form.submitting
              ? tt('register.registering', '注册中...')
              : tt('register.submit', '注册')}
          </AuthButton>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‌​‍‌​‍​‌​​‌‌​‍‌ ⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
