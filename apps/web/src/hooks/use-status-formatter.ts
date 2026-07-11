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
    const map: Record<StatusTone, string> = {
      default: 'text-gray-500 bg-gray-100',
      success: 'text-green-600 bg-green-100',
      warning: 'text-yellow-600 bg-yellow-100',
      danger: 'text-red-600 bg-red-100',
      info: 'text-amber-600 bg-amber-100',
    }
    return map[tone]
  }, [])

  return { format, toneClass }
}
