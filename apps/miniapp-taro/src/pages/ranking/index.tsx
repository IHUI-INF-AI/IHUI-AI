// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect, useRef } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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

const FILE_TABS = (tt: TtFn): { key: FileType; labelKey: string; fallback: string }[] => [
  { key: 0, labelKey: 'ranking.tabAll', fallback: tt('common.all', '全部') },
  { key: 1, labelKey: 'ranking.tabText', fallback: tt('aigc.list.catText', '文本') },
  { key: 2, labelKey: 'ranking.tabAudio', fallback: tt('aigc.list.catAudio', '音频') },
  { key: 3, labelKey: 'ranking.tabImage', fallback: tt('aigc.list.catImage', '图片') },
  { key: 4, labelKey: 'ranking.tabVideo', fallback: tt('aigc.list.catVideo', '视频') },
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

  // 对齐 RN RankingScreen header 返回键(navigateBack 失败降级回首页,同 check-in/task-center)
  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  return (
    <View className="min-h-screen bg-background pb-[48rpx]">
      {/* header 对齐 RN RankingScreen header(back 32rpx / 标题 48rpx/700,页底色无卡片底) */}
      <View className="flex flex-col px-[20rpx] pt-[24rpx] pb-[16rpx]">
        <View className="self-start mb-[16rpx]" onClick={goBack} hoverClass="opacity-60">
          <Text className="text-[32rpx] text-muted-foreground">{tt('common.back', '返回')}</Text>
        </View>
        <Text className="text-[48rpx] font-bold text-foreground">
          {tt('ranking.listTitle', 'AI榜单')}
        </Text>
      </View>

      {/* 搜索框(对齐共享屏胶囊语言:bg-card 圆角24rpx) */}
      <View className="py-[16rpx] px-[20rpx]">
        <Input
          className="block w-full h-[64rpx] px-[24rpx] bg-card border border-solid border-border rounded-[24rpx] text-[28rpx] text-foreground box-border"
          placeholder={tt('ranking.searchPlaceholder', '搜索 AI 工具')}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      {/* 文件类型筛选 tab(对齐 RN RankingScreen tab:圆角24rpx / bg-card,激活 bg-primary) */}
      <ScrollView scrollX className="whitespace-nowrap">
        <View className="whitespace-nowrap flex flex-row py-[16rpx] px-[20rpx]">
          {FILE_TABS(tt).map((tab) => (
            <View
              key={tab.key}
              className={`inline-flex items-center justify-center py-[12rpx] px-[24rpx] mr-[12rpx] rounded-[24rpx] ${
                fileType === tab.key ? 'bg-primary' : 'bg-card'
              }`}
              onClick={() => onTabChange(tab.key)}
              hoverClass="opacity-60">
              <Text
                className={`text-[28rpx] ${
                  fileType === tab.key ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {tt(tab.labelKey, tab.fallback)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 榜单列表(对齐 RN RankingScreen card:行布局 / p28rpx / 圆角24rpx / 2rpx描边 bg-background) */}
      {list.length ? (
        <View className="p-[28rpx] pb-[64rpx]">
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
              <ThemeRoot key={item.id}>
                <View
                  className="flex items-center bg-background border border-solid border-border rounded-[24rpx] p-[28rpx] mb-[16rpx]"
                  onClick={() => goDetail(item.id)}
                  hoverClass="opacity-60">
                  {logo ? (
                    <Image
                      className="w-[88rpx] h-[88rpx] rounded-full border-[3rpx] border-solid border-border bg-[var(--color-muted)] shrink-0"
                      src={logo}
                      mode="aspectFill"
                    />
                  ) : null}
                  <View className="flex-1 ml-[20rpx] overflow-hidden flex flex-col gap-[16rpx]">
                    <Text className="text-[32rpx] font-semibold text-foreground leading-[1.4] line-clamp-1">
                      {name || '-'}
                    </Text>
                    {desc ? (
                      <Text className="text-[22rpx] text-[var(--color-text-tertiary)] leading-[1.5] line-clamp-2">
                        {desc}
                      </Text>
                    ) : null}
                    <View className="flex flex-wrap gap-x-[24rpx] gap-y-[8rpx]">
                      <Text className="text-[22rpx] text-muted-foreground">
                        {tt('ranking.detail.attention', '关注度')}: {attention || '-'}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground">
                        {tt('ranking.detail.category', '类别')}: {category}
                      </Text>
                      <Text className="text-[22rpx] text-[var(--color-success)]">
                        {tt('ranking.detail.price', '价格')}: {price}
                      </Text>
                    </View>
                  </View>
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      ) : null}

      {!loading && !list.length ? (
        <View className="flex justify-center py-[64rpx]">
          <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
            {tt('ranking.empty', '暂无数据')}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="flex justify-center py-[64rpx]">
          <Text className="text-[28rpx] text-[var(--color-text-tertiary)]">
            {tt('common.loading', '加载中...')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
