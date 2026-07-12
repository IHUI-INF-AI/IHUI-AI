import type { ExportColumn } from '@/lib/export-utils'
import type { CoursePay, CForm, CoursePaySearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:coursepay:'

export const payTypeText = (n: number) =>
  n === 0 ? 'payType.0' : n === 1 ? 'payType.1' : n === 2 ? 'payType.2' : String(n)

export const payCrowdText = (n: number) =>
  n === 0 ? 'payCrowd.0' : n === 1 ? 'payCrowd.1' : String(n)

export const EMPTY_FORM: CForm = { courseId: '', payType: '0', payCrowd: '0', amount: '0' }

export const EMPTY_SEARCH: CoursePaySearch = { payCrowd: '', creator: '' }

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'courseId', title: 'col.courseId' },
  { key: 'title', title: 'col.courseName' },
  { key: 'payType', title: 'col.payType', formatter: (v) => payTypeText(Number(v)) },
  { key: 'payCrowd', title: 'col.payCrowd', formatter: (v) => payCrowdText(Number(v)) },
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
