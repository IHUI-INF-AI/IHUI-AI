export interface AiGcItem {
  id: string
  title: string
  subtitle: string
  context: string
  fileUrl: string
  fileType: string
  coverUrl: string
  type: string
  creator: string
  createdAt: string
}

export interface AiGcList {
  list: AiGcItem[]
  total: number
}
