/**
 * ChangePhoneScreen — APP 改手机号页面(changePhone.vue 迁移)
 * 流程:输入新手机号 → 获取验证码(60s 倒计时)→ 提交绑定。
 * 路由参数:uuid(必填,用户标识)。
 */
import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Route {
  params?: { uuid?: string }
}

interface Nation {
  title: string
  content: string
  id: number
}

const NATIONS: Nation[] = [
  { title: '美国', content: '+1', id: 1 },
  { title: '台湾', content: '+886', id: 2 },
  { title: '香港', content: '+852', id: 3 },
  { title: '韩国', content: '+82', id: 4 },
  { title: '日本', content: '+81', id: 5 },
]

export function ChangePhoneScreen({ route }: { route?: Route }) {
  const navigation = useNavigation<NavigationProp>()
  const { token } = useAuth()
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
      return
    }
    if (phoneNumber.length !== 11) {
      setTip('请输入正确电话号码!')
      return
    }
    setTip('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: phoneNumber, type: 2 }),
      })
      if (!resp.ok) throw new Error('http')
      startCountdown()
    } catch {
      setTip('验证码发送失败,请稍后重试')
    }
  }

  const handleSubmit = async () => {
    if (!phoneNumber) {
      setTip('请输入手机号码!')
      return
    }
    if (!codeValue) {
      setTip('请输入验证码!')
      return
    }
    if (!uuid) {
      setTip('缺少用户标识,无法绑定')
      return
    }
    setSubmitting(true)
    setTip('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/phone/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: phoneNumber, uuid, code: codeValue }),
      })
      const data = (await resp.json()) as { code?: string; message?: string; msg?: string }
      if (!resp.ok || data.code !== '200') {
        setTip(data.msg || data.message || '绑定失败')
        return
      }
      setTip('绑定成功!')
      const t = setTimeout(() => {
        clearTimeout(t)
        navigation.goBack()
      }, 1000)
    } catch {
      setTip('网络异常,请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>绑定手机号</Text>

      <View style={s.inputWbox}>
        <View style={s.inputBox}>
          <Pressable style={s.areaBox} onPress={() => setNationShow((v) => !v)} accessibilityLabel="选择区号">
            <Text style={s.areaText}>{phoneHead}</Text>
            <Text style={s.areaArrow}>▾</Text>
          </Pressable>
          <TextInput
            style={s.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="手机号码"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>
        {nationShow ? (
          <View style={s.nationBox}>
            {NATIONS.map((n) => (
              <Pressable
                key={n.id}
                style={s.nationItem}
                onPress={() => {
                  setPhoneHead(n.content)
                  setNationShow(false)
                }}
                accessibilityLabel={`${n.title} ${n.content}`}
              >
                <Text style={s.nationTitle}>{n.title}</Text>
                <Text style={s.nationCode}>{n.content}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={s.inputWbox}>
        <View style={s.inputBox}>
          <TextInput
            style={s.input}
            value={codeValue}
            onChangeText={setCodeValue}
            placeholder="验证码"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={6}
          />
          {sendCodeShow ? (
            <Pressable style={s.sendBtn} onPress={sendCode} accessibilityLabel="发送验证码">
              <Text style={s.sendText}>发送验证码</Text>
            </Pressable>
          ) : codeMin > 0 ? (
            <Text style={s.countdownText}>{codeMin}秒后重新获取</Text>
          ) : (
            <Pressable style={s.sendBtn} onPress={sendCode} accessibilityLabel="重新获取验证码">
              <Text style={s.sendText}>获取验证码</Text>
            </Pressable>
          )}
        </View>
      </View>

      {tip ? <Text style={s.tipText}>{tip}</Text> : null}

      <Pressable
        style={[s.submitBtn, submitting && s.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityLabel="确定"
      >
        <Text style={s.submitText}>{submitting ? '提交中...' : '确定'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#8D80E5', textAlign: 'center', marginBottom: 24 },
  inputWbox: { width: '100%', marginBottom: 16 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#F9FAFB',
  },
  areaBox: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginRight: 12 },
  areaText: { fontSize: 14, color: '#374151' },
  areaArrow: { fontSize: 10, color: '#9CA3AF', marginLeft: 4 },
  input: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  sendBtn: { paddingLeft: 12 },
  sendText: { fontSize: 13, fontWeight: '700', color: '#847CFF' },
  countdownText: { fontSize: 12, color: '#6B7280', paddingLeft: 12 },
  nationBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F7F8FF',
    overflow: 'hidden',
  },
  nationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  nationTitle: { fontSize: 13, color: '#3D3D3D' },
  nationCode: { fontSize: 13, color: '#979797' },
  tipText: { fontSize: 12, color: '#DC2626', marginBottom: 12 },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#847CFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
})

export default ChangePhoneScreen
