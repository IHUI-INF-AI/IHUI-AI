// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface UserPlatform {
  id: string
  userUuid: string
  platformId: string
  identityId: string
  status: number
  isDel: number
  field1?: string
  createdAt: string
  updator?: string
}

export interface CForm {
  userUuid: string
  platformId: string
  identityId: string
  status: string
  isDel: string
  field1: string
}

export interface SearchQ {
  userUuid: string
  platformId: string
  identityId: string
  status: string
}
