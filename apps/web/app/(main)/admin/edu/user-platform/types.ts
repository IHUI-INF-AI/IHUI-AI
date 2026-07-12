export interface UserPlatform {
  id: string
  userUuid: string
  platformId: string
  identityId: string
  status: number
  isDel: number
  field1?: string
  createdAt: string
  updator?: string
}

export interface CForm {
  userUuid: string
  platformId: string
  identityId: string
  status: string
  isDel: string
  field1: string
}

export interface SearchQ {
  userUuid: string
  platformId: string
  identityId: string
  status: string
}
