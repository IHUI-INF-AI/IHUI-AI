// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type Scope = 'none' | 'self' | 'team' | 'org' | 'all'

export interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  scope: Scope
  isSystem: boolean
  createdAt: string
  permissionsCount?: number
}

export interface RoleForm {
  name: string
  displayName: string
  description: string
  scope: Scope
}
