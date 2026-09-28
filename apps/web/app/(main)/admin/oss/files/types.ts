// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface OssFile {
  id: string
  fileName: string
  size: number
  mimeType: string
  url: string | null
  uploadedBy: string
  createdAt: string
}

export interface FileListData {
  list: OssFile[]
  total: number
}
