// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/course-planet/CoursePlanetScreen.tsx
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
import * as api from '@/api'
import Carousel from '@/components/Carousel'
// P2-F 接线:SectionHeader 切换为 Taro 适配层导出(props 契约与旧实现一致;Carousel 契约不兼容保持本地实现)
import { SectionHeader } from '@/components/adapters'
import ThemeRoot from '@/components/ThemeRoot'
import CategoryBar from '@/components/CategoryBar'
import { EmptyState, ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'

interface PlanetCourse {
  id: string
  title: string
  coverUrl?: string
  teacher?: string
  price?: number
  students?: number
  category?: string
}

const PAGE_SIZE = 10

const CATEGORY_KEYS = [
  { key: 'all', label: 'coursePlanet.catAll' },
  { key: 'recommend', label: 'coursePlanet.catRecommend' },
  { key: 'hot', label: 'coursePlanet.catHot' },
  { key: 'new', label: 'coursePlanet.catNew' },
  { key: 'free', label: 'coursePlanet.catFree' },
]

export default function CoursePlanet() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [allList, setAllList] = useState<PlanetCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const loadingRef = useRef(false)

  const loadData = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(false)
    try {
      const res = (await api.getCoursePlanet()) as Record<string, unknown>
      const rawList = (res?.list as Record<string, unknown>[]) || []
      const mapped: PlanetCourse[] = rawList.map((item, idx) => ({
        id: String(item.id ?? idx),
        title:
          (item.title as string) ||
          (item.name as string) ||
          (item.courseTitle as string) ||
          t('coursePlanet.course'),
        coverUrl:
          (item.coverUrl as string) ||
          (item.image as string) ||
          (item.pic as string) ||
          (item.thumbnail as string) ||
          '',
        teacher:
          (item.teacher as string) || (item.instructor as string) || (item.author as string) || '',
        price: item.price !== null && item.price !== undefined ? Number(item.price) : undefined,
        students:
          item.students !== null && item.students !== undefined
            ? Number(item.students)
            : item.studyCount !== null && item.studyCount !== undefined
              ? Number(item.studyCount)
              : item.learnCount !== null && item.learnCount !== undefined
                ? Number(item.learnCount)
                : undefined,
        category: (item.category as string) || (item.tag as string) || (item.type as string) || '',
      }))
      // 空就空:不回填演示课程(RN CoursePlanetScreen 无兜底;本页 313 行已有 EmptyState 轨道)
      setAllList(mapped)
      setDisplayCount(PAGE_SIZE)
    } catch (e) {
      logger.error('coursePlanet', '加载课程星球', e)
      // 失败走 209 行 ErrorState 轨道:不再回填演示课程(对齐 RN 错误语义)
      setError(true)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [t])

  useDidShow(() => {
    loadData()
  })

  const onCategoryChange = useCallback((key: string) => {
    setActiveCategory(key)
    setDisplayCount(PAGE_SIZE)
  }, [])

  const filteredList = useMemo(() => {
    if (activeCategory === 'all') return allList
    if (activeCategory === 'free') return allList.filter((c) => !c.price || c.price === 0)
    return allList.filter((c) => c.category && c.category.toLowerCase().includes(activeCategory))
  }, [allList, activeCategory])

  const displayList = filteredList.slice(0, displayCount)
  const hasMore = displayCount < filteredList.length

  useReachBottom(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE)
    }
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${id}` })
  }, [])

  if (loading && allList.length === 0) {
    return (
      <ThemeRoot>
        {/* 对齐 RN CoursePlanetScreen:root 底色 brandAccent.light → --color-brand-accent-light */}
        <View className="min-h-screen bg-[var(--color-brand-accent-light)]">
          {/* 对齐 RN NavBar:高 44dp→88rpx(透明底、无下描边 ⇒ 透出页面底色) */}
          <View className="h-[88rpx] flex items-center px-[24rpx]">
            <Text className="text-[length:36rpx] font-semibold text-foreground">
              {t('coursePlanet.title')}
            </Text>
          </View>
          <View className="p-[20rpx]">
            <ScreenSkeleton variant="card" count={4} />
          </View>
        </View>
      </ThemeRoot>
    )
  }

  if (error && allList.length === 0) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-[var(--color-brand-accent-light)]">
          <View className="h-[88rpx] flex items-center px-[24rpx]">
            <Text className="text-[length:36rpx] font-semibold text-foreground">
              {t('coursePlanet.title')}
            </Text>
          </View>
          <View className="p-[20rpx]">
            {/* 对齐 RN errorText:12dp→24rpx / danger.DEFAULT / 居中 / paddingY rpx(16) */}
            <ErrorState
              message={tt('coursePlanet.loadFailed', '加载失败')}
              onRetry={() => void loadData()}
              retryLabel={t('common.retry')}
            />
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN root 底色 brandAccent.light → --color-brand-accent-light;scrollContent padding rpx(20) */}
      <View className="min-h-screen bg-[var(--color-brand-accent-light)]">
        {/* 对齐 RN NavBar:高 44dp→88rpx(透明底、无下描边 ⇒ 透出页面底色) */}
        <View className="h-[88rpx] flex items-center px-[24rpx]">
          <Text className="text-[length:36rpx] font-semibold text-foreground">
            {t('coursePlanet.title')}
          </Text>
        </View>
        {/* 分类筛选:统一分类条(与 web / RN 同形同档) */}
        <CategoryBar
          className="bg-transparent py-[16rpx] px-[20rpx]"
          value={activeCategory}
          onChange={onCategoryChange}
          items={CATEGORY_KEYS.map((cat) => ({ id: cat.key, label: tt(cat.label, cat.key) }))}
        />
        {displayList.length > 0 && (
          <View className="px-[20rpx] mb-[16rpx]">
            <SectionHeader title={tt('coursePlanet.featured', '精选推荐')} showMore={false} />
          </View>
        )}
        {displayList.length > 0 && (
          <View className="px-[20rpx] mb-[24rpx]">
            {/* 高度与圆角都回到组件默认(唯一源 carousel-spec + 组件根的角色档圆角)。
                早先这里写死过一档高度、并用 className 覆盖组件圆角,注释给出的理由是"对齐 RN"。
                那个理由是错的:对面同槽渲染的是另一枚组件(RN 课程卡),不是本配对组件,
                照抄它的数只会让两端同名组件彼此不同 —— 而它恰恰是用户实拍投诉的成因。 */}
            <Carousel
              variant="course"
              items={displayList.slice(0, 5).map((item) => ({ img: item.coverUrl || '' }))}
              courseMeta={displayList.slice(0, 5).map((item) => ({
                title: item.title,
                price: item.price,
                isFree: item.price === 0,
              }))}
              autoplay
              interval={4000}
              onItemClick={(_item, idx) => onItemClick(displayList[idx]?.id ?? '')}
            />
          </View>
        )}
        <View className="p-[20rpx]">
          {displayList.length ? (
            displayList.map((item) => (
              <View
                key={item.id}
                className="flex bg-card rounded-lg border border-border overflow-hidden mb-[24rpx]"
                hoverClass="opacity-60"
                onClick={() => onItemClick(item.id)}
              >
                {/* 对齐 RN list 变体 thumbWrap:100×80dp→200×160rpx,bg surface.muted,直角(随卡片圆角裁切) */}
                {item.coverUrl ? (
                  <Image
                    className="w-[200rpx] h-[160rpx] flex-shrink-0 bg-muted"
                    src={item.coverUrl}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[200rpx] h-[160rpx] flex-shrink-0 bg-muted flex items-center justify-center">
                    <LineIcon name="book-open" size={48} color="var(--color-muted-foreground)" />
                  </View>
                )}
                {/* 对齐 RN infoWrap:paddingH 12dp→24rpx / paddingV 8dp→16rpx / justify-between */}
                <View className="flex-1 px-[24rpx] py-[16rpx] flex flex-col justify-between min-h-[160rpx]">
                  <Text className="text-[length:28rpx] text-foreground font-semibold leading-[1.4] line-clamp-2">
                    {item.title}
                  </Text>
                  {item.teacher ? (
                    <Text className="text-[length:24rpx] text-muted-foreground mt-[8rpx]">
                      {tt('coursePlanet.teacher', '讲师')}: {item.teacher}
                    </Text>
                  ) : null}
                  <View className="flex items-center justify-between mt-[8rpx]">
                    {item.price !== null && item.price !== undefined ? (
                      <Text
                        className={`text-[length:24rpx] font-semibold ${item.price === 0 ? 'text-success' : 'text-foreground'}`}
                      >
                        {item.price === 0
                          ? tt('coursePlanet.free', '免费')
                          : `¥${item.price.toFixed(2)}`}
                      </Text>
                    ) : null}
                    {item.students !== null && item.students !== undefined ? (
                      <Text className="text-[length:24rpx] text-muted-foreground">
                        {item.students} {tt('coursePlanet.studentsUnit', '人学习')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title={t('coursePlanet.empty')} />
          )}
          {hasMore && displayList.length > 0 ? (
            <Text className="block text-center text-muted-foreground text-[length:24rpx] py-[24rpx]">
              {tt('coursePlanet.loadingMore', '加载中…')}
            </Text>
          ) : null}
          {!hasMore && displayList.length > 0 ? (
            <Text className="block text-center text-muted-foreground text-[length:24rpx] py-[24rpx]">
              {t('common.noMore')}
            </Text>
          ) : null}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
