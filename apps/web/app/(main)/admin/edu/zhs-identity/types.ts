export interface ZhsIdentity {
  id: string
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId?: string
  remark?: string
  binding?: string
  isCross?: number
  creator?: string
  createdAt: string
  updator?: string
}

export interface CForm {
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId: string
  remark: string
  binding: string
  isCross: string
}

export interface Search {
  uuid: string
  name: string
  platformId: string
  organizationId: string
}
