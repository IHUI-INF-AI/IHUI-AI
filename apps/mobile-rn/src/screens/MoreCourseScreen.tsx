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
import { getCourses, type Course } from '@ihui/api-client'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import { MoreCourseScreen as SharedMoreCourseScreen } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { MoreCourseScreenProps } from '@ihui/types'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type LoadMode = 'initial' | 'refresh' | 'append'
type MoreCourseItem = MoreCourseScreenProps['items'][number]

const PAGE_SIZE = 10

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

  useEffect(() => {
    void loadPage(1, 'initial')
  }, [loadPage])

  const onRefresh = useCallback(() => {
    void loadPage(1, 'refresh')
  }, [loadPage])

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
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
