// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface DemandRow {
  id: string
  agentId: string
  agentName: string
  startName: string
  desc: string
  startTime: string
  examineTime: string
  status: string
  agentCategory?: Record<string, string>
  [k: string]: unknown
}

export interface ChatMsg {
  ques: string
  content: string
}

export interface WsChatMsg {
  type?: string
  event?: string
  data?: { content_type?: string; content?: string }
}

export interface ListData {
  list: DemandRow[]
  total: number
}
