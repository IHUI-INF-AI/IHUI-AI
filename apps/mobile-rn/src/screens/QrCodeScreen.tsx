import { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { QrCodeScreen as SharedQrCodeScreen, type QrCodeItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function QrCodeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<QrCodeItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetchApi<QrCodeItem>('/user/qr-code')
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

  return (
    <SharedQrCodeScreen
      t={t}
      info={info}
      loading={loading}
      error={error}
      onShare={onShare}
      onBack={() => navigation.goBack()}
    />
  )
}
