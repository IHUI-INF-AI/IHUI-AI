// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Course {
  id: string
  title: string
  subtitle?: string
  content?: string
  remark?: string
  remarkFile?: string
  binding?: string
  stage?: number
  label?: string
  auditStatus?: number
  creator?: string
  nickname?: string
}

export interface CForm {
  title: string
  subtitle: string
  content: string
  remark: string
  remarkFile: string
  binding: string
  stage: string
  label: string
  creator: string
}
