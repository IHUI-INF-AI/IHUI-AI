import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

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
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

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
    <View className="min-h-screen bg-background pb-[48rpx]">
      <View className="pt-[24rpx] px-[32rpx] pb-[16rpx] bg-card">
        <Text className="text-[36rpx] font-semibold text-primary [text-shadow:0_0_10rpx_rgba(0,242,255,0.6)]">
          {tt('ranking.listTitle', 'AI榜单')}
        </Text>
      </View>

      {/* 搜索框 */}
      <View className="py-[16rpx] px-[32rpx] bg-card">
        <Input
          className="block w-full h-[64rpx] px-[24rpx] bg-background border border-border rounded-[8rpx] text-[26rpx] text-foreground box-border"
          placeholder={tt('ranking.searchPlaceholder', '搜索 AI 工具')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      {/* 文件类型筛选 tab */}
      <ScrollView scrollX className="whitespace-nowrap py-[16rpx] px-[24rpx] bg-card">
        {FILE_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`inline-flex items-center justify-center py-[12rpx] px-[32rpx] mr-[16rpx] bg-background border border-border rounded-[8rpx] ${fileType === tab.key ? 'bg-primary border-primary' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <Text
              className={`text-[26rpx] ${fileType === tab.key ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
            >
              {tt(tab.labelKey, tab.fallback)}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* 榜单列表 */}
      {list.length ? (
        <View className="pt-[16rpx] px-[24rpx]">
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
              <View
                key={item.id}
                className="flex items-start bg-card border border-border rounded-[12rpx] p-[24rpx] mb-[16rpx]"
                onClick={() => goDetail(item.id)}
              >
                {logo ? (
                  <Image
                    className="w-[120rpx] h-[120rpx] rounded-[12rpx] bg-background shrink-0"
                    src={logo}
                    mode="aspectFill"
                  />
                ) : null}
                <View className="flex-1 ml-[24rpx] overflow-hidden flex flex-col gap-[8rpx]">
                  <Text className="text-[30rpx] font-semibold text-foreground leading-[1.4] line-clamp-1">
                    {name || '-'}
                  </Text>
                  {desc ? (
                    <Text className="text-[24rpx] text-muted-foreground leading-[1.5] line-clamp-2">
                      {desc}
                    </Text>
                  ) : null}
                  <View className="flex flex-wrap gap-[8rpx_20rpx] mt-[4rpx]">
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('ranking.detail.attention', '关注度')}: {attention || '-'}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground">
                      {tt('ranking.detail.category', '类别')}: {category}
                    </Text>
                    <Text className="text-[22rpx] text-accent">
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
        <View className="block text-center py-[80rpx] text-[28rpx] text-muted-foreground">
          <Text>{tt('ranking.empty', '暂无数据')}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="block text-center py-[80rpx] text-[28rpx] text-muted-foreground">
          <Text>{tt('common.loading', '加载中...')}</Text>
        </View>
      ) : null}
    </View>
  )
}
