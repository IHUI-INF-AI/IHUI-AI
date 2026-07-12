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
  { key: 'userUuid', title: 'col.userUuid' },
  { key: 'courseId', title: 'col.courseId' },
  { key: 'videoId', title: 'col.videoId' },
  { key: 'outBillOn', title: 'col.billDate' },
  { key: 'payWay', title: 'col.payMethod' },
  { key: 'amount', title: 'col.amount' },
  { key: 'realAmount', title: 'col.paidAmount' },
  { key: 'type', title: 'col.type' },
  { key: 'createdAt', title: 'col.createdAt' },
]
