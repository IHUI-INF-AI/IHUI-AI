// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTagBySlug, getTagResources } from '@ihui/api-client'
import type { TagResourceItem } from '@ihui/api-client'
import { TagDetailScreen as SharedTagDetailScreen, type TagCloudItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'TagDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「标签详情」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/tags/TagDetailScreen.tsx`,本文件只管平台侧:
 * 取词、主题、路由参数与两段取数,与 web PageClient.tsx 同址同序:
 * :70 GET /api/tags/${slug} 先取标签,成功后 :77 GET /api/tags/${id}/resources 取内容列表。
 */
export function TagDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { slug } = route.params
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tag, setTag] = useState<TagCloudItem | null>(null)
  const [resources, setResources] = useState<TagResourceItem[] | null>(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResourcesLoading(false)
    try {
      const tagRes = await getTagBySlug(slug)
      if (!tagRes.success) {
        // 404 = 标签不存在(web :105-119 notFound 分支),不当作错误,交共享屏渲染空态。
        setTag(null)
        setResources(null)
        return
      }
      const detail = tagRes.data.tag
      setTag(detail)
      setResourcesLoading(true)
      const resRes = await getTagResources(detail.id)
      setResources(resRes.success ? (resRes.data.list ?? []) : [])
      if (!resRes.success) setError(t('tagsPage.fetchFailed'))
    } catch {
      setTag(null)
      setResources(null)
      setError(t('tagsPage.fetchFailed'))
    } finally {
      setResourcesLoading(false)
      setLoading(false)
    }
  }, [slug, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedTagDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      tag={tag}
      resources={resources}
      resourcesLoading={resourcesLoading}
      onRefresh={() => void load()}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
