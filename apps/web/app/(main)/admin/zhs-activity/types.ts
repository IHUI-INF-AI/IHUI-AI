// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface ZhsActivity {
  id: string
  activityName: string | null
  activityRule: string | null
  activityRecharge: string | null
  beginAmount: string | null
  multiple: string | null
  computing: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

export interface ListData {
  list: ZhsActivity[]
  total: number
}

export interface ZhsActivityForm {
  activityName: string
  activityRule: string
  activityRecharge: string
  beginAmount: string
  multiple: string
  computing: string
  beginTime: string
  endTime: string
  status: boolean
}
