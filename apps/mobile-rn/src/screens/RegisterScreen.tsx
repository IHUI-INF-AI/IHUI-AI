import { useCallback, useRef, useState } from 'react'
import { useColorScheme } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { register, sendSmsCode, verifyAuthCode } from '@ihui/api-client'
import { useRegisterForm } from '@ihui/shared/hooks'
import { RegisterScreen as SharedRegisterScreen } from '@ihui/rn-app'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { VerifyCodeModal } from '../components/VerifyCodeModal'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * mobile-rn 注册页(2026-07-29 重构:接入 @ihui/shared/hooks useRegisterForm)
 *
 * 消除本地 useState + handleRegister 重复逻辑,改用跨端共享 hook。
 * - type: 'account'(账号注册,无验证码)
 * - registerApi:调用 @ihui/api-client register,返回 token/user 给 hook
 * - onRegisterSuccess:注册成功后调 AuthContext.login(account, password) 自动登录;
 *   失败时跳 Login 页让用户手动登录(保留原 wrapper 行为)
 * - accountRef/passwordRef:缓存表单值供 onRegisterSuccess 使用,避免闭包 stale
 *
 * 2026-07-30 增补:接入本地 VerifyCodeModal 作为"手机号二次验证"附加触发器,
 * 账号密码注册成功后引导用户绑定/验证手机号(纯演示流程,不影响主注册提交)。
 *
 * 2026-07-30 进一步接入:本地 FloatBox 浮层提示,覆盖注册成功 / 失败 / 自动登录失败
 * 三种状态(替代 Alert.alert,与共享 LoginScreen 风格对齐)。
 *
 * 2026-07-30 协议勾选:启用 enableAgreement(合规对齐 web 端),复用共享组件 AgreementRow。
 */
export function RegisterScreen() {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const colorScheme = useColorScheme()
  const accountRef = useRef('')
  const passwordRef = useRef('')
  const [verifyVisible, setVerifyVisible] = useState(false)
  const [verifyPhone, setVerifyPhone] = useState('')
  // FloatBox 浮层提示状态
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')

  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])

  const hideToast = useCallback((): void => {
    setToastVisible(false)
  }, [])

  const form = useRegisterForm({
    type: 'account',
    enableCode: false,
    enableConfirmPassword: true,
    enableAgreement: true,
    enableAutoLogin: true,
    registerApi: async (v) => {
      accountRef.current = v.account.trim()
      passwordRef.current = v.password
      const res = await register(v.account.trim(), v.password)
      if (res.success) {
        const user = res.data.user
        // 同步缓存手机号供后续弹窗使用
        if (user.phone) setVerifyPhone(user.phone)
        return {
          success: true,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          user: {
            id: user.id,
            nickname: user.nickname ?? user.username ?? '',
            avatar: user.avatar,
          },
        }
      }
      return { success: false, error: res.error }
    },
    onRegisterSuccess: async (result) => {
      if (!result.success) {
        showToast('error', result.error ?? t('auth.registerFailed'))
        return
      }
      showToast('success', t('auth.registerSuccess'))
      const r = await login(accountRef.current, passwordRef.current)
      if (!r.success) {
        showToast('warning', t('auth.autoLoginFailed'))
        // 浮层淡出后再跳 Login,避免页面提前销毁
        const navTimer = setTimeout(() => {
          clearTimeout(navTimer)
          navigation.navigate('Login')
        }, 1500)
        return
      }
      // 注册 + 自动登录成功,延迟让用户看到成功提示再弹二次验证
      const toastTimer = setTimeout(() => {
        clearTimeout(toastTimer)
        if (verifyPhone) {
          setVerifyVisible(true)
        }
      }, 1200)
    },
  })

  // hook 的 error 为 i18n key(auth.*)时走 t() 翻译,后端错误消息原样透传
  const translateError = (err: string | null): string => {
    if (!err) return ''
    if (err.startsWith('auth.')) return t(err)
    return err
  }

  // 协议未勾选错误(form.error === 'auth.agreeRequired' 时显示协议错误红字)
  const showAgreeErr = form.error === 'auth.agreeRequired'

  // 服务条款 / 隐私政策点击:跳转协议页面(对齐 LoginScreen 处理方式)
  const onOpenTerms = useCallback(() => {
    navigation.navigate('Agreement')
  }, [navigation])
  const onOpenPrivacy = useCallback(() => {
    navigation.navigate('Privacy')
  }, [navigation])

  return (
    <>
      <SharedRegisterScreen
        t={t}
        account={form.values.account}
        password={form.values.password}
        confirmPassword={form.values.confirmPassword}
        loading={form.submitting}
        error={translateError(form.error)}
        onAccountChange={form.setAccount}
        onPasswordChange={form.setPassword}
        onConfirmPasswordChange={form.setConfirmPassword}
        onRegister={form.register}
        onBack={() => navigation.goBack()}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        enableAgreement
        agreed={form.agreed}
        onAgreedChange={form.setAgreed}
        showAgreeErr={showAgreeErr}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
      <VerifyCodeModal
        visible={verifyVisible}
        phone={verifyPhone || '未绑定手机号'}
        onClose={() => setVerifyVisible(false)}
        onResend={async () => {
          if (verifyPhone) {
            await sendSmsCode(verifyPhone, 'register')
          }
        }}
        onSubmit={async (code) => {
          if (!verifyPhone) {
            showToast('warning', '请先绑定手机号后再验证')
            setVerifyVisible(false)
            return
          }
          const res = await verifyAuthCode({ mobile: verifyPhone, code })
          if (res.success && res.data.valid) {
            showToast('success', '手机号验证成功')
            setVerifyVisible(false)
          } else {
            showToast('error', res.error ?? '验证码错误,请重试')
          }
        }}
      />
      <FloatBox visible={toastVisible} type={toastType} message={toastMessage} onHide={hideToast} />
    </>
  )
}
