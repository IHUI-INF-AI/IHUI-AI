import { useCallback, useEffect, useState } from 'react'
import { getAigcTasks, type AigcTask } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AigcListScreen as SharedAigcListScreen,
  type AigcCategoryOption,
  type AigcFileType,
  type AigcListItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

// Aigc 系列屏幕未注册到 RootStackParamList(独立 mock 屏幕),本地扩展导航类型
// 避免 useNavigation<any>() 退化为 any,保留 navigate/goBack 的类型安全
type AigcStackParamList = RootStackParamList & {
  AigcCover: { id: string; title: string }
  AigcPublish: undefined
}
type Nav = NativeStackNavigationProp<AigcStackParamList>

const CATEGORIES: AigcCategoryOption[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片', fileType: 0 },
  { key: 'video', label: '视频', fileType: 1 },
  { key: 'audio', label: '音频', fileType: 3 },
  { key: 'text', label: '文案', fileType: 4 },
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asFileType(v: unknown): AigcFileType {
  if (v === 0 || v === 1 || v === 3 || v === 4) return v
  return 0
}

/** 将 AIGC 任务(result 为 unknown)安全映射为 UI 层 AigcListItem,避免 any */
function toAigcWork(task: AigcTask): AigcListItem {
  const r = isRecord(task.result) ? task.result : {}
  return {
    id: task.taskId,
    title: asString(r.title) ?? '未命名作品',
    subtitle: asString(r.subtitle),
    prompt: asString(r.prompt),
    content: asString(r.content),
    fileUrl: asString(r.fileUrl),
    coverUrl: asString(r.coverUrl),
    audioUrl: asString(r.audioUrl),
    duration: asString(r.duration),
    fileType: asFileType(r.fileType),
    createdAt: task.createdAt ?? '',
  }
}

export default function AigcListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [category, setCategory] = useState<AigcCategoryOption['key']>('all')
  const [items, setItems] = useState<AigcListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAigcTasks({ page: 1, pageSize: 50 })
      if (res.success) {
        setItems(res.data.list.map(toAigcWork))
      } else {
        setError(res.error || '加载失败')
      }
    } catch {
      setError('加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const openWork = (work: AigcListItem) => {
    navigation.navigate('AigcCover', { id: work.id, title: work.title })
  }

  const goPublish = () => navigation.navigate('AigcPublish')

  return (
    <SharedAigcListScreen
      t={t}
      items={items}
      categories={CATEGORIES}
      category={category}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onSelectCategory={setCategory}
      onRefresh={onRefresh}
      onPressItem={openWork}
      onPublish={goPublish}
      onBack={() => navigation.goBack()}
    />
  )
}
