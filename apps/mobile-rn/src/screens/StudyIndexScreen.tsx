// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * StudyIndexScreen AI 视频页 —— mobile-rn 薄壳。
 *
 * 渲染主体是共享层 `@ihui/rn-app` 的 StudyIndexScreen（单一真相源）：
 * 壳侧只保留 `/api/study/videos` + `fetchModels` 取数、三态 pageType 与搜索/分类状态、
 * NavBar（共享屏不接管返回）与导航端口注入，不再复制共享屏的列表/预览渲染。
 *
 * 路由与入口：RootNavigator.tsx:680/1247（默认导出），drawer-nav.ts:244/903-904。
 * 端口口径：共享屏全部 props 逐项真实接线；不回落空函数，不造 noop。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Search, X } from 'lucide-react-native'
import { fetchApi, fetchModels, type LlmModel } from '@ihui/api-client'
import { apiFailureToError, toUserFriendlyMessage } from '@ihui/shared/utils'
import { StudyIndexScreen as SharedStudyIndexScreen } from '@ihui/rn-app'
import { Tappable } from '@ihui/ui-native'
import { tokens as tk } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { StudyVideoItem } from '@ihui/types'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PageType = 'index' | 'model' | 'study'

const PAGE_SIZE = 10
const API_PATH = '/api/study/videos'
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

/** 赛道分类(对齐 Uniapp categoryDictionary 静态占位) */
const TRACK_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'douyin', name: '抖音运营' },
  { id: 'private', name: '私域运营' },
  { id: 'content', name: '内容创作' },
  { id: 'data', name: '数据分析' },
] as const

interface StudyVideoResponse {
  list: StudyVideoItem[]
  total: number
}

export function StudyIndexScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<StudyVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [pageType, setPageType] = useState<PageType>('index')
  const [activeCategory, setActiveCategory] = useState('all')
  const [models, setModels] = useState<LlmModel[]>([])

  const load = useCallback(
    async (opts: { reset?: boolean; nextPage?: number } = {}) => {
      const reset = opts.reset ?? false
      const targetPage = opts.nextPage ?? 1
      if (reset) {
        setLoading(true)
        setError('')
      }
      try {
        const res = await fetchApi<StudyVideoResponse>(API_PATH, {
          params: {
            page: targetPage,
            pageSize: PAGE_SIZE,
            search: search.trim() || undefined,
            category: activeCategory !== 'all' ? activeCategory : undefined,
          },
        })
        if (!res.success) throw apiFailureToError(res)
        const list = res.data.list ?? []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
        setError(detail.trim() ? toUserFriendlyMessage(e) : '加载失败,请下拉刷新重试')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [search, activeCategory],
  )

  // 模型列表加载(对齐 Uniapp getCozeApiList,复用 fetchModels)
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((res) => {
        if (!cancelled) setModels(res.models)
      })
      .catch(() => {
        // 静默失败:模型列表非核心功能
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void load({ reset: true })
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load({ reset: true })
  }, [load])

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || refreshing) return
    if (items.length >= total) return
    setLoadingMore(true)
    void load({ reset: false, nextPage: page + 1 })
  }, [items.length, loading, loadingMore, load, page, refreshing, total])

  const onSubmitSearch = useCallback(() => {
    setSearch(searchInput)
    setShowSearch(false)
  }, [searchInput])

  // 返回逻辑(对齐原端内 backPage:model/study → index,index → 上一页)
  const handleBack = useCallback(() => {
    if (pageType !== 'index') {
      setPageType('index')
      return
    }
    navigation.goBack()
  }, [navigation, pageType])

  // index 预览态:模型 / 课程各取前 3 条(与共享屏口径一致)
  const previewModels = models.slice(0, 3).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.provider,
    isFree: !m.input_price,
  }))
  const previewItems = items.slice(0, 3)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title="AI 视频"
          onBack={handleBack}
          rightAction={
            <Tappable
              hitSlop={BACK_HIT_SLOP}
              onPress={() => setShowSearch((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="搜索"
            >
              {showSearch ? (
                <X size={20} color={tk.text.medium} />
              ) : (
                <Search size={20} color={tk.text.medium} />
              )}
            </Tappable>
          }
        />
      </NavChrome>
      <SharedStudyIndexScreen
        colorScheme={resolvedTheme}
        items={items}
        refreshing={refreshing}
        loadingMore={loadingMore}
        error={error}
        total={total}
        searchInput={searchInput}
        showSearch={showSearch}
        pageType={pageType}
        activeCategory={activeCategory}
        previewModels={previewModels}
        previewItems={previewItems}
        initialLoading={loading && items.length === 0 && !refreshing}
        trackCategories={TRACK_CATEGORIES}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onSubmitSearch={onSubmitSearch}
        onSearchInputChange={setSearchInput}
        onCategoryChange={setActiveCategory}
        onViewMoreModels={() => setPageType('model')}
        onViewMoreCourses={() => setPageType('study')}
        retryText="重试"
        emptyText="暂无学习视频"
        noMoreText="没有更多了"
        loadingText={t('common.loading')}
        loadingMoreText="加载更多..."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg },
})

export default StudyIndexScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
