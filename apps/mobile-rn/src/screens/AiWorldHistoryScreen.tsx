// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiWorldHistoryScreen AI 世界历史版本列表(mobile-rn 端 wrapper)
 *
 * 承载 web `/ai-world/history`(apps/web/app/(main)/ai-world/history/page.tsx):
 * GET /api/ai-world/history(需登录,未登录不发注定 401 的请求,与 web useAuthGate 同口径)。
 * UI 下沉共享层 @ihui/rn-app AiWorldCollectionScreen(variant='history'),
 * 时间列与 web 同口径取 updatedAt;条目点击进详情,登录引导跳 Login。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiWorldHistory } from '@ihui/api-client'
import type { AiWorldCollectionItem } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { AiWorldCollectionScreen } from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AiWorldHistoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<AiWorldCollectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!user) return
      if (mode === 'initial') setLoading(true)
      else setRefreshing(true)
      setError('')
      try {
        const res = await getAiWorldHistory()
        if (!res.success) {
          setError(apiFailureToText(res, t('aiWorldHistoryPage.fetchFailed')))
          setItems([])
          return
        }
        setItems(res.data.list ?? [])
      } catch {
        setError(t('aiWorldHistoryPage.fetchFailed'))
        setItems([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t, user],
  )

  useEffect(() => {
    if (!user) return
    void load('initial')
  }, [load, user])

  return (
    <AiWorldCollectionScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      variant="history"
      title={t('aiWorldHistoryPage.title')}
      subtitle={t('aiWorldHistoryPage.subtitle')}
      emptyText={t('aiWorldHistoryPage.empty')}
      loginRequiredText={user ? '' : t('aiWorldHistoryPage.loginRequired')}
      loginLabel={t('common.login')}
      onLogin={() => navigation.navigate('Login')}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={() => void load('initial')}
      items={items.map((item) => ({
        id: item.id,
        title: item.title,
        coverImage: item.coverImage,
        viewCount: item.viewCount,
        date: item.updatedAt ?? item.createdAt ?? '',
      }))}
      onPressItem={(id) => navigation.navigate('AiWorldDetail', { id })}
      onRefresh={() => void load('refresh')}
    />
  )
}

export default AiWorldHistoryScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
