// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/register/RegisterScreen.tsx
//
// 薄壳(2026-11-14 收敛):视图委托共享屏 `RegisterScreen`,本端只保留平台职责:
//   ① 取数 —— register / sendSmsCode;② 导航 —— 回登录、打开协议页;③ 轻提示 —— onToast;
//   ④ 端内控件 —— 区号选择器(`PhoneAreaCodePicker`,共享屏以 renderPhonePrefix 插槽承载)。
// 表单状态与校验仍来自共享 hook `useRegisterForm`(与 RN 侧同一个 hook),
// 收敛前本页把 hook 的每个字段各接一遍手写输入框(247 行);现在输入框由共享屏统一渲染。
import { useTt, useI18n, t } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { register, sendSmsCode } from '@/api'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'
import ThemeRoot from '@/components/ThemeRoot'
import PhoneAreaCodePicker from '@/components/PhoneAreaCodePicker'
import { RegisterScreen } from '@ihui/rn-app/features/register/RegisterScreen'
import { useAppTheme } from '@/lib/theme'
import { onToast } from '@/host/on-toast'

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
  // auth.passwordMismatch 不在小程序五语言包里 ⇒ 不映射会把裸键直接弹给用户
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

export default function RegisterIndex() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolved } = useAppTheme()
  // 区号选择器的视觉状态(共享屏不承载区号选择器,属本端控件)
  const [phoneHead, setPhoneHead] = useState('+86')

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
        // error 置空串会把 '' 写进 form.error ⇒ falsy ⇒ 注册按钮"没反应"。
        // 透传后端真实错误文案(对词典外键原样返回),取不到再落通用失败键。
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
    // 验证码发送失败 / 未勾协议:共享屏用行内红字,这里同样走行内,不弹 toast(同一错误不提示两次)
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
    <ThemeRoot className="container-ali">
      <RegisterScreen
        t={t}
        account={form.values.phone}
        password={form.values.password}
        confirmPassword={form.values.confirmPassword}
        loading={form.submitting}
        error={form.error === 'register.sendCodeFailed' ? '' : (form.error ?? '')}
        onAccountChange={form.setPhone}
        onPasswordChange={form.setPassword}
        onConfirmPasswordChange={form.setConfirmPassword}
        onRegister={form.register}
        onBack={goToLogin}
        colorScheme={resolved}
        enableAgreement
        agreed={form.agreed}
        onAgreedChange={(v) => {
          form.setAgreed(v)
          if (form.error) form.clearError()
        }}
        showAgreeErr={form.error === 'auth.agreeRequired'}
        onOpenTerms={() => openAgreement('user')}
        onOpenPrivacy={() => openAgreement('privacy')}
        renderPhonePrefix={() => <PhoneAreaCodePicker value={phoneHead} onChange={setPhoneHead} />}
        code={form.values.code}
        onCodeChange={form.setCode}
        onSendCode={async () => {
          await form.sendCode()
        }}
        countdown={form.countdown}
        sendingCode={form.sendingCode}
        codeSendError={form.error === 'register.sendCodeFailed' ? t('register.sendCodeFailed') : ''}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
