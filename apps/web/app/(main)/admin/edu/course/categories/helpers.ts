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
  { key: 'code', title: '编码' },
  { key: 'name', title: '名称' },
  { key: 'prentId', title: '父ID' },
  { key: 'typeId', title: '类型ID' },
  { key: 'sort', title: '排序' },
  { key: 'creator', title: '创建人' },
]
