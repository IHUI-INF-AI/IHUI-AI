export interface Channel {
  id: string
  name: string
  code: string | null
  description: string | null
  sort: number
  status: number
  createdAt: string
}

export interface ChannelsData {
  list: Channel[]
  total: number
  page: number
  pageSize: number
}

export interface ChannelForm {
  name: string
  code: string
  description: string
  sort: string
  status: boolean
}
