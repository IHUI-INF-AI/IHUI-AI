// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface MenuItem {
  id: string
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
  [key: string]: unknown
}

export interface MenuForm {
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
}

export interface ListData {
  list: MenuItem[]
  total: number
}
