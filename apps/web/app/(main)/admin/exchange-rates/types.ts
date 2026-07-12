export interface ExchangeRate {
  id: number
  fromCurrency: string
  toCurrency: string
  rate: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface ExchangeRateForm {
  fromCurrency: string
  toCurrency: string
  rate: string
  status: number
}
