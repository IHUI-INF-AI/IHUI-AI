// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type CfgType = 'string' | 'number' | 'boolean' | 'json'

export interface EduSetting {
  id: string
  group: string
  key: string
  value?: string | null
  type: CfgType
  isPublic: boolean
  sort: number
  status: number
  description?: string | null
  credentials?: Record<string, unknown>
  updatedAt?: string
}

export interface EduSettingForm {
  group: string
  key: string
  value: string
  type: CfgType
  credentialsJson: string
  isPublic: boolean
  sort: number
  status: number
  description: string
}
