// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/learn-develop/LearnDevelopScreen.tsx
//
// 薄壳(2026-11-14 收敛):学习路径卡与推荐课程区委托共享屏 `LearnDevelopScreen`,
// 本端只保留平台职责:
//   ① 取数 —— GET /api/content/course/list;② 生命周期 —— useDidShow;
//   ③ 导航 —— 课程详情 / 排行榜 / 创客名片(联系李总)。
// 路径卡走共享 entries(含 meta + progress 进度条),课程区走 courses 段(含三态 + 重试),
// 本端不再手写这两块的样式。
import { aizhsUrl } from '@/constants/icon-urls'
import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { Course } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { PressableCard } from '@/components/ScreenStates.taro'
import { LearnDevelopScreen } from '@ihui/rn-app/features/learn-develop/LearnDevelopScreen'
import { useAppTheme } from '@/lib/theme'
import type { LearnDevelopCourseCard, LearnDevelopEntry } from '@ihui/types'

const aiallIcon = aizhsUrl('remote-images/aiall.png')
const rankoneIcon = aizhsUrl('remote-images/rankone.png')
const useNumIcon = aizhsUrl('remote-images/useNum.png')
// chuangke.png 已外置到 CDN(与 src/assets/remote/images/chuangke.png 字节一致),
// 通过 aizhsUrl 运行时加载,不再复制进主包。
const chuangkeIcon = aizhsUrl('remote-images/chuangke.png')

/** 学习路径卡 → 共享 entries。meta 承载「N 门课 · 进度 X%」,progress 驱动进度条。 */
const LEARN_PATHS = (tt: TtFn): LearnDevelopEntry[] => {
  const meta = (courses: number, progress: number) =>
    `${courses} ${tt('learnDevelop.courseUnit', '门课')} · ${tt('learnDevelop.progressLabel', '进度')} ${progress}%`
  return [
    {
      icon: chuangkeIcon,
      title: tt('learnDevelop.d1', '前端工程师'),
      desc: '',
      meta: meta(12, 35),
      progress: 35,
      onPress: () => undefined,
    },
    {
      icon: aiallIcon,
      title: tt('learnDevelop.d2', 'AI 应用开发'),
      desc: '',
      meta: meta(8, 0),
      progress: 0,
      onPress: () => undefined,
    },
    {
      icon: useNumIcon,
      title: tt('learnDevelop.d3', '数据分析师'),
      desc: '',
      meta: meta(15, 60),
      progress: 60,
      onPress: () => undefined,
    },
  ]
}

export default function LearnDevelop() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [courseList, setCourseList] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.getCourseList({ page: 1, pageSize: 5 })
      setCourseList(res?.list || [])
    } catch (e) {
      logger.error('learnDevelop', '加载课程', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${id}` })
  }, [])

  const onGoRank = useCallback(() => {
    Taro.navigateTo({ url: '/pages/study/rank' })
  }, [])

  // 直接联系李总 → 创客名片页(对齐 RN wrapper 的 onContact → navigate('Carte'))
  const onContact = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-content/carte/index' })
  }, [])

  const courses: LearnDevelopCourseCard[] = courseList.map((item) => ({
    id: String(item.id),
    title: item.title,
    coverUrl: item.coverUrl,
    teacher: item.teacher,
    price: item.price ?? null,
  }))

  return (
    <ThemeRoot>
      <LearnDevelopScreen
        t={t}
        onBack={() => Taro.navigateBack()}
        onNavigate={(url) => Taro.navigateTo({ url })}
        onContact={onContact}
        entries={LEARN_PATHS(tt)}
        entriesTitle={tt('learnDevelop.pathTitle', '学习路径')}
        coursesTitle={tt('learnDevelop.recommend', '推荐课程')}
        courses={courses}
        coursesSection={
          loading && courseList.length === 0
            ? 'loading'
            : error && courseList.length === 0
              ? 'error'
              : courseList.length === 0
                ? 'empty'
                : 'ready'
        }
        onRetry={loadData}
        coursesEmptyLabel={t('learnDevelop.empty')}
        onCoursePress={onItemClick}
        // 本页依赖原生导航栏:隐藏共享屏内置 header,避免双标题/双返回
        hideHeader
        colorScheme={resolved}
      />

      {/* 排行榜入口:共享屏 entries 是两列栅格,这一条需要整行形态 ⇒ 留在页面层渲染
          (样式与共享卡的卡片语言一致:卡片底 + 边框 + 圆角)。 */}
      <View className="px-[20rpx] pb-[48rpx]">
        <PressableCard
          className="flex items-center justify-between p-[28rpx] bg-card rounded-lg border border-border mt-[24rpx]"
          onClick={onGoRank}
        >
          <View className="flex items-center">
            <Image src={rankoneIcon} className="w-[40rpx] h-[40rpx] mr-[16rpx]" mode="aspectFit" />
            <Text className="text-body text-foreground font-semibold">
              {tt('learnDevelop.rankEntry', '学习排行榜')}
            </Text>
          </View>
          <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
        </PressableCard>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
