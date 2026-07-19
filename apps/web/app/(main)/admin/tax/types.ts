export type TaxStatus = 'active' | 'disabled'

export interface TaxRule {
  id: string
  name: string
  category: string
  rate: number
  threshold: number
  description: string | null
  status: TaxStatus
  effectiveAt: string | null
  createdAt: string | null
}

export interface TaxListData {
  list: TaxRule[]
  total: number
}
