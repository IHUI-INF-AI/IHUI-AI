/**
 * 对齐说明(本次 coursePlanet 对齐任务):
 * - 历史项目 pagesA/coursePlanet/index.vue 的完整结构(CourseCarousel + MoreTitles×3
 *   + Menu + 双 tab 课程列表 + UpToDate)由 CoursePlanetScreen.tsx 承载(命名与路由一致)。
 * - 本页为知识星球资讯列表页(对应历史项目 tabbar 知识星球页),与 coursePlanet 的
 *   "课程分类区段头"语义不符,故不接入 MoreTitles;仅按任务要求接入
 *   components/common/Loading(对齐原项目 common/Loading 全屏 loading-mask 语义)。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { KnowledgePlanetScreen as SharedKnowledgePlanetScreen } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import Loading from '../components/common/Loading'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// 知识星球资讯列表(api 层 miniapp-compat 路由,返回 { list, total };旧路径 /resource/getKnowledgePlanet 已下线 404)
const API_PATH = '/api/knowledge-planet/news'

function toTimestamp(time: string | number | undefined): number {
  if (time === undefined || time === null) return Date.now()
  if (typeof time === 'number') {
    return time < 1e12 ? time * 1000 : time
  }
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function KnowledgePlanetScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<
    { id: string; title: string; cover?: string; summary?: string; createdAt: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<{
        list: {
          id: string | number
          title: string
          summary?: string | null
          coverImage?: string | null
          createdAt?: string | number
        }[]
        total: number
      }>(API_PATH)
      if (!res.success) throw new Error()
      const rawList = res.data?.list ?? []
      setItems(
        rawList.map((raw) => ({
          id: String(raw.id),
          title: raw.title,
          cover: raw.coverImage ?? undefined,
          summary: raw.summary ?? undefined,
          createdAt: toTimestamp(raw.createdAt),
        })),
      )
    } catch {
      setError('加载失败，请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const onItemClick = useCallback(
    (id: string) => {
      navigation.navigate('AnnouncementDetail', { id })
    },
    [navigation],
  )

  return (
    <View style={styles.root}>
      <SharedKnowledgePlanetScreen
        t={t}
        items={items}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={onRefresh}
        onItemClick={onItemClick}
        onBack={() => navigation.goBack()}
      />
      {/* 加载遮罩(对齐原项目 common/Loading 全屏 loading-mask 语义) */}
      {loading ? <Loading text={t('common.loading')} fullscreen /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
