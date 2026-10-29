// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Favorite 路由(mobile-rn 端 wrapper):收藏列表 —— 本仓收藏页的**唯一**取数与渲染入口。
 *
 * 2026-10-28 跨端重复屏合并:`packages/app/src/features/favorites/FavoritesScreen.tsx` 与
 * `packages/app/src/features/favorite/FavoriteScreen.tsx` 打的是同一个端点
 * (`GET /api/favorites`,取消收藏同一条 `DELETE /api/favorites/:resourceType/:resourceId`)、
 * 同一套意图(标题都是「我的收藏」)、卡片字段与删除确认一字不差,唯一差别是后者多一排 tab 筛选
 * ⇒ 前者是后者的真子集,已删除。`Favorites` 路由现在复用下面这份模型 + 同一枚共享屏,
 * 不得再在任何 wrapper 里抄第二份取数或第二套列表 UI。
 *
 * 传输层字段名以 `packages/api-client/tests/favorites-field-contract.test.ts` 锁定的契约为准
 * (后端列叫 resource*,共享视图模型 FavoriteItemRow 叫 target*),只在这一处边界转换。
 */
import { useCallback, useState } from 'react'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getFavorites } from '@ihui/api-client'
import { FavoriteScreen as SharedFavoriteScreen } from '@ihui/rn-app'
import type { FavoriteFilterTab, FavoriteItemRow, FavoriteScreenProps } from '@ihui/types'
import { deleteFavorite } from '../api/social'
import { usePaginatedList, useRefreshOnFocus } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { formatShortDateWithYear } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/**
 * 对齐说明:Uniapp 历史项目无独立收藏列表页(收藏散落在各详情页内),
 * 文案参照 shared bookmarks/favorites 命名空间 + tab 类型(全部/课程/直播/文章)中文硬编码。
 * mobile-rn/shared zh-CN 暂无 favorite.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖自动失效(UNIAPP_TEXT 优先级高于 t,后续可删)。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'favorite.title': '我的收藏',
  'favorite.tabAll': '全部',
  'favorite.tabCourse': '课程',
  'favorite.tabLive': '直播',
  'favorite.tabArticle': '文章',
  'favorite.empty': '暂无收藏',
  'favorite.loadFailed': '加载收藏失败',
  'favorite.deleteTitle': '删除收藏',
  'favorite.deleteFailed': '删除失败',
}

/** 共享屏 FavoriteScreen 的完整 props(含 colorScheme);Favorite / Favorites 两条路由共用。 */
export function useFavoriteScreenModel(): FavoriteScreenProps {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FavoriteFilterTab>('all')

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      // 查询参数名按后端 GET /api/favorites 的 schema(favoritesListQuery 只认 resourceType,
      // 传 targetType 会被 zod 丢掉 ⇒ 切了 tab 却拿到全量,页面自己再在内存里过滤都算不上)。
      const apiQuery: { page: number; pageSize: number; resourceType?: string } = {
        page: query.page,
        pageSize: query.pageSize,
      }
      if (tab !== 'all') apiQuery.resourceType = tab
      const res = await getFavorites(apiQuery)
      if (res.success && res.data) {
        // 传输层 resource* → 共享视图模型 target*,只在这一处边界转换
        return {
          success: true as const,
          data: {
            ...res.data,
            list: res.data.list.map((f) => ({
              id: f.id,
              targetId: f.resourceId,
              targetType: f.resourceType,
              title: f.title ?? '',
              cover: null,
              // 展示文本在边界一次成型(原 favorites 屏即此口径):共享屏只渲染字符串
              createdAt: formatShortDateWithYear(f.createdAt),
            })),
          },
        }
      }
      return { success: false as const, error: res.error || uniappT('favorite.loadFailed') }
    },
    [tab, uniappT],
  )

  const { items, loading, refreshing, loadingMore, error, total, refresh, loadMore, removeItem } =
    usePaginatedList<FavoriteItemRow>(fetcher, PAGE_SIZE)
  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新):走分页 hook 的 refresh,重置分页并重载
  useRefreshOnFocus(refresh)

  const onSelectTab = (next: FavoriteFilterTab) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  // 删除确认弹窗:uni.showModal → RN Alert(取消/删除·destructive)
  const onDelete = (item: FavoriteItemRow) => {
    appAlert(uniappT('favorite.deleteTitle'), item.title, [
      { text: uniappT('common.cancel'), style: 'cancel' },
      {
        text: uniappT('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await deleteFavorite(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            appAlert(uniappT('common.failed'), res.error || uniappT('favorite.deleteFailed'))
          }
        },
      },
    ])
  }

  return {
    t: uniappT,
    items,
    activeTab: tab,
    onSelectTab,
    loading,
    refreshing,
    loadingMore,
    error,
    onRefresh: refresh,
    onLoadMore: loadMore,
    onDelete,
    onBack: () => navigation.goBack(),
    colorScheme: resolvedTheme,
    hasMore: items.length < total,
    onGoDiscover: () => navigation.navigate('Home'),
  }
}

export function FavoriteScreen() {
  const model = useFavoriteScreenModel()
  return <SharedFavoriteScreen {...model} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
