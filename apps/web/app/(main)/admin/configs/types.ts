// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type Category = 'general' | 'mail' | 'storage' | 'security' | 'payment' | 'ai' | 'system'
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
