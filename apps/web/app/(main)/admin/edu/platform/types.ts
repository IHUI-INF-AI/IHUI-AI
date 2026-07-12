export interface EduPlatform {
  id: string
  code: string
  name: string
  domain?: string
  remark?: string
  binding?: string
  filePath?: string
  type?: number
  status: number
  sort?: number
  creator?: string
  createdAt: string
  updator?: string
  field1?: string
  field2?: string
}

export interface CForm {
  code: string
  name: string
  domain: string
  remark: string
  binding: string
  filePath: string
  type: string
  status: boolean
  sort: string
  field1: string
  field2: string
}
