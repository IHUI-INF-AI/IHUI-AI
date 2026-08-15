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

/**
 * 对齐说明:Uniapp 历史项目 pages.json 全量注册表无证书页
 * (zhengshu/certificate 0 命中),证书为 RN 端独有功能,无 Uniapp 基准可对齐,
 * 文案为中文兜底。mobile-rn/shared zh-CN 暂无 certificate.* key
 * (translate 缺 key 返回 key 本身),key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'certificate.title': '我的证书',
  'certificate.empty': '暂无证书',
  'certificate.loadFailed': '加载失败',
  'certificate.status.issued': '已发放',
  'certificate.status.expired': '已过期',
  'certificate.status.revoked': '已撤销',
  'certificate.issuedDate': '发放日期',
  'certificate.expiryDate': '有效期至',
}

export function CertificateScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<CertificateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<CertPage>('/api/certificates')
      if (!res.success) throw new Error()
      setItems(res.data.list ?? [])
    } catch {
      setError(uniappT('certificate.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [uniappT])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedCertificateScreen
      t={uniappT}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(item) => {
        navigation.navigate('CertDetail', { id: item.id })
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
