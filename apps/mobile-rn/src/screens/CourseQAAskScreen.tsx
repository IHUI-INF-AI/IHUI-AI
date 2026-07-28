import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { fetchApi } from '@ihui/api-client'
type Nav = NativeStackNavigationProp<RootStackParamList>

export function CourseQAAskScreen() {
  const { t } = useI18n()
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
      const res = await fetchApi('/course-qa', { method: 'POST', body: JSON.stringify({ question }) })
      if (!res.success) throw new Error()
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
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  label: { fontSize: 12, color: tokens.text.secondary },
  textarea: { marginTop: 6, minHeight: 120, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, fontSize: 14, color: tokens.text.primary },
  error: { fontSize: 12, color: tokens.danger.DEFAULT, marginTop: 8 },
  toast: { fontSize: 12, color: tokens.success.DEFAULT, marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: tokens.success.DEFAULT, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
})
