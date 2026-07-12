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
