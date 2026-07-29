import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AigcCoverScreen as SharedAigcCoverScreen,
  type AigcCoverFilter,
  type AigcCoverOption,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type AigcCoverRouteParamList = {
  AigcCover: { id: string; title: string } | undefined
}
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<AigcCoverRouteParamList, 'AigcCover'>

interface AigcCoverResult {
  url?: string
  label?: string
  source?: 'work' | 'ai'
}

function readResult(raw: unknown): AigcCoverResult {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const url = typeof r.url === 'string' ? r.url : undefined
  const label = typeof r.label === 'string' ? r.label : undefined
  const source = r.source === 'work' || r.source === 'ai' ? r.source : undefined
  return { url, label, source }
}

function mapTaskToCover(task: AigcTask): AigcCoverOption | null {
  const r = readResult(task.result)
  if (!r.url) return null
  return {
    id: task.taskId,
    url: r.url,
    source: r.source || 'work',
    label: r.label || '作品',
  }
}

export default function AigcCoverScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { t } = useI18n()
  const workTitle = (route.params?.title as string) ?? t('aigcCover.workTitleDefault')
  const [covers, setCovers] = useState<AigcCoverOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [filter, setFilter] = useState<AigcCoverFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAigcTasks({ page: 1, pageSize: 20 })
        if (cancelled) return
        if (res.success) {
          const mapped = res.data.list
            .map(mapTaskToCover)
            .filter((c): c is AigcCoverOption => c !== null)
          setCovers(mapped)
        } else {
          setError(res.error || t('aigcCover.loadFailed'))
        }
      } catch {
        if (!cancelled) setError(t('aigcCover.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onConfirm = (selected: AigcCoverOption) => {
    Alert.alert(
      t('aigcCover.applied.title'),
      t('aigcCover.applied.message', { title: workTitle, label: selected.label }),
      [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
    )
  }

  const onGenerateAi = () => {
    Alert.alert(t('aigcCover.aiGen.title'), t('aigcCover.aiGen.message'), [
      { text: t('common.gotIt') },
    ])
  }

  return (
    <SharedAigcCoverScreen
      t={t}
      workTitle={workTitle}
      covers={covers}
      selectedId={selectedId}
      filter={filter}
      loading={loading}
      error={error}
      onSelectCover={setSelectedId}
      onFilterChange={setFilter}
      onConfirm={onConfirm}
      onGenerateAi={onGenerateAi}
      onBack={() => navigation.goBack()}
    />
  )
}
