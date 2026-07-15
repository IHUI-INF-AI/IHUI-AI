export interface Address {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

export type AddressInput = Omit<Address, 'id'>

export const EMPTY_ADDRESS: AddressInput = {
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
}
