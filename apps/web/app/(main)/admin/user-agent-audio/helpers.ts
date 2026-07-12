import { fetchApi } from '@/lib/api'
import type { UserAgentAudio, UserAgentAudioForm, UserAgentAudioSearch } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: UserAgentAudioForm = {
  uuid: '',
  audioId: '',
  agentId: '',
  audioPath: '',
  source: '',
  platform: '',
}

export const EMPTY_SEARCH: UserAgentAudioSearch = {
  uuid: '',
  audioId: '',
  agentId: '',
  source: '',
  platform: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'uuid', title: '用户UUID' },
  { key: 'audioId', title: '音频ID' },
  { key: 'agentId', title: 'AgentID' },
  { key: 'audioPath', title: '音频路径' },
  { key: 'source', title: '来源' },
  { key: 'platform', title: '平台' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updateAt', title: '更新时间' },
]

export function audioToForm(item: UserAgentAudio): UserAgentAudioForm {
  return {
    uuid: item.uuid ?? '',
    audioId: item.audioId ?? '',
    agentId: item.agentId ?? '',
    audioPath: item.audioPath ?? '',
    source: item.source ?? '',
    platform: item.platform ?? '',
  }
}
