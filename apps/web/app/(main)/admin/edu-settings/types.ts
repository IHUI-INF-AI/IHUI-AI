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
