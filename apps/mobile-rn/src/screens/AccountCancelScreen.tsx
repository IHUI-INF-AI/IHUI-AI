// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { AccountCancelScreen as SharedAccountCancelScreen } from '@ihui/rn-app'
import { deleteAccount, sendSmsCode } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const CONFIRM_SENTENCE = '确认注销'

export default function AccountCancelScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const navigation = useNavigation<NavigationProp>()

  const [inputPhone, setInputPhone] = useState(user?.phone ?? '')
  const [confirmText, setConfirmText] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmCountdown, setConfirmCountdown] = useState(5)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    if (confirmCountdown > 0 && showConfirmModal) {
      const timer = setTimeout(() => setConfirmCountdown(confirmCountdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (confirmCountdown === 0 && showConfirmModal) {
      setShowConfirmModal(false)
      setConfirmCountdown(5)
    }
  }, [confirmCountdown, showConfirmModal])

  const onSendSms = useCallback(async () => {
    const phone = inputPhone.trim()
    if (!phone) {
      appAlert(t('home.pubTip'), t('account.phoneRequired'))
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      appAlert(t('home.pubTip'), t('account.phoneInvalid'))
      return
    }
    // 真实发送短信验证码(对齐原项目 account-cancel.vue onGetCode → sendTextMsg)
    const res = await sendSmsCode(phone, 'login')
    if (res.success) {
      appAlert(t('home.pubTip'), t('account.smsSent'))
      setCountdown(60)
    } else {
      appAlert(t('home.pubTip'), res.error ?? t('account.smsFailRetry'))
    }
  }, [inputPhone, t])

  const validate = useCallback((): string => {
    if (!inputPhone.trim()) return t('account.phoneRequired')
    if (!/^1\d{10}$/.test(inputPhone.trim())) return t('account.phoneInvalid')
    if (!smsCode.trim()) return t('account.smsRequired')
    if (smsCode.trim().length < 4) return t('account.smsMin')
    if (confirmText.trim() !== CONFIRM_SENTENCE)
      return t('account.confirmHint', { s: CONFIRM_SENTENCE })
    return ''
  }, [inputPhone, smsCode, confirmText, t])

  const onSubmit = useCallback(async () => {
    const err = validate()
    if (err) {
      appAlert(t('home.pubTip'), err)
      return
    }
    setSubmitting(true)
    try {
      // 真实注销接口(对齐原项目 accountCancel → DELETE /login/cancel;RN 后端为 POST /api/settings/delete-account)
      const res = await deleteAccount(smsCode.trim(), '用户主动申请注销')
      if (!res.success) {
        appAlert(t('home.pubTip'), res.error ?? t('account.failRetry'))
        return
      }
      appAlert(t('account.okTitle'), t('account.okBody'), [
        {
          text: t('common.gotIt'),
          onPress: () => {
            void logout()
          },
        },
      ])
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      appAlert(t('home.pubTip'), detail.trim() ? toUserFriendlyMessage(e) : t('account.failRetry'))
    } finally {
      setSubmitting(false)
    }
  }, [validate, logout, smsCode, t])

  return (
    <SharedAccountCancelScreen
      t={t}
      phone={inputPhone}
      confirmText={confirmText}
      smsCode={smsCode}
      countdown={countdown}
      showConfirmModal={showConfirmModal}
      confirmCountdown={confirmCountdown}
      submitting={submitting}
      onPhoneChange={setInputPhone}
      onConfirmTextChange={setConfirmText}
      onSmsCodeChange={setSmsCode}
      onSendSms={onSendSms}
      onSubmit={onSubmit}
      onCloseModal={() => setShowConfirmModal(false)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
