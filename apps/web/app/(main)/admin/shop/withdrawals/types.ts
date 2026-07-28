import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass, textareaClass } from '@/lib/form-styles'
import type {
  AdminListData,
  WithdrawalFlowItem,
  WithdrawalItem,
} from '@ihui/types'

export { api, selectClass, textareaClass }

export type { WithdrawalItem, WithdrawalFlowItem }
export type { AdminListData as ListData } from '@ihui/types'

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

// 注:本地 inputSm 值与 @/lib/form-styles.ts 不同(此处等于 selectClass 完整串),
// 保留本地定义以维持现有视觉行为。
export const inputSm =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const CHANNEL_LABEL: Record<WithdrawalItem['channel'], string> = {
  alipay: '支付宝',
  wechat: '微信',
  bank: '银行卡',
}
export const STATUS_LABEL: Record<WithdrawalItem['status'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
  failed: '已失败',
}
export const STATUS_STYLE: Record<WithdrawalItem['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
}
export const FLOW_STATUS: Record<number, string> = { 0: '处理中', 1: '成功', 2: '失败' }
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

export const DETAIL_EXPORT = [
  { key: 'id', title: 'ID' },
  { key: 'user', title: '用户' },
  { key: 'amount', title: '金额(分)' },
  { key: 'channel', title: '渠道' },
  { key: 'account', title: '账户' },
  { key: 'status', title: '状态' },
  { key: 'reviewer', title: '审核人' },
  { key: 'createdAt', title: '申请时间' },
]
export const FLOW_EXPORT = [
  { key: 'id', title: 'ID' },
  { key: 'userId', title: '用户ID' },
  { key: 'amount', title: '金额(分)' },
  { key: 'outBillNo', title: '外部单号' },
  { key: 'status', title: '状态' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updatedAt', title: '更新时间' },
  { key: 'transferDetail', title: '转账详情' },
]
