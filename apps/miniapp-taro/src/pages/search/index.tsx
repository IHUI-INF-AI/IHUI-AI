// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/search/SearchScreen UI 与
// apps/mobile-rn SearchScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { fetchApi } from '@ihui/api-client'
import type { SearchScreenItem } from '@ihui/types'
import ThemeRoot from '@/components/ThemeRoot'

/** 搜索类型 → 小程序详情页路由(note 暂无对应详情页,点击不跳转) */
const TYPE_ROUTES: Partial<Record<SearchScreenItem['type'], string>> = {
  course: '/pages/course/detail',
  article: '/pages/news/detail',
  post: '/pages/circle/detail',
  agent: '/pages/ai/agent-detail',
}

/** 搜索类型徽章文案 fallback(i18n 未命中时降级,文案对齐 shared bookmark.type) */
const TYPE_FALLBACK: Record<SearchScreenItem['type'], string> = {
  course: '课程',
  article: '文章',
  post: '动态',
  note: '笔记',
  agent: '智能体',
}

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(20),
    paddingRight: toRpx(20),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
  }),
  backBtn: (): CSSProperties => ({
    paddingRight: toRpx(24),
  }),
  searchRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(20),
    paddingRight: toRpx(20),
    paddingBottom: toRpx(12),
  }),
  input: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(14),
    borderRadius: toRpx(12),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    fontSize: toRpx(16),
    color: tk.text.primary,
    backgroundColor: tk.surface.muted,
  }),
  searchBtn: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: toRpx(8),
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    borderRadius: toRpx(12),
    backgroundColor: tk.brand.DEFAULT,
    flexShrink: 0,
  }),
  listScroll: (): CSSProperties => ({
    flex: 1,
  }),
  listBody: (): CSSProperties => ({
    paddingLeft: toRpx(20),
    paddingRight: toRpx(20),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(24),
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: toRpx(40),
    paddingBottom: toRpx(40),
  }),
  errorWrap: (): CSSProperties => ({
    paddingLeft: toRpx(20),
    paddingRight: toRpx(20),
    paddingTop: toRpx(4),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    borderRadius: toRpx(12),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    marginBottom: toRpx(12),
    backgroundColor: tk.surface.bg,
  }),
  cardHead: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    marginBottom: toRpx(8),
  }),
  typeBadge: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(4),
    backgroundColor: tk.success.light,
    overflow: 'hidden',
    flexShrink: 0,
  }),
}

const textStyles = {
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.secondary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(22),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  searchText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.surface.light,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  error: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
    paddingBottom: toRpx(8),
  }),
  typeBadge: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(10),
    color: tk.success.DEFAULT,
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  cardSummary: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.medium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  }),
}

export default function Search() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  // 搜索:对齐 mobile-rn runSearch 状态机(端点 /api/search?keyword=)
  const runSearch = useCallback(async () => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setSearched(true)
    try {
      const res = await fetchApi<SearchScreenItem[]>(
        `/api/search?keyword=${encodeURIComponent(trimmed)}`,
      )
      if (res.success) setResults(res.data ?? [])
      else setError(res.error || tt('search.failed', '搜索失败'))
    } catch {
      setError(tt('search.failed', '搜索失败'))
    } finally {
      setLoading(false)
    }
  }, [keyword, tt])

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  // 点击结果项:按 type 跳对应详情页(note 暂无对应页面,忽略)
  const onPressItem = (item: SearchScreenItem) => {
    const base = TYPE_ROUTES[item.type]
    if (base) Taro.navigateTo({ url: `${base}?id=${item.id}` })
  }

  const typeLabel = (type: SearchScreenItem['type']): string =>
    tt(`search.type.${type}`, TYPE_FALLBACK[type])

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <View style={viewStyles.header()}>
          <View style={viewStyles.backBtn()} onTap={goBack}>
            <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
          </View>
          <Text style={textStyles.title(tk)}>{tt('search.title', '搜索')}</Text>
        </View>

        <View style={viewStyles.searchRow()}>
          <Input
            style={viewStyles.input(tk)}
            value={keyword}
            placeholder={tt('search.placeholder', '搜索课程、讲师、内容')}
            placeholderStyle={`color: ${tk.text.tertiary}`}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={() => void runSearch()}
            confirmType="search"
          />
          <View style={viewStyles.searchBtn(tk)} onTap={() => void runSearch()}>
            <Text style={textStyles.searchText(tk)}>{tt('common.search', '搜索')}</Text>
          </View>
        </View>

        {loading ? (
          <View style={viewStyles.errorWrap()}>
            <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={viewStyles.errorWrap()}>
            <Text style={textStyles.error(tk)}>{error}</Text>
          </View>
        ) : null}

        <ScrollView scrollY style={viewStyles.listScroll()}>
          <View style={viewStyles.listBody()}>
            {!loading && searched && results.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.muted(tk)}>{tt('search.empty', '未找到相关内容')}</Text>
              </View>
            ) : null}
            {results.map((item) => (
              <View
                key={`${item.type}_${item.id}`}
                style={viewStyles.card(tk)}
                onTap={() => onPressItem(item)}
              >
                <View style={viewStyles.cardHead()}>
                  <View style={viewStyles.typeBadge(tk)}>
                    <Text style={textStyles.typeBadge(tk)}>{typeLabel(item.type)}</Text>
                  </View>
                </View>
                <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                <Text style={textStyles.cardSummary(tk)}>{item.summary}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
