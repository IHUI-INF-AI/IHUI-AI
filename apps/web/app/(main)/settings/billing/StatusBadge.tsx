'use client'

import { cn } from '@/lib/utils'
import { STATUS_CLS } from './helpers'

/**
 * i18n 静态映射表 — 用于消除 prefix.status 形式的动态拼接
 * 嵌套结构:prefix → status → 完整 i18n key
 * 已知 prefix:billingOrderStatus / billingInvoiceStatus
 * 已知 status:STATUS_CLS 全部 10 个枚值
 * 未知组合兜底 'status.unknown'
 */
const STATUS_LABEL_KEY: Record<string, Record<string, string>> = {
  billingOrderStatus: {
    pending: 'billingOrderStatus.pending',
    paid: 'billingOrderStatus.paid',
    cancelled: 'billingOrderStatus.cancelled',
    refunding: 'billingOrderStatus.refunding',
    refunded: 'billingOrderStatus.refunded',
    completed: 'billingOrderStatus.completed',
    failed: 'billingOrderStatus.failed',
    processing: 'billingOrderStatus.processing',
    issued: 'billingOrderStatus.issued',
    rejected: 'billingOrderStatus.rejected',
  },
  billingInvoiceStatus: {
    pending: 'billingInvoiceStatus.pending',
    paid: 'billingInvoiceStatus.paid',
    cancelled: 'billingInvoiceStatus.cancelled',
    refunding: 'billingInvoiceStatus.refunding',
    refunded: 'billingInvoiceStatus.refunded',
    completed: 'billingInvoiceStatus.completed',
    failed: 'billingInvoiceStatus.failed',
    processing: 'billingInvoiceStatus.processing',
    issued: 'billingInvoiceStatus.issued',
    rejected: 'billingInvoiceStatus.rejected',
  },
}

interface Props {
  status: string
  prefix: string
  t: (k: string) => string
}

export function StatusBadge({ status, prefix, t }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        STATUS_CLS[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {t(STATUS_LABEL_KEY[prefix]?.[status] ?? 'status.unknown')}
    </span>
  )
}
