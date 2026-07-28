import { unwrapApi as api } from '@/lib/api-helpers'

export { api }

export type { InvoiceTitle, InvoiceTitlesData as TitlesData } from '@ihui/types'

export interface TitleForm {
  titleName: string
  taxNo: string
  titleType: 'company' | 'personal'
  bankName: string
  bankAccount: string
  address: string
  phone: string
  isDefault: boolean
}

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

export const EMPTY_FORM: TitleForm = {
  titleName: '',
  taxNo: '',
  titleType: 'company',
  bankName: '',
  bankAccount: '',
  address: '',
  phone: '',
  isDefault: false,
}
