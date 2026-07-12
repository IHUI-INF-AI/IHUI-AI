export interface AuthVeriCode {
  id: string
  userId: string
  phone: string
  code: string
  type?: string
  platform?: string
  ip?: string
  expiresAt?: string
  used?: string | number
  usedAt?: string
  createdAt?: string
}

export interface ListData {
  list: AuthVeriCode[]
  total: number
}

export interface AuthVeriCodeSearch {
  userId: string
  phone: string
  platform: string
}

export interface AuthVeriCodeForm {
  userId: string
  phone: string
  code: string
  type: string
  platform: string
  ip: string
  expiresAt: string
  used: string
  usedAt: string
  createdAt: string
}
