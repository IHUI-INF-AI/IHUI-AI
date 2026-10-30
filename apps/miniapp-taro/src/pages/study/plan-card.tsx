// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 学习计划卡片的共享屏对齐件:状态词表/徽章/截止日 + 卡片脚(课程数 / 进度 / 截止时间)。
// 拆到同目录子模块只为一件事:plan.tsx 保持在 250 行内(页面体量约束),门会读同目录 ./ 模块。

import { View, Text } from '@tarojs/components'

/** 状态词表与 RN 共享屏 StudyPlanScreen 的 PlanStatus 同一套(active/paused/completed/overdue) */
export type PlanStatus = 'active' | 'paused' | 'completed' | 'overdue'

/** GET /study/plan 行(共享屏卡片消费的那几个字段;后端未出的按可选字段消费) */
export interface PlanItem {
  id: string
  title: string
  target: number
  /** 进度百分比(0-100,当日已学分钟 / target,后端实时聚合) */
  progress: number
  /** 今日已学分钟数(全部计划共享当日聚合值) */
  minutes?: number
  /** 创建时刻(GET /study/plan 行上真实存在,api 包装类型未声明 ⇒ 本页按可选字段消费) */
  createdAt?: string
  /** 后端回传状态时优先用它;不回则由进度 / 截止日推出 */
  status?: PlanStatus
  /** 课时数:当前 /study/plan 行不出网,回传即渲染;不回时小程序内建计划本就不带课程 ⇒ 0/0 */
  totalLessons?: number
  completedLessons?: number
  /** 截止日 YYYY-MM-DD;不回时按后端同一窗口(创建 + 30 天)推出 */
  deadline?: string
}

/** 端内 t 的类型(与 i18n provider 的 t 同形,避免子模块重复实现取词) */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/** 截止日:后端没给就按后端同一窗口推(创建时刻 + 30 天,与 study-plan-routes.ts 的 due 同源)。 */
export function deadlineOf(p: PlanItem): string {
  if (p.deadline) return p.deadline
  if (!p.createdAt) return ''
  const created = new Date(p.createdAt)
  if (Number.isNaN(created.getTime())) return ''
  return new Date(created.getTime() + 30 * 86400_000).toISOString().slice(0, 10)
}

/** 状态:后端回传优先(共享屏词表),否则由进度 / 截止日推出 —— 逾期是真实可达的。 */
export function statusOf(p: PlanItem): PlanStatus {
  if (p.status) return p.status
  if (p.progress >= 100) return 'completed'
  const deadline = deadlineOf(p)
  if (deadline && deadline < new Date().toISOString().slice(0, 10)) return 'overdue'
  return 'active'
}

/** 徽章文案对齐 RN statusLabel(完成带 ✓),四档与共享屏逐字一致。 */
export function statusLabel(t: TranslateFn, status: PlanStatus): string {
  switch (status) {
    case 'paused':
      return t('studyPlan.status.paused')
    case 'completed':
      return `${t('studyPlan.status.completed')} ✓`
    case 'overdue':
      return t('studyPlan.status.overdue')
    default:
      return t('studyPlan.status.active')
  }
}

/** 徽章配色对齐 RN statusBadgeStyle:进行中 success.light / 暂停 amber / 完成 success.lighter / 逾期 danger。 */
export function statusClass(status: PlanStatus): string {
  switch (status) {
    case 'paused':
      return 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]'
    case 'completed':
      return 'bg-[var(--color-success-lighter)] text-[var(--color-success-deep-text)]'
    case 'overdue':
      return 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
    default:
      return 'bg-[var(--color-success-light)] text-success'
  }
}

/** 卡片脚:课程数 / 进度 / 截止时间(对齐 RN cardFoot;窄屏按 gap 换行,不压字)。 */
export function PlanFoot({ item, t }: { item: PlanItem; t: TranslateFn }) {
  return (
    <View className="flex flex-wrap justify-between items-center mt-[16rpx] gap-x-[16rpx] gap-y-[8rpx]">
      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
        {t('studyPlan.lessons')}: {item.completedLessons ?? 0}/{item.totalLessons ?? 0}
      </Text>
      <Text className="text-[length:22rpx] font-semibold text-foreground">
        {t('studyPlan.progress')}: {item.progress}%
      </Text>
      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
        {t('studyPlan.deadline')}: {deadlineOf(item)}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
