export interface DemandRow {
  id: string
  agentId: string
  agentName: string
  startName: string
  desc: string
  startTime: string
  examineTime: string
  status: string
  agentCategory?: Record<string, string>
  [k: string]: unknown
}

export interface ChatMsg {
  ques: string
  content: string
}

export interface WsChatMsg {
  type?: string
  event?: string
  data?: { content_type?: string; content?: string }
}

export interface ListData {
  list: DemandRow[]
  total: number
}
