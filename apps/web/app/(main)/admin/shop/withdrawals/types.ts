import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass, textareaClass } from '@/lib/form-styles'
import type { WithdrawalFlowItem, WithdrawalItem } from '@ihui/types'

export { api, selectClass, textareaClass }

export type { WithdrawalItem, WithdrawalFlowItem }
export type { AdminListData as ListData } from '@ihui/types'

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

// 注:本地 inputSm 值与 @/lib/form-styles.ts 不同(此处等于 selectClass 完整串),
// 保留本地定义以维持现有视觉行为。
export const inputSm =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const CHANNEL_LABEL: Record<WithdrawalItem['channel'], string> = {
  alipay: 'withdrawals.channel.alipay',
  wechat: 'withdrawals.channel.wechat',
  bank: 'withdrawals.channel.bank',
}
export const STATUS_LABEL: Record<WithdrawalItem['status'], string> = {
  pending: 'withdrawals.status.pending',
  approved: 'withdrawals.status.approved',
  rejected: 'withdrawals.status.rejected',
  completed: 'withdrawals.status.completed',
  failed: 'withdrawals.status.failed',
}
export const STATUS_STYLE: Record<WithdrawalItem['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
}
export const FLOW_STATUS: Record<number, string> = {
  0: 'withdrawals.flowStatus.processing',
  1: 'withdrawals.flowStatus.success',
  2: 'withdrawals.flowStatus.failed',
}
export const FLOW_STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600',
  1: 'bg-emerald-500/10 text-emerald-600',
  2: 'bg-red-500/10 text-red-600',
}

export const EMPTY_DETAIL = {
  user: '',
  amount: '',
  channel: 'alipay' as WithdrawalItem['channel'],
  account: '',
  status: 'pending' as WithdrawalItem['status'],
}
export const EMPTY_FLOW = {
  userId: '',
  amount: '',
  outBillNo: '',
  status: '0',
  transferDetail: '',
}

export function getDetailExport(t: (key: string) => string) {
  return [
    { key: 'id', title: t('withdrawals.detail.export.id') },
    { key: 'user', title: t('withdrawals.detail.export.user') },
    { key: 'amount', title: t('withdrawals.detail.export.amount') },
    { key: 'channel', title: t('withdrawals.detail.export.channel') },
    { key: 'account', title: t('withdrawals.detail.export.account') },
    { key: 'status', title: t('withdrawals.detail.export.status') },
    { key: 'reviewer', title: t('withdrawals.detail.export.reviewer') },
    { key: 'createdAt', title: t('withdrawals.detail.export.createdAt') },
  ]
}
export function getFlowExport(t: (key: string) => string) {
  return [
    { key: 'id', title: t('withdrawals.flow.export.id') },
    { key: 'userId', title: t('withdrawals.flow.export.userId') },
    { key: 'amount', title: t('withdrawals.flow.export.amount') },
    { key: 'outBillNo', title: t('withdrawals.flow.export.outBillNo') },
    { key: 'status', title: t('withdrawals.flow.export.status') },
    { key: 'createdAt', title: t('withdrawals.flow.export.createdAt') },
    { key: 'updatedAt', title: t('withdrawals.flow.export.updatedAt') },
    { key: 'transferDetail', title: t('withdrawals.flow.export.transferDetail') },
  ]
}
