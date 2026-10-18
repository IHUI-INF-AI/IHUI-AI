// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, RefreshControl } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { getAutomation, listAutomations, type UserAutomation } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { AutomationCard } from '../components/automation/AutomationCard'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type AutomationRouteProp = RouteProp<RootStackParamList, 'Automations'>

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row items-start gap-2">
      <Text className="w-20 shrink-0 text-xs text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-xs text-foreground">{value}</Text>
    </View>
  )
}

/**
 * 只读「自动化」屏。两种形态:
 *  - 传入 id(由 Workflows 跳转):拉取单个自动化详情并展示配置与最近结果。
 *  - 未传 id(作为独立入口打开):降级为自动化列表,可继续下钻。
 * 全程无写入 / 无编辑器。
 */
export function AutomationsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<AutomationRouteProp>()
  const id = route.params?.id

  const [detail, setDetail] = useState<UserAutomation | null>(null)
  const [list, setList] = useState<UserAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      if (id) {
        setDetail(await getAutomation(id))
      } else {
        const res = await listAutomations({ limit: 50 })
        setList(res.items)
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

  const handleSelect = useCallback(
    (item: UserAutomation) => {
      navigation.navigate('Automations', { id: item.id })
    },
    [navigation],
  )

  if (loading) return <Loading text={t('common.loading')} />
  if (error) return <Empty text={error} actionText={t('common.retry')} onAction={load} />

  if (detail) {
    const item = detail
    const isActive = item.status === 'active'
    return (
      <ScrollView
        className="flex-1 bg-background px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Card className="mb-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex-1 pr-2">{item.name}</CardTitle>
            <Badge
              variant={isActive ? 'default' : 'secondary'}
              label={isActive ? t('automations.active') : t('automations.paused')}
            />
          </CardHeader>
          <CardContent>
            <Row
              label={t('automations.schedule')}
              value={
                item.scheduleType === 'recurring'
                  ? t('automations.scheduleRecurring')
                  : t('automations.scheduleOnce')
              }
            />
            {item.scheduleType === 'recurring' && item.rrule ? (
              <Row label={t('automations.rrule')} value={item.rrule} />
            ) : null}
            {item.scheduleType === 'once' && item.scheduledAt ? (
              <Row label={t('automations.nextRun')} value={formatDateTime(item.scheduledAt)} />
            ) : null}
            <Row label={t('automations.timezone')} value={item.timezone || '—'} />
            <Row label={t('automations.lastRun')} value={formatDateTime(item.lastRunAt)} />
            <Row label={t('automations.nextRun')} value={formatDateTime(item.nextRunAt)} />
            <View className="mt-2">
              <Text className="mb-1 text-xs text-muted-foreground">{t('automations.prompt')}</Text>
              <Text className="text-sm text-foreground">{item.prompt}</Text>
            </View>
            {item.lastResult ? (
              <View className="mt-2">
                <Text className="mb-1 text-xs text-muted-foreground">
                  {t('automations.lastRun')}
                </Text>
                <Text className="text-sm text-foreground">{item.lastResult.summary}</Text>
              </View>
            ) : null}
          </CardContent>
        </Card>
      </ScrollView>
    )
  }

  // 列表降级形态(未传 id 时)
  if (list.length === 0) {
    return (
      <Empty text={t('automations.empty')} actionText={t('common.retry')} onAction={load} />
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-background px-4 pt-4"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      {list.map((item) => (
        <AutomationCard key={item.id} item={item} onSelect={handleSelect} />
      ))}
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
