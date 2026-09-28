// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Student {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  signupCount: number
  learnHours: number
  createdAt: string
}

export interface SForm {
  nickname: string
  phone: string
  email: string
  password: string
  level: string
  status: number
}
