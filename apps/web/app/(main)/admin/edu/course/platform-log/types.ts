// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface PlatformLog {
  id: string
  platformId: string
  courseId: string
  videoId: string
  type: number
  creator: string
  sysCreator: string
  createdAt: string
}

export interface CForm {
  platformId: string
  courseId: string
  videoId: string
  type: string
  creator: string
  sysCreator: string
  createdAt: string
}

export interface Search {
  platformId: string
  courseId: string
  videoId: string
  type: string
  creator: string
  createdAt: string
}
