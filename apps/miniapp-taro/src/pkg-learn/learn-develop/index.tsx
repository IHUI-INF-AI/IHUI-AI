// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { Course } from '@/api'
import aiallIcon from '@/assets/remote/images/aiall.png'
import kechengIcon from '@/assets/remote/images/kecheng.png'
import rankoneIcon from '@/assets/remote/images/rankone.png'
import useNumIcon from '@/assets/remote/images/useNum.png'
import ThemeRoot from '@/components/ThemeRoot'

// chuangke.png 体积 644 KB,直接 import 会被打包进 chunk 导致页面体积 887 KB。
// 改为字符串路径,Taro copy 配置(src/static/ → dist/static/)会将其复制到
// dist/static/images/chuangke.png,运行时通过 /static/images/chuangke.png 访问。
// 对齐原项目 zhs_app-ZZ 的字符串路径引用模式(rankings.vue: /static/images/...)。
const chuangkeIcon = '/static/images/chuangke.png'

function isImagePath(s: string): boolean {
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')
}

interface LearnPath {
  id: string
  icon: string
  nameKey: string
  name: string
  courses: number
  progress: number
}

const LEARN_PATHS = (tt: TtFn): LearnPath[] => [
  {
    id: 'p1',
    icon: chuangkeIcon,
    nameKey: 'learnDevelop.pathFrontend',
    name: tt('learndevelop.d1', '前端工程师'),
    courses: 12,
    progress: 35,
  },
  {
    id: 'p2',
    icon: aiallIcon,
    nameKey: 'learnDevelop.pathAI',
    name: tt('learndevelop.d2', 'AI 应用开发'),
    courses: 8,
    progress: 0,
  },
  {
    id: 'p3',
    icon: useNumIcon,
    nameKey: 'learnDevelop.pathData',
    name: tt('learndevelop.d3', '数据分析师'),
    courses: 15,
    progress: 60,
  },
]

