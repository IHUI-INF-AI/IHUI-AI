export interface Organization {
  id: string
  uuid: string
  platformId: string
  name: string
  remark?: string
  filePath?: string
  binding?: string
  creator?: string
  createdAt: string
  updator?: string
}

export interface OrganizationForm {
  uuid: string
  platformId: string
  name: string
  remark: string
  filePath: string
  binding: string
}

export interface OrganizationSearch {
  platformId: string
  name: string
}
