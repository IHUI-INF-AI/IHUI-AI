import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import {
  AigcCoverScreen as SharedAigcCoverScreen,
  type AigcCoverFilter,
  type AigcCoverOption,
} from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n } from '../i18n'

type AigcCoverRouteParamList = {
  AigcCover: { id: string; title: string } | undefined
}
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<AigcCoverRouteParamList, 'AigcCover'>

// AigcTask.result 为 unknown,用类型守卫安全提取 url/label/source 字段。
// 避免对 unknown 直接 `as` 断言(不安全),也禁止 any 兜底。
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

function mapTaskToCover(task: AigcTask, defaultLabel: string): AigcCoverOption | null {
  const r = readResult(task.result)
  if (!r.url) return null
  return {
    id: task.taskId,
    url: r.url,
    source: r.source || 'work',
    label: r.label || defaultLabel,
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

  // 从 @ihui/api-client 加载真实 AIGC 任务列表,映射为 AigcCoverOption[]。
  // cancelled flag 防止组件卸载后 setState 导致内存泄漏。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAigcTasks({ page: 1, pageSize: 20 })
        if (cancelled) return
        if (res.success) {
          const mapped = res.data.list
            .map((task) => mapTaskToCover(task, t('aigcCover.labelDefault')))
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

  const onConfirm = (cover: AigcCoverOption) => {
    Alert.alert(
      t('aigcCover.applied.title'),
      t('aigcCover.applied.message', { title: workTitle, label: cover.label }),
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
