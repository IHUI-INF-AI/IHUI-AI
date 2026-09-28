// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
