// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/article-list/ArticleListScreen.tsx
import { useTt, t } from '@/i18n'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getNewsList, type News } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { ArticleListScreen } from '@ihui/rn-app/features/article-list/ArticleListScreen'
import type { ArticleListItem } from '@ihui/types'
import { onToast } from '@/host/on-toast'

/** 防御式扩展:后端如返回 category/source/isTop 字段则使用,否则降级 */
type NewsExt = News & {
  category?: string
  source?: string
  isTop?: boolean
}

type CategoryKey = 'all' | 'announce' | 'activity' | 'info' | 'tutorial'

const READ_KEY = 'news_read_ids'
const PAGE_SIZE = 10

/** 读取已读 id 集合 */
const readIdSet = (): Set<string> => {
  try {
    const raw = Taro.getStorageSync(READ_KEY)
    if (!raw) return new Set()
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

/** 标记一条新闻为已读(本地存储,后端如提供阅读接口可在此扩展) */
const markRead = (id: string | number) => {
  const sid = String(id)
  const set = readIdSet()
  if (set.has(sid)) return
  set.add(sid)
  Taro.setStorageSync(READ_KEY, JSON.stringify([...set]))
}

/** 分类关键词匹配(后端未返回 category 时,按标题/摘要兜底分类) */
const detectCategory = (n: NewsExt): CategoryKey => {
  if (n.category) {
    const c = String(n.category).toLowerCase()
    if (c.includes('announce') || c.includes(t('news.cat.announce'))) return 'announce'
    if (c.includes('activ') || c.includes(t('news.cat.activity'))) return 'activity'
    if (c.includes('tutor') || c.includes(t('news.cat.tutorial'))) return 'tutorial'
    if (c.includes('info') || c.includes(t('news.cat.info'))) return 'info'
  }
  const text = `${n.title || ''} ${n.summary || ''}`.toLowerCase()
  if (text.includes(t('news.cat.announce')) || text.includes(t('newsList.q1'))) return 'announce'
  if (
    text.includes(t('news.cat.activity')) ||
    text.includes(t('common.discountAmount')) ||
    text.includes(t('newsList.q2'))
  )
    return 'activity'
  if (
    text.includes(t('news.cat.tutorial')) ||
    text.includes(t('aiCareer.guide')) ||
    text.includes(t('newsList.q3'))
  )
    return 'tutorial'
  return 'info'
}

/** 资讯实回 → 共享屏 ArticleListItem(平台字段在页 wrapper 内归一,屏内不认平台类型) */
const toArticleItem = (n: NewsExt): ArticleListItem => ({
  id: String(n.id),
  title: n.title,
  author: '',
  views: Number(n.views ?? 0),
  publishedAt: String(n.createTime ?? ''),
  summary: n.summary || undefined,
  category: n.category || undefined,
  source: n.source || undefined,
  pinned: n.isTop === true,
})

export default function NewsListPage() {
  const tt = useTt()

  // 屏标题对齐 RN ArticleListScreen 的 header:小程序由原生导航栏承载,随语言切换重设
  useEffect(() => {
    Taro.setNavigationBarTitle({ title: tt('articleList.title', '文章') })
  }, [tt])

  const [list, setList] = useState<NewsExt[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => readIdSet())

  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const pageRef = useRef(1)

  const categories: Array<{ key: CategoryKey; label: string }> = [
    { key: 'all', label: tt('news.cat.all', '全部') },
    { key: 'announce', label: tt('news.cat.announce', '公告') },
    { key: 'activity', label: tt('news.cat.activity', '活动') },
    { key: 'info', label: tt('news.cat.info', '资讯') },
    { key: 'tutorial', label: tt('news.cat.tutorial', '教程') },
  ]

  const load = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (!reset && !hasMoreRef.current) return
      loadingRef.current = true
      setLoading(true)
      let curPage = pageRef.current
      if (reset) {
        curPage = 1
        hasMoreRef.current = true
        setHasMore(true)
        setList([])
        pageRef.current = 1
      }
      try {
        const res = await getNewsList({ page: curPage, pageSize: PAGE_SIZE, keyword })
        const newList = (res.list || []) as NewsExt[]
        setList((prev) => (reset ? newList : [...prev, ...newList]))
        const total = res.total ?? 0
        const nextCount = reset ? newList.length : list.length + newList.length
        const more = nextCount < total
        hasMoreRef.current = more
        setHasMore(more)
        pageRef.current = curPage + 1
      } catch (e) {
        logger.error('news/list', t('newsList.q4'), e)
        onToast(tt('common.failed', '操作失败'), { kind: 'error' })
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [keyword, list.length, tt],
  )

  const goDetail = useCallback((id: string | number) => {
    markRead(id)
    setReadIds(readIdSet())
    Taro.navigateTo({ url: `/pkg-content/news/detail?id=${id}` })
  }, [])

  const onSearchConfirm = useCallback(() => {
    void load(true)
  }, [load])

  usePullDownRefresh(() => {
    void load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    void load(false)
  })

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current(true)
  }, [])

  // 置顶新闻(取首条 isTop=true 或列表第一条作为置顶展示)
  const pinned: NewsExt | null =
    list.find((n) => n.isTop === true) ??
    (list.length > 0 && activeCategory === 'all' ? list[0] : null) ??
    null

  // 当前分类过滤(置顶除外)
  const visibleList: NewsExt[] = list.filter((n) => {
    if (pinned && n.id === pinned.id) return false
    if (activeCategory === 'all') return true
    return detectCategory(n) === activeCategory
  })

  const pinnedVisible = pinned
    ? activeCategory === 'all' || detectCategory(pinned) === activeCategory
    : false

  return (
    <ThemeRoot className="page">
      {/* 主 UI 全部委托共享屏;本页只保留资讯域取数/分页/已读存储与分类兜底 */}
      <ArticleListScreen
        t={t}
        items={visibleList.map(toArticleItem)}
        loading={loading}
        refreshing={false}
        error=""
        onRefresh={() => void load(true)}
        onPressItem={(item) => goDetail(item.id)}
        onBack={() => {
          void Taro.navigateBack()
        }}
        onEndReached={() => void load(false)}
        loadingMore={loading && list.length > 0}
        noMore={!hasMore}
        hideHeader
        keyword={keyword}
        searchPlaceholder={tt('news.search', '搜索资讯')}
        onKeywordChange={setKeyword}
        onSearch={onSearchConfirm}
        categories={categories.map((c) => ({ id: c.key, label: c.label }))}
        selectedCategory={activeCategory}
        onSelectCategory={(id) => setActiveCategory(id as CategoryKey)}
        pinnedItem={pinnedVisible && pinned ? toArticleItem(pinned) : null}
        readIds={[...readIds]}
        onToast={(msg) => onToast(msg, { kind: 'error' })}
      />

      {/* 状态与列表由共享屏承载 */}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
