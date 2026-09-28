// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface AgentTask {
  id: string
  title: string | null
  context: string | null
  createdName: string | null
  closingTime: string | null
  cycle: string | null
  cycleUnit: string | null
  lowestPrice: string | null
  peakPrice: string | null
  status: number
  remark: string | null
  createdAt: string | null
}

export interface ListData {
  list: AgentTask[]
  total: number
}

export interface AgentTaskForm {
  title: string
  context: string
  lowestPrice: string
  peakPrice: string
  cycle: string
  cycleUnit: string
  closingTime: string
}
