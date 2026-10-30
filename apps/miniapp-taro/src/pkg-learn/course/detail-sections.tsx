// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 课程详情页 — 对齐 RN 共享屏的补齐分区(2026-10-29 还原度补齐)
 *
 * 对齐目标:packages/app/src/features/course-detail/CourseDetailScreen.tsx
 *
 * 共享屏的 tagRow(等级 + 学习人数)、actionRow(价格 + 已报名徽章 / 报名·支付按钮)、
 * lessons 区(section 标题 + 逐节完成态)在本页一个元素都没有 —— 还原度门记 8 个缺口。
 * 这里按共享屏的结构最小补齐,文案键**一律复用共享屏那套**
 * (词条已在 packages/i18n/messages/miniapp-taro/ 五语言齐备),不新造键、不写死中文。
 *
 * 数据口径:列表/详情端点(apps/api miniapp-public-fallback-routes 的 toCourseRow)已返回
 * `isFree` / `signupCount`,端内 Course 类型尚未收敛这两列,由页面按同一份返回读取,
 * 不在端内造第二份投影。
 */
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { EmptyState } from '@/components/ScreenStates.taro'

/** 目录里的一行(与共享屏 CourseDetailLesson 同信息结构 + 端内高亮态) */
export interface CourseLessonRow {
  id: string
  title: string
  /** 已学完(共享屏 courseDetail.completed 的语义位) */
  completed: boolean
  locked: boolean
  /** 当前学习位置(端内 CourseCatalog 原有 currentId 高亮,替换后保留) */
  current: boolean
}

/** 标签行:等级 + 学习人数(共享屏 tagRow 同结构) */
export function CourseMetaTags({ level, studentCount }: { level?: string; studentCount?: number }) {
  const { t } = useI18n()
  return (
    <View className="flex flex-row flex-wrap gap-[12rpx] px-[24rpx] py-[16rpx]">
      {level ? (
        <View className="px-[16rpx] py-[4rpx] rounded-md bg-muted">
          <Text className="text-[length:22rpx] text-muted-foreground">{level}</Text>
        </View>
      ) : null}
      {studentCount === null || studentCount === undefined ? null : (
        <View className="px-[16rpx] py-[4rpx] rounded-md bg-muted">
          <Text className="text-[length:22rpx] text-muted-foreground">
            {t('courseDetail.studentCount', { count: studentCount })}
          </Text>
        </View>
      )}
    </View>
  )
}

/** 底部操作条:价格 + 已报名徽章 / 报名·支付按钮(共享屏 actionRow 同语义) */
export function CourseActionBar({
  isFree,
  price,
  enrolled,
  enrolling,
  onEnroll,
}: {
  isFree: boolean
  price: number
  enrolled: boolean
  enrolling: boolean
  onEnroll: () => void
}) {
  const { t } = useI18n()
  return (
    <View className="fixed left-0 right-0 bottom-0 h-[100rpx] bg-card flex flex-row items-center justify-between px-4 shadow-[0_-2rpx_12rpx_var(--color-black-6)]">
      <View className="flex-1 flex flex-row items-baseline">
        {isFree ? (
          <Text className="text-[length:32rpx] font-bold text-[var(--color-success)]">
            {t('courseDetail.free')}
          </Text>
        ) : (
          <>
            <Text className="text-[length:28rpx] font-bold text-primary">¥</Text>
            <Text className="text-[length:40rpx] font-bold text-primary">{price.toFixed(2)}</Text>
          </>
        )}
      </View>
      {enrolled ? (
        <View className="px-[20rpx] py-[8rpx] rounded-md bg-[var(--color-success-lighter)]">
          <Text className="text-[length:24rpx] text-[var(--color-success-deep-text)]">
            {t('courseDetail.enrolled')}
          </Text>
        </View>
      ) : (
        <View
          className={`px-[20rpx] h-[80rpx] leading-[80rpx] rounded-xl text-[length:32rpx] font-semibold bg-cta text-cta-foreground ${enrolling ? 'opacity-50' : ''}`}
          hoverClass="opacity-60"
          onClick={enrolling ? undefined : onEnroll}
        >
          <Text>
            {isFree
              ? t('courseDetail.enroll')
              : t('courseDetail.pay', { amount: price.toFixed(2) })}
          </Text>
        </View>
      )}
    </View>
  )
}

/** 课程目录:section 标题 + 逐节完成态(共享屏 lessons 区同结构) */
export function LessonsSection({
  lessons,
  onLessonClick,
}: {
  lessons: CourseLessonRow[]
  onLessonClick: (lesson: CourseLessonRow, index: number) => void
}) {
  const { t } = useI18n()
  return (
    <View className="mx-3 my-3 bg-card rounded-lg overflow-hidden">
      <View className="flex flex-row items-center justify-between px-4 py-3">
        <Text className="text-[length:32rpx] font-semibold text-foreground">
          {t('courseDetail.lessons')}
        </Text>
        <Text className="text-[length:22rpx] text-muted-foreground">{lessons.length}</Text>
      </View>
      {lessons.length === 0 ? (
        <EmptyState title={t('common.empty')} />
      ) : (
        lessons.map((lesson, idx) => (
          <View
            key={lesson.id}
            className={`flex flex-row items-center justify-between px-4 py-[24rpx] ${lesson.current ? 'bg-muted' : ''}`}
            hoverClass="opacity-60"
            onClick={() => onLessonClick(lesson, idx)}
          >
            <Text
              className={`flex-1 text-[length:28rpx] text-foreground ${lesson.current ? 'font-semibold' : ''}`}
            >
              {lesson.title}
            </Text>
            {lesson.completed ? (
              <Text className="ml-2 text-[length:24rpx] text-[var(--color-success)]">
                {t('courseDetail.completed')}
              </Text>
            ) : null}
            {lesson.locked ? (
              <LineIcon
                name="lock"
                size={28}
                color="var(--color-muted-foreground)"
                className="ml-2"
              />
            ) : null}
          </View>
        ))
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
