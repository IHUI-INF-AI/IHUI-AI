// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Homework {
  id: string
  title: string
  description: string | null
  lessonTitle: string | null
  dueDate: string | null
  status: string
  submitCount: number
}

export interface HForm {
  title: string
  description: string
  lessonId: string
  dueDate: string
  status: string
}
