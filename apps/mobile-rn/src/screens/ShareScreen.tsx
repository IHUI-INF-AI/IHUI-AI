import { useState } from 'react'
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ShareResp { shareUrl: string; shareCode: string; expireAt: string }

type Route = RouteProp<RootStackParamList, 'Share'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function ShareScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { targetType, targetId, title } = route.params
  const [result, setResult] = useState<ShareResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remark, setRemark] = useState('')

  const onCreate = async () => {
    setLoading(true); setError('')
    const res = await fetchApi<ShareResp>('/api/shares', { method: 'POST', body: JSON.stringify({ targetType, targetId, remark: remark.trim() }) })
    setLoading(false)
    if (res.success && res.data) setResult(res.data)
    else if (!res.success) setError(res.error || t('share.createFailed'))
  }

  const onShare = async () => {
    if (!result) return
    try { await Share.share({ message: `${title}\n${result.shareUrl}` }) } catch { /* user cancelled */ }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('share.title')}</Text>
      <Text style={styles.targetTitle}>{title}</Text>
      <Text style={styles.label}>{t('share.remark')}</Text>
      <TextInput style={styles.input} value={remark} onChangeText={setRemark} placeholder={t('share.remarkPlaceholder')} placeholderTextColor="#9ca3af" />
      <TouchableOpacity style={[styles.createBtn, loading && styles.btnDisabled]} onPress={onCreate} disabled={loading}>
        <Text style={styles.createText}>{loading ? t('common.loading') : t('share.create')}</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('share.url')}</Text>
          <Text style={styles.cardValue} numberOfLines={1} selectable>{result.shareUrl}</Text>
          <Text style={styles.cardLabel}>{t('share.code')}</Text>
          <Text style={styles.cardValue} selectable>{result.shareCode}</Text>
          <Text style={styles.cardLabel}>{t('share.expireAt')}</Text>
          <Text style={styles.cardValue}>{result.expireAt}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareText}>{t('share.shareNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 4 },
  targetTitle: { fontSize: 14, color: PRIMARY, marginBottom: 12 },
  label: { marginTop: 12, fontSize: 12, color: '#6b7280' },
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  createBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#9ca3af' },
  createText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { marginTop: 12, fontSize: 13, color: '#dc2626' },
  card: { marginTop: 16, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  cardLabel: { marginTop: 8, fontSize: 11, color: '#9ca3af' },
  cardValue: { marginTop: 2, fontSize: 14, color: '#111827' },
  shareBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  shareText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
