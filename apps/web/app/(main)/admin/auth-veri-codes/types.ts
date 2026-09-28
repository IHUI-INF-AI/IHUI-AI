// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface AuthVeriCode {
  id: string
  userId: string
  phone: string
  code: string
  type?: string
  platform?: string
  ip?: string
  expiresAt?: string
  used?: string | number
  usedAt?: string
  createdAt?: string
}

export interface ListData {
  list: AuthVeriCode[]
  total: number
}

export interface AuthVeriCodeSearch {
  userId: string
  phone: string
  platform: string
}

export interface AuthVeriCodeForm {
  userId: string
  phone: string
  code: string
  type: string
  platform: string
  ip: string
  expiresAt: string
  used: string
  usedAt: string
  createdAt: string
}
