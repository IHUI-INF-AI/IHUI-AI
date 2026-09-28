// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface UserResult {
  id: string
  nickname: string
  avatar?: string
  bio?: string
}
export interface ProjectResult {
  id: string
  name: string
  description: string
  fileCount: number
  updatedAt: string
}
export interface FileResult {
  id: string
  name: string
  size: number
  mimeType: string
  projectId: string
  createdAt: string
  projectName?: string | null
}
export interface SearchResults {
  users: UserResult[]
  projects: ProjectResult[]
  files: FileResult[]
}

export type TabKey = 'all' | 'user' | 'project' | 'file'
export type SortKey = 'relevance' | 'time' | 'name' | 'size'
