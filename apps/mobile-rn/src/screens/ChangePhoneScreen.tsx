import { useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ChangePhoneScreen as SharedChangePhoneScreen, type NationOption } from '@ihui/rn-app'
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCountdown = () => {
    setSendCodeShow(false); setCodeMin(60)
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
    if (!phoneNumber) { setTip('请输入手机号码!'); return }
    if (phoneNumber.length !== 11) { setTip('请输入正确电话号码!'); return }
    setTip('')
    try {
      const res = await fetchApi('/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, type: 2 }),
      })
      if (!res.success) throw new Error()
      startCountdown()
    } catch { setTip('验证码发送失败,请稍后重试') }
  }

  const handleSubmit = async () => {
    if (!phoneNumber) { setTip('请输入手机号码!'); return }
    if (!codeValue) { setTip('请输入验证码!'); return }
    if (!uuid) { setTip('缺少用户标识,无法绑定'); return }
    setSubmitting(true); setTip('')
    try {
      const res = await fetchApi('/auth/phone/edit', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, uuid, code: codeValue }),
      })
      if (!res.success) { setTip(res.error || '绑定失败'); return }
      setTip('绑定成功!')
      const tm = setTimeout(() => { clearTimeout(tm); navigation.goBack() }, 1000)
    } catch { setTip('网络异常,请稍后重试') } finally { setSubmitting(false) }
  }

  return (
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
      onSelectNation={(n) => { setPhoneHead(n.content); setNationShow(false) }}
      onSendCode={sendCode}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
