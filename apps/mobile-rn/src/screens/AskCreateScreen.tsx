import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AskCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!title.trim()) { setError(t('askCreate.titleRequired')); return }
    setSaving(true); setError('')
    const res = await fetchApi<{ id: string }>('/api/asks', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), content: content.trim(), tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('AskDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('askCreate.saveFailed'))
  }

  if (saving) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('askCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('askCreate.titleLabel')}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('askCreate.titlePlaceholder')} placeholderTextColor={tokens.text.tertiary} />
      <Text style={styles.label}>{t('askCreate.contentLabel')}</Text>
      <TextInput style={[styles.input, styles.textarea]} value={content} onChangeText={setContent} placeholder={t('askCreate.contentPlaceholder')} placeholderTextColor={tokens.text.tertiary} multiline textAlignVertical="top" />
      <Text style={styles.label}>{t('askCreate.tagsLabel')}</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder={t('askCreate.tagsPlaceholder')} placeholderTextColor={tokens.text.tertiary} />
      <TouchableOpacity style={[styles.submitBtn, saving && styles.submitDisabled]} onPress={onSubmit} disabled={saving}>
        <Text style={styles.submitText}>{t('askCreate.submit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.surface.bg, padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8 },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  label: { marginTop: 12, fontSize: 12, color: tokens.text.secondary },
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, fontSize: 14, color: tokens.text.primary },
  textarea: { minHeight: 120, maxHeight: 240 },
  submitBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: tokens.success.DEFAULT, alignItems: 'center' },
  submitDisabled: { backgroundColor: tokens.text.tertiary },
  submitText: { color: tokens.surface.light, fontSize: 15, fontWeight: '600' },
})
