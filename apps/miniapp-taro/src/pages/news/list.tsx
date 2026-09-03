// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, t } from '@/i18n'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import { getNewsList, type News } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import './list.css'

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

const formatViews = (n: number): string => {
  if (!n || n <= 0) return '0'
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 10000).toFixed(1)}w`
}

export default function NewsListPage() {
  const tt = useTt()

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
        Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
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
    Taro.navigateTo({ url: `/pages/news/detail?id=${id}` })
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
    <View className="page">
      {/* 搜索栏 */}
      <View className="search-bar">
        <Image
          className="search-icon"
          style={{ width: '30rpx', height: '30rpx' }}
          src="/static/images/icons/search.svg"
          mode="aspectFit"
        />
        <Input
          className="search-input"
          placeholder={tt('news.search', '搜索资讯')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
          confirmType="search"
        />
      </View>

      {/* 分类 Tab */}
      <ScrollView scrollX className="tabs" enhanced showScrollbar={false}>
        {categories.map((c) => (
          <View
            key={c.key}
            className={`tab${activeCategory === c.key ? ' tab-active' : ''}`}
            onClick={() => setActiveCategory(c.key)}
          >
            <Text className="tab-label">{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 置顶新闻 */}
      {pinnedVisible && pinned ? (
        <View className="pinned" onClick={() => goDetail(pinned.id)}>
          <View className="pinned-tag">
            <Text className="pinned-tag-text">{tt('news.pinned', '置顶')}</Text>
          </View>
          {pinned.coverUrl ? (
            <Image className="pinned-cover" src={pinned.coverUrl} mode="aspectFill" />
          ) : null}
          <View className="pinned-body">
            <Text className="pinned-title">{pinned.title}</Text>
            {pinned.summary ? <Text className="pinned-summary">{pinned.summary}</Text> : null}
            <View className="pinned-meta">
              <Text className="pinned-time">{pinned.createTime}</Text>
              <Text className="pinned-views">
                {tt('news.readCount', '{n}阅读', { n: formatViews(Number(pinned.views ?? 0)) })}
              </Text>
              {pinned.source ? <Text className="pinned-source">{pinned.source}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* 新闻列表 */}
      {visibleList.length ? (
        <View className="list">
          {visibleList.map((n) => {
            const isRead = readIds.has(String(n.id))
            return (
              <ThemeRoot><View
                key={n.id}
                className={`item${isRead ? ' item-read' : ''}`}
                onClick={() => goDetail(n.id)}
              >
                {n.coverUrl ? <Image className="cover" src={n.coverUrl} mode="aspectFill" /> : null}
                <View className="body">
                  <View className="title-row">
                    {!isRead ? <Text className="unread-dot" /> : null}
                    <Text className="title">{n.title}</Text>
                  </View>
                  {n.summary ? <Text className="summary">{n.summary}</Text> : null}
                  <View className="meta">
                    <Text className="time">{n.createTime}</Text>
                    <Text className="views">
                      {tt('news.readCount', '{n}阅读', {
                        n: formatViews(Number(n.views ?? 0)),
                      })}
                    </Text>
                    {n.source ? <Text className="source">{n.source}</Text> : null}
                  </View>
                </View>
              </View>
            </ThemeRoot>)
          })}
        </View>
      ) : null}

      {/* 状态 */}
      {!loading && !pinnedVisible && visibleList.length === 0 ? (
        <View className="empty">
          <Image
            className="empty-icon"
            style={{ width: '56rpx', height: '56rpx' }}
            src="/static/images/icons/inbox.svg"
            mode="aspectFit"
          />
          <Text>{tt('news.empty', '暂无资讯')}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="loading">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      ) : null}

      {!loading && !hasMore && visibleList.length > 0 ? (
        <View className="no-more">
          <Text>{tt('common.noMore', '没有更多了')}</Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
