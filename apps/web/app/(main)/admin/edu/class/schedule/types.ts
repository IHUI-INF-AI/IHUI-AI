// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Schedule {
  id: string
  classId: string
  className: string | null
  title: string
  teacherName: string | null
  startTime: string
  endTime: string
  location: string | null
  status: string
}

export interface SForm {
  classId: string
  title: string
  teacherName: string
  startTime: string
  endTime: string
  location: string
}
