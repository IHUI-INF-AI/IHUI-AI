import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
import {
  AiCareerScreen as SharedAiCareerScreen,
  type AiCareerMatchItem,
  type AiCareerTrend,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'

function mapToCareerMatch(it: AiCareerItem): AiCareerMatchItem {
  const rawReasons = it.reasons
  const reasons = Array.isArray(rawReasons)
    ? rawReasons.filter((r): r is string => typeof r === 'string')
    : typeof it.content === 'string' && it.content.trim()
      ? it.content
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
      : []
  const trend: AiCareerTrend = it.trend === 'up' || it.trend === 'new' ? it.trend : 'stable'
  const match = typeof it.match === 'number' && Number.isFinite(it.match) ? it.match : 0
  const salary =
    typeof it.salary === 'string' && it.salary.trim()
      ? it.salary
      : typeof it.description === 'string' && it.description.trim()
        ? it.description
        : ''
  return { id: it.id, title: it.title, match, salary, trend, reasons }
}

export default function AiCareerScreen() {
  const { t } = useI18n()
  const [items, setItems] = useState<AiCareerMatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    const res = await getAiCareers({ pageSize: 20 })
    if (res.success) {
      setItems((res.data.list ?? []).map(mapToCareerMatch))
    } else {
      setError(res.error || t('aiCareer.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedAiCareerScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      selectedId={selectedId}
      onToggleItem={(id) => setSelectedId((prev) => (prev === id ? null : id))}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPlan={(c) =>
        Alert.alert(t('aiCareer.plan.title'), t('aiCareer.plan.message', { name: c.title }))
      }
      onBack={() => undefined}
    />
  )
}
