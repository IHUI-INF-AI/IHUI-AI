// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 注册页 —— 跨端薄壳,委托 RN 共享屏 RegisterScreen(单一源)。
 *
 * 渲染真相源 = packages/app/src/features/register/RegisterScreen.tsx(RN 与小程序同一份,
 * 经 src/rn-compat 兼容层在小程序落地)。端内不再写布局与样式:源头改一笔,两端同动。
 *
 * 平台侧只注入本端事实:取词(t)、主题档(resolvedTheme)、注册/发码 API、导航出口、toast。
 *
 * 已完成 align-up:共享屏补了「+86 区号前缀 / 密码可见性切换」端口,本页注入后功能与旧手抄页一致。
 * 唯一未还原的是「输入聚焦描边」(共享屏 TextField 未暴露焦点事件),属次要视觉差异。
 */
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { useI18n, useTt, t } from '@/i18n'
import { goToLogin } from '@/utils/auth'
import { register, sendSmsCode } from '@/api'
import {
  useRegisterForm,
  type RegisterApiResult,
  type RegisterFormValues,
  type SendCodeApiResult,
} from '@ihui/shared/hooks'
import { RegisterScreen as SharedRegisterScreen } from '@ihui/rn-app/features/register/RegisterScreen'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import './index.css'

/** 共享 hook 的通用错误 key(auth.*) → 本页 register.* 文案 */
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
  // auth.passwordMismatch 不在小程序五语言包里 ⇒ 指到包内现成键,避免把裸键弹给用户。
  if (e === 'auth.passwordMismatch')
    return { key: 'user.password.mismatch', fb: t('user.password.mismatch') }
  return null
}

/** 共享 hook 的通用成功 key(auth.*) → 本页 register.* 文案 */
function mapRegisterInfoKey(e: string): { key: string; fb: string } | null {
  if (e === 'auth.codeSent') return { key: 'register.codeSent', fb: t('login.codeSent') }
  if (e === 'auth.registerSuccess') return { key: 'register.success', fb: t('register.success') }
  return null
}

export default function RegisterIndex() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const [showPwd, setShowPwd] = useState(false)

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
        // error 置空串会把 '' 写进 form.error ⇒ falsy ⇒ 注册失败时按钮"没反应"。
        // 透传后端真实文案(t() 对词典外键原样返回),取不到再落通用失败键。
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

  // 共享屏以 error prop 行内渲染;auth.* 需先映射到本页文案,避免把裸 key 弹给用户。
  const displayError: string | undefined = form.error
    ? form.error === 'register.sendCodeFailed' || form.error === 'auth.agreeRequired'
      ? t(form.error)
      : (() => {
          const m = mapRegisterErrorKey(form.error, form.values.phone)
          return m ? tt(m.key, m.fb) : t(form.error)
        })()
    : undefined

  // 成功/发送验证码提示:共享屏无 info 通道,走 toast。
  useEffect(() => {
    if (!form.info) return
    const mapped = mapRegisterInfoKey(form.info)
    onToast(mapped ? tt(mapped.key, mapped.fb) : t(form.info), { kind: 'success' })
  }, [form.info, t, tt])

  // 非行内错误另走 toast(验证码失败/未勾协议由共享屏行内显示,不重复弹)。
  useEffect(() => {
    if (!form.error) return
    if (form.error === 'register.sendCodeFailed' || form.error === 'auth.agreeRequired') return
    const mapped = mapRegisterErrorKey(form.error, form.values.phone)
    onToast(mapped ? tt(mapped.key, mapped.fb) : t(form.error), { kind: 'error' })
  }, [form.error, form.values.phone, t, tt])

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
        error={displayError ?? ''}
        onAccountChange={form.setPhone}
        onPasswordChange={form.setPassword}
        onConfirmPasswordChange={form.setConfirmPassword}
        onRegister={() => void form.register()}
        onBack={goToLogin}
        colorScheme={resolvedTheme}
        enableAgreement
        agreed={form.agreed}
        onAgreedChange={form.setAgreed}
        showAgreeErr={form.error === 'auth.agreeRequired'}
        onOpenTerms={() => openAgreement('user')}
        onOpenPrivacy={() => openAgreement('privacy')}
        phonePrefix="+86"
        passwordVisible={showPwd}
        onTogglePasswordVisible={() => setShowPwd((v) => !v)}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
