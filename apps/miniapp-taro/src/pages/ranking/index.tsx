import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

/** AI 工具榜单条目(后端字段命名不统一,pick 函数兼容多命名) */
interface ToolItem {
  id: string | number
  [key: string]: unknown
}

interface ListResponse {
  list: ToolItem[]
  total?: number
}

/** 文件类型 tab:全部(0)/文本(1)/音频(2)/图片(3)/视频(4) */
type FileType = 0 | 1 | 2 | 3 | 4

const FILE_TABS: { key: FileType; labelKey: string; fallback: string }[] = [
  { key: 0, labelKey: 'ranking.tabAll', fallback: '全部' },
  { key: 1, labelKey: 'ranking.tabText', fallback: '文本' },
  { key: 2, labelKey: 'ranking.tabAudio', fallback: '音频' },
  { key: 3, labelKey: 'ranking.tabImage', fallback: '图片' },
  { key: 4, labelKey: 'ranking.tabVideo', fallback: '视频' },
]

const PAGE_SIZE = 10

/** 取字段值,兼容后端返回的多种命名 */
const pick = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export default function RankingIndex() {
  const { t } = useI18n()
  /** i18n 兜底:key 未命中时返回 fallback */
  const tt = useCallback(
    (k: string, fb: string) => (t(k) === k ? fb : t(k)),
    [t],
  )

  const [list, setList] = useState<ToolItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fileType, setFileType] = useState<FileType>(0)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchPage = useCallback(
    async (curPage: number, ft: FileType, kw: string): Promise<boolean> => {
      try {
        const res = (await api.get('/ranking/list', {
          fileType: ft,
          page: curPage,
          pageSize: PAGE_SIZE,
          keyword: kw,
        })) as ListResponse | undefined
        const newList = res?.list || []
        setList((prev) => (curPage === 1 ? newList : [...prev, ...newList]))
        const total = res?.total ?? newList.length
        const more = newList.length >= PAGE_SIZE && curPage * PAGE_SIZE < total
        setHasMore(more)
        return more
      } catch {
        // 兜底:走现有 getRankingList(无分页,只取首页)
        if (curPage === 1) {
          try {
            const res = (await api.getRankingList()) as ListResponse | undefined
            setList(res?.list || [])
            setHasMore(false)
          } catch {
            setList([])
            setHasMore(false)
          }
        }
        return false
      }
    },
    [],
  )

  const reload = useCallback(
    async (ft: FileType, kw: string) => {
      setLoading(true)
      setPage(1)
      await fetchPage(1, ft, kw)
      setLoading(false)
    },
    [fetchPage],
  )

  const reloadRef = useRef(reload)
  reloadRef.current = reload
  useEffect(() => {
    void reloadRef.current(0, '')
  }, [])

  const onTabChange = useCallback(
    (ft: FileType) => {
      if (ft === fileType) return
      setFileType(ft)
      void reload(ft, keyword)
    },
    [fileType, keyword, reload],
  )

  const onSearchConfirm = useCallback(() => {
    void reload(fileType, keyword)
  }, [fileType, keyword, reload])

  const onScrollToLower = useCallback(() => {
    if (loading || !hasMore) return
    const next = page + 1
    setLoading(true)
    void fetchPage(next, fileType, keyword).then(() => {
      setPage(next)
      setLoading(false)
    })
  }, [loading, hasMore, page, fileType, keyword, fetchPage])

  useReachBottom(onScrollToLower)
  usePullDownRefresh(() => {
    void reload(fileType, keyword).finally(() => Taro.stopPullDownRefresh())
  })

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/ranking/detail?id=${id}` })
  }, [])

  return (
    <View className="rkg-page">
      <View className="rkg-header">
        <Text className="rkg-title">{tt('ranking.listTitle', 'AI榜单')}</Text>
      </View>

      {/* 搜索框 */}
      <View className="rkg-search">
        <Input
          className="rkg-search-input"
          placeholder={tt('ranking.searchPlaceholder', '搜索 AI 工具')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      {/* 文件类型筛选 tab */}
      <ScrollView scrollX className="rkg-tabs">
        {FILE_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`rkg-tab${fileType === tab.key ? ' active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <Text>{tt(tab.labelKey, tab.fallback)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 榜单列表 */}
      {list.length ? (
        <View className="rkg-list">
          {list.map((item) => {
            const raw = item as Record<string, unknown>
            const logo = pick(raw, ['logo', 'avatar', 'icon', 'field1'])
            const name = pick(raw, ['name', 'title'])
            const desc = pick(raw, ['desc', 'description', 'intro', 'summary'])
            const attention = pick(raw, ['attention', 'viewCount', 'collectCount'])
            const category =
              pick(raw, ['category', 'cate']) || tt('ranking.generalHelper', '通用助手')
            const price = pick(raw, ['price']) || tt('ranking.free', '免费')
            return (
              <View key={item.id} className="rkg-item" onClick={() => goDetail(item.id)}>
                {logo ? <Image className="rkg-item-logo" src={logo} mode="aspectFill" /> : null}
                <View className="rkg-item-body">
                  <Text className="rkg-item-title">{name || '-'}</Text>
                  {desc ? <Text className="rkg-item-desc">{desc}</Text> : null}
                  <View className="rkg-item-meta">
                    <Text className="rkg-item-attention">
                      {tt('ranking.detail.attention', '关注度')}: {attention || '-'}
                    </Text>
                    <Text className="rkg-item-category">
                      {tt('ranking.detail.category', '类别')}: {category}
                    </Text>
                    <Text className="rkg-item-price">
                      {tt('ranking.detail.price', '价格')}: {price}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="rkg-empty">
          <Text>{tt('ranking.empty', '暂无数据')}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="rkg-loading">
          <Text>{tt('common.loading', '加载中...')}</Text>
        </View>
      ) : null}
    </View>
  )
}
