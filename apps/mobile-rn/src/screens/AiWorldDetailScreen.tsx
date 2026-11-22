// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiWorldDetailScreen AI 世界条目详情(mobile-rn 端 wrapper)
 *
 * 承载 web `/ai-world/[id]`(apps/web/app/(main)/ai-world/[id]/PageClient.tsx)。
 * UI 全部下沉共享层 @ihui/rn-app AiWorldDetailScreen,本 wrapper 仅保留平台侧:
 * - 取数:GET /api/ai-world/:id(详情)+ GET /api/ai-world/categories(分类名解析)
 *   + GET /api/favorites/check/aiworld/:id(仅登录态,与 web 同口径)
 * - 收藏切换:POST /api/favorites / DELETE /api/favorites/aiworld/:id(social.ts 封装)
 * - 聚焦时静默重取(编辑保存后返回列表再进详情不展示旧数据)
 * - 导航 goBack;主题色 / i18n 注入
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  addFavorite,
  checkFavorite,
  deleteFavorite,
  getAiWorldCategories,
  getAiWorldItem,
} from '@ihui/api-client'
import type { AiWorldCategoryRow, AiWorldDetailItem } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AiWorldDetailScreen as SharedAiWorldDetailScreen,
  type AiWorldDetailData,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AiWorldDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AiWorldDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const { id } = route.params

  const [world, setWorld] = useState<AiWorldDetailItem | null>(null)
  const [categories, setCategories] = useState<AiWorldCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favorited, setFavorited] = useState(false)
  const [favoritePending, setFavoritePending] = useState(false)
  const [favoriteError, setFavoriteError] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError('')
      try {
        const [worldRes, catRes] = await Promise.all([getAiWorldItem(id), getAiWorldCategories()])
        if (!worldRes.success) {
          setError(apiFailureToText(worldRes, t('aiWorldDetailPage.fetchFailed')))
          return
        }
        setWorld(worldRes.data.world)
        if (catRes.success && Array.isArray(catRes.data)) setCategories(catRes.data)
        if (user) {
          const favRes = await checkFavorite('aiworld', id)
          setFavorited(favRes.success ? favRes.data.favorited : false)
        } else {
          setFavorited(false)
        }
      } catch {
        setError(t('aiWorldDetailPage.fetchFailed'))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [id, t, user],
  )

  useEffect(() => {
    void load()
  }, [load])

  // 聚焦时静默重取(编辑屏保存后 navigate 回已挂载的详情不展示旧数据);挂载后的首个 focus 跳过
  const skipNextFocusRef = useRef(true)
  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      if (skipNextFocusRef.current) {
        skipNextFocusRef.current = false
        return
      }
      void load(true)
    })
    return unsubFocus
  }, [navigation, load])

  const toggleFavorite = useCallback(async () => {
    if (favoritePending) return
    setFavoritePending(true)
    setFavoriteError('')
    try {
      const res = favorited ? await deleteFavorite('aiworld', id) : await addFavorite('aiworld', id)
      if (res.success) setFavorited(!favorited)
      else setFavoriteError(apiFailureToText(res, t('aiWorldDetailPage.favoriteFailed')))
    } catch {
      setFavoriteError(t('aiWorldDetailPage.favoriteFailed'))
    } finally {
      setFavoritePending(false)
    }
  }, [favorited, favoritePending, id, t])

  const data = useMemo<AiWorldDetailData | null>(() => {
    if (!world) return null
    return {
      id: world.id,
      title: world.title,
      content: world.content,
      coverImage: world.coverImage,
      categoryName: world.categoryId
        ? (categories.find((c) => c.id === world.categoryId)?.name ?? null)
        : null,
      viewCount: world.viewCount,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
    }
  }, [world, categories])

  return (
    <SharedAiWorldDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      data={data}
      onRetry={() => void load()}
      showFavorite={Boolean(user)}
      favorited={favorited}
      favoritePending={favoritePending}
      onToggleFavorite={() => void toggleFavorite()}
      favoriteError={favoriteError}
    />
  )
}

export default AiWorldDetailScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
