import type { ExportColumn } from '@/lib/export-utils'
import type { CoursePay, CForm, CoursePaySearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:coursepay:'

export const payTypeText = (n: number) =>
  n === 0 ? '免费' : n === 1 ? '限免' : n === 2 ? '付费' : String(n)

export const payCrowdText = (n: number) => (n === 0 ? '全部' : n === 1 ? '会员' : String(n))

export const EMPTY_FORM: CForm = { courseId: '', payType: '0', payCrowd: '0', amount: '0' }

export const EMPTY_SEARCH: CoursePaySearch = { payCrowd: '', creator: '' }

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'courseId', title: '课程ID' },
  { key: 'title', title: '课程名称' },
  { key: 'payType', title: '付费类型', formatter: (v) => payTypeText(Number(v)) },
  { key: 'payCrowd', title: '付费人群', formatter: (v) => payCrowdText(Number(v)) },
  { key: 'amount', title: '金额' },
  { key: 'creator', title: '创建人' },
]

export function coursePayToForm(r: CoursePay): CForm {
  return {
    courseId: r.courseId,
    payType: String(r.payType),
    payCrowd: String(r.payCrowd),
    amount: r.amount,
  }
}
