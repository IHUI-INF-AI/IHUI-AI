// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface NotificationLog {
  id: string
  user_id: string
  type?: string
  title?: string
  content?: string
  channel?: string
  status?: string
  error_message?: string
  created_at: string
}

export interface ListData {
  list: NotificationLog[]
  total: number
}

export interface NotificationLogSearch {
  channel: string
  status: string
  startDate: string
  endDate: string
  userId: string
}
