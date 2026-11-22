// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { deleteFavorite, getFavorites } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { BookmarkScreen as SharedBookmarkScreen } from '@ihui/rn-app'
import type { BookmarkItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
// 深路径直连真身:@ihui/shared/hooks 的 barrel 在 RN 测试里是端内替身(见 vitest.config),
// 而分页判据(去重合并 / total 收缩 / 同 tick 互斥)必须在真实现上验证 —— 指替身就测的是替身。
import { usePaginatedList } from '@ihui/shared/hooks/use-paginated-list'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

export function BookmarkScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  /** 删除等写操作产生的错误,与列表加载错误合并展示;刷新时清掉。 */
  const [actionError, setActionError] = useState('')

  // 收藏只有 GET /api/favorites 这一个来源(/api/bookmarks 在后端不存在)。
  // 传输层字段按后端契约叫 resource*,共享视图模型 BookmarkItem 叫 target*,
  // 名字在**这一处边界**转换,不在屏内两处各转一次。
  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const res = await getFavorites(query)
      if (res.success && res.data) {
        return {
          success: true as const,
          data: {
            ...res.data,
            list: res.data.list.map((f) => ({
              id: f.id,
              targetId: f.resourceId,
              targetType: f.resourceType,
              title: f.title ?? '',
              createdAt: f.createdAt,
            })),
          },
        }
      }
      return { success: false as const, error: res.error || t('bookmark.loadFailed') }
    },
    [t],
  )

  // 后端 GET /api/favorites 是真分页(page/pageSize + total),接分页 hook:
  // 首屏只取一页、触底/按钮取下一页,不再像旧实现那样固定 page=1/pageSize=50 硬截断。
  const { items, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore, removeItem } =
    usePaginatedList<BookmarkItem>(fetcher, PAGE_SIZE)

  const onPressItem = (item: BookmarkItem) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article')
      navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
  }

  const onRemove = async (item: BookmarkItem) => {
    setActionError('')
    const res = await deleteFavorite(item.targetType, item.targetId)
    // 删除成功同时删条与 total 计数(removeItem 内做),否则「已到底」会被误判成还有下一页。
    if (res.success) removeItem((b) => b.id === item.id)
    else setActionError(apiFailureToText(res, t('common.failed')))
  }

  return (
    <SharedBookmarkScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={actionError || error}
      onRefresh={() => {
        setActionError('')
        refresh()
      }}
      onPressItem={onPressItem}
      onRemove={onRemove}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
