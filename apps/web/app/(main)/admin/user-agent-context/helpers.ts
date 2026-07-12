import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { UserAgentContext, UserAgentContextForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: UserAgentContextForm = {
  agentId: '',
  userUuid: '',
  problem: '',
  answer: '',
  userUrl: '',
  agentUrl: '',
  sendTime: '',
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'agentId', title: 'AgentID' },
  { key: 'agentName', title: 'Agent名称' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'userName', title: '用户名' },
  { key: 'problem', title: '问题' },
  { key: 'answer', title: '回答' },
  { key: 'userUrl', title: '用户URL' },
  { key: 'agentUrl', title: 'AgentURL' },
  { key: 'sendTime', title: '发送时间' },
]

export function userAgentContextToForm(item: UserAgentContext): UserAgentContextForm {
  return {
    agentId: item.agentId ?? '',
    userUuid: item.userUuid ?? '',
    problem: item.problem ?? '',
    answer: item.answer ?? '',
    userUrl: item.userUrl ?? '',
    agentUrl: item.agentUrl ?? '',
    sendTime: item.sendTime ?? '',
  }
}
