export type OssConfigStatus = 'active' | 'shared' | 'recycled'

export interface OssConfig {
  id: string
  name: string
  provider: string
  endpoint: string
  bucket: string
  region: string
  accessKey: string
  status: OssConfigStatus
  isDefault: boolean
  description: string
  createdAt: string
  updatedAt: string
}

export interface OssConfigForm {
  name: string
  provider: string
  endpoint: string
  bucket: string
  region: string
  accessKey: string
  secretKey: string
  isDefault: boolean
  description: string
}

export interface OssConfigListData {
  list: OssConfig[]
  total: number
}
