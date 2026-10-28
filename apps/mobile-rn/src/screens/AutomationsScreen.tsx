// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { getAutomation, listAutomations, type UserAutomation } from '@ihui/api-client'
import {
  AutomationsScreen as SharedAutomationsScreen,
  getTokens,
  type AutomationItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type AutomationRouteProp = RouteProp<RootStackParamList, 'Automations'>
type TReturn = ReturnType<typeof useI18n>['t']

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/** 端内映射:日期与状态文案在此算好后传入共享层(共享层不做 toLocaleString,防三端漂移) */
function toAutomationItem(item: UserAutomation, t: TReturn): AutomationItem {
  const isActive = item.status === 'active'
  return {
    id: item.id,
    name: item.name,
    active: isActive,
    statusText: isActive ? t('automations.active') : t('automations.paused'),
    scheduleType: item.scheduleType,
    scheduleText:
      item.scheduleType === 'recurring'
        ? t('automations.scheduleRecurring')
        : t('automations.scheduleOnce'),
    rrule: item.rrule,
    scheduledAtText: item.scheduledAt ? formatDateTime(item.scheduledAt) : null,
    timezoneText: item.timezone || '—',
    lastRunText: formatDateTime(item.lastRunAt),
    nextRunText: formatDateTime(item.nextRunAt),
    prompt: item.prompt,
    lastResultSummary: item.lastResult?.summary ?? null,
  }
}

/**
 * 只读「自动化」屏(RN wrapper)。两种形态:
 *  - 传入 id(由 Workflows 跳转):拉取单个自动化详情并展示配置与最近结果。
 *  - 未传 id(作为独立入口打开):降级为自动化列表,可继续下钻。
 * 全程无写入 / 无编辑器。纯 UI 已迁至 @ihui/rn-app 共享层,本文件只保留 API/导航/主题与数据映射。
 */
export function AutomationsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<AutomationRouteProp>()
  const id = route.params?.id

  const [detail, setDetail] = useState<AutomationItem | null>(null)
  const [items, setItems] = useState<AutomationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      if (id) {
        setDetail(toAutomationItem(await getAutomation(id), t))
      } else {
        const res = await listAutomations({ limit: 50 })
        setItems(res.items.map((item) => toAutomationItem(item, t)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('automations.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const handleOpen = useCallback(
    (automationId: string) => {
      navigation.navigate('Automations', { id: automationId })
    },
    [navigation],
  )

  return (
    <SharedAutomationsScreen
      t={t}
      tk={getTokens(resolvedTheme)}
      items={items}
      detail={detail}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => void load()}
      onOpen={handleOpen}
      renderLoading={(text) => <Loading text={text} />}
      renderEmpty={({ text, actionText, onAction }) => (
        <Empty text={text} actionText={actionText} onAction={onAction} />
      )}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
