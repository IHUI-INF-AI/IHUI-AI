import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'NoteCreate'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function NoteCreateScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { courseId } = route.params ?? { courseId: '' }
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!title.trim() || !content.trim()) { setError(t('noteCreate.required')); return }
    setSaving(true); setError('')
    const res = await fetchApi<{ id: string }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), content: content.trim(), courseId, isPublic, tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('NoteDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('noteCreate.saveFailed'))
  }

  if (saving) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('noteCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('noteCreate.titleLabel')}</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('noteCreate.titlePlaceholder')} placeholderTextColor="#9ca3af" />
      <Text style={styles.label}>{t('noteCreate.contentLabel')}</Text>
      <TextInput style={[styles.input, styles.textarea]} value={content} onChangeText={setContent} placeholder={t('noteCreate.contentPlaceholder')} placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />
      <Text style={styles.label}>{t('noteCreate.tagsLabel')}</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder={t('noteCreate.tagsPlaceholder')} placeholderTextColor="#9ca3af" />
      <TouchableOpacity style={styles.visibilityRow} onPress={() => setIsPublic(!isPublic)}>
        <Text style={styles.visibilityLabel}>{t('noteCreate.isPublic')}</Text>
        <Text style={styles.visibilityValue}>{isPublic ? t('noteCreate.public') : t('noteCreate.private')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.submitBtn, saving && styles.submitDisabled]} onPress={onSubmit} disabled={saving}>
        <Text style={styles.submitText}>{t('noteCreate.submit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  label: { marginTop: 12, fontSize: 12, color: '#6b7280' },
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  textarea: { minHeight: 120, maxHeight: 240 },
  visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  visibilityLabel: { fontSize: 14, color: '#111827' },
  visibilityValue: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  submitBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  submitDisabled: { backgroundColor: '#9ca3af' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
