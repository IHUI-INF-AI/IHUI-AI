// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Remind {
  id: string
  userId: string
  userName: string | null
  title: string
  content: string | null
  remindAt: string
  type: string
  isRead: boolean
}

export interface RForm {
  title: string
  userId: string
  content: string
  remindAt: string
  type: string
  isRead: boolean
}
