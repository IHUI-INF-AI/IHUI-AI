export type Category = 'general' | 'mail' | 'storage' | 'security' | 'payment' | 'ai' | 'system'
export type CfgType = 'string' | 'number' | 'boolean' | 'json'

export interface SystemConfig {
  id: string
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description: string | null
  updatedAt: string | null
}

export interface SystemConfigForm {
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description: string
}
