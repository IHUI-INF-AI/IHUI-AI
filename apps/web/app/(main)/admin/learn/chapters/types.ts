// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Lesson {
  id: string
  title: string
  isPublished: boolean
}

export interface Chapter {
  id: string
  lessonId: string
  title: string
  sortOrder: number
  createdAt: string
}

export interface LessonsData {
  list: Lesson[]
  total: number
}

export interface ChaptersData {
  list: Chapter[]
}

export interface ChapterForm {
  title: string
  sortOrder: string
}
