// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Paper {
  id: string
  title: string
}

export interface Arrangement {
  id: string
  paperId: string
  paperTitle?: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}

export interface AForm {
  paperId: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}
