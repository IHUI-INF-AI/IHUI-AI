import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ChangePhoneScreen as SharedChangePhoneScreen, type NationOption } from '@ihui/rn-app'
import { InputArea } from '../components/InputArea'
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

const NOTE_MAX_LENGTH = 500

/**
 * mobile-rn 换绑手机号(2026-07-30 接入本地 InputArea + FloatBox)
 *
 * shell 层职责:
 * - 主体调用 @ihui/rn-app.SharedChangePhoneScreen(国家区号 + 手机号 + 验证码 + 提交)
 * - 底部叠加 mobile-rn 本地 InputArea(附加备注输入,例如"换号原因 / 申诉说明")
 *   + 浮动提示 FloatBox(成功/错误 toast)
 */
export function ChangePhoneScreen({ route }: { route?: { params?: { uuid?: string } } }) {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const uuid = route?.params?.uuid ?? ''
  const [phoneNumber, setPhoneNumber] = useState('')
  const [codeValue, setCodeValue] = useState('')
  const [phoneHead, setPhoneHead] = useState('+86')
  const [nationShow, setNationShow] = useState(false)
  const [codeMin, setCodeMin] = useState(60)
  const [sendCodeShow, setSendCodeShow] = useState(true)
  const [tip, setTip] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
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
      const res = await fetchApi('/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, type: 2 }),
      })
      if (!res.success) throw new Error()
      startCountdown()
      showToast('success', '验证码已发送')
    } catch {
      setTip('验证码发送失败,请稍后重试')
      showToast('error', '验证码发送失败')
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
    if (!uuid) {
      setTip('缺少用户标识,无法绑定')
      showToast('error', '缺少用户标识')
      return
    }
    setSubmitting(true)
    setTip('')
    try {
      const res = await fetchApi('/auth/phone/edit', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, uuid, code: codeValue, note: note.trim() }),
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
    } catch {
      setTip('网络异常,请稍后重试')
      showToast('error', '网络异常')
    } finally {
      setSubmitting(false)
    }
  }

  // InputArea 备注提交:仅做本地回显(真实业务可对接 /auth/phone/edit 的 note 字段)
  const handleNoteSubmit = useCallback(
    async (text: string) => {
      setNoteSubmitting(true)
      // 演示:把备注回写到本地 tip(不实际发起网络请求)
      setTip(`已记录备注: ${text.slice(0, 20)}${text.length > 20 ? '...' : ''}`)
      showToast('success', '备注已暂存')
      setNoteSubmitting(false)
    },
    [showToast],
  )

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
        />
        <View style={styles.noteWrap}>
          <InputArea
            value={note}
            onChangeText={setNote}
            placeholder="备注(选填,如换号原因 / 申诉说明)"
            maxLength={NOTE_MAX_LENGTH}
            onSubmit={handleNoteSubmit}
            loading={noteSubmitting}
          />
        </View>
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
  noteWrap: {
    marginTop: 8,
  },
})
