import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

/** 广场卡片项(对标原项目 CardContent info) */
interface PlazaItem {
  id: string
  title: string
  desc?: string
  track?: string
  coverUrl?: string
  author?: string
  avatar?: string
  status?: number
  attention?: number
}

interface Filters {
  status: number
  track: string
  search: string
}

/** 状态筛选 tab(对标原项目 Status:全部/进行中/已完成) */
const STATUS_TABS = [
  { key: 0, labelKey: 'plaza.index.tabAll' },
  { key: 1, labelKey: 'plaza.index.tabOngoing' },
  { key: 2, labelKey: 'plaza.index.tabDone' },
]

/** 赛道分类(对标原项目 ScrollTitle 横向赛道) */
const TRACKS = [
  { key: '', labelKey: 'plaza.index.trackAll' },
  { key: 'writing', labelKey: 'plaza.index.trackWriting' },
  { key: 'coding', labelKey: 'plaza.index.trackCoding' },
  { key: 'design', labelKey: 'plaza.index.trackDesign' },
  { key: 'marketing', labelKey: 'plaza.index.trackMarketing' },
  { key: 'education', labelKey: 'plaza.index.trackEducation' },
]

/** 身份切换(对标原项目 identity-modal) */
const IDENTITIES = [
  { key: 'demander', labelKey: 'plaza.index.identityDemander' },
  { key: 'developer', labelKey: 'plaza.index.identityDeveloper' },
]

const PAGE_SIZE = 10

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function asNumber(v: unknown, fb = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}
function normalizeItem(raw: Record<string, unknown>): PlazaItem {
  return {
    id: asString(raw['id']) || String(raw['id'] ?? Math.random()),
    title: asString(raw['title']) || asString(raw['name']),
    desc: asString(raw['desc']) || asString(raw['description']) || asString(raw['content']),
    track: asString(raw['track']) || asString(raw['category']),
    coverUrl: asString(raw['coverUrl']) || asString(raw['cover'] || raw['imgUrl']),
    author: asString(raw['author']) || asString(raw['nickname']),
    avatar: asString(raw['avatar']),
    status: asNumber(raw['status'], 0),
    attention: asNumber(raw['attention'] ?? raw['viewCount']),
  }
}

