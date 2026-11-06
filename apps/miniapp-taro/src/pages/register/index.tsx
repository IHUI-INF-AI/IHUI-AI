// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/register/RegisterScreen.tsx

import { useI18n, useTt, t } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { register, sendSmsCode } from '@/api'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'
import ThemeRoot from '@/components/ThemeRoot'
import { RegisterScreen as SharedRegisterScreen } from '@ihui/rn-app/features/register/RegisterScreen'
import { onToast } from '@/host/on-toast'

/**
 * 注册页(壳承载形制):渲染委托给共享 RegisterScreen(RN 跨端屏),
 * 本页只持有状态与平台端口(register/sendSmsCode API、onBack、onToast、协议跳转),
 * 并把 @ihui/shared useRegisterForm 的表单状态逐 prop 注入共享屏。
 * 改动共享屏行为应去 packages/app/src/features/register/RegisterScreen.tsx。
 */

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
  if (e === 'auth.passwordMismatch')
    return { key: 'user.password.mismatch', fb: t('user.password.mismatch') }
  return null
}

/** 把共享 hook 返回的通用成功 key(auth.*)映射到本页 register.* 文案 */
function mapRegisterInfoKey(e: string): { key: string; fb: string } | null {
  if (e === 'auth.codeSent') return { key: 'register.codeSent', fb: t('login.codeSent') }
  if (e === 'auth.registerSuccess') return { key: 'register.success', fb: t('register.success') }
  return null
}

export default function RegisterIndexPage() {
  const { t } = useI18n()
  const tt = useTt()

  // 用 @ihui/shared useRegisterForm 持有全部表单状态 + 平台 API 注入;共享屏只负责渲染。
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
      } catch (e) {
        const msg = e instanceof Error ? e.message.trim() : ''
        return { success: false, error: msg || 'common.failed' }
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
    if (form.error === 'register.sendCodeFailed' || form.error === 'auth.agreeRequired') return
    const mapped = mapRegisterErrorKey(form.error, form.values.phone)
    onToast(mapped ? tt(mapped.key, mapped.fb) : t(form.error), { kind: 'error' })
  }, [form.error, form.values.phone, t, tt])

  useEffect(() => {
    if (form.info) {
      const mapped = mapRegisterInfoKey(form.info)
      onToast(mapped ? tt(mapped.key, mapped.fb) : t(form.info), { kind: 'success' })
    }
  }, [form.info, t, tt])

  function openAgreement(type: 'user' | 'privacy') {
    const url = type === 'user' ? '/pkg-about/about/protocol' : '/pkg-about/about/privacy'
    Taro.navigateTo({
      url,
      fail: () => onToast(tt('register.pageMissing', '页面未注册'), { kind: 'error' }),
    })
  }

  return (
    <ThemeRoot>
      <SharedRegisterScreen
        t={t}
        account={form.values.phone}
        password={form.values.password}
        confirmPassword={form.values.confirmPassword}
        loading={form.submitting}
        error={form.error ?? ''}
        onAccountChange={form.setPhone}
        onPasswordChange={form.setPassword}
        onConfirmPasswordChange={form.setConfirmPassword}
        onRegister={() => {
          void form.register()
        }}
        onBack={() => goToLogin()}
        enableAgreement
        agreed={form.agreed}
        onAgreedChange={form.setAgreed}
        showAgreeErr={form.error === 'auth.agreeRequired'}
        onOpenTerms={() => openAgreement('user')}
        onOpenPrivacy={() => openAgreement('privacy')}
        code={form.values.code}
        onCodeChange={form.setCode}
        onSendCode={form.sendCode}
        countdown={form.countdown}
        sendingCode={form.sendingCode}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‌​‍‌​‍​‌​​‌‌​‍‌ ⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
