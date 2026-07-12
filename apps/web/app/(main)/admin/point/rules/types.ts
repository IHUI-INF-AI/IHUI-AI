export interface Channel {
  id: string
  name: string
}

export interface Rule {
  id: string
  name: string
  code: string | null
  channelId: string | null
  point: number | null
  description: string | null
  sort: number
  status: number
  createdAt: string
}

export interface RulesData {
  list: Rule[]
  total: number
  page: number
  pageSize: number
}

export interface RuleForm {
  name: string
  code: string
  channelId: string
  point: string
  description: string
  sort: string
  status: boolean
}
