// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getStudyInfo, getStudyRecords, type StudyRecord } from '@/api'
import rankoneIcon from '@/assets/remote/images/rankone.png'
import kechengIcon from '@/assets/remote/images/kecheng.png'
// record_back.png 5.2MB 大图,用字符串路径让 Taro copy 到 dist/static/ 而非打包进 common.js
const recordBackIcon = '/static/images/record_back.png'
import studyIconAddIcon from '@/assets/remote/images/study_icon_add.png'
import wenjianIcon from '@/assets/remote/images/wenjian.png'
import ThemeRoot from '@/components/ThemeRoot'

function isImagePath(s: string): boolean {
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')
}

interface StudyInfo {
  todayMinutes: number
  totalMinutes: number
  continuousDays: number
  courses: number
}

const RECENT_LIMIT = 5

export default function StudyIndex() {
  const { t } = useI18n()
  const [info, setInfo] = useState<StudyInfo>({
    todayMinutes: 0,
    totalMinutes: 0,
    continuousDays: 0,
    courses: 0,
  })
  const [recent, setRecent] = useState<StudyRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [infoRes, recordRes] = await Promise.all([
        getStudyInfo(),
        getStudyRecords({ page: 1, pageSize: RECENT_LIMIT }),
      ])
      setInfo(infoRes)
      setRecent(recordRes?.list || [])
    } catch {
      // 统一提示
    } finally {
      setLoading(false)
    }
  }, [])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  useDidShow(() => {
    load()
  })

  const goVideo = useCallback((r: StudyRecord) => {
    Taro.navigateTo({
      url: `/pages/study/video-detail/index?id=${r.id}&courseId=${r.courseId}`,
    })
  }, [])

  const entries = [
    { icon: recordBackIcon, labelKey: 'study.record', url: '/pages/study/record' },
    { icon: studyIconAddIcon, labelKey: 'study.plan', url: '/pages/study/plan' },
    { icon: rankoneIcon, labelKey: 'study.rank', url: '/pages/study/rank' },
    { icon: wenjianIcon, labelKey: 'study.exam', url: '/pages/exam/list' },
    { icon: kechengIcon, labelKey: 'profile.myCourses', url: '/pages/study/my-study/index' },
  ]

  return (
    <ThemeRoot>
      {/* 对齐 RN StudyProgressScreen:容器底 surface.bg,paddingH 10dp→20rpx / paddingT 48dp→96rpx / paddingB 32dp→64rpx */}
      <View className="min-h-screen bg-background px-[20rpx] pt-[96rpx] pb-[64rpx]">
        {/* 统计卡网格对齐 RN statGrid/statCard:gap 8dp→16rpx,卡片 p 14dp→28rpx / 圆角 12dp→24rpx / 边框 border.light / 数值 22dp→44rpx/700 success */}
        <View className="flex flex-wrap gap-[16rpx] mb-[32rpx]">
          <View className="w-[calc(50%_-_8rpx)] flex flex-col items-center p-[28rpx] rounded-[24rpx] border border-border bg-card">
            <Text className="text-[44rpx] font-bold text-success">{info.todayMinutes}</Text>
            <Text className="block mt-[16rpx] text-[22rpx] text-muted-foreground">
              {t('study.todayMinutes')}
            </Text>
          </View>
          <View className="w-[calc(50%_-_8rpx)] flex flex-col items-center p-[28rpx] rounded-[24rpx] border border-border bg-card">
            <Text className="text-[44rpx] font-bold text-success">{info.totalMinutes}</Text>
            <Text className="block mt-[16rpx] text-[22rpx] text-muted-foreground">
              {t('study.totalMinutes')}
            </Text>
          </View>
          <View className="w-[calc(50%_-_8rpx)] flex flex-col items-center p-[28rpx] rounded-[24rpx] border border-border bg-card">
            <Text className="text-[44rpx] font-bold text-success">{info.continuousDays}</Text>
            <Text className="block mt-[16rpx] text-[22rpx] text-muted-foreground">
              {t('study.continuousDays')}
            </Text>
          </View>
          <View className="w-[calc(50%_-_8rpx)] flex flex-col items-center p-[28rpx] rounded-[24rpx] border border-border bg-card">
            <Text className="text-[44rpx] font-bold text-success">{info.courses}</Text>
            <Text className="block mt-[16rpx] text-[22rpx] text-muted-foreground">
              {t('study.courses')}
            </Text>
          </View>
        </View>

        {/* 学习记录入口(RN 无对应区,保留业务;卡片视觉统一为 RN card 语言:圆角 24rpx + 边框) */}
        <View className="mb-[24rpx] bg-card rounded-[24rpx] border border-border p-[16rpx] flex flex-col gap-[8rpx]">
          {entries.map((e) => (
            <View key={e.url} className="flex items-center p-[24rpx]" onClick={() => navigate(e.url)}>
              {isImagePath(e.icon) ? (
                <Image src={e.icon} className="w-[40rpx] h-[40rpx]" mode="aspectFit" />
              ) : (
                <Text>{e.icon}</Text>
              )}
              <Text className="flex-1 ml-[24rpx] text-[28rpx] text-foreground">{t(e.labelKey)}</Text>
              <Text className="text-muted-foreground">›</Text>
            </View>
          ))}
        </View>

        {/* 继续学习对齐 RN sectionTitle(18dp→36rpx/700)+ 课程进度卡(card: p 28rpx / 圆角 24rpx / 边框;标题 16dp→32rpx/600;进度条 h 6dp→12rpx,fill success;meta 11dp→22rpx text.tertiary) */}
        <Text className="block text-[36rpx] font-bold text-foreground mb-[16rpx]">
          {t('study.continueLearning')}
        </Text>
        {loading ? (
          <View className="text-center py-[48rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        ) : recent.length > 0 ? (
          <View className="flex flex-col gap-[16rpx]">
            {recent.map((r) => (
              <View
                key={r.id}
                className="p-[28rpx] rounded-[24rpx] border border-border bg-card"
                onClick={() => goVideo(r)}
              >
                <Text className="block text-[32rpx] font-semibold text-foreground">
                  {r.courseTitle}
                </Text>
                <View className="h-[12rpx] bg-card rounded-[24rpx] overflow-hidden mt-[16rpx]">
                  <View
                    className="h-[12rpx] bg-success rounded-[24rpx]"
                    style={{ width: `${r.progress}%` }}
                  />
                </View>
                <Text className="block mt-[16rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                  {`${t('study.recordPage.progress').replace(/\s*\{\{n\}\}\s*%?/, '')} ${r.progress}%`}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="text-center py-[48rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('study.emptyCourse')}</Text>
          </View>
        )}

        {/* FAB 对齐 RN FloatingActionButton:48×48dp→96rpx / 圆角 12dp→24rpx / bg brand / 图标 24dp→48rpx */}
        <View
          className="fixed bottom-5 right-4 w-[96rpx] h-[96rpx] bg-primary text-primary-foreground rounded-[24rpx] flex items-center justify-center text-[48rpx] shadow-md"
          onClick={() => navigate('/pages/study/publish/index')}
        >
          <Text>+</Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
