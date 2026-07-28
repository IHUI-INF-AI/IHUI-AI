import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CertificateScreen as SharedCertificateScreen } from '@ihui/rn-app'
import type { CertificateItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CertPage {
  list: CertificateItem[]
  total: number
}

export function CertificateScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<CertificateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<CertPage>('/api/certificates')
      if (!res.success) throw new Error()
      setItems(res.data.list ?? [])
    } catch {
      setError(t('certificate.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedCertificateScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(item) => {
        // @ts-expect-error CertificateDetail 路由待在 RootStackParamList 注册(navigation 基础设施,非共享层范围)
        navigation.navigate('CertificateDetail', { id: item.id })
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
