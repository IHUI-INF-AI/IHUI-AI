import type { ExportColumn } from '@/lib/export-utils'
import type { CozeForm } from './types'

export const COZE_STATUS: Record<number, string> = { 0: '未使用', 1: '使用中', 2: '已过期' }

export const COZE_STATUS_CLASS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  2: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

export const EMPTY_COZE: CozeForm = {
  cozeId: '',
  signAccount: '',
  signPassword: '',
  signNickname: '',
  platform: 'coze',
  address: '',
  status: '0',
}

export const COZE_PAGE_SIZE = 10

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const COZE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'cozeId', title: 'Coze ID' },
  { key: 'signAccount', title: '签权账号' },
  { key: 'signNickname', title: '签权昵称' },
  { key: 'platform', title: '平台' },
  { key: 'address', title: '地址' },
  { key: 'status', title: '状态', formatter: (v) => COZE_STATUS[Number(v)] ?? String(v) },
  { key: 'creator', title: '创建人' },
  { key: 'createdAt', title: '创建时间' },
]
