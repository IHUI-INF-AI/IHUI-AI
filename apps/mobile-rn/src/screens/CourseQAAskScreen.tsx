import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CourseQAAskScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (!question.trim()) {
      setError(t('courseQAAsk.placeholder'))
      return
    }
    setSubmitting(true); setError(''); setSuccess(false)
    try {
      const r = await fetch(`${API_BASE_URL}/api/course-qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question }),
      })
      if (!r.ok) throw new Error()
      setSuccess(true)
      setQuestion('')
    } catch { setError(t('courseQAAsk.submitting')) } finally { setSubmitting(false) }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('courseQAAsk.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.label}>{t('courseQAAsk.question')}</Text>
        <TextInput
          style={s.textarea}
          value={question}
          onChangeText={setQuestion}
          placeholder={t('courseQAAsk.placeholder')}
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
        {success ? <Text style={s.toast}>{t('courseQAAsk.success')}</Text> : null}
        <TouchableOpacity style={[s.btn, submitting && s.btnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.btnText}>{t('courseQAAsk.submit')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  label: { fontSize: 12, color: '#6B7280' },
  textarea: { marginTop: 6, minHeight: 120, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#111827' },
  error: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  toast: { fontSize: 12, color: '#10B981', marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
})
