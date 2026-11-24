// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import {
  AgentReviewDetailScreen as SharedAgentReviewDetailScreen,
  type AgentReviewListItem,
} from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type DetailRoute = RouteProp<RootStackParamList, 'AgentReviewDetail'>

/**
 * 评价详情薄壳：路由参数已带完整条目（列表项与详情项字段等构），首屏不请求；
 * 错误态的重试按 id 重取 `/agent-reviews` 并定位该条，是真正的重载而不是返回别名。
 */
export function AgentReviewDetailScreen() {
  const { resolvedTheme } = useTheme()
  const { t, locale } = useI18n()
  const navigation = useNavigation()
  const route = useRoute<DetailRoute>()
  const routeItem = route.params?.item
  const [item, setItem] = useState<AgentReviewListItem | null>(routeItem ?? null)
  const [error, setError] = useState(routeItem ? '' : t('agentReviewDetail.empty'))

  const formatTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return (iso: string): string => {
      const date = new Date(iso)
      return Number.isNaN(date.getTime()) ? iso : formatter.format(date)
    }
  }, [locale])

  const onBack = useCallback(() => navigation.goBack(), [navigation])
  const reload = useCallback(async () => {
    if (!routeItem) {
      setError(t('agentReviewDetail.empty'))
      return
    }
    try {
      const res = await fetchApi<AgentReviewListItem[]>('/agent-reviews')
      if (!res.success) throw new Error('agent-reviews failed')
      const found = (res.data ?? []).find((row) => row.id === routeItem.id)
      if (!found) {
        setError(t('agentReviewDetail.empty'))
        return
      }
      setItem({ ...found, createdAt: formatTime(found.createdAt) })
      setError('')
    } catch {
      setError(t('agentReviewList.loadFailed'))
    }
  }, [formatTime, routeItem, t])

  return (
    <SharedAgentReviewDetailScreen
      t={t}
      item={item}
      loading={false}
      error={error}
      onBack={onBack}
      onRetry={reload}
      colorScheme={resolvedTheme}
    />
  )
}
