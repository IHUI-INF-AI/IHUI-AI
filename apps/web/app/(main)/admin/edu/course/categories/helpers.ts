import type { ExportColumn } from '@/lib/export-utils'
import type { CForm } from './types'

export const EMPTY: CForm = {
  code: '',
  name: '',
  prentId: '',
  typeId: '',
  img: '',
  butImg: '',
  isInvalid: '0',
  sort: '0',
}

export const PAGE_SIZE = 10
export const PERM = 'course:categorydictionary:'
export const API = '/api/admin/category-dictionary'

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'code', title: 'col.code' },
  { key: 'name', title: 'col.name' },
  { key: 'prentId', title: 'col.parentId' },
  { key: 'typeId', title: 'col.typeId' },
  { key: 'sort', title: 'col.sort' },
  { key: 'creator', title: 'col.creator' },
]
