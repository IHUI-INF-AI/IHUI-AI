import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
import {
  AiCareerScreen as SharedAiCareerScreen,
  type AiCareerMatchItem,
  type AiCareerTrend,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'

function mapToMatchItem(it: AiCareerItem): AiCareerMatchItem {
  const rawReasons = it.reasons
  const reasons: string[] = Array.isArray(rawReasons)
    ? rawReasons.filter((r): r is string => typeof r === 'string')
    : typeof it.content === 'string' && it.content.trim()
      ? it.content
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
      : []

  const rawTrend = it.trend
  const trend: AiCareerTrend =
    rawTrend === 'up' || rawTrend === 'new' ? rawTrend : 'stable'

  const rawMatch = it.match
  const match =
    typeof rawMatch === 'number' && Number.isFinite(rawMatch) ? rawMatch : 0

  const salary =
    typeof it.salary === 'string' && it.salary.trim()
      ? it.salary
      : typeof it.description === 'string' && it.description.trim()
        ? it.description
        : undefined

  return {
    id: it.id,
    title: it.title,
    salary,
    match,
    trend,
    reasons,
  }
}

export default function AiCareerScreen() {
  const { t } = useI18n()
  const [items, setItems] = useState<AiCareerMatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await getAiCareers({ pageSize: 20 })
    if (res.success) {
      setItems((res.data.list ?? []).map(mapToMatchItem))
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
      onToggleItem={(id) =>
        setSelectedId((prev) => (prev === id ? null : id))
      }
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPlan={(item) =>
        Alert.alert(
          t('aiCareer.plan.title'),
          t('aiCareer.plan.message', { name: item.title }),
        )
      }
      onBack={() => undefined}
    />
  )
}
