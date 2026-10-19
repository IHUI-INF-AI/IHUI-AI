// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import { ChangePhoneScreen as SharedChangePhoneScreen, type NationOption } from '@ihui/rn-app'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NATIONS: NationOption[] = [
  { title: '美国', content: '+1', id: 1 },
  { title: '台湾', content: '+886', id: 2 },
  { title: '香港', content: '+852', id: 3 },
  { title: '韩国', content: '+82', id: 4 },
  { title: '日本', content: '+81', id: 5 },
]

/**
 * mobile-rn 换绑手机号
 *
 * shell 层职责:
 * - 主体调用 @ihui/rn-app.SharedChangePhoneScreen(国家区号 + 手机号 + 验证码 + 提交)
 * - 验证码发往新手机号(/api/auth/sms/send),提交打 /api/auth/change-phone/confirm
 *   (confirm 校验的是新手机号的验证码,身份只取 JWT 主体,无旧码前置步骤)
 * - 浮动提示 FloatBox(成功/错误 toast)
 */
export function ChangePhoneScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [codeValue, setCodeValue] = useState('')
  const [phoneHead, setPhoneHead] = useState('+86')
  const [nationShow, setNationShow] = useState(false)
  const [codeMin, setCodeMin] = useState(60)
  const [sendCodeShow, setSendCodeShow] = useState(true)
  const [tip, setTip] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showToast = useCallback((type: FloatBoxType, message: string) => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])

  const hideToast = useCallback(() => {
    setToastVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCountdown = () => {
    setSendCodeShow(false)
    setCodeMin(60)
    timerRef.current = setInterval(() => {
      setCodeMin((m) => {
        if (m > 1) return m - 1
        if (timerRef.current) clearInterval(timerRef.current)
        setSendCodeShow(true)
        return 0
      })
    }, 1000)
  }

  const sendCode = async () => {
    if (!phoneNumber) {
      setTip('请输入手机号码!')
      showToast('warning', '请输入手机号码')
      return
    }
    if (phoneNumber.length !== 11) {
      setTip('请输入正确电话号码!')
      showToast('warning', '请输入正确电话号码')
      return
    }
    setTip('')
    try {
      const res = await fetchApi('/api/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, scene: 'phone-binding' }),
      })
      if (!res.success) throw apiFailureToError(res)
      startCountdown()
      showToast('success', '验证码已发送')
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      const friendly = detail.trim() ? toUserFriendlyMessage(e) : ''
      setTip(friendly || '验证码发送失败,请稍后重试')
      showToast('error', friendly || '验证码发送失败')
    }
  }

  const handleSubmit = async () => {
    if (!phoneNumber) {
      setTip('请输入手机号码!')
      showToast('warning', '请输入手机号码')
      return
    }
    if (!codeValue) {
      setTip('请输入验证码!')
      showToast('warning', '请输入验证码')
      return
    }
    setSubmitting(true)
    setTip('')
    try {
      const res = await fetchApi('/api/auth/change-phone/confirm', {
        method: 'POST',
        body: JSON.stringify({ newPhone: phoneNumber, code: codeValue }),
      })
      if (!res.success) {
        setTip(res.error || '绑定失败')
        showToast('error', res.error || '绑定失败')
        return
      }
      setTip('绑定成功!')
      showToast('success', '绑定成功')
      const tm = setTimeout(() => {
        clearTimeout(tm)
        navigation.goBack()
      }, 1000)
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      const friendly = detail.trim() ? toUserFriendlyMessage(e) : ''
      setTip(friendly || '网络异常,请稍后重试')
      showToast('error', friendly || '网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <SharedChangePhoneScreen
          t={t}
          phoneNumber={phoneNumber}
          codeValue={codeValue}
          phoneHead={phoneHead}
          nationShow={nationShow}
          codeMin={codeMin}
          sendCodeShow={sendCodeShow}
          tip={tip}
          submitting={submitting}
          nations={NATIONS}
          onPhoneChange={setPhoneNumber}
          onCodeChange={setCodeValue}
          onToggleNationShow={() => setNationShow((v) => !v)}
          onSelectNation={(n) => {
            setPhoneHead(n.content)
            setNationShow(false)
          }}
          onSendCode={sendCode}
          onSubmit={handleSubmit}
          onBack={() => navigation.goBack()}
          colorScheme={resolvedTheme}
        />
      </View>
      <FloatBox visible={toastVisible} type={toastType} message={toastMessage} onHide={hideToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
