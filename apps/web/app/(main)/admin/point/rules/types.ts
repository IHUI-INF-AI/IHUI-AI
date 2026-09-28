// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Channel {
  id: string
  name: string
}

export interface Rule {
  id: string
  name: string
  code: string | null
  channelId: string | null
  point: number | null
  description: string | null
  sort: number
  status: number
  createdAt: string
}

export interface RulesData {
  list: Rule[]
  total: number
  page: number
  pageSize: number
}

export interface RuleForm {
  name: string
  code: string
  channelId: string
  point: string
  description: string
  sort: string
  status: boolean
}
