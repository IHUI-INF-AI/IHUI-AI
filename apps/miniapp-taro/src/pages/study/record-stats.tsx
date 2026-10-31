// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'

/** 学习统计聚合 —— 与 RN 共享屏 StudyRecordStats 同字段,数据源 GET /study/statistics */
export interface StudyStats {
  totalDuration: number
  totalCourses: number
  completedCourses: number
  totalLessons: number
  completedLessons: number
  continuousDays: number
}

/**
 * 学习统计卡 —— 对齐 RN StudyRecordScreen.statsCard:6 指标 2 行 × 3 格。
 * 档位换算与仓内镜像页同口径(RN dp × 2 = rpx):padding 14dp→28rpx、radius rnRadius.lg→rounded-lg,
 * 数值 20dp→40rpx/700 text.primary,标签 11dp→22rpx text.secondary。
 */
export function RecordStats({ stats }: { stats: StudyStats | null }) {
  const tt = useTt()
  const rows: Array<Array<{ key: string; value: number; label: string }>> = [
    [
      {
        key: 'totalDuration',
        value: stats?.totalDuration ?? 0,
        label: tt('studyRecord.totalDuration', '累计时长(分钟)'),
      },
      {
        key: 'totalCourses',
        value: stats?.totalCourses ?? 0,
        label: tt('studyRecord.totalCourses', '课程总数'),
      },
      {
        key: 'completedCourses',
        value: stats?.completedCourses ?? 0,
        label: tt('studyRecord.completedCourses', '已完成课程'),
      },
    ],
    [
      {
        key: 'totalLessons',
        value: stats?.totalLessons ?? 0,
        label: tt('studyRecord.totalLessons', '课时总数'),
      },
      {
        key: 'completedLessons',
        value: stats?.completedLessons ?? 0,
        label: tt('studyRecord.completedLessons', '已完成课时'),
      },
      {
        key: 'continuousDays',
        value: stats?.continuousDays ?? 0,
        label: tt('studyRecord.continuousDays', '连续学习(天)'),
      },
    ],
  ]

  return (
    <View className="bg-card border border-border rounded-lg p-[28rpx] mb-[24rpx] flex flex-col gap-[24rpx]">
      {rows.map((row, i) => (
        <View key={i} className="flex">
          {row.map((cell) => (
            <View key={cell.key} className="flex-1 flex flex-col items-center">
              <Text className="text-heading font-bold text-foreground leading-[1.2]">
                {cell.value}
              </Text>
              <Text className="mt-[16rpx] text-[length:22rpx] text-muted-foreground text-center">
                {cell.label}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
