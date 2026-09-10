// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/search/SearchScreen UI 与
// apps/mobile-rn SearchScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
// 2026-09-08:样式对齐 RN SharedSearchScreen — RN raw dp M → M*2 rpx,borderWidth 1 → 1rpx;
// 颜色由 RN token 换算为 CSS 变量(surface.bg→--color-background / surface.muted→--color-muted /
// border.light→--color-border / text.primary→--color-foreground / text.secondary→--color-muted-foreground /
// text.tertiary→--color-text-tertiary / text.medium→--color-text-medium / brand→--color-primary /
// success.DEFAULT→--color-success / success.light→--color-success-light / danger→--color-danger)。
import { Fragment, useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
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

// ===== 样式(view/text 分组,对齐共享屏 createStyles;颜色全部走 CSS 变量) =====

const viewStyles: Record<string, CSSProperties> = {
  // RN container:paddingHorizontal 10(dp) + paddingTop 48(dp,含状态栏)
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--color-background)',
    paddingLeft: '20rpx',
    paddingRight: '20rpx',
    paddingTop: 'calc(env(safe-area-inset-top) + 8rpx)',
  },
  // RN header:gap 12 + marginBottom 12
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '24rpx',
    marginBottom: '24rpx',
  },
  // RN searchRow:gap 8 + marginBottom 12
  searchRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16rpx',
    marginBottom: '24rpx',
  },
  // RN input:paddingH 12 + paddingV 14 + 圆角 12 + border.light + surface.muted
  input: {
    flex: 1,
    paddingLeft: '24rpx',
    paddingRight: '24rpx',
    paddingTop: '28rpx',
    paddingBottom: '28rpx',
    borderRadius: '24rpx',
    border: '1rpx solid var(--color-border)',
    fontSize: '32rpx',
    color: 'var(--color-foreground)',
    backgroundColor: 'var(--color-muted)',
  },
  // RN searchBtn:paddingH 14 + paddingV 8 + 圆角 12 + brand 底
  searchBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: '28rpx',
    paddingRight: '28rpx',
    paddingTop: '16rpx',
    paddingBottom: '16rpx',
    borderRadius: '24rpx',
    backgroundColor: 'var(--color-primary)',
    flexShrink: 0,
  },
  listScroll: {
    flex: 1,
  },
  listBody: {
    paddingBottom: '24rpx',
  },
  // RN empty:paddingVertical 40 居中
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '80rpx',
    paddingBottom: '80rpx',
  },
  // RN separator:height 12
  separator: {
    height: '24rpx',
  },
  // RN card:padding 12 + 圆角 12 + border.light(背景透出页面底色)
  card: {
    paddingLeft: '24rpx',
    paddingRight: '24rpx',
    paddingTop: '24rpx',
    paddingBottom: '24rpx',
    borderRadius: '24rpx',
    border: '1rpx solid var(--color-border)',
  },
  // RN cardHead:marginBottom 8
  cardHead: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: '16rpx',
  },
  // RN typeBadge:paddingH 6 + paddingV 2 + 圆角 4 + success.light 底
  typeBadge: {
    alignSelf: 'flex-start',
    paddingLeft: '12rpx',
    paddingRight: '12rpx',
    paddingTop: '4rpx',
    paddingBottom: '4rpx',
    borderRadius: '8rpx',
    backgroundColor: 'var(--color-success-light)',
    overflow: 'hidden',
    flexShrink: 0,
  },
}

const textStyles: Record<string, CSSProperties> = {
  // RN back:fontSize 16 + text.secondary
  back: {
    fontSize: '32rpx',
    color: 'var(--color-muted-foreground)',
  },
  // RN title:flex 1 + fontSize 22 + 600
  title: {
    flex: 1,
    fontSize: '44rpx',
    fontWeight: '600',
    color: 'var(--color-foreground)',
  },
  // RN searchText:fontSize 16 + surface.light(按钮对比字)
  searchText: {
    fontSize: '32rpx',
    color: 'var(--color-card)',
  },
  // RN muted:fontSize 14 + text.secondary
  muted: {
    fontSize: '28rpx',
    color: 'var(--color-muted-foreground)',
  },
  // RN error:fontSize 14 + danger + marginBottom 8
  error: {
    fontSize: '28rpx',
    color: 'var(--color-danger)',
    marginBottom: '16rpx',
  },
  // RN typeBadge 文字:fontSize 10 + success.DEFAULT
  typeBadge: {
    fontSize: '20rpx',
    color: 'var(--color-success)',
  },
  // RN cardTitle:fontSize 16 + 600 + text.primary,单行省略
  cardTitle: {
    fontSize: '32rpx',
    fontWeight: '600',
    color: 'var(--color-foreground)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // RN cardSummary:marginTop 8 + fontSize 14 + text.medium,两行省略
  cardSummary: {
    marginTop: '16rpx',
    fontSize: '28rpx',
    color: 'var(--color-text-medium)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
}

export default function Search() {
  const tt = useTt()
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
      <View style={viewStyles.container}>
        <View style={viewStyles.header}>
          <Text style={textStyles.back} onTap={goBack}>
            {tt('common.back', '返回')}
          </Text>
          <Text style={textStyles.title}>{tt('search.title', '搜索')}</Text>
        </View>

        <View style={viewStyles.searchRow}>
          <Input
            style={viewStyles.input}
            value={keyword}
            placeholder={tt('search.placeholder', '搜索课程、讲师、内容')}
            placeholderStyle="color: var(--color-text-tertiary);"
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={() => void runSearch()}
            confirmType="search"
          />
          <View style={viewStyles.searchBtn} onTap={() => void runSearch()} hoverClass="opacity-60">
            <Text style={textStyles.searchText}>{tt('common.search', '搜索')}</Text>
          </View>
        </View>

        {loading ? <Text style={textStyles.muted}>{tt('common.loading', '加载中...')}</Text> : null}
        {error ? <Text style={textStyles.error}>{error}</Text> : null}

        <ScrollView scrollY style={viewStyles.listScroll}>
          <View style={viewStyles.listBody}>
            {!loading && searched && results.length === 0 ? (
              <View style={viewStyles.center}>
                <Text style={textStyles.muted}>{tt('search.empty', '未找到相关内容')}</Text>
              </View>
            ) : null}
            {results.map((item, idx) => (
              <Fragment key={`${item.type}_${item.id}`}>
                <View style={viewStyles.card} onTap={() => onPressItem(item)} hoverClass="opacity-60">
                  <View style={viewStyles.cardHead}>
                    <View style={viewStyles.typeBadge}>
                      <Text style={textStyles.typeBadge}>{typeLabel(item.type)}</Text>
                    </View>
                  </View>
                  <Text style={textStyles.cardTitle}>{item.title}</Text>
                  <Text style={textStyles.cardSummary}>{item.summary}</Text>
                </View>
                {idx < results.length - 1 ? <View style={viewStyles.separator} /> : null}
              </Fragment>
            ))}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‌​‍‌​‍​‌​​‌‌​‍‌ ⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
