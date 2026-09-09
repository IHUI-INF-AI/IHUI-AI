// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, {
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
  useRouter,
} from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getCourseList, type Course } from '@/api'
// P2-F 接线:SectionHeader/ColorfulLoader 切换为 Taro 适配层导出(props 契约与旧实现一致)
import { SectionHeader, ColorfulLoader } from '@/components/adapters'
import ThemeRoot from '@/components/ThemeRoot'

export default function CourseList() {
  const { t } = useI18n()
  const tt = useTt()
  const router = useRouter()
  const initialKeyword = router.params.keyword || ''
  const [list, setList] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState(initialKeyword)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const keywordRef = useRef(initialKeyword)

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCourseList({
        page: pageRef.current,
        pageSize: 10,
        keyword: keywordRef.current,
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const onSearch = useCallback(() => {
    keywordRef.current = keyword
    load(true)
  }, [keyword, load])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }, [])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/course/list',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <ThemeRoot>
      {/* 对齐 RN CourseTabScreen:容器底 surface.bg(--color-background),内容内边距 = section padding 14dp→28rpx,底部 scrollContent 24dp→48rpx */}
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[48rpx]">
        {/* 搜索区对齐 RN searchInput:高 50dp→100rpx / 圆角 8dp→16rpx / bg muted / 边框 border.light / 字号 16dp→32rpx */}
        <View className="flex items-center mb-[24rpx]">
          <Input
            className="flex-1 h-[100rpx] px-[24rpx] bg-muted border border-border rounded-[16rpx] text-[32rpx] text-foreground"
            type="text"
            placeholder={t('course.list.searchPlaceholder')}
            placeholderStyle="color: var(--color-text-tertiary)"
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={onSearch}
          />
          {/* RN 无独立搜索按钮(returnKeyType=search),保留功能入口并按 RN moreLink 字号/色对齐(14dp→28rpx,text.secondary) */}
          <View
            className="ml-[16rpx] px-[24rpx] h-[100rpx] leading-[100rpx] text-muted-foreground text-[28rpx]"
            hoverClass="opacity-60"
            onClick={onSearch}
          >
            <Text>{t('course.list.search')}</Text>
          </View>
        </View>

        <View className="mb-[24rpx]">
          <SectionHeader
            title={tt('course.list.title', '精品课程')}
            subtitle={`${list.length} 个课{tt('courseList.p1', '程')}`}
            showMore={false}
          />
        </View>

        {list.length > 0 && (
          <View>
            {list.map((item) => (
              <View
                key={item.id}
                className="flex bg-card rounded-[32rpx] overflow-hidden mb-[24rpx]"
                hoverClass="opacity-85"
                onClick={() => goDetail(item.id)}
              >
                {/* 对齐 RN courseImage:110×110dp→220×220rpx,圆角 12dp→24rpx,底色 border.light */}
                <Image
                  className="w-[220rpx] h-[220rpx] bg-border flex-shrink-0"
                  src={item.coverUrl}
                  mode="aspectFill"
                />
                {/* 对齐 RN courseInfo:padding 12dp→24rpx,纵向 gap 6dp→12rpx;价格独立成行(RN pricePaid:16dp→32rpx/600/text.primary) */}
                <View className="flex-1 p-[24rpx] flex flex-col gap-[12rpx]">
                  <Text className="text-[32rpx] text-foreground font-semibold">{item.title}</Text>
                  {item.subtitle && (
                    <Text className="text-[28rpx] text-muted-foreground">{item.subtitle}</Text>
                  )}
                  {item.teacher && (
                    <Text className="text-[24rpx] text-muted-foreground">{item.teacher}</Text>
                  )}
                  <Text className="text-[32rpx] text-foreground font-semibold">
                    ¥{item.price ?? 0}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 对齐 RN emptyWrap/emptyText:paddingY 48dp→96rpx,字号 14dp→28rpx,text.secondary */}
        {!loading && list.length === 0 && (
          <View className="text-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('course.list.empty')}</Text>
          </View>
        )}

        {/* 对齐 RN centerWrap:paddingY 48dp→96rpx */}
        {loading && (
          <View className="flex justify-center items-center py-[96rpx]">
            <ColorfulLoader size={80} />
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
