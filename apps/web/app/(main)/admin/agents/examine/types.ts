export interface Examine {
  id: string
  agentId: string
  agentName: string | null
  agentAvatar: string | null
  status: number
  startTime: string | null
  startPhone: string | null
  startName: string | null
  examineUser: string | null
  examineTime: string | null
  desc: string | null
  follow: string | null
  prologue: string | null
  reason: string | null
  createdAt: string
}

export interface ListData {
  list: Examine[]
  total: number
}

export interface ChatMsg {
  ques: string
  content: string
}

export interface ExamineForm {
  agentId: string
  agentName: string
  agentAvatar: string
  startTime: string
  startPhone: string
  startName: string
  examineUser: string
  examineTime: string
  desc: string
  follow: string
  prologue: string
  status: boolean
}
