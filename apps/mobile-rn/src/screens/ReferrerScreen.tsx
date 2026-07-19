import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card, Input } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ReferrerInfo {
  referrerName: string | null
  referrerCode: string | null
}

export function ReferrerScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<ReferrerInfo | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/user/referrer`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) throw new Error('http')
        const data = (await resp.json()) as { data?: ReferrerInfo }
        if (cancelled) return
        setInfo(data.data ?? { referrerName: null, referrerCode: null })
      } catch {
        if (!cancelled) setError(t('referrer.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const handleBind = async () => {
    if (!code) {
      setError(t('referrer.codeRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/user/referrer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      })
      if (!resp.ok) throw new Error('http')
      setInfo({ referrerName: code, referrerCode: code })
      setSuccess(t('referrer.bindSuccess'))
      setCode('')
    } catch {
      setError(t('referrer.bindFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('referrer.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.label}>{t('referrer.current')}</Text>
          {info?.referrerCode ? (
            <Text style={styles.value}>{info.referrerName || info.referrerCode}</Text>
          ) : (
            <Text style={styles.muted}>{t('referrer.empty')}</Text>
          )}
          <Text style={styles.desc}>{t('referrer.desc')}</Text>
        </Card>
        {info?.referrerCode ? null : (
          <Card style={styles.card}>
            <Text style={styles.label}>{t('referrer.codeLabel')}</Text>
            <Input
              value={code}
              onChangeText={setCode}
              placeholder={t('referrer.codePlaceholder')}
              autoCapitalize="none"
              style={styles.input}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}
            <Button loading={submitting} disabled={submitting} onPress={handleBind} style={styles.submitBtn}>
              {submitting ? t('referrer.submitting') : t('referrer.submit')}
            </Button>
          </Card>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16 },
  card: { padding: 12, marginBottom: 12, borderRadius: 8 },
  label: { fontSize: 12, color: '#6B7280' },
  value: { marginTop: 6, fontSize: 16, fontWeight: '600', color: '#10B981' },
  desc: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  input: { marginTop: 4 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  successText: { fontSize: 12, color: '#10B981', marginTop: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8 },
  muted: { fontSize: 13, color: '#6B7280' },
})
