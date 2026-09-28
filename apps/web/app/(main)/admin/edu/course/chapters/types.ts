// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Lesson {
  id: string
  title: string
}

export interface Section {
  id: string
  title: string
  duration: number
  isFree: boolean
}

export interface Chapter {
  id: string
  title: string
  sortOrder: number
  sections?: Section[]
}

export interface ChForm {
  title: string
  sortOrder: string
}