export default function LearnDevelop() {
  const { t } = useI18n()
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
    loadData()
  })

  const onItemClick = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pkg-learn/course/detail?id=${id}` })
  }, [])

  const onGoRank = useCallback(() => {
    Taro.navigateTo({ url: '/pages/study/rank' })
  }, [])

  return (
    <ThemeRoot>
      {/* 对齐 RN LearnDevelopScreen:容器底 surface.bg;头部无卡片底(与 RN header 一致直接置于页面底色上),标题 20dp→40rpx/600 */}
      <View className="min-h-screen bg-background">
        <View className="px-[20rpx] py-[24rpx]">
          <Text className="text-[40rpx] font-semibold text-foreground">
            {t('learnDevelop.title')}
          </Text>
        </View>
        {/* 对齐 RN scrollContent:paddingH 10dp→20rpx / paddingV 12dp→24rpx / paddingB 24dp→48rpx */}
        <View className="px-[20rpx] pt-[24rpx] pb-[48rpx]">
          {/* 学习路径(RN 无对应区,保留业务;卡片对齐 RN entryCard 语言:圆角 12dp→24rpx + 边框 border.light + padding 14dp→28rpx) */}
          <View className="first:mt-0 mt-[24rpx] mb-[16rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">
              {tt('learnDevelop.pathTitle', '学习路径')}
            </Text>
          </View>
          {LEARN_PATHS(tt).map((path) => (
            <View
              key={path.id}
              className="flex items-center p-[28rpx] bg-card rounded-[24rpx] border border-border mb-[16rpx]"
            >
              <View className="w-[88rpx] h-[88rpx] flex items-center justify-center bg-background rounded-[12rpx] flex-shrink-0 mr-[16rpx]">
                {isImagePath(path.icon) ? (
                  <Image src={path.icon} className="w-[48rpx] h-[48rpx]" mode="aspectFit" />
                ) : (
                  <Text className="text-[48rpx]">{path.icon}</Text>
                )}
              </View>
              <View className="flex-1 flex flex-col">
                <Text className="text-[30rpx] font-semibold text-foreground">
                  {tt(path.nameKey, path.name)}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                  {path.courses} {tt('learnDevelop.coursesUnit', '门课')} ·{' '}
                  {tt('learnDevelop.progress', '进度')} {path.progress}%
                </Text>
                {/* 进度条对齐 RN 进度条语言(StudyProgress bar/barFill):h 6dp→12rpx、胶囊圆角 24rpx、填充 success;轨道保留 bg-muted(RN 轨道 surface.card 在亮色卡片上不可见,此处保持可见) */}
                <View className="h-[12rpx] bg-muted rounded-[12rpx] mt-[12rpx] overflow-hidden">
                  <View
                    className="h-full bg-success rounded-[12rpx]"
                    style={{ width: `${path.progress}%` }}
                  />
                </View>
              </View>
            </View>
          ))}

          {/* 推荐课程(RN 无对应区,保留业务;课程行卡对齐 RN CourseCarousel list 变体卡片:圆角 24rpx + 边框,thumb 100×80dp→200×160rpx 直角,价格 12dp→24rpx/600,免费 success/付费 text.primary) */}
          <View className="first:mt-0 mt-[24rpx] mb-[16rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">
              {tt('learnDevelop.recommend', '推荐课程')}
            </Text>
          </View>
          {loading && courseList.length === 0 ? (
            <Text className="block text-center text-muted-foreground py-[80rpx]">
              {t('common.loading')}
            </Text>
          ) : error && courseList.length === 0 ? (
            <View className="flex flex-col items-center py-[40rpx]">
              <Text className="block text-center text-muted-foreground py-[40rpx]">
                {tt('learnDevelop.loadFailed', '加载失败')}
              </Text>
              <Text
                className="inline-block mt-[24rpx] py-[16rpx] px-[48rpx] bg-primary text-primary-foreground text-center rounded-[12rpx] text-[28rpx]"
                onClick={loadData}
              >
                {t('common.retry')}
              </Text>
            </View>
          ) : courseList.length > 0 ? (
            courseList.map((item) => (
              <View
                key={item.id}
                className="flex bg-card rounded-[24rpx] border border-border overflow-hidden mb-[16rpx]"
                hoverClass="opacity-60"
                onClick={() => onItemClick(item.id)}
              >
                {item.coverUrl ? (
                  <Image
                    className="w-[200rpx] h-[160rpx] flex-shrink-0 bg-muted"
                    src={item.coverUrl}
                    mode="aspectFill"
                  />
                ) : (
                  <View className="w-[200rpx] h-[160rpx] flex-shrink-0 bg-muted flex items-center justify-center">
                    <Image src={kechengIcon} className="w-[48rpx] h-[48rpx]" mode="aspectFit" />
                  </View>
                )}
                <View className="flex-1 px-[24rpx] py-[16rpx] flex flex-col justify-between min-h-[160rpx]">
                  <Text className="text-[28rpx] text-foreground font-semibold leading-[1.4] line-clamp-2 overflow-hidden">
                    {item.title}
                  </Text>
                  {item.teacher ? (
                    <Text className="text-[24rpx] text-muted-foreground mt-[8rpx]">
                      {tt('learnDevelop.teacher', '讲师')}: {item.teacher}
                    </Text>
                  ) : null}
                  {item.price !== null && item.price !== undefined ? (
                    <Text
                      className={`text-[24rpx] font-semibold ${item.price === 0 ? 'text-success' : 'text-foreground'}`}
                    >
                      {item.price === 0
                        ? tt('learnDevelop.free', '免费')
                        : `¥${item.price.toFixed(2)}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text className="block text-center text-muted-foreground py-[40rpx]">
              {t('learnDevelop.empty')}
            </Text>
          )}

          {/* 学习排行榜入口(RN 无对应区,保留业务;卡片语言同上) */}
          <View
            className="flex items-center justify-between p-[28rpx] bg-card rounded-[24rpx] border border-border mt-[24rpx]"
            hoverClass="opacity-60"
            onClick={onGoRank}
          >
            <View className="flex items-center">
              <Image
                src={rankoneIcon}
                className="w-[40rpx] h-[40rpx] mr-[16rpx]"
                mode="aspectFit"
              />
              <Text className="text-[28rpx] text-foreground font-semibold">
                {tt('learnDevelop.rankEntry', '学习排行榜')}
              </Text>
            </View>
            <Text className="text-[36rpx] text-muted-foreground">›</Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
