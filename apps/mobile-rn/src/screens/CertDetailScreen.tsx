import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Cert {
  id: string
  certNo: string
  title: string
  issuer: string
  holder: string
  issuedAt: string
  expiredAt?: string
  score: number
  verifyUrl: string
}

type Route = RouteProp<RootStackParamList, 'CertDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function CertDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [cert, setCert] = useState<Cert | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Cert>(`/api/certificates/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setCert(res.data)
      else setError(res.error || t('certDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error || !cert)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('certDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('certDetail.title')}</Text>
      <View style={styles.certCard}>
        <Text style={styles.certTitle}>{cert.title}</Text>
        <Text style={styles.certNo}>
          {t('certDetail.certNo')}:{cert.certNo}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.label}>{t('certDetail.holder')}</Text>
        <Text style={styles.value}>{cert.holder}</Text>
        <Text style={styles.label}>{t('certDetail.issuer')}</Text>
        <Text style={styles.value}>{cert.issuer}</Text>
        <Text style={styles.label}>{t('certDetail.score')}</Text>
        <Text style={styles.value}>{cert.score}</Text>
        <Text style={styles.label}>{t('certDetail.issuedAt')}</Text>
        <Text style={styles.value}>{cert.issuedAt}</Text>
        {cert.expiredAt ? (
          <>
            <Text style={styles.label}>{t('certDetail.expiredAt')}</Text>
            <Text style={styles.value}>{cert.expiredAt}</Text>
          </>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.verifyBtn}
        onPress={() => navigation.navigate('CertVerify', { certNo: cert.certNo })}
      >
        <Text style={styles.verifyText}>{t('certDetail.verify')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  certCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: '#ecfdf5',
  },
  certTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  certNo: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  divider: { height: 1, backgroundColor: PRIMARY, marginVertical: 12 },
  label: { marginTop: 6, fontSize: 11, color: '#6b7280' },
  value: { marginTop: 2, fontSize: 14, color: '#111827' },
  verifyBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: 'center',
  },
  verifyText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  btnText: { color: '#fff', fontSize: 14 },
})
