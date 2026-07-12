import type { ExportColumn } from '@/lib/export-utils'
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

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'platformId', title: 'col.platformId' },
  { key: 'courseId', title: 'col.courseId' },
  { key: 'videoId', title: 'col.videoId' },
  { key: 'type', title: 'col.type' },
  { key: 'creator', title: 'col.creator' },
  { key: 'sysCreator', title: 'col.systemCreator' },
  { key: 'createdAt', title: 'col.createdAt' },
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
