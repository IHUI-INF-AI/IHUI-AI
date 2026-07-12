export interface ApiPackage {
  id: string
  name: string
  price: number
  quota: number
  period: 'month' | 'year' | 'permanent'
  description: string | null
  status: number
  createdAt: string
}

export interface ApiPackageForm {
  name: string
  price: string
  quota: string
  period: ApiPackage['period']
  description: string
}
