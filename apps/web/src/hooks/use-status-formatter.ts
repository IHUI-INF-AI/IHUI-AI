'use client'

import * as React from 'react'

export type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusFormat {
  label: string
  tone: StatusTone
}

const STATUS_MAP: Record<string, StatusFormat> = {
  pending: { label: '待处理', tone: 'warning' },
  processing: { label: '处理中', tone: 'info' },
  success: { label: '成功', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  paid: { label: '已支付', tone: 'success' },
  unpaid: { label: '未支付', tone: 'warning' },
  refunded: { label: '已退款', tone: 'info' },
  active: { label: '有效', tone: 'success' },
  inactive: { label: '无效', tone: 'default' },
  expired: { label: '已过期', tone: 'danger' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
}

export interface UseStatusFormatterReturn {
  format: (status: string) => StatusFormat
  toneClass: (tone: StatusTone) => string
}

/** 状态格式化 Hook，将后端状态码统一映射为中文标签与语义色调 */
export function useStatusFormatter(): UseStatusFormatterReturn {
  const format = React.useCallback((status: string): StatusFormat => {
    return STATUS_MAP[status] ?? { label: status, tone: 'default' }
  }, [])

  const toneClass = React.useCallback((tone: StatusTone): string => {
    // 颜色体系与 src/lib/status-colors.ts 保持一致(emerald/amber/red/muted + dark 变体)
    const map: Record<StatusTone, string> = {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
      info: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    }
    return map[tone]
  }, [])

  return { format, toneClass }
}
