// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Image } from '@tarojs/components'
import { useTt } from '@/i18n'
import { PressableCard } from '@/components/ScreenStates.taro'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import { formatDateByTemplate } from '@ihui/shared'
import type { StudyRecord } from '@/api'

/**
 * 学习记录行:GET /study/records 除共享类型 StudyRecord 外还回 lessonTitle(study-routes.ts:49-61)。
 * status 未进共享类型,故本页三态一律由 progress 派生 —— 与 RN 共享屏
 * completed / in_progress / paused 同义(paused 即零进度、灰档;该端点每行 progress 为真值,
 * 报名未学即为 0 ⇒ 三档均可达)。
 * 两点如实登记:① 该端点不产出 coverUrl ⇒ 封面无图腿是当前常态,兜底文案恒展示;
 * ② 行上的时刻字段真名是 lastStudyAt / createdAt(study-routes.ts:59-60),
 * 共享类型里的 time 后端从未给出 ⇒ 展示时刻只认这两个,不读 time。
 */
export type StudyRecordRow = StudyRecord & {
  coverUrl?: string
  lessonTitle?: string
  lastStudyAt?: string
  createdAt?: string
}

export type RecordStatus = 'completed' | 'in_progress' | 'paused'

const STATUS_BASE = 'text-[length:20rpx] font-semibold py-[8rpx] px-[16rpx] rounded-sm'
const META_TEXT = 'text-[length:22rpx] text-[var(--color-text-tertiary)]'

/** 三态派生:100% 已完成 / 有进度进行中 / 零进度已暂停(对齐 RN statusLabel 三档) */
export function statusOf(progress: number): RecordStatus {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in_progress'
  return 'paused'
}

/**
 * 单条学习记录卡 —— 对齐 RN card:titleRow(标题 + 状态徽章)/ metaRow(时长·进度 + 上次学习)/
 * 进度条(success 档)+ 本页保留的「继续学习」入口。padding 14dp→28rpx、radius→rounded-lg。
 */
export function RecordCard({ row, onOpen }: { row: StudyRecordRow; onOpen: () => void }) {
  const tt = useTt()
  const st = statusOf(row.progress)
  const statusLabel =
    st === 'completed'
      ? tt('studyRecord.statusCompleted', '已完成')
      : st === 'paused'
        ? tt('studyRecord.statusPaused', '已暂停')
        : tt('studyRecord.statusInProgress', '进行中')
  const statusClass =
    st === 'completed'
      ? 'bg-[var(--color-success-light)] text-foreground'
      : st === 'paused'
        ? 'bg-muted text-muted-foreground'
        : 'bg-[var(--color-warning-light)] text-foreground'
  // 对齐 RN:courseTitle → lessonTitle → 未命名学习记录(lessons.title 为 notNull,
  // 兜底只在历史空串行上命中)
  const title = row.courseTitle || row.lessonTitle || tt('studyRecord.untitled', '未命名学习记录')
  // metaRow 只展示进度:每行的「时长」字段是处理器写死的 0(study-routes.ts:55 `duration: 0`),
  // 不是真实分钟数 ⇒ 展示它等于摆假数据。对应文案键已从本页撤除,等后端真出该字段再接回。
  const meta: string[] = []
  if (typeof row.progress === 'number') {
    meta.push(`${tt('studyRecord.progress', '进度')}: ${clampPercent(row.progress)}%`)
  }
  const lastStudyAt = formatDateByTemplate(row.lastStudyAt || row.createdAt || '', 'YYYY-MM-DD')

  return (
    <PressableCard
      className="flex bg-card border border-border rounded-lg p-[28rpx]"
      onClick={onOpen}
    >
      {row.coverUrl ? (
        <Image
          className="w-[160rpx] h-[120rpx] rounded-lg bg-muted flex-shrink-0"
          src={row.coverUrl}
          mode="aspectFill"
        />
      ) : (
        <View className="w-[160rpx] h-[120rpx] rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
          <Text className="text-[length:22rpx] text-muted-foreground">
            {tt('study.recordPage.coverFallback', '课程')}
          </Text>
        </View>
      )}
      <View className="flex-1 min-w-0 ml-[20rpx] flex flex-col">
        <View className="flex items-center justify-between">
          <Text className="flex-1 min-w-0 mr-[12rpx] text-[length:32rpx] font-bold text-foreground overflow-hidden ihui-ellipsis whitespace-nowrap">
            {title}
          </Text>
          <Text className={`${STATUS_BASE} ${statusClass}`}>{statusLabel}</Text>
        </View>
        <View className="mt-[12rpx]">
          <View className="h-[8rpx] bg-muted rounded-xs overflow-hidden">
            <View
              className="h-full bg-success rounded-xs"
              style={{ width: `${clampPercent(row.progress)}%` }}
            />
          </View>
        </View>
        <View className="mt-[10rpx] flex items-center justify-between">
          <Text className={META_TEXT}>{meta.join(' · ')}</Text>
          <Text className={META_TEXT}>
            {tt('study.recordPage.lastTime', '上次学习')}: {lastStudyAt}
          </Text>
        </View>
        <View className="mt-[12rpx] self-end py-[16rpx] px-[32rpx] bg-cta rounded-xl">
          <Text className="text-[length:28rpx] font-semibold text-cta-foreground leading-[1.4]">
            {tt('study.recordPage.continue', '继续学习')}
          </Text>
        </View>
      </View>
    </PressableCard>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
