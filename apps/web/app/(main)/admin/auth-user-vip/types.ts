// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface AuthUserVip {
  id: string
  userUuid: string
  vipId: string
  progress?: string
  creator?: string
  createdTime?: string
  isValid?: string | number
}

export interface AuthUserVipSearch {
  userUuid: string
  vipId: string
  progress: string
  isValid: string
}

export interface AuthUserVipForm {
  userUuid: string
  vipId: string
  progress: string
  creator: string
  createdTime: string
  isValid: string
}

export interface ListData {
  list: AuthUserVip[]
  total: number
}
