// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { FileItem } from '@/components/workspace/file-list'

export interface ProjectDetail {
  id: string
  name: string
  description: string
  updatedAt: string
}

export interface PreviewState {
  file: FileItem
  url: string | null
  loading: boolean
}
