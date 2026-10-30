// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 学习计划卡片的共享屏对齐件:状态词表/徽章/截止日 + 卡片脚(进度 / 截止时间)。
// 拆到同目录子模块只为一件事:plan.tsx 保持在 250 行内(页面体量约束),门会读同目录 ./ 模块。

import { View, Text } from '@tarojs/components'

/**
 * 状态词表。**只有三档,且三档都可达**:
 * 本端数据源是 GET /study/plan(miniapp-compat-routes.ts:2605-2612 逐字段列举,
 * 只出 id/title/target/minutes/progress/createdAt),而 `study_plans` 表本身没有状态列
 * (packages/database/src/schema/study.ts:22-30) ⇒ 后端不可能回传 status,本端也没有暂停动作
 * (plan.tsx 唯一的写动作是 POST /study/plan 新建)。共享屏词表里的「暂停」因此是
 * **结构上不可达的死分支**,已从这里撤除 —— 宁可让还原度门报缺,也不留账面假绿。
 */
export type PlanStatus = 'active' | 'completed' | 'overdue'

/**
 * GET /study/plan 行 —— 只声明该端点真出的字段。
 * 课时数(completedLessons/totalLessons)同样不在响应里:这里的「计划」是标题 + 目标分钟,
 * 与课程/课时没有关联字段可用 ⇒ 相应的「0/0」是编出来的常量,展示它等于摆假数据,
 * 对应文案键已从卡片脚撤除。
 */
export interface PlanItem {
  id: string
  title: string
  /** 目标分钟数(study_plans.target,默认 30) */
  target: number
  /** 进度百分比(0-100,当日已学分钟 / target,后端实时聚合 —— 同上行号) */
  progress: number
  /** 今日已学分钟数(全部计划共享当日聚合值) */
  minutes?: number
  /** 创建时刻(GET /study/plan 行上真实存在,api 包装类型未声明 ⇒ 本页按可选字段消费) */
  createdAt?: string
  /**
   * 截止日 YYYY-MM-DD。该端点不回传此字段,由 createdAt 按后端同一窗口推出(见 deadlineOf);
   * 后端给了就用后端的。
   */
  deadline?: string
}

/** 端内 t 的类型(与 i18n provider 的 t 同形,避免子模块重复实现取词) */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/**
 * 截止日:后端没给就按后端同一窗口推(创建时刻 + 30 天)。
 * 同窗口公式的另一处实现 = GET /study/plans 的 due(other/study-plan-routes.ts:46),
 * 那里直接产出 dueDate/deadline 字段;本端点没带上,故在端内按同一算法补,不另立窗口。
 */
export function deadlineOf(p: PlanItem): string {
  if (p.deadline) return p.deadline
  if (!p.createdAt) return ''
  const created = new Date(p.createdAt)
  if (Number.isNaN(created.getTime())) return ''
  return new Date(created.getTime() + 30 * 86400_000).toISOString().slice(0, 10)
}

/** 状态:由进度 / 截止日推出(三档均可达:进度 100 完成、超窗逾期、其余进行中)。 */
export function statusOf(p: PlanItem): PlanStatus {
  if (p.progress >= 100) return 'completed'
  const deadline = deadlineOf(p)
  if (deadline && deadline < new Date().toISOString().slice(0, 10)) return 'overdue'
  return 'active'
}

/** 徽章文案对齐 RN statusLabel(完成带 ✓),三档逐字沿用共享屏词条。 */
export function statusLabel(t: TranslateFn, status: PlanStatus): string {
  switch (status) {
    case 'completed':
      return `${t('studyPlan.status.completed')} ✓`
    case 'overdue':
      return t('studyPlan.status.overdue')
    default:
      return t('studyPlan.status.active')
  }
}

/** 徽章配色对齐 RN statusBadgeStyle:进行中 success.light / 完成 success.lighter / 逾期 danger。 */
export function statusClass(status: PlanStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-[var(--color-success-lighter)] text-[var(--color-success-deep-text)]'
    case 'overdue':
      return 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
    default:
      return 'bg-[var(--color-success-light)] text-success'
  }
}

/** 卡片脚:进度 / 截止时间(对齐 RN cardFoot 的可达两格;窄屏按 gap 换行,不压字)。 */
export function PlanFoot({ item, t }: { item: PlanItem; t: TranslateFn }) {
  return (
    <View className="flex flex-wrap justify-between items-center mt-[16rpx] gap-x-[16rpx] gap-y-[8rpx]">
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
