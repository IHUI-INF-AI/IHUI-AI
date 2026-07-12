export type Driver = 'local' | 'aliyun-oss' | 'tencent-cos' | 'qiniu' | 's3' | 'minio'

export interface OssDriver {
  id: string
  name: string
  driver: Driver
  isEnabled: boolean
  isDefault: boolean
  sort: number
  description?: string | null
  config?: Record<string, unknown>
  credentials?: Record<string, unknown>
  updatedAt?: string
}

export interface OssForm {
  name: string
  driver: Driver
  isEnabled: boolean
  isDefault: boolean
  sort: number
  description: string
  credentialsJson: string
  configJson: string
}
