import { fetchApi } from '@/lib/api'
import { TONE } from '@/lib/status-colors'
import type { ExamineForm, Examine } from './types'

export const PAGE_SIZE = 10
export const WS_URL = process.env.NEXT_PUBLIC_WS_CHAT_URL || '/ws/chat'

export const STATUS_MAP: Record<number, string> = { 0: '待提交', 1: '审核中', 2: '已通过' }

export const STATUS_STYLE: Record<number, string> = {
  0: TONE.amber,
  1: TONE.amber,
  2: TONE.emerald,
}

export const EMPTY_FORM: ExamineForm = {
  agentId: '',
  agentName: '',
  agentAvatar: '',
  startTime: '',
  startPhone: '',
  startName: '',
  examineUser: '',
  examineTime: '',
  desc: '',
  follow: '',
  prologue: '',
  status: true,
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'agentName', title: 'Agent名称' },
  { key: 'status', title: '状态', formatter: (v: unknown) => STATUS_MAP[v as number] ?? '-' },
  { key: 'startTime', title: '开始时间' },
  { key: 'startPhone', title: '联系电话' },
  { key: 'startName', title: '联系人' },
  { key: 'examineUser', title: '审核人' },
  { key: 'desc', title: '描述' },
  { key: 'follow', title: '关注' },
  { key: 'prologue', title: '开场白' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function formFromItem(item: Examine): ExamineForm {
  return {
    agentId: item.agentId,
    agentName: item.agentName ?? '',
    agentAvatar: item.agentAvatar ?? '',
    startTime: item.startTime ?? '',
    startPhone: item.startPhone ?? '',
    startName: item.startName ?? '',
    examineUser: item.examineUser ?? '',
    examineTime: item.examineTime ?? '',
    desc: item.desc ?? '',
    follow: item.follow ?? '',
    prologue: item.prologue ?? '',
    status: item.status === 1,
  }
}
