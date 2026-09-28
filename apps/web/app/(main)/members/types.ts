// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface MemberItem {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  gender: number
  status: number
  levelId: string | null
  growthValue: number
  createdAt: string | null
}

export interface MembersData {
  list: MemberItem[]
  total: number
  page: number
  pageSize: number
}

export interface LevelItem {
  id: string
  name: string
}
