import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card, Input } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { fetchApi } from '@ihui/api-client'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const FEEDBACK_TYPES = ['bug', 'suggestion', 'question', 'other'] as const
type FeedbackType = (typeof FEEDBACK_TYPES)[number]

const FEEDBACK_TYPE_KEYS: Record<FeedbackType, string> = {
  bug: 'feedback.type_bug',
  suggestion: 'feedback.type_suggestion',
  question: 'feedback.type_question',
  other: 'feedback.type_other',
}

export function FeedbackScreen() {
  const { t } = useI18n()
    const navigation = useNavigation<NavigationProp>()
  const [type, setType] = useState<FeedbackType>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!content) {
      setError(t('feedback.contentRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetchApi('/feedbacks', { method: 'POST', body: JSON.stringify({ type, content, contact }) })
      if (!res.success) throw new Error('http')
      setSuccess(t('feedback.success'))
      setContent('')
      setContact('')
    } catch {
      setError(t('feedback.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('feedback.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.label}>{t('feedback.type')}</Text>
          <View style={styles.typeRow}>
            {FEEDBACK_TYPES.map((tp) => (
              <TouchableOpacity
                key={tp}
                onPress={() => setType(tp)}
                style={[styles.typeBtn, type === tp && styles.typeBtnActive]}
              >
                <Text style={[styles.typeText, type === tp && styles.typeTextActive]}>
                  {t(FEEDBACK_TYPE_KEYS[tp])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>{t('feedback.content')}</Text>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder={t('feedback.contentPlaceholder')}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>{t('feedback.contact')}</Text>
          <Input
            value={contact}
            onChangeText={setContact}
            placeholder={t('feedback.contactPlaceholder')}
            style={styles.input}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <Button
            loading={submitting}
            disabled={submitting}
            onPress={handleSubmit}
            style={styles.submitBtn}
          >
            {submitting ? t('feedback.submitting') : t('feedback.submit')}
          </Button>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  body: { padding: 16 },
  card: { padding: 12, borderRadius: 8 },
  label: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  typeBtnActive: { backgroundColor: tokens.success.DEFAULT },
  typeText: { fontSize: 12, color: tokens.text.secondary },
  typeTextActive: { color: tokens.surface.light },
  textarea: { marginTop: 4, minHeight: 80 },
  input: { marginTop: 4 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT, marginTop: 8 },
  successText: { fontSize: 12, color: tokens.success.DEFAULT, marginTop: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8 },
})
