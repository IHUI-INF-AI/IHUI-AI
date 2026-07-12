import type { TaskDeveloperForm } from './types'

export const RESOURCE = '/api/admin/task-developer'
export const PERM = 'ai:taskdeveloper'
export const PERMS = {
  add: `${PERM}:add`,
  edit: `${PERM}:edit`,
  remove: `${PERM}:remove`,
  export: `${PERM}:export`,
}

export const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: '待接单', cls: 'bg-amber-500/10 text-amber-600' },
  1: { label: '进行中', cls: 'bg-blue-500/10 text-blue-600' },
  2: { label: '已完成', cls: 'bg-emerald-500/10 text-emerald-600' },
  3: { label: '已取消', cls: 'bg-red-500/10 text-red-600' },
  4: { label: '已超时', cls: 'bg-gray-500/10 text-gray-600' },
}

export const FIELDS: { key: keyof TaskDeveloperForm; label: string; type?: 'number' }[] = [
  { key: 'taskId', label: '任务ID' },
  { key: 'accept', label: '接单人' },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'discount', label: '折扣', type: 'number' },
  { key: 'realAmount', label: '实付', type: 'number' },
  { key: 'nodes', label: '节点' },
  { key: 'publisher', label: '发布者' },
  { key: 'creator', label: '创建者' },
]

export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'taskId', label: '任务ID' },
  { key: 'accept', label: '接单人' },
  { key: 'amount', label: '金额' },
  { key: 'nodes', label: '节点' },
  { key: 'publisher', label: '发布者' },
  { key: 'creator', label: '创建者' },
]

export const EXPORT_COLS = [
  { key: 'taskId', title: '任务ID' },
  { key: 'accept', title: '接单人' },
  { key: 'amount', title: '金额' },
  { key: 'discount', title: '折扣' },
  { key: 'realAmount', title: '实付' },
  { key: 'nodes', title: '节点' },
  { key: 'status', title: '状态' },
  { key: 'publisher', title: '发布者' },
  { key: 'creator', title: '创建者' },
  { key: 'createdAt', title: '创建时间' },
]

export const EMPTY_FORM: TaskDeveloperForm = {
  taskId: '',
  accept: '',
  amount: '0',
  discount: '0',
  realAmount: '0',
  nodes: '',
  publisher: '',
  creator: '',
}

export const TH_CLS = 'px-4 py-2.5 font-medium'

export function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}
