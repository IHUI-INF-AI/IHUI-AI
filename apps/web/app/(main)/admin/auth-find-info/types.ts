// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface AuthFindInfo {
  id: string
  userUuid: string
  card: string
  belong?: string
  title?: string
  message?: string
  createdAt?: string
}

export interface ListData {
  list: AuthFindInfo[]
  total: number
}

export interface AuthFindInfoForm {
  userUuid: string
  card: string
  belong: string
  title: string
  message: string
  createdAt: string
}

export interface AuthFindInfoSearch {
  userUuid: string
  card: string
}
