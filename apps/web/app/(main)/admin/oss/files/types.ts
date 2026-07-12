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
