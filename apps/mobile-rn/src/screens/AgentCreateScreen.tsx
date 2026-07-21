import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function AgentCreateScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [category, setCategory] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!name.trim()) { setError(t('agentCreate.nameRequired')); return }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim(), systemPrompt: systemPrompt.trim(), category: category.trim() || 'general', isPublic }),
    })
    setSaving(false)
    if (res.success && res.data) {
      navigation.replace('AgentDetail', { id: res.data.id })
    } else if (!res.success) {
      setError(res.error || t('agentCreate.saveFailed'))
    }
  }

  if (saving) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('agentCreate.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>{t('agentCreate.name')}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('agentCreate.namePlaceholder')} placeholderTextColor="#9ca3af" />
      <Text style={styles.label}>{t('agentCreate.category')}</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder={t('agentCreate.categoryPlaceholder')} placeholderTextColor="#9ca3af" />
      <Text style={styles.label}>{t('agentCreate.description')}</Text>
      <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder={t('agentCreate.descPlaceholder')} placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />
      <Text style={styles.label}>{t('agentCreate.systemPrompt')}</Text>
      <TextInput style={[styles.input, styles.textarea]} value={systemPrompt} onChangeText={setSystemPrompt} placeholder={t('agentCreate.promptPlaceholder')} placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />
      <TouchableOpacity style={styles.visibilityRow} onPress={() => setIsPublic(!isPublic)}>
        <Text style={styles.visibilityLabel}>{t('agentCreate.isPublic')}</Text>
        <Text style={styles.visibilityValue}>{isPublic ? t('agentCreate.public') : t('agentCreate.private')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.submitBtn, saving && styles.submitDisabled]} onPress={onSubmit} disabled={saving}>
        <Text style={styles.submitText}>{t('agentCreate.submit')}</Text>
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
  textarea: { minHeight: 80, maxHeight: 160 },
  visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  visibilityLabel: { fontSize: 14, color: '#111827' },
  visibilityValue: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  submitBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  submitDisabled: { backgroundColor: '#9ca3af' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
