import { fetchApi } from '@/lib/api'
import type { Channel, ChannelForm, ChannelsData } from './types'

export const PAGE_SIZE = 20

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchChannels(params: { page: number; search: string }): Promise<ChannelsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<ChannelsData>(`/api/admin/edu-points/channels?${qs.toString()}`)
}

export const EMPTY_FORM: ChannelForm = {
  name: '',
  code: '',
  description: '',
  sort: '0',
  status: true,
}

export function channelToForm(channel: Channel): ChannelForm {
  return {
    name: channel.name,
    code: channel.code ?? '',
    description: channel.description ?? '',
    sort: String(channel.sort),
    status: channel.status === 1,
  }
}
