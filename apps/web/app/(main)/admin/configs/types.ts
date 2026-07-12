export type Category = 'general' | 'mail' | 'storage' | 'security' | 'payment' | 'ai'
export type CfgType = 'string' | 'number' | 'boolean' | 'json'

export interface Config {
  id: string
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description?: string
  updatedAt?: string
}

export interface ConfigForm {
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description: string
}
