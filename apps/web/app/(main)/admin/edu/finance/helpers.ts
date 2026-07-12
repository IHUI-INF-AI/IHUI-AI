import type { ExportColumn } from '@/lib/export-utils'
import type { CForm } from './types'

export const EMPTY: CForm = {
  userUuid: '',
  courseId: '',
  videoId: '',
  outBillOn: '',
  payWay: '',
  amount: '0',
  realAmount: '0',
}

export const PAGE_SIZE = 10
export const PERM = 'course:coursepaylog:'
export const API = '/api/admin/course-pay-log'

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'courseId', title: '课程ID' },
  { key: 'videoId', title: '视频ID' },
  { key: 'outBillOn', title: '账单日期' },
  { key: 'payWay', title: '支付方式' },
  { key: 'amount', title: '金额' },
  { key: 'realAmount', title: '实付金额' },
  { key: 'type', title: '类型' },
  { key: 'createdAt', title: '创建时间' },
]
