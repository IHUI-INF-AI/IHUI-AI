import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface VerifyResult { valid: boolean; certNo: string; title: string; holder: string; issuer: string; issuedAt: string }

type Route = RouteProp<RootStackParamList, 'CertVerify'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function CertVerifyScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const initialNo = route.params?.certNo ?? ''
  const [certNo, setCertNo] = useState(initialNo)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onVerify = async () => {
    if (!certNo.trim()) return
    setLoading(true); setError(''); setResult(null)
    const res = await fetchApi<VerifyResult>(`/api/certs/verify/${encodeURIComponent(certNo.trim())}`)
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(res.error || t('certVerify.failed'))
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('certVerify.title')}</Text>
      <Text style={styles.label}>{t('certVerify.certNo')}</Text>
      <TextInput style={styles.input} value={certNo} onChangeText={setCertNo} placeholder={t('certVerify.placeholder')} placeholderTextColor="#9ca3af" returnKeyType="search" onSubmitEditing={onVerify} />
      <TouchableOpacity style={[styles.verifyBtn, (!certNo.trim() || loading) && styles.verifyDisabled]} onPress={onVerify} disabled={!certNo.trim() || loading}>
        <Text style={styles.verifyText}>{loading ? t('common.loading') : t('certVerify.verify')}</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={[styles.resultCard, result.valid ? styles.validCard : styles.invalidCard]}>
          <Text style={[styles.resultStatus, result.valid ? styles.valid : styles.invalid]}>{result.valid ? t('certVerify.valid') : t('certVerify.invalid')}</Text>
          {result.valid ? (
            <>
              <Text style={styles.certTitle}>{result.title}</Text>
              <Text style={styles.resultLine}>{t('certVerify.holder')}:{result.holder}</Text>
              <Text style={styles.resultLine}>{t('certVerify.issuer')}:{result.issuer}</Text>
              <Text style={styles.resultLine}>{t('certVerify.issuedAt')}:{result.issuedAt}</Text>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  label: { marginTop: 12, fontSize: 12, color: '#6b7280' },
  input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  verifyBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  verifyDisabled: { backgroundColor: '#9ca3af' },
  verifyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { marginTop: 12, fontSize: 13, color: '#dc2626' },
  resultCard: { marginTop: 16, padding: 16, borderRadius: 8, borderWidth: 1 },
  validCard: { borderColor: PRIMARY, backgroundColor: '#ecfdf5' },
  invalidCard: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  resultStatus: { fontSize: 16, fontWeight: '600' },
  valid: { color: PRIMARY },
  invalid: { color: '#dc2626' },
  certTitle: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#111827' },
  resultLine: { marginTop: 4, fontSize: 13, color: '#374151' },
})
