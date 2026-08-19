import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { AccountCancelScreen as SharedAccountCancelScreen } from '@ihui/rn-app'
import { deleteAccount, sendSmsCode } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const CONFIRM_SENTENCE = '确认注销'

export default function AccountCancelScreen() {
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
      Alert.alert('提示', '请先输入手机号')
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      Alert.alert('提示', '请输入正确的手机号')
      return
    }
    // 真实发送短信验证码(对齐原项目 account-cancel.vue onGetCode → sendTextMsg)
    const res = await sendSmsCode(phone, 'login')
    if (res.success) {
      Alert.alert('提示', '验证码已发送')
      setCountdown(60)
    } else {
      Alert.alert('提示', res.error ?? '验证码发送失败，请稍后重试')
    }
  }, [inputPhone])

  const validate = useCallback((): string => {
    if (!inputPhone.trim()) return '请输入手机号'
    if (!/^1\d{10}$/.test(inputPhone.trim())) return '请输入正确的手机号'
    if (!smsCode.trim()) return '请输入短信验证码'
    if (smsCode.trim().length < 4) return '验证码至少 4 位'
    if (confirmText.trim() !== CONFIRM_SENTENCE) return `请输入「${CONFIRM_SENTENCE}」确认注销`
    return ''
  }, [inputPhone, smsCode, confirmText])

  const onSubmit = useCallback(async () => {
    const err = validate()
    if (err) {
      Alert.alert('提示', err)
      return
    }
    setSubmitting(true)
    try {
      // 真实注销接口(对齐原项目 accountCancel → DELETE /login/cancel;RN 后端为 POST /api/settings/delete-account)
      const res = await deleteAccount(smsCode.trim(), '用户主动申请注销')
      if (!res.success) {
        Alert.alert('提示', res.error ?? '提交失败，请稍后重试')
        return
      }
      Alert.alert('注销成功', '您的账号已注销', [
        {
          text: '知道了',
          onPress: () => {
            void logout()
          },
        },
      ])
    } catch {
      Alert.alert('提示', '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }, [validate, logout])

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
    />
  )
}
