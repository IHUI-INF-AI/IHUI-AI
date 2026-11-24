// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TeacherListScreen 讲师列表页(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app LecturerListScreen
 * (与 lecturer-detail/LecturerDetailScreen 命名配套),本 wrapper 仅保留平台特定职责:
 * - 数据:fetchApi(/teacher/list) + usePaginatedList 分页(经 ../hooks re-export)
 * - 交互:关键词搜索(提交触发重查)→ 下拉刷新/上拉加载更多 → 点击卡片进讲师详情
 * - 导航:TeacherDetail 跳转 / goBack;主题色 / i18n 注入
 */
import { useCallback, useState } from 'react'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { fetchApi, type Teacher } from '@ihui/api-client'
import { LecturerListScreen, type LecturerListItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /teacher/list 响应结构(对齐 miniapp getTeacherList) */
interface TeacherPage {
  list: Teacher[]
  total: number
}

const PAGE_SIZE = 10

/** Teacher(API)→ 共享层 LecturerListItem 映射 */
function toListItem(teacher: Teacher): LecturerListItem {
  return {
    id: String(teacher.id),
    name: teacher.name,
    avatar: teacher.avatar ?? null,
    title: teacher.title ?? null,
    intro: teacher.intro ?? null,
    courses: teacher.courses ?? 0,
    students: teacher.students ?? 0,
  }
}

export function TeacherListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  // 搜索框内容为共享层内部 UI 状态,提交经 onSearch 上抛为查询关键词(触发重拉第 1 页)
  const [keyword, setKeyword] = useState('')

  // 关键词变化 → fetcher 重建 → usePaginatedList 自动重拉第 1 页
  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<TeacherPage>('/teacher/list', {
        params: { page, pageSize, keyword: keyword || undefined },
      })
      if (!res.success) return { success: false as const, error: t('common.failed') }
      return {
        success: true as const,
        data: { list: res.data?.list ?? [], total: res.data?.total ?? 0 },
      }
    },
    [keyword, t],
  )

  const { items, loading, refreshing, loadingMore, refresh, loadMore } = usePaginatedList(
    fetcher,
    PAGE_SIZE,
  )

  return (
    <LecturerListScreen
      t={t}
      items={items.map(toListItem)}
      loading={loading}
      refreshing={refreshing}
      loadingMore={loadingMore}
      onRefresh={refresh}
      onLoadMore={loadMore}
      onSearch={setKeyword}
      onOpenLecturer={(lecturerId) => navigation.navigate('TeacherDetail', { id: lecturerId })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
