import type { PlatformLog, CForm, Search } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:courseplatformlog:'

export const EMPTY: CForm = {
  platformId: '',
  courseId: '',
  videoId: '',
  type: '0',
  creator: '',
  sysCreator: '',
  createdAt: '',
}

export const EMPTY_SEARCH: Search = {
  platformId: '',
  courseId: '',
  videoId: '',
  type: '',
  creator: '',
  createdAt: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'platformId', title: '平台ID' },
  { key: 'courseId', title: '课程ID' },
  { key: 'videoId', title: '视频ID' },
  { key: 'type', title: '类型' },
  { key: 'creator', title: '创建人' },
  { key: 'sysCreator', title: '系统创建人' },
  { key: 'createdAt', title: '创建时间' },
]

export const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export function platformLogToForm(r: PlatformLog): CForm {
  return {
    platformId: r.platformId,
    courseId: r.courseId,
    videoId: r.videoId,
    type: String(r.type),
    creator: r.creator,
    sysCreator: r.sysCreator,
    createdAt: r.createdAt ? r.createdAt.slice(0, 10) : '',
  }
}
