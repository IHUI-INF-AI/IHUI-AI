import { logger } from '@/utils/logger'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getPlazaList } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

/** 广场卡片项(对标原项目 CardContent info) */
interface PlazaItem {
  id: string
  title: string
  coverUrl?: string
  author?: string
  avatar?: string
  status?: number
  attention?: number
}

/** 状态筛选 tab(对标原项目 Status 组件:2=已发布 4=测试中 6=已下线 9=全部) */
const STATUS_TABS = [
  { key: 9, labelKey: 'plaza.index.statusAll' },
  { key: 2, labelKey: 'plaza.index.statusPublished' },
  { key: 4, labelKey: 'plaza.index.statusTesting' },
  { key: 6, labelKey: 'plaza.index.statusOffline' },
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
    coverUrl: asString(raw['coverUrl']) || asString(raw['cover'] || raw['imgUrl']),
    author: asString(raw['author']) || asString(raw['nickname']),
    avatar: asString(raw['avatar']),
    status: asNumber(raw['status'], 2),
    attention: asNumber(raw['attention'] ?? raw['viewCount']),
  }
}

function statusLabel(s: number, t: (k: string) => string): string {
  if (s === 2) return t('plaza.index.statusPublished')
  if (s === 4) return t('plaza.index.statusTesting')
  if (s === 6) return t('plaza.index.statusOffline')
  return t('plaza.index.statusUnknown')
}

export default function PlazaIndex() {
  const { t } = useI18n()
  const [leftList, setLeftList] = useState<PlazaItem[]>([])
  const [rightList, setRightList] = useState<PlazaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [status, setStatus] = useState(9)
  const pageRef = useRef(1)
  const totalRef = useRef(0)

  const fetchPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      if (loading) return
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          pageNum,
          pageSize: PAGE_SIZE,
          status: status === 9 ? '' : status,
        }
        const res = (await getPlazaList(params)) as Record<string, unknown>
        const arr = (res?.list as Record<string, unknown>[]) || []
        const items = arr.map(normalizeItem)
        totalRef.current = asNumber(res?.total, 0)
        if (reset) {
          // 简单双列分配:奇数左,偶数右
          const l: PlazaItem[] = []
          const r: PlazaItem[] = []
          items.forEach((it, i) => (i % 2 === 0 ? l.push(it) : r.push(it)))
          setLeftList(l)
          setRightList(r)
        } else {
          setLeftList((prev) => {
            const l = [...prev]
            items.forEach((it, i) => {
              if (i % 2 === 0) l.push(it)
            })
            return l
          })
          setRightList((prev) => {
            const r = [...prev]
            items.forEach((it, i) => {
              if (i % 2 === 1) r.push(it)
            })
            return r
          })
        }
        const cnt = reset ? items.length : leftList.length + rightList.length + items.length
        setHasMore(cnt < totalRef.current)
        if (items.length > 0) {
          pageRef.current = pageNum
        }
      } catch (e) {
        logger.error('plaza', 'load', e)
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status],
  )

  useDidShow(() => {
    pageRef.current = 1
    fetchPage(1, true)
  })

  usePullDownRefresh(() => {
    pageRef.current = 1
    fetchPage(1, true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!hasMore || loading) return
    pageRef.current += 1
    fetchPage(pageRef.current, false)
  })

  const onStatusChange = useCallback(
    (s: number) => {
      if (s === status) return
      setStatus(s)
      pageRef.current = 1
      fetchPage(1, true)
    },
    [status, fetchPage],
  )

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/plaza/cover/index?id=${id}` })
  }, [])

  const toSetNeed = useCallback(() => {
    Taro.navigateTo({ url: '/pages/plaza/set-need/index' })
  }, [])

  const renderCard = (item: PlazaItem) => (
    <View className="pza-card" onClick={() => onItemClick(item.id)}>
      {item.coverUrl ? (
        <Image className="pza-cover" src={item.coverUrl} mode="widthFix" />
      ) : null}
      <View className="pza-info">
        <Text className="pza-title">{item.title || t('plaza.index.untitled')}</Text>
        <View className="pza-meta">
          <Text className="pza-author">{item.author || t('plaza.index.anonymous')}</Text>
          <Text className="pza-status">{statusLabel(item.status ?? 0, t)}</Text>
        </View>
        {(item.attention ?? 0) > 0 ? (
          <Text className="pza-attention">♥ {item.attention}</Text>
        ) : null}
      </View>
    </View>
  )

  return (
    <View className="pza-page">
      <View className="pza-header">
        <Text className="pza-page-title">{t('plaza.index.title')}</Text>
      </View>

      {/* 状态筛选 tab */}
      <ScrollView scrollX className="pza-tabs">
        {STATUS_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`pza-tab${status === tab.key ? ' active' : ''}`}
            onClick={() => onStatusChange(tab.key)}
          >
            <Text>{t(tab.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 瀑布流双列 */}
      <ScrollView scrollY className="pza-scroll">
        {loading && leftList.length === 0 ? (
          <View className="pza-empty">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : leftList.length === 0 && rightList.length === 0 ? (
          <View className="pza-empty">
            <Text className="pza-empty-main">{t('plaza.index.emptyMain')}</Text>
            <Text className="pza-empty-sub">{t('plaza.index.emptySub')}</Text>
          </View>
        ) : (
          <View className="pza-cols">
            <View className="pza-col">{leftList.map(renderCard)}</View>
            <View className="pza-col">{rightList.map(renderCard)}</View>
          </View>
        )}
        {loading && leftList.length > 0 ? (
          <Text className="pza-load-more">{t('common.loading')}</Text>
        ) : null}
        {!hasMore && leftList.length > 0 ? (
          <Text className="pza-load-more">{t('common.noMore')}</Text>
        ) : null}
        <View className="pza-bottom-space" />
      </ScrollView>

      {/* 悬浮发布按钮 */}
      <View className="pza-fab" onClick={toSetNeed}>
        <Text className="pza-fab-icon">+</Text>
      </View>
    </View>
  )
}