export default function PlazaIndex() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [leftList, setLeftList] = useState<PlazaItem[]>([])
  const [rightList, setRightList] = useState<PlazaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [status, setStatus] = useState(0)
  const [search, setSearch] = useState('')
  const [track, setTrack] = useState('')
  const [identity, setIdentity] = useState('demander')

  const [drawerVisible, setDrawerVisible] = useState(false)
  const [showCenter, setShowCenter] = useState(false)
  const [showBottom, setShowBottom] = useState(false)
  const [searchOpen, setSearchOpen] = useState(true)
  const [detail, setDetail] = useState<PlazaItem | null>(null)

  const pageRef = useRef(1)
  const totalRef = useRef(0)
  const loadedRef = useRef(0)
  const loadingRef = useRef(false)

  const statusText = useCallback(
    (s?: number) => {
      if (s === 1) return tt('plaza.index.tabOngoing', '进行中')
      if (s === 2) return tt('plaza.index.tabDone', '已完成')
      return tt('plaza.index.tabAll', '全部')
    },
    [tt],
  )

  const fetchPage = useCallback(async (pageNum: number, reset: boolean, flt: Filters) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        pageNum,
        pageSize: PAGE_SIZE,
        status: flt.status === 0 ? '' : flt.status,
        track: flt.track || '',
        keyword: flt.search,
      }
      const res = (await api.getPlazaList(params)) as Record<string, unknown>
      const arr = (res?.list as Record<string, unknown>[]) || []
      const items = arr.map(normalizeItem)
      totalRef.current = asNumber(res?.total, 0)
      if (reset) {
        loadedRef.current = items.length
        const l: PlazaItem[] = []
        const r: PlazaItem[] = []
        items.forEach((it, i) => (i % 2 === 0 ? l.push(it) : r.push(it)))
        setLeftList(l)
        setRightList(r)
      } else {
        loadedRef.current += items.length
        setLeftList((prev) => [...prev, ...items.filter((_, i) => i % 2 === 0)])
        setRightList((prev) => [...prev, ...items.filter((_, i) => i % 2 === 1)])
      }
      setHasMore(loadedRef.current < totalRef.current)
      if (items.length > 0) pageRef.current = pageNum
    } catch (e) {
      logger.error('plaza', 'load', e)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    pageRef.current = 1
    fetchPage(1, true, { status, track, search })
  })

  usePullDownRefresh(() => {
    pageRef.current = 1
    fetchPage(1, true, { status, track, search }).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!hasMore || loadingRef.current) return
    pageRef.current += 1
    fetchPage(pageRef.current, false, { status, track, search })
  })

  const onStatusChange = useCallback(
    (s: number) => {
      if (s === status) return
      setStatus(s)
      pageRef.current = 1
      fetchPage(1, true, { status: s, track, search })
    },
    [status, track, search, fetchPage],
  )

  const onTrackSelect = useCallback(
    (key: string) => {
      setDrawerVisible(false)
      if (key === track) return
      setTrack(key)
      pageRef.current = 1
      fetchPage(1, true, { status, track: key, search })
    },
    [status, track, search, fetchPage],
  )

  const onSearchConfirm = useCallback(() => {
    pageRef.current = 1
    fetchPage(1, true, { status, track, search })
  }, [status, track, search, fetchPage])

  const onItemClick = useCallback(async (item: PlazaItem) => {
    setDetail(item)
    setShowCenter(true)
    try {
      const res = (await api.getPlazaInfoById(item.id)) as Record<string, unknown>
      if (res) setDetail({ ...item, ...normalizeItem(res) })
    } catch {
      // 保留已点击项
    }
  }, [])

  const onSetNeed = useCallback(() => {
    Taro.navigateTo({ url: '/pages/plaza/set-need/index' })
  }, [])

  const onIdentityChange = useCallback((key: string) => {
    setIdentity(key)
    setShowBottom(false)
  }, [])

  const renderCard = (item: PlazaItem) => (
    <View className="pza-card" onClick={() => onItemClick(item)}>
      {item.coverUrl ? (
        <Image className="pza-cover" src={item.coverUrl} mode="widthFix" />
      ) : null}
      <View className="pza-info">
        <Text className="pza-title">{item.title || tt('plaza.index.untitled', '未命名')}</Text>
        {item.desc ? <Text className="pza-desc">{item.desc}</Text> : null}
        <View className="pza-meta">
          <Text className="pza-author">{item.author || tt('plaza.index.anonymous', '匿名')}</Text>
          <Text className="pza-status">{statusText(item.status)}</Text>
        </View>
        <View className="pza-tags">
          {item.track ? <Text className="pza-track">{item.track}</Text> : null}
          {(item.attention ?? 0) > 0 ? (
            <Text className="pza-attention">♥ {item.attention}</Text>
          ) : null}
        </View>
      </View>
    </View>
  )

  return (
    <View className="pza-page">
      <View className="pza-header">
        <Text className="pza-page-title">{tt('plaza.index.title', 'AI需求广场')}</Text>
        <View className="pza-nav-btns">
          <Text className="pza-nav-btn" onClick={() => setSearchOpen((v) => !v)}>
            {tt('plaza.index.navSearch', '搜索')}
          </Text>
          <Text className="pza-nav-btn" onClick={() => setShowBottom(true)}>
            {tt('plaza.index.navMenu', '菜单')}
          </Text>
          <Text className="pza-nav-btn" onClick={() => setDrawerVisible(true)}>
            {tt('plaza.index.navCategory', '分类')}
          </Text>
        </View>
      </View>

      {searchOpen ? (
        <View className="pza-search">
          <Input
            className="pza-search-input"
            type="text"
            placeholder={tt('plaza.index.searchPlaceholder', '搜索需求')}
            value={search}
            onInput={(e) => setSearch(e.detail.value)}
            onConfirm={onSearchConfirm}
            confirmType="search"
          />
        </View>
      ) : null}

      {/* 状态筛选 tab */}
      <ScrollView scrollX className="pza-tabs">
        {STATUS_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`pza-tab${status === tab.key ? ' active' : ''}`}
            onClick={() => onStatusChange(tab.key)}
          >
            <Text>{tt(tab.labelKey, tab.key === 0 ? '全部' : tab.key === 1 ? '进行中' : '已完成')}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 瀑布流双列 */}
      <ScrollView scrollY className="pza-scroll">
        {loading && leftList.length === 0 ? (
          <View className="pza-empty">
            <Text>{tt('common.loading', '加载中…')}</Text>
          </View>
        ) : leftList.length === 0 && rightList.length === 0 ? (
          <View className="pza-empty">
            <Text className="pza-empty-main">
              {tt('plaza.index.emptyMain', '当前赛道千万级空白市场')}
            </Text>
            <Text className="pza-empty-sub">
              {tt('plaza.index.emptySub', '不会开发?发布需求快来抢占市场!')}
            </Text>
          </View>
        ) : (
          <View className="pza-cols">
            <View className="pza-col">{leftList.map(renderCard)}</View>
            <View className="pza-col">{rightList.map(renderCard)}</View>
          </View>
        )}
        {loading && leftList.length > 0 ? (
          <Text className="pza-load-more">{tt('common.loading', '加载中…')}</Text>
        ) : null}
        {!hasMore && leftList.length > 0 ? (
          <Text className="pza-load-more">{tt('common.noMore', '没有更多了')}</Text>
        ) : null}
        <View className="pza-bottom-space" />
      </ScrollView>

      {/* 悬浮发布按钮 */}
      <View className="pza-fab" onClick={onSetNeed}>
        <Text className="pza-fab-icon">+</Text>
      </View>

      {/* 赛道分类弹窗 */}
      {drawerVisible ? (
        <View className="pza-mask" onClick={() => setDrawerVisible(false)}>
          <View className="pza-drawer" catchMove>
            <View className="pza-drawer-head">
              <Text className="pza-drawer-title">
                {tt('plaza.index.categoryTitle', '赛道分类')}
              </Text>
              <Text className="pza-drawer-close" onClick={() => setDrawerVisible(false)}>
                ×
              </Text>
            </View>
            <ScrollView scrollX className="pza-track-scroll">
              {TRACKS.map((tr) => (
                <View
                  key={tr.key || 'all'}
                  className={`pza-track${track === tr.key ? ' active' : ''}`}
                  onClick={() => onTrackSelect(tr.key)}
                >
                  <Text>
                    {tt(
                      tr.labelKey,
                      tr.key === ''
                        ? '全部'
                        : tr.key === 'writing'
                          ? '写作'
                          : tr.key === 'coding'
                            ? '编程'
                            : tr.key === 'design'
                              ? '设计'
                              : tr.key === 'marketing'
                                ? '营销'
                                : '教育',
                    )}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* 卡片详情居中弹窗 */}
      {showCenter && detail ? (
        <View className="pza-mask" onClick={() => setShowCenter(false)}>
          <View className="pza-center" catchMove>
            <View className="pza-center-head">
              <Text className="pza-center-title">{detail.title}</Text>
              <Text className="pza-center-close" onClick={() => setShowCenter(false)}>
                ×
              </Text>
            </View>
            <ScrollView scrollY className="pza-center-body">
              {detail.coverUrl ? (
                <Image className="pza-center-cover" src={detail.coverUrl} mode="widthFix" />
              ) : null}
              {detail.desc ? <Text className="pza-center-desc">{detail.desc}</Text> : null}
              <View className="pza-center-meta">
                <Text className="pza-center-label">
                  {tt('plaza.index.detailTrack', '赛道')}:{detail.track || '-'}
                </Text>
                <Text className="pza-center-label">
                  {tt('plaza.index.detailStatus', '状态')}:{statusText(detail.status)}
                </Text>
              </View>
              <View className="pza-center-meta">
                <Text className="pza-center-label">
                  {tt('plaza.index.detailAuthor', '发布人')}:{detail.author || tt('plaza.index.anonymous', '匿名')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* 身份切换弹窗 */}
      {showBottom ? (
        <View className="pza-mask" onClick={() => setShowBottom(false)}>
          <View className="pza-bottom-sheet" catchMove>
            <View className="pza-sheet-head">
              <Text className="pza-sheet-title">
                {tt('plaza.index.identityTitle', '切换身份')}
              </Text>
            </View>
            {IDENTITIES.map((it) => (
              <View
                key={it.key}
                className={`pza-sheet-item${identity === it.key ? ' active' : ''}`}
                onClick={() => onIdentityChange(it.key)}
              >
                <Text>
                  {tt(it.labelKey, it.key === 'demander' ? '需求方' : '开发者')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}
