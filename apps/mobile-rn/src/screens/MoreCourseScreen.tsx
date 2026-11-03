// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MoreCourseScreen 更多课程页 —— mobile-rn 薄壳。
 *
 * 渲染主体是共享层 `@ihui/rn-app` 的 MoreCourseScreen（单一真相源）：
 * 壳侧只保留 `getCourses` 分页取数（reload / refresh / loadMore）、分页状态与导航端口注入，
 * 不再复制共享屏的课程卡片列表渲染。
 *
 * 路由与入口：RootNavigator.tsx:716/1283，drawer-nav.ts:243/884-885。
 * 端口口径：共享屏全部 props 逐项真实接线；`onRetry` 单独绑定真实 reload，
 * 不用 `onRetry ?? onRefresh` 之类的别名，也不回落空函数。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCourses, fetchApi, type Course } from '@ihui/api-client'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import {
  MoreCourseScreen as SharedMoreCourseScreen,
  type MoreCoursePlanetItem,
} from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { MoreCourseScreenProps } from '@ihui/types'
import type { ImageSourcePropType } from 'react-native'
import IMG_LUNBO6 from '../../assets/images/carousel/lunbo6.jpg'
import IMG_CAROUSEL1 from '../../assets/images/carousel/carousel1.jpg'
import IMG_CAROUSEL2 from '../../assets/images/carousel/carousel2.jpg'
import IMG_CAROUSEL3 from '../../assets/images/carousel/carousel3.jpg'
import IMG_CAROUSEL_TWO from '../../assets/images/carousel/carousel4-footer1-two.png'
import IMG_LUNBO1 from '../../assets/images/carousel/lunbo1.png'
import IMG_LUNBO2 from '../../assets/images/carousel/lunbo2.png'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type LoadMode = 'initial' | 'refresh' | 'append'
type MoreCourseItem = MoreCourseScreenProps['items'][number]

const PAGE_SIZE = 10

/** 顶部轮播 7 张图(旧壳 BANNER_ITEMS 原样恢复;打包器返回资源句柄,类型按 RN 口径收窄) */
const BANNER_IMAGES = [
  IMG_LUNBO6,
  IMG_CAROUSEL1,
  IMG_CAROUSEL2,
  IMG_CAROUSEL3,
  IMG_CAROUSEL_TWO,
  IMG_LUNBO1,
  IMG_LUNBO2,
] as unknown as readonly ImageSourcePropType[]

/** 知识星球资讯接口(api 层 miniapp-compat 路由,返回 { list, total }) */
const PLANET_API_PATH = '/api/knowledge-planet/news'

/** 时间字段归一化为毫秒时间戳(旧壳 toTimestamp 原样恢复) */
function toTimestamp(time: string | number | undefined): number {
  if (time === undefined || time === null) return Date.now()
  if (typeof time === 'number') {
    return time < 1e12 ? time * 1000 : time
  }
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** Course → 共享屏卡片契约(cover 可空,统一收窄为 undefined) */
function toSharedItem(c: Course): MoreCourseItem {
  return {
    id: c.id,
    title: c.title,
    cover: c.cover ?? undefined,
    instructor: c.instructor,
    lessonCount: c.lessonCount,
    price: c.price,
    isFree: c.isFree,
    studentCount: c.studentCount,
  }
}

export function MoreCourseScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<MoreCourseItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [planetItems, setPlanetItems] = useState<MoreCoursePlanetItem[]>([])

  const loadPage = useCallback(
    async (targetPage: number, mode: LoadMode) => {
      if (mode !== 'append') setError('')
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      if (mode === 'append') setLoadingMore(true)
      try {
        const res = await getCourses({ page: targetPage, pageSize: PAGE_SIZE })
        if (!res.success) throw apiFailureToError(res)
        const list = (res.data.list ?? []).map(toSharedItem)
        setItems((prev) =>
          mode === 'append'
            ? [...prev, ...list.filter((next) => !prev.some((item) => item.id === next.id))]
            : list,
        )
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        setError(detail.trim() ? toUserFriendlyMessage(e) : t('common.loadFailPullRetry'))
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [t],
  )

  const reload = useCallback(() => {
    void loadPage(1, 'initial')
  }, [loadPage])

  /** 知识星球资讯加载(api 层 newsArticles 数据源;失败静默,区块走空态) */
  const loadPlanet = useCallback(async () => {
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
      }>(PLANET_API_PATH)
      if (!res.success) return
      setPlanetItems(
        (res.data?.list ?? []).map((raw) => ({
          id: String(raw.id),
          title: raw.title,
          cover: raw.coverImage ?? undefined,
          summary: raw.summary ?? undefined,
          createdAt: toTimestamp(raw.createdAt),
        })),
      )
    } catch {
      // 资讯为辅区块,失败不打断主课程列表
    }
  }, [])

  useEffect(() => {
    void loadPage(1, 'initial')
    void loadPlanet()
  }, [loadPage, loadPlanet])

  const onRefresh = useCallback(() => {
    void loadPage(1, 'refresh')
    void loadPlanet()
  }, [loadPage, loadPlanet])

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    void loadPage(page + 1, 'append')
  }, [items.length, loading, loadingMore, loadPage, page, refreshing, total])

  return (
    <SharedMoreCourseScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      error={error}
      total={total}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onPressItem={(item) => navigation.navigate('CourseDetail', { id: String(item.id) })}
      onBack={() => navigation.goBack()}
      onRetry={reload}
      bannerImages={BANNER_IMAGES}
      planet={{
        items: planetItems,
        onEnter: () => navigation.navigate('KnowledgePlanet'),
        onItemPress: (id) => navigation.navigate('AnnouncementDetail', { id }),
      }}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
