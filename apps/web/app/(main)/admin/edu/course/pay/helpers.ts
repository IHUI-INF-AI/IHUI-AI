import type { ExportColumn } from '@/lib/export-utils'
import type { CoursePay, CForm, CoursePaySearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:coursepay:'

/** 付费类型 i18n key 静态映射表(数字枚值 0/1/2):payType.${num} — 用于消除 `t(`payType.${var}`)` 动态拼接 */
export const PAY_TYPE_KEY: Record<number, string> = {
  0: 'payType.0',
  1: 'payType.1',
  2: 'payType.2',
}

/** 付费人群 i18n key 静态映射表(数字枚值 0/1):payCrowd.${num} — 用于消除 `t(`payCrowd.${var}`)` 动态拼接 */
export const PAY_CROWD_KEY: Record<number, string> = {
  0: 'payCrowd.0',
  1: 'payCrowd.1',
}

export const EMPTY_FORM: CForm = { courseId: '', payType: '0', payCrowd: '0', amount: '0' }

export const EMPTY_SEARCH: CoursePaySearch = { payCrowd: '', creator: '' }

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'courseId', title: 'col.courseId' },
  { key: 'title', title: 'col.courseName' },
  { key: 'payType', title: 'col.payType', formatter: (v) => PAY_TYPE_KEY[Number(v)] ?? String(v) },
  { key: 'payCrowd', title: 'col.payCrowd', formatter: (v) => PAY_CROWD_KEY[Number(v)] ?? String(v) },
  { key: 'amount', title: 'col.amount' },
  { key: 'creator', title: 'col.creator' },
]

export function coursePayToForm(r: CoursePay): CForm {
  return {
    courseId: r.courseId,
    payType: String(r.payType),
    payCrowd: String(r.payCrowd),
    amount: r.amount,
  }
}
