export interface Agreement {
  id: string
  type: string
  title: string
  content: string
  version: string
  effectiveDate: string
  status: number
}

export interface AgreementForm {
  type: string
  title: string
  content: string
  version: string
  effectiveDate: string
  status: number
}
