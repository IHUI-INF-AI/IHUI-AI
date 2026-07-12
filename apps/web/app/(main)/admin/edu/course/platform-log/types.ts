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
