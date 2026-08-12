import * as React from 'react'
import { Card, CardContent } from './card'

/**
 * StatCard / StatGrid（2026-08-12 立）
 *
 * 用途：dashboard 数字展示卡片（label + value，部分带 icon / trend）。
 * 根因：原本只用 <Card><CardContent className="p-3 min-[640px]:p-3">{...}</CardContent></Card> 写 stat card，
 *       但 CardContent 默认值是 pt-0 + pb-p-6/4（响应式不对称），
 *       自定义 p-3 被 min-[640px]:p-6 覆盖、pt-0 没被覆盖，结果宽屏下 label 贴顶 + value 底 24px 空白。
 * 修复：在 CardContent 默认值去掉 pt-0 改为全对称 p-4/p-6，pb 同时用 CardHeader 的 pb-0 对冲 Header+Content 间距。
 *       本组件作为最佳实践封装，避免后续再踩坑。
 *
 * 用法：
 * <StatGrid cols={4}>
 *   <StatCard label="总任务" value={total} />
 *   <StatCard label="成功次数" value={success} variant="success" />
 *   <StatCard label="失败次数" value={failed} variant="danger" />
 *   <StatCard label="成功率" value={`${rate}%`} />
 * </StatGrid>
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 标签/标题,文字 text-xs text-muted-foreground */
  label: React.ReactNode
  /** 主数字/值,文字 text-2xl font-semibold tabular-nums */
  value: React.ReactNode
  /** 可选辅助文字(跟在 value 后面或下面,如百分号、单位) */
  hint?: React.ReactNode
  /** 颜色变体:default 文字色 | success 绿色 | danger 红色 | warning 橙色 */
  variant?: 'default' | 'success' | 'danger' | 'warning'
  /** icon:声明时显示在 label 前 */
  icon?: React.ReactNode
}

const VALUE_VARIANT: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
}

export function StatCard({
  label,
  value,
  hint,
  variant = 'default',
  icon,
  className,
  ...rest
}: StatCardProps) {
  return (
    <Card className={className} {...rest}>
      <CardContent className="flex flex-col gap-1 p-4 min-[640px]:p-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-semibold tabular-nums tracking-tight ${VALUE_VARIANT[variant]}`}>
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

export interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4
}

const STAT_GRID_COLS: Record<NonNullable<StatGridProps['cols']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export function StatGrid({ cols = 4, className, children, ...rest }: StatGridProps) {
  return (
    <div className={`grid gap-3 ${STAT_GRID_COLS[cols]} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  )
}
