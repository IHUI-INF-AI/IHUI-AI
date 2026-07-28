import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface QrInfo {
  content: string
  url: string
  inviteCode: string
}

export function QrCodeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<QrInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<QrInfo>('/user/qr-code')
        if (cancelled) return
        if (!resp.success) throw new Error('http')
        setInfo(resp.data ?? null)
      } catch {
        if (!cancelled) setError(t('qrCode.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onShare = async () => {
    if (!info) return
    try {
      await Share.share({ message: info.url })
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('common.empty')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('qrCode.title')}</Text>
      </View>
      <View style={styles.body}>
        <Card style={styles.card}>
          <View style={styles.qrBox}>
            <Text style={styles.qrPlaceholder}>QR</Text>
          </View>
          <Text style={styles.tip}>{t('qrCode.scanTip')}</Text>
          <Text style={styles.code}>{info.inviteCode}</Text>
          <TouchableOpacity onPress={onShare} style={styles.shareBtn}>
            <Text style={styles.shareText}>{t('qrCode.share')}</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  center: { flex: 1, backgroundColor: tokens.surface.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  body: { padding: 16 },
  card: { padding: 16, borderRadius: 8, alignItems: 'center' },
  qrBox: { width: 200, height: 200, borderRadius: 8, backgroundColor: tokens.surface.card, alignItems: 'center', justifyContent: 'center' },
  qrPlaceholder: { fontSize: 32, fontWeight: '700', color: tokens.text.tertiary, letterSpacing: 2 },
  tip: { marginTop: 12, fontSize: 12, color: tokens.text.secondary },
  code: { marginTop: 6, fontSize: 18, fontWeight: '700', color: tokens.success.DEFAULT, letterSpacing: 1 },
  shareBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
  shareText: { fontSize: 13, color: tokens.surface.light, fontWeight: '600' },
  muted: { fontSize: 13, color: tokens.text.secondary },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
})
